import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANALES_IPC } from '@shared/types/ipc'
import type { ResultadoCuenta, Usuario } from '@shared/types/cuenta'
import { preferencias, sesionNueva } from '@shared/cocina/fixtures.test-utils'
import { abrirBase } from './db/conexion'
import { guardarSesion } from './db/sesiones'
import { cargarSemilla, leerSemilla } from './db/semillas'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))
import { registrarIpc } from './ipc'
import type { Cuenta } from './cuenta'

afterEach(() => handle.mockClear())

/** Cuenta simulada con sesión de `u1` (o sin sesión). */
function cuentaFalsa(
  usuario: Usuario | null = { id: 'u1', nombre: 'Ana', email: 'a@x.es' }
): Cuenta {
  const estado = { usuario, sinConexion: false }
  const ok = vi.fn().mockResolvedValue({ ok: true, estado })
  return {
    iniciar: vi.fn().mockResolvedValue(estado),
    estado: () => estado,
    token: () => (estado.usuario ? 'tok' : null),
    registrar: ok,
    verificar: ok,
    reenviarCodigo: ok,
    entrar: ok,
    salir: vi.fn(async (): Promise<ResultadoCuenta> => {
      estado.usuario = null
      return { ok: true, estado }
    }),
    recuperar: ok,
    restablecer: ok,
    caducada: vi.fn()
  }
}

describe('voz:token IPC', () => {
  it('construye el contexto del chat desde la base y rechaza contexto o pantalla adulterados', async () => {
    const db = abrirBase(':memory:')
    const conversar = vi.fn().mockResolvedValue({
      contenido: { role: 'model', parts: [{ text: 'Hola' }] },
      simulado: true
    })
    try {
      cargarSemilla(db, leerSemilla())
      registrarIpc(
        db,
        { pedirTokenVoz: vi.fn(), narrar: vi.fn(), conversar },
        { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() },
        { leer: vi.fn(), detener: vi.fn() },
        cuentaFalsa()
      )
      const handler = handle.mock.calls.find(([c]) => c === CANALES_IPC.chefConversar)![1] as (
        _e: unknown,
        d: unknown
      ) => Promise<unknown>
      const datos = {
        pantalla: 'preparar',
        preferencias: preferencias(),
        mensajes: [{ role: 'user', parts: [{ text: 'Tengo pollo' }] }]
      }
      await expect(handler({}, { ...datos, contexto: 'inventado' })).rejects.toThrow()
      await expect(handler({}, { ...datos, pantalla: 'cocinar' })).rejects.toThrow('No hay')
      await handler({}, datos)
      expect(JSON.parse(conversar.mock.calls[0]![0].contexto).catalogo).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'pollo_muslo' })])
      )
      expect(JSON.parse(conversar.mock.calls[0]![0].contexto).recetas).toEqual([])
      guardarSesion(db, sesionNueva(), 'u1')
      await handler({}, { ...datos, pantalla: 'cocinar' })
      expect(conversar.mock.calls[1]![0].contexto).toContain('paso_actual:')
    } finally {
      db.close()
    }
  })
  it('limita PCM, asocia la captura a la ventana y libera al terminar la receta', async () => {
    const db = abrirBase(':memory:')
    const voz = {
      iniciar: vi.fn().mockResolvedValue({ ok: true }),
      reconocer: vi.fn().mockResolvedValue({ texto: 'siguiente', confianza: 1 }),
      reset: vi.fn().mockResolvedValue(undefined),
      detener: vi.fn()
    }
    const lector = { leer: vi.fn().mockResolvedValue({ ok: true }), detener: vi.fn() }
    const evento = { sender: { id: 1, once: vi.fn() } }
    try {
      cargarSemilla(db, leerSemilla())
      registrarIpc(
        db,
        { pedirTokenVoz: vi.fn(), narrar: vi.fn(), conversar: vi.fn() },
        voz,
        lector,
        cuentaFalsa()
      )
      const handler = (canal: string): ((evento: unknown, dato: unknown) => Promise<unknown>) =>
        handle.mock.calls.find(([c]) => c === canal)![1]
      await expect(handler(CANALES_IPC.vozIniciar)(evento, {})).rejects.toThrow('cocinas')
      guardarSesion(db, sesionNueva(), 'u1')
      await handler(CANALES_IPC.vozIniciar)(evento, {})
      await handler(CANALES_IPC.vozIniciar)(evento, {})
      expect(evento.sender.once).toHaveBeenCalledOnce()
      await expect(
        handler(CANALES_IPC.vozReconocer)(evento, new ArrayBuffer(6402))
      ).rejects.toThrow()
      await expect(handler(CANALES_IPC.vozReconocer)(evento, new ArrayBuffer(3))).rejects.toThrow()
      expect(
        await handler(CANALES_IPC.vozReconocer)({ sender: { id: 2 } }, new ArrayBuffer(3200))
      ).toBeNull()
      expect(await handler(CANALES_IPC.vozReconocer)(evento, new ArrayBuffer(3200))).toMatchObject({
        texto: 'siguiente'
      })
      await handler(CANALES_IPC.vozRepetir)(evento, {})
      expect(lector.leer).toHaveBeenCalledWith(expect.stringContaining('Pica'))
      await handler(CANALES_IPC.sesionAplicar)(evento, {
        nombre: 'ir_a_paso',
        argumentos: { orden: 9 },
        confirmado: false
      })
      await handler(CANALES_IPC.sesionAplicar)(evento, {
        nombre: 'terminar_receta',
        argumentos: {},
        confirmado: true
      })
      expect(voz.detener).toHaveBeenCalledOnce()
      expect(lector.detener).toHaveBeenCalledOnce()
    } finally {
      db.close()
    }
  })
  it('valida cuerpo vacío y no pide tokens fuera de cocinar', async () => {
    const db = abrirBase(':memory:')
    const pedirTokenVoz = vi.fn().mockResolvedValue({
      ok: true,
      credencial: { token: 'falso_test', expiraEn: new Date().toISOString() }
    })
    try {
      cargarSemilla(db, leerSemilla())
      registrarIpc(
        db,
        { pedirTokenVoz, narrar: vi.fn(), conversar: vi.fn() },
        { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() },
        { leer: vi.fn(), detener: vi.fn() },
        cuentaFalsa()
      )
      const handler = handle.mock.calls.find(([canal]) => canal === CANALES_IPC.vozToken)![1] as (
        _evento: unknown,
        datos: unknown
      ) => Promise<unknown>
      await expect(handler(null, { url: 'http://atacante' })).rejects.toThrow()
      expect(await handler(null, {})).toMatchObject({
        ok: false,
        error: { codigo: 'fase_incorrecta' }
      })
      expect(pedirTokenVoz).not.toHaveBeenCalled()
      guardarSesion(db, sesionNueva(), 'u1')
      expect(await handler(null, {})).toMatchObject({ ok: true })
      expect(pedirTokenVoz).toHaveBeenCalledOnce()
    } finally {
      db.close()
    }
  })
})

describe('cuenta IPC', () => {
  const canal = (nombre: string): ((evento: unknown, datos?: unknown) => Promise<unknown>) =>
    handle.mock.calls.find(([c]) => c === nombre)![1]

  it('valida formularios sin lanzar y aísla la cocina de cada cuenta', async () => {
    const db = abrirBase(':memory:')
    const cuenta = cuentaFalsa()
    const voz = { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() }
    try {
      cargarSemilla(db, leerSemilla())
      registrarIpc(
        db,
        { pedirTokenVoz: vi.fn(), narrar: vi.fn(), conversar: vi.fn() },
        voz,
        { leer: vi.fn(), detener: vi.fn() },
        cuenta
      )
      expect(
        await canal(CANALES_IPC.cuentaRegistrar)(null, {
          nombre: 'Ana',
          email: 'no-es-correo',
          contrasena: 'larga-1234'
        })
      ).toMatchObject({ ok: false, error: { codigo: 'datos_invalidos' } })
      expect(cuenta.registrar).not.toHaveBeenCalled()
      expect(
        await canal(CANALES_IPC.cuentaVerificar)(null, { email: 'ana@x.es', codigo: '12345' })
      ).toMatchObject({ ok: false, error: { mensaje: 'El código tiene 6 cifras.' } })

      // La receta de otra cuenta no se retoma.
      guardarSesion(db, sesionNueva(), 'otra')
      expect(await canal(CANALES_IPC.sesionRetomar)(null)).toBeNull()
      guardarSesion(db, { ...sesionNueva(), id: 'mia' }, 'u1')
      expect(await canal(CANALES_IPC.sesionRetomar)(null)).toMatchObject({ id: 'mia' })

      // Al salir se apaga la voz y ya no se puede leer la cocina.
      await canal(CANALES_IPC.cuentaSalir)(null)
      expect(voz.detener).toHaveBeenCalled()
      await expect(
        Promise.resolve().then(() => canal(CANALES_IPC.sesionRetomar)(null))
      ).rejects.toThrow('Inicia sesión')
    } finally {
      db.close()
    }
  })
})

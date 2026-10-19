import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANALES_IPC } from '@shared/types/ipc'
import { sesionNueva } from '@shared/cocina/fixtures.test-utils'
import { abrirBase } from './db/conexion'
import { guardarSesion } from './db/sesiones'
import { cargarSemilla, leerSemilla } from './db/semillas'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))
import { registrarIpc } from './ipc'

afterEach(() => handle.mockClear())

describe('voz:token IPC', () => {
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
      registrarIpc(db, { pedirTokenVoz: vi.fn() }, voz, lector)
      const handler = (canal: string): ((evento: unknown, dato: unknown) => Promise<unknown>) =>
        handle.mock.calls.find(([c]) => c === canal)![1]
      await expect(handler(CANALES_IPC.vozIniciar)(evento, {})).rejects.toThrow('cocinas')
      guardarSesion(db, sesionNueva())
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
        { pedirTokenVoz },
        { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() },
        { leer: vi.fn(), detener: vi.fn() }
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
      guardarSesion(db, sesionNueva())
      expect(await handler(null, {})).toMatchObject({ ok: true })
      expect(pedirTokenVoz).toHaveBeenCalledOnce()
    } finally {
      db.close()
    }
  })
})

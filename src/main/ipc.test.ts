import { afterEach, describe, expect, it, vi } from 'vitest'
import { esquemaIngrediente, esquemaReceta } from '@shared/esquemas/receta'
import { CANALES_IPC } from '@shared/types/ipc'
import type { ResultadoCuenta, Usuario } from '@shared/types/cuenta'
import { preferencias, sesionNueva } from '@shared/cocina/fixtures.test-utils'
import { abrirBase } from './db/conexion'
import { listarMisRecetas } from './db/mis-recetas'
import { descartarSesionCocinando, guardarSesion } from './db/sesiones'
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
    token: async () => (estado.usuario ? 'tok' : null),
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
        {
          pedirTokenVoz: vi.fn(),
          narrar: vi.fn(),
          conversar,
          proponerRecetas: vi.fn(),
          generarReceta: vi.fn()
        },
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
        {
          pedirTokenVoz: vi.fn(),
          narrar: vi.fn(),
          conversar: vi.fn(),
          proponerRecetas: vi.fn(),
          generarReceta: vi.fn()
        },
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
        {
          pedirTokenVoz,
          narrar: vi.fn(),
          conversar: vi.fn(),
          proponerRecetas: vi.fn(),
          generarReceta: vi.fn()
        },
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
    const proponerRecetas = vi.fn()
    const generarReceta = vi.fn()
    try {
      cargarSemilla(db, leerSemilla())
      registrarIpc(
        db,
        {
          pedirTokenVoz: vi.fn(),
          narrar: vi.fn(),
          conversar: vi.fn(),
          proponerRecetas,
          generarReceta
        },
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
      ).toMatchObject({
        ok: false,
        error: { mensaje: 'Escribe el código del correo (6 a 10 cifras).' }
      })

      // La despensa se guarda a nombre de la cuenta y se validan los datos.
      expect(await canal(CANALES_IPC.preferenciasLeer)(null)).toBeNull()
      const despensa = preferencias({ ingredientes: ['cebolla'] })
      await canal(CANALES_IPC.preferenciasGuardar)(null, despensa)
      expect(await canal(CANALES_IPC.preferenciasLeer)(null)).toEqual(despensa)
      await expect(
        Promise.resolve().then(() =>
          canal(CANALES_IPC.preferenciasGuardar)(null, { ingredientes: 'no' })
        )
      ).rejects.toThrow()

      // Las ideas se comprueban en main: se descarta la que choca con la alergia.
      proponerRecetas.mockResolvedValue({
        ok: true,
        datos: {
          ideas: [
            {
              titulo: 'Con huevo',
              descripcion: 'x',
              ingredientes: ['cebolla', 'huevos'],
              tiempoTotalMin: 10,
              dificultad: 'facil'
            },
            {
              titulo: 'Guiso de yuca',
              descripcion: 'x',
              ingredientes: ['cebolla', 'yuca'],
              tiempoTotalMin: 10,
              dificultad: 'facil'
            }
          ],
          fuente: 'memoria',
          fuentes: [],
          sugerenciasBusqueda: null
        }
      })
      const ideas = await canal(CANALES_IPC.recetasProponer)(null, {
        preferencias: preferencias({ ingredientes: ['cebolla', 'sal'], alergias: ['huevo'] }),
        excluir: [],
        pedido: 'algo rápido'
      })
      expect(proponerRecetas.mock.calls[0]![0].pedido).toBe('algo rápido')
      expect(ideas).toMatchObject({
        ok: true,
        ideas: [{ titulo: 'Guiso de yuca', tienes: ['Cebolla'], sinVerificar: ['yuca'] }]
      })
      expect(proponerRecetas.mock.calls[0]![0].ingredientes).toEqual(['Cebolla'])
      expect(
        await canal(CANALES_IPC.recetasProponer)(null, {
          preferencias: preferencias({ ingredientes: ['sal'] }),
          excluir: []
        })
      ).toMatchObject({ ok: false })

      // La receta de una idea se comprueba, se cocina desde la sesión y se retoma sin estar en la base.
      const receta = esquemaReceta.parse({
        ...leerSemilla().recetas.find((r) => r.id === 'arroz_con_pollo'),
        id: 'gen_prueba',
        slug: 'gen-prueba',
        titulo: 'Guiso de yuca',
        origen: 'generada',
        estadoRevision: 'borrador',
        pasos: [{ id: 'p1', orden: 1, texto: 'Cocina la yuca.', requiereConfirmacion: true }],
        ingredientes: [
          { id: 'ir_1', ingredienteId: 'nuevo_yuca', cantidad: 500, unidad: 'g', redondeo: 5 }
        ]
      })
      const nueva = esquemaIngrediente.parse({
        id: 'nuevo_yuca',
        nombre: 'Yuca',
        categoria: 'verduras',
        alergenos: ['huevo'],
        // El backend no decide esto: main lo corrige.
        alergenosVerificados: true
      })
      generarReceta.mockResolvedValue({
        ok: true,
        datos: { receta, ingredientesNuevos: [nueva] }
      })
      const idea = {
        titulo: 'Guiso de yuca',
        descripcion: 'x',
        ingredientes: ['yuca'],
        tiempoTotalMin: 10,
        dificultad: 'facil'
      }
      const sinAlergias = preferencias({ ingredientes: ['cebolla'] })
      expect(
        await canal(CANALES_IPC.recetasGenerar)(null, {
          idea,
          preferencias: { ...sinAlergias, alergias: ['huevo'] }
        })
      ).toMatchObject({ ok: false })
      const generada = await canal(CANALES_IPC.recetasGenerar)(null, {
        idea,
        preferencias: sinAlergias
      })
      expect(generada).toMatchObject({
        ok: true,
        receta: { origen: 'generada', dietas: [], alergenos: ['huevo'] },
        ingredientesNuevos: [{ alergenosVerificados: false }]
      })
      expect(() =>
        canal(CANALES_IPC.sesionIniciar)(null, {
          recetaId: 'gen_prueba',
          porciones: 2,
          preferencias: { ...sinAlergias, alergias: ['huevo'] }
        })
      ).toThrow(/ya no encaja/)
      const sesion = await canal(CANALES_IPC.sesionIniciar)(null, {
        recetaId: 'gen_prueba',
        porciones: 2,
        preferencias: sinAlergias
      })
      expect(sesion).toMatchObject({
        recetaId: 'gen_prueba',
        recetaAdaptada: {
          titulo: 'Guiso de yuca',
          ingredientes: [{ cantidad: expect.any(Number) }]
        },
        recetaGenerada: { receta: { id: 'gen_prueba' } }
      })
      expect(await canal(CANALES_IPC.sesionRetomar)(null)).toMatchObject({ recetaId: 'gen_prueba' })
      expect(
        await canal(CANALES_IPC.sesionAplicar)(null, {
          nombre: 'cambiar_porciones',
          argumentos: { porciones: 6 },
          confirmado: true
        })
      ).toMatchObject({ resultado: { ok: true }, sesion: { porciones: 6 } })

      // Al guardarla pasa a Mis recetas de esa cuenta: se busca, se abre y se vuelve a cocinar.
      expect(await canal(CANALES_IPC.misRecetasListar)(null)).toEqual([])
      await expect(
        Promise.resolve().then(() =>
          canal(CANALES_IPC.misRecetasGuardar)(null, { sesionId: 'de-nadie' })
        )
      ).rejects.toThrow(/no se puede guardar/)
      const sesionId = (sesion as { id: string }).id
      await canal(CANALES_IPC.misRecetasGuardar)(null, { sesionId })
      const mias = (await canal(CANALES_IPC.misRecetasGuardar)(null, { sesionId })) as unknown[]
      expect(mias).toHaveLength(1)
      expect(mias[0]).toMatchObject({ receta: { id: 'gen_prueba', alergenos: ['huevo'] } })
      expect(await canal(CANALES_IPC.recetasObtener)(null, 'gen_prueba')).toMatchObject({
        titulo: 'Guiso de yuca'
      })
      const busqueda = (await canal(CANALES_IPC.recetasBuscar)(
        null,
        preferencias({ ingredientes: ['cebolla'], ingredientesSinIdentificar: ['yuca'] })
      )) as { resultados: { receta: { id: string }; faltantes: unknown[] }[] }
      expect(busqueda.resultados.find((r) => r.receta.id === 'gen_prueba')?.faltantes).toEqual([])
      const conAlergia = (await canal(CANALES_IPC.recetasBuscar)(
        null,
        preferencias({ ingredientes: ['cebolla'], alergias: ['huevo'] })
      )) as { resultados: { receta: { id: string } }[] }
      expect(conAlergia.resultados.map((r) => r.receta.id)).not.toContain('gen_prueba')
      expect(listarMisRecetas(db, 'otra')).toEqual([])
      expect(await canal(CANALES_IPC.misRecetasQuitar)(null, { recetaId: 'gen_prueba' })).toEqual(
        []
      )
      descartarSesionCocinando(db, 'u1')

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

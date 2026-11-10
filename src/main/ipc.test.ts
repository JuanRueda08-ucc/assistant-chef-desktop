import { afterEach, describe, expect, it, vi } from 'vitest'
import { esquemaIngrediente, esquemaReceta } from '@shared/esquemas/receta'
import { CANALES_IPC } from '@shared/types/ipc'
import type { ResultadoCuenta, Usuario } from '@shared/types/cuenta'
import { preferencias, sesionNueva } from '@shared/cocina/fixtures.test-utils'
import { abrirBase } from './db/conexion'
import { guardarMiReceta, leerMisRecetasGuardadas, listarMisRecetas } from './db/mis-recetas'
import { arrozConPollo } from '@shared/recetas/fixtures.test-utils'
import { datosNubeFalsos, supabaseFalso } from './datos-cuenta.test-utils'
import { crearDatosLocales } from './datos-cuenta'
import { descartarSesionCocinando, guardarSesion } from './db/sesiones'
import { cargarSemilla, leerSemilla } from './db/semillas'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))
import { registrarIpc } from './ipc'
import { dictado } from './voz/dictado'
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
    cambiarNombre: ok,
    cambiarContrasena: ok,
    comprobarContrasena: ok,
    olvidar: vi.fn(),
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
          generarReceta: vi.fn(),
          transcribir: vi.fn(),
          generarImagen: vi.fn(),
          titularChat: vi.fn(),
          borrarCuenta: vi.fn(),
          uso: vi.fn()
        },
        { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() },
        { leer: vi.fn(), detener: vi.fn() },
        cuentaFalsa(),
        crearDatosLocales(db)
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
          generarReceta: vi.fn(),
          transcribir: vi.fn(),
          generarImagen: vi.fn(),
          titularChat: vi.fn(),
          borrarCuenta: vi.fn(),
          uso: vi.fn()
        },
        voz,
        lector,
        cuentaFalsa(),
        crearDatosLocales(db)
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
          generarReceta: vi.fn(),
          transcribir: vi.fn(),
          generarImagen: vi.fn(),
          titularChat: vi.fn(),
          borrarCuenta: vi.fn(),
          uso: vi.fn()
        },
        { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() },
        { leer: vi.fn(), detener: vi.fn() },
        cuentaFalsa(),
        crearDatosLocales(db)
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
    const transcribir = vi.fn()
    const titularChat = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, datos: { titulo: 'Arroz con pollo' } })
      .mockResolvedValueOnce({ ok: false, mensaje: 'Sin cuota.' })
    try {
      cargarSemilla(db, leerSemilla())
      registrarIpc(
        db,
        {
          pedirTokenVoz: vi.fn(),
          narrar: vi.fn(),
          conversar: vi.fn(),
          proponerRecetas,
          generarReceta,
          transcribir,
          generarImagen: vi.fn(),
          titularChat,
          borrarCuenta: vi.fn(),
          uso: vi.fn()
        },
        voz,
        { leer: vi.fn(), detener: vi.fn() },
        cuenta,
        crearDatosLocales(db)
      )
      expect(
        await canal(CANALES_IPC.cuentaRegistrar)(null, {
          nombre: 'Ana',
          email: 'no-es-correo',
          contrasena: 'larga-1234'
        })
      ).toMatchObject({ ok: false, error: { codigo: 'datos_invalidos' } })
      // La contraseña dice qué le falta, sin llegar a Supabase.
      expect(
        await canal(CANALES_IPC.cuentaRegistrar)(null, {
          nombre: 'Ana',
          email: 'ana@x.es',
          contrasena: 'larga-1234'
        })
      ).toMatchObject({
        ok: false,
        error: { mensaje: 'A tu contraseña le falta: una letra mayúscula (A-Z).' }
      })
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
      // Una receta suelta, aunque no use nada de lo elegido (tarea 45).
      const evaluar = canal(CANALES_IPC.recetasEvaluar)
      const suelta = (await evaluar(null, {
        recetaId: 'arroz_con_pollo',
        preferencias: preferencias({ ingredientes: ['cebolla'] })
      })) as { ok: boolean; motivos?: string[] }
      expect(typeof suelta.ok).toBe('boolean')
      expect(
        await evaluar(null, { recetaId: 'no_existe', preferencias: preferencias() })
      ).toBeNull()
      await expect(
        Promise.resolve().then(() => evaluar(null, { recetaId: 'arroz_con_pollo' }))
      ).rejects.toThrow()
      expect(listarMisRecetas(db, 'otra')).toEqual([])
      expect(await canal(CANALES_IPC.misRecetasQuitar)(null, { recetaId: 'gen_prueba' })).toEqual(
        []
      )
      descartarSesionCocinando(db, 'u1')

      // El título del chat lo pone la IA; si falla, la app conserva el suyo (null).
      const titular = canal(CANALES_IPC.chefTitular)
      expect(await titular(null, { pregunta: 'tengo pollo', respuesta: 'Bien.' })).toBe(
        'Arroz con pollo'
      )
      expect(await titular(null, { pregunta: 'tengo pollo', respuesta: '' })).toBeNull()
      await expect(
        Promise.resolve().then(() => titular(null, { pregunta: '', respuesta: '' }))
      ).rejects.toThrow()

      // «Hablar» permite el micrófono solo mientras dura, y un texto vacío no llega al chat.
      await canal(CANALES_IPC.vozDictadoIniciar)(null, {})
      expect(dictado.activo).toBe(true)
      await canal(CANALES_IPC.vozDictadoTerminar)(null, {})
      expect(dictado.activo).toBe(false)
      transcribir.mockResolvedValueOnce({ ok: true, datos: { texto: ' dame ideas ' } })
      const audio = new ArrayBuffer(320)
      expect(await canal(CANALES_IPC.vozTranscribir)(null, audio)).toEqual({
        ok: true,
        texto: 'dame ideas'
      })
      transcribir.mockResolvedValueOnce({ ok: true, datos: { texto: '  ' } })
      expect(await canal(CANALES_IPC.vozTranscribir)(null, audio)).toMatchObject({ ok: false })
      await expect(
        Promise.resolve().then(() =>
          canal(CANALES_IPC.vozTranscribir)(null, new ArrayBuffer(256_002))
        )
      ).rejects.toThrow()

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

describe('chats y Mis recetas de la cuenta en la nube (0025)', () => {
  it('sube a la cuenta las recetas guardadas en el equipo, las borra de aquí y valida los chats', async () => {
    const db = abrirBase(':memory:')
    const sb = supabaseFalso()
    try {
      cargarSemilla(db, leerSemilla())
      const generada = { receta: { ...arrozConPollo(), id: 'gen_local' }, ingredientesNuevos: [] }
      guardarMiReceta(db, 'u1', generada, 0)
      registrarIpc(
        db,
        {
          pedirTokenVoz: vi.fn(),
          narrar: vi.fn(),
          conversar: vi.fn(),
          proponerRecetas: vi.fn(),
          generarReceta: vi.fn(),
          transcribir: vi.fn(),
          generarImagen: vi.fn(),
          titularChat: vi.fn(),
          borrarCuenta: vi.fn(),
          uso: vi.fn()
        },
        { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() },
        { leer: vi.fn(), detener: vi.fn() },
        cuentaFalsa(),
        datosNubeFalsos(sb),
        { verBorradores: false, datosEnLaNube: true }
      )
      const canal = (nombre: string): ((evento: unknown, datos?: unknown) => Promise<unknown>) =>
        handle.mock.calls.find(([c]) => c === nombre)![1]

      const mias = (await canal(CANALES_IPC.misRecetasListar)(null)) as { receta: { id: string } }[]
      expect(mias.map((g) => g.receta.id)).toEqual(['gen_local'])
      expect(sb.tablas.mis_recetas.map((f) => f.id)).toEqual(['gen_local'])
      expect(leerMisRecetasGuardadas(db, 'u1')).toEqual([])
      // Ya en memoria: obtener la receta no espera a la red.
      expect(await canal(CANALES_IPC.recetasObtener)(null, 'gen_local')).toMatchObject({
        id: 'gen_local'
      })

      const chat = {
        id: '6f1c2c1e-6a43-4f2a-9a33-0a1b2c3d4e5f',
        titulo: 'Arroz con pollo',
        tituloDeIA: false,
        turnos: [],
        contexto: [],
        actualizado: 1
      }
      await canal(CANALES_IPC.chatsGuardar)(null, chat)
      expect(await canal(CANALES_IPC.chatsListar)(null)).toEqual([chat])
      await expect(canal(CANALES_IPC.chatsGuardar)(null, { ...chat, id: 'x' })).rejects.toThrow()
      await expect(canal(CANALES_IPC.chatsBorrar)(null, { id: 'x' })).rejects.toThrow()
      await canal(CANALES_IPC.chatsBorrar)(null, { id: chat.id })
      expect(sb.tablas.chats).toEqual([])
    } finally {
      db.close()
    }
  })
})

describe('borrar la cuenta (0026)', () => {
  it('comprueba la contraseña, borra en la nube y después lo del equipo, y cierra la sesión', async () => {
    const db = abrirBase(':memory:')
    try {
      cargarSemilla(db, leerSemilla())
      const cuenta = cuentaFalsa()
      const borrarCuenta = vi.fn().mockResolvedValue({ ok: true, datos: { borrada: true } })
      cuenta.olvidar = vi.fn(() => {
        cuenta.estado().usuario = null
      })
      registrarIpc(
        db,
        {
          pedirTokenVoz: vi.fn(),
          narrar: vi.fn(),
          conversar: vi.fn(),
          proponerRecetas: vi.fn(),
          generarReceta: vi.fn(),
          transcribir: vi.fn(),
          generarImagen: vi.fn(),
          titularChat: vi.fn(),
          borrarCuenta,
          uso: vi.fn()
        },
        { iniciar: vi.fn(), reconocer: vi.fn(), reset: vi.fn(), detener: vi.fn() },
        { leer: vi.fn(), detener: vi.fn() },
        cuenta,
        crearDatosLocales(db)
      )
      const borrar = handle.mock.calls.find(([c]) => c === CANALES_IPC.cuentaBorrar)![1] as (
        e: unknown,
        d: unknown
      ) => Promise<ResultadoCuenta>
      guardarSesion(db, sesionNueva(), 'u1')

      // Sin escribir BORRAR no se hace nada.
      expect(await borrar(null, { contrasena: 'x', confirmacion: 'borrar' })).toMatchObject({
        ok: false,
        error: { mensaje: 'Escribe BORRAR para confirmar.' }
      })
      // Con la contraseña mal, tampoco.
      cuenta.comprobarContrasena = vi.fn().mockResolvedValue({
        ok: false,
        error: { codigo: 'credenciales', mensaje: 'La contraseña actual no es correcta.' }
      })
      expect((await borrar(null, { contrasena: 'x', confirmacion: 'BORRAR' })).ok).toBe(false)
      expect(borrarCuenta).not.toHaveBeenCalled()

      cuenta.comprobarContrasena = vi.fn().mockResolvedValue({ ok: true, estado: cuenta.estado() })
      const r = await borrar(null, { contrasena: 'Buena#2026', confirmacion: 'BORRAR' })
      expect(r).toEqual({ ok: true, estado: { usuario: null, sinConexion: false } })
      expect(borrarCuenta).toHaveBeenCalledOnce()
      expect(
        db.prepare('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ?').get('u1')
      ).toEqual({ n: 0 })
    } finally {
      db.close()
    }
  })
})

import { BrowserWindow, Notification, ipcMain, nativeImage } from 'electron'
import { z } from 'zod'
import { esquemaId } from '@shared/esquemas/receta'
import { PORCIONES_MAX, PORCIONES_MIN, esquemaPreferencias } from '@shared/esquemas/sesion'
import { esquemaLlamadaHerramienta } from '@shared/ia/herramientas'
import { esquemaChatIpc } from '@shared/ia/chat'
import { contextoCompacto } from '@shared/ia/contexto'
import { esquemaGenerarIpc, esquemaProponerIpc } from '@shared/esquemas/ideas'
import { conEtiquetas } from '@shared/recetas/etiquetas'
import { evaluarIdeas } from '@shared/recetas/ideas'
import { problemasRecetaGenerada } from '@shared/recetas/receta-generada'
import type { RecetaGenerada } from '@shared/types/receta'
import { esquemaLeerPaso, esquemaPeticionTokenVoz } from '@shared/esquemas/voz'
import {
  esquemaCodigo,
  esquemaEmail,
  esquemaEntrar,
  esquemaRegistro,
  esquemaRestablecer
} from '@shared/esquemas/cuenta'
import type { ResultadoCuenta } from '@shared/types/cuenta'
import { CANALES_IPC, type ApiChef } from '@shared/types/ipc'
import { aplicarEnCocina, iniciarCocina, retomarCocina } from './cocina'
import { buscarEnBase } from './db/busqueda'
import { listarIngredientes, listarTecnicas } from './db/catalogo'
import type { BaseDatos } from './db/conexion'
import {
  guardarMiReceta,
  listarMisRecetas,
  obtenerMiReceta,
  quitarMiReceta
} from './db/mis-recetas'
import { listarRecetas, obtenerReceta } from './db/recetas'
import { guardarPreferencias, leerPreferencias } from './db/preferencias'
import { obtenerSesion, obtenerSesionCocinando } from './db/sesiones'
import type { crearClienteBackend } from './backend'
import { fallo, type Cuenta } from './cuenta'
import { dictado, MS_MAX_DICTADO } from './voz/dictado'
import type { VozLocal } from './voz/local'
import { pcmAWavBase64 } from './voz/wav'
import type { crearLectorLocal } from './voz/lector'

/**
 * La imagen llega en PNG grande: se reduce a un JPEG de 800 px de ancho para guardarla con la
 * receta. `null` si no es una imagen que Electron pueda leer.
 */
function reducirImagen(base64: string): string | null {
  const imagen = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'))
  if (imagen.isEmpty()) return null
  const { width } = imagen.getSize()
  const reducida = width > 800 ? imagen.resize({ width: 800, quality: 'good' }) : imagen
  return `data:image/jpeg;base64,${reducida.toJPEG(82).toString('base64')}`
}

/** Recetas escritas por la IA que siguen esperando a cocinarse; al cocinar pasan a la sesión. */
const MAX_GENERADAS = 20

type Resultado<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>

const esquemaIniciarCocina = z.strictObject({
  recetaId: esquemaId,
  porciones: z.number().int().min(PORCIONES_MIN).max(PORCIONES_MAX),
  preferencias: esquemaPreferencias
})

/**
 * Implementa en main los canales de src/shared/types/ipc.ts. Todo argumento que llega del
 * renderer se valida con zod antes de usarse. La hora la pone main (`Date.now()`).
 */
export function registrarIpc(
  db: BaseDatos,
  backend: ReturnType<typeof crearClienteBackend>,
  voz: VozLocal,
  lector: ReturnType<typeof crearLectorLocal>,
  cuenta: Cuenta,
  opciones: { verBorradores: boolean } = { verBorradores: false }
): void {
  let propietario: number | null = null
  // --- Cuenta (0016) ------------------------------------------------------------------------
  // La primera comprobación de la sesión guardada se hace una vez; todo lo demás la espera.
  const preparada = cuenta.iniciar().catch(() => cuenta.estado())
  /** Valida con zod y, si falla, devuelve el primer mensaje al formulario en vez de lanzar. */
  function conDatos<T>(
    esquema: z.ZodType<T>,
    accion: (datos: T) => Promise<ResultadoCuenta>
  ): (_evento: unknown, datos: unknown) => Promise<ResultadoCuenta> {
    return async (_evento, datos) => {
      await preparada
      const r = esquema.safeParse(datos)
      if (!r.success) return fallo('datos_invalidos', r.error.issues[0]?.message)
      return accion(r.data)
    }
  }
  ipcMain.handle(CANALES_IPC.cuentaEstado, async () => {
    await preparada
    return cuenta.estado()
  })
  ipcMain.handle(CANALES_IPC.cuentaRegistrar, conDatos(esquemaRegistro, cuenta.registrar))
  ipcMain.handle(CANALES_IPC.cuentaVerificar, conDatos(esquemaCodigo, cuenta.verificar))
  ipcMain.handle(
    CANALES_IPC.cuentaReenviar,
    conDatos(esquemaEmail, (d) => cuenta.reenviarCodigo(d.email))
  )
  ipcMain.handle(CANALES_IPC.cuentaEntrar, conDatos(esquemaEntrar, cuenta.entrar))
  ipcMain.handle(CANALES_IPC.cuentaSalir, async () => {
    await preparada
    dictado.activo = false
    voz.detener()
    lector.detener()
    propietario = null
    return cuenta.salir()
  })
  ipcMain.handle(
    CANALES_IPC.cuentaRecuperar,
    conDatos(esquemaEmail, (d) => cuenta.recuperar(d.email))
  )
  ipcMain.handle(CANALES_IPC.cuentaRestablecer, conDatos(esquemaRestablecer, cuenta.restablecer))

  /** Id de la cuenta con sesión; sin cuenta no se lee ni se cambia ninguna cocina. */
  const usuarioId = (): string => {
    const usuario = cuenta.estado().usuario
    if (!usuario) throw new Error('Inicia sesión para continuar.')
    return usuario.id
  }
  const cocinando = (): ReturnType<typeof obtenerSesionCocinando> => {
    const usuario = cuenta.estado().usuario
    return usuario ? obtenerSesionCocinando(db, usuario.id) : null
  }

  ipcMain.handle(CANALES_IPC.chefConversar, async (_evento, datos: unknown) => {
    const peticion = esquemaChatIpc.parse(datos)
    let contexto: string
    if (peticion.pantalla === 'cocinar') {
      const sesion = cocinando()
      if (!sesion) throw new Error('No hay una receta cocinándose para esta consulta.')
      contexto = contextoCompacto(sesion, Date.now())
    } else {
      const catalogo = listarIngredientes(db)
      const usuario = cuenta.estado().usuario
      const busqueda = buscarEnBase(
        db,
        peticion.preferencias,
        opciones.verBorradores,
        usuario?.id ?? null
      )
      contexto = JSON.stringify({
        preferencias: peticion.preferencias,
        catalogo: catalogo
          .slice(0, 300)
          .map(({ id, nombre, sinonimos, alergenos }) => ({ id, nombre, sinonimos, alergenos })),
        catalogoParcial: catalogo.length > 300,
        recetas: busqueda.resultados
          .slice(0, 10)
          .map((r) => ({ ...r.receta, faltantes: r.faltantes })),
        ideasDelChef: peticion.ideas,
        misRecetas: usuario
          ? listarMisRecetas(db, usuario.id).map(({ receta }) => ({
              id: receta.id,
              titulo: receta.titulo
            }))
          : [],
        aviso:
          'Las recetas son candidatas calculadas. Usa buscar_recetas para abrir los resultados antes de ver o elegir. Una lista vacía no autoriza a inventar recetas: pide ideas con proponer_ideas.'
      })
    }
    return backend.conversar({ pantalla: peticion.pantalla, contexto, mensajes: peticion.mensajes })
  })
  const vigilados = new Set<number>()
  ipcMain.handle(CANALES_IPC.vozCallar, (_evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    lector.detener()
  })
  ipcMain.handle(CANALES_IPC.vozNarrar, async (_evento, datos: unknown) => {
    const peticion = esquemaLeerPaso.parse(datos)
    const sesion = cocinando()
    const paso = sesion?.recetaAdaptada?.pasos.find((p) => p.orden === sesion.pasoActual)
    if (!sesion || !paso || sesion.id !== peticion.sesionId || paso.id !== peticion.pasoId)
      return null
    lector.detener()
    return backend.narrar(paso.textoVoz ?? paso.texto)
  })
  const exigirCocina = (): void => {
    if (!cocinando()) throw new Error('La voz solo está disponible mientras cocinas.')
  }
  const esquemaAudio = z
    .instanceof(ArrayBuffer)
    .refine((a) => a.byteLength > 0 && a.byteLength <= 6400 && a.byteLength % 2 === 0)
  let caducidadDictado: ReturnType<typeof setTimeout> | undefined
  const terminarDictado = (): void => {
    clearTimeout(caducidadDictado)
    dictado.activo = false
  }
  ipcMain.handle(CANALES_IPC.vozDictadoIniciar, (_evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    usuarioId()
    clearTimeout(caducidadDictado)
    dictado.activo = true
    caducidadDictado = setTimeout(terminarDictado, MS_MAX_DICTADO)
  })
  ipcMain.handle(CANALES_IPC.vozDictadoTerminar, (_evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    terminarDictado()
  })
  ipcMain.handle(
    CANALES_IPC.vozTranscribir,
    async (_evento, audio: unknown): Promise<Resultado<ApiChef['voz']['transcribir']>> => {
      const pcm = z
        .instanceof(ArrayBuffer)
        .refine((a) => a.byteLength > 0 && a.byteLength <= 256_000 && a.byteLength % 2 === 0)
        .parse(audio)
      usuarioId()
      const respuesta = await backend.transcribir(pcmAWavBase64(pcm))
      if (!respuesta.ok) return respuesta
      const texto = respuesta.datos.texto.trim()
      return texto
        ? { ok: true, texto }
        : { ok: false, mensaje: 'No te entendí. Inténtalo de nuevo o escríbelo.' }
    }
  )
  ipcMain.handle(CANALES_IPC.vozIniciar, async (evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    exigirCocina()
    propietario = evento.sender.id
    const id = evento.sender.id
    if (!vigilados.has(id)) {
      vigilados.add(id)
      evento.sender.once('destroyed', () => {
        vigilados.delete(id)
        if (propietario === id) {
          voz.detener()
          lector.detener()
          propietario = null
        }
      })
    }
    return voz.iniciar()
  })
  ipcMain.handle(CANALES_IPC.vozReconocer, async (evento, audio: unknown) => {
    const valido = esquemaAudio.parse(audio)
    exigirCocina()
    if (propietario !== evento.sender.id) return null
    return voz.reconocer(valido)
  })
  ipcMain.handle(CANALES_IPC.vozReset, async (evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    if (propietario === evento.sender.id) await voz.reset()
  })
  ipcMain.handle(CANALES_IPC.vozDetener, (evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    if (propietario === evento.sender.id || propietario === null) {
      voz.detener()
      lector.detener()
      propietario = null
    }
  })
  ipcMain.handle(CANALES_IPC.vozRepetir, async (_evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    const sesion = cocinando()
    const paso = sesion?.recetaAdaptada?.pasos.find((p) => p.orden === sesion.pasoActual)
    if (!paso) return { ok: false, mensaje: 'No hay un paso para repetir.' }
    return lector.leer(paso.textoVoz ?? paso.texto)
  })
  ipcMain.handle(
    CANALES_IPC.vozToken,
    async (_evento, datos: unknown): Promise<Resultado<ApiChef['voz']['token']>> => {
      esquemaPeticionTokenVoz.parse(datos)
      if (!cocinando())
        return {
          ok: false,
          error: {
            codigo: 'fase_incorrecta',
            mensaje: 'La voz solo está disponible mientras cocinas.'
          }
        }
      return backend.pedirTokenVoz()
    }
  )
  ipcMain.handle(
    CANALES_IPC.catalogoIngredientes,
    (): Resultado<ApiChef['catalogo']['ingredientes']> => listarIngredientes(db)
  )

  ipcMain.handle(CANALES_IPC.recetasListar, (): Resultado<ApiChef['recetas']['listar']> =>
    listarRecetas(db)
  )

  ipcMain.handle(
    CANALES_IPC.recetasObtener,
    (_evento, id: unknown): Resultado<ApiChef['recetas']['obtener']> => {
      const recetaId = esquemaId.parse(id)
      const usuario = cuenta.estado().usuario
      return (
        obtenerReceta(db, recetaId) ??
        (usuario ? (obtenerMiReceta(db, usuario.id, recetaId)?.receta ?? null) : null)
      )
    }
  )

  ipcMain.handle(
    CANALES_IPC.recetasBuscar,
    (_evento, preferencias: unknown): Resultado<ApiChef['recetas']['buscar']> =>
      buscarEnBase(
        db,
        esquemaPreferencias.parse(preferencias),
        opciones.verBorradores,
        cuenta.estado().usuario?.id ?? null
      )
  )

  ipcMain.handle(
    CANALES_IPC.recetasProponer,
    async (_evento, datos: unknown): Promise<Resultado<ApiChef['recetas']['proponer']>> => {
      const { preferencias, excluir, pedido } = esquemaProponerIpc.parse(datos)
      const catalogo = listarIngredientes(db)
      const ingredientes = [
        ...catalogo
          .filter((i) => !i.esBasicoDespensa && preferencias.ingredientes.includes(i.id))
          .map((i) => i.nombre),
        ...preferencias.ingredientesSinIdentificar
      ]
      if (ingredientes.length === 0)
        return { ok: false, mensaje: 'Añade algún ingrediente a tu despensa para pedir ideas.' }
      const respuesta = await backend.proponerRecetas({
        ingredientes,
        porciones: preferencias.porciones,
        restricciones: preferencias.restricciones,
        alergias: preferencias.alergias,
        tiempoMaxMin: preferencias.tiempoMaxMin,
        nivel: preferencias.nivel,
        equipo: preferencias.equipo,
        excluir,
        pedido
      })
      if (!respuesta.ok) return respuesta
      // El código, no el modelo, decide qué tienes, qué falta y qué se descarta (0019).
      return {
        ok: true,
        ideas: evaluarIdeas(respuesta.datos.ideas, { catalogo, preferencias, excluir }),
        fuente: respuesta.datos.fuente,
        fuentes: respuesta.datos.fuentes,
        sugerenciasBusqueda: respuesta.datos.sugerenciasBusqueda
      }
    }
  )

  const generadas = new Map<string, { usuarioId: string; generada: RecetaGenerada }>()

  ipcMain.handle(
    CANALES_IPC.recetasGenerar,
    async (_evento, datos: unknown): Promise<Resultado<ApiChef['recetas']['generar']>> => {
      const { idea, preferencias } = esquemaGenerarIpc.parse(datos)
      const usuario = usuarioId()
      const catalogo = listarIngredientes(db)
      const respuesta = await backend.generarReceta({
        idea,
        preferencias,
        catalogo,
        tecnicas: listarTecnicas(db).map(({ id, nombre }) => ({ id, nombre }))
      })
      if (!respuesta.ok) return respuesta
      // Lo que no decide el modelo se fija aquí, también si el backend fallara (0019).
      const ingredientesNuevos = respuesta.datos.ingredientesNuevos.map((i) => ({
        ...i,
        alergenosVerificados: false
      }))
      const generada: RecetaGenerada = {
        receta: conEtiquetas({ ...respuesta.datos.receta, origen: 'generada', imagen: null }, [
          ...catalogo,
          ...ingredientesNuevos
        ]),
        ingredientesNuevos
      }
      if (problemasRecetaGenerada(generada, preferencias, catalogo).length > 0)
        return {
          ok: false,
          mensaje: 'La receta no encaja con tus alergias, tu dieta o tu tiempo. Prueba con otra.'
        }
      if (generadas.size >= MAX_GENERADAS) generadas.delete(generadas.keys().next().value!)
      generadas.set(generada.receta.id, { usuarioId: usuario, generada })
      return { ok: true, ...generada }
    }
  )

  ipcMain.handle(
    CANALES_IPC.recetasImagen,
    async (_evento, datos: unknown): Promise<Resultado<ApiChef['recetas']['imagen']>> => {
      const { recetaId } = z.strictObject({ recetaId: esquemaId }).parse(datos)
      const guardada = generadas.get(recetaId)
      if (!guardada || guardada.usuarioId !== usuarioId()) return null
      const { receta, ingredientesNuevos } = guardada.generada
      if (receta.imagen) return receta.imagen
      const nombres = [...listarIngredientes(db), ...ingredientesNuevos]
      const respuesta = await backend.generarImagen({
        titulo: receta.titulo,
        descripcion: receta.descripcion,
        ingredientes: receta.ingredientes
          .slice(0, 30)
          .map((ir) => nombres.find((i) => i.id === ir.ingredienteId)?.nombre ?? ir.ingredienteId)
      })
      if (!respuesta.ok || !respuesta.datos.imagen) return null
      const imagen = reducirImagen(respuesta.datos.imagen.datos)
      if (!imagen) return null
      receta.imagen = imagen
      return imagen
    }
  )

  ipcMain.handle(CANALES_IPC.avisoTemporizador, (evento, datos: unknown) => {
    const { etiqueta } = z.strictObject({ etiqueta: z.string().trim().min(1).max(80) }).parse(datos)
    const ventana = BrowserWindow.fromWebContents(evento.sender)
    // Dentro de la app ya se ve el aviso; la notificación es para cuando está minimizada o detrás.
    if (ventana?.isFocused() || !Notification.isSupported()) return
    new Notification({ title: '¡Ya! Terminó un temporizador', body: etiqueta }).show()
    ventana?.flashFrame(true)
  })

  ipcMain.handle(CANALES_IPC.misRecetasListar, (): Resultado<ApiChef['misRecetas']['listar']> =>
    listarMisRecetas(db, usuarioId())
  )

  ipcMain.handle(
    CANALES_IPC.misRecetasGuardar,
    (_evento, datos: unknown): Resultado<ApiChef['misRecetas']['guardar']> => {
      const { sesionId } = z.strictObject({ sesionId: z.string().min(1) }).parse(datos)
      const usuario = usuarioId()
      // La receta sale de la sesión de la cuenta: el renderer nunca la envía.
      const generada = obtenerSesion(db, sesionId, usuario)?.recetaGenerada
      if (!generada) throw new Error('Esta receta no se puede guardar.')
      guardarMiReceta(db, usuario, generada, Date.now())
      return listarMisRecetas(db, usuario)
    }
  )

  ipcMain.handle(
    CANALES_IPC.misRecetasQuitar,
    (_evento, datos: unknown): Resultado<ApiChef['misRecetas']['quitar']> => {
      const { recetaId } = z.strictObject({ recetaId: esquemaId }).parse(datos)
      const usuario = usuarioId()
      quitarMiReceta(db, usuario, recetaId)
      return listarMisRecetas(db, usuario)
    }
  )

  ipcMain.handle(CANALES_IPC.preferenciasLeer, (): Resultado<ApiChef['preferencias']['leer']> =>
    leerPreferencias(db, usuarioId())
  )

  ipcMain.handle(CANALES_IPC.preferenciasGuardar, (_evento, preferencias: unknown): void =>
    guardarPreferencias(db, usuarioId(), esquemaPreferencias.parse(preferencias), Date.now())
  )

  ipcMain.handle(CANALES_IPC.sesionRetomar, (): Resultado<ApiChef['sesion']['retomar']> =>
    retomarCocina(db, usuarioId(), Date.now())
  )

  ipcMain.handle(
    CANALES_IPC.sesionIniciar,
    (_evento, datos: unknown): Resultado<ApiChef['sesion']['iniciar']> => {
      const peticion = esquemaIniciarCocina.parse(datos)
      const usuario = usuarioId()
      const guardada = generadas.get(peticion.recetaId)
      const generada =
        guardada?.usuarioId === usuario
          ? guardada.generada
          : obtenerMiReceta(db, usuario, peticion.recetaId)
      // Las alergias o la dieta pueden haber cambiado desde que se escribió.
      if (
        generada &&
        problemasRecetaGenerada(generada, peticion.preferencias, listarIngredientes(db)).length > 0
      )
        throw new Error('Esta receta ya no encaja con tus preferencias. Pide otra idea.')
      return iniciarCocina(db, usuario, peticion, Date.now(), undefined, generada)
    }
  )

  ipcMain.handle(
    CANALES_IPC.sesionAplicar,
    (_evento, llamada: unknown): Resultado<ApiChef['sesion']['aplicar']> => {
      const aplicacion = aplicarEnCocina(
        db,
        usuarioId(),
        esquemaLlamadaHerramienta.parse(llamada),
        Date.now()
      )
      if (aplicacion.sesion.fase !== 'cocinar') {
        voz.detener()
        lector.detener()
        propietario = null
      }
      return aplicacion
    }
  )
}

import { ipcMain } from 'electron'
import { z } from 'zod'
import { esquemaId } from '@shared/esquemas/receta'
import { PORCIONES_MAX, PORCIONES_MIN, esquemaPreferencias } from '@shared/esquemas/sesion'
import { esquemaLlamadaHerramienta } from '@shared/ia/herramientas'
import { esquemaLeerPaso, esquemaPeticionTokenVoz } from '@shared/esquemas/voz'
import { CANALES_IPC, type ApiChef } from '@shared/types/ipc'
import { aplicarEnCocina, iniciarCocina, retomarCocina } from './cocina'
import { buscarEnBase } from './db/busqueda'
import { listarIngredientes } from './db/catalogo'
import type { BaseDatos } from './db/conexion'
import { listarRecetas, obtenerReceta } from './db/recetas'
import { obtenerSesionCocinando } from './db/sesiones'
import type { crearClienteBackend } from './backend'
import type { VozLocal } from './voz/local'
import type { crearLectorLocal } from './voz/lector'

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
  lector: ReturnType<typeof crearLectorLocal>
): void {
  let propietario: number | null = null
  const vigilados = new Set<number>()
  ipcMain.handle(CANALES_IPC.vozCallar, (_evento, datos: unknown) => {
    esquemaPeticionTokenVoz.parse(datos)
    lector.detener()
  })
  ipcMain.handle(CANALES_IPC.vozNarrar, async (_evento, datos: unknown) => {
    const peticion = esquemaLeerPaso.parse(datos)
    const sesion = obtenerSesionCocinando(db)
    const paso = sesion?.recetaAdaptada?.pasos.find((p) => p.orden === sesion.pasoActual)
    if (!sesion || !paso || sesion.id !== peticion.sesionId || paso.id !== peticion.pasoId)
      return null
    lector.detener()
    return backend.narrar(paso.textoVoz ?? paso.texto)
  })
  const exigirCocina = (): void => {
    if (!obtenerSesionCocinando(db))
      throw new Error('La voz solo está disponible mientras cocinas.')
  }
  const esquemaAudio = z
    .instanceof(ArrayBuffer)
    .refine((a) => a.byteLength > 0 && a.byteLength <= 6400 && a.byteLength % 2 === 0)
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
    const sesion = obtenerSesionCocinando(db)
    const paso = sesion?.recetaAdaptada?.pasos.find((p) => p.orden === sesion.pasoActual)
    if (!paso) return { ok: false, mensaje: 'No hay un paso para repetir.' }
    return lector.leer(paso.textoVoz ?? paso.texto)
  })
  ipcMain.handle(
    CANALES_IPC.vozToken,
    async (_evento, datos: unknown): Promise<Resultado<ApiChef['voz']['token']>> => {
      esquemaPeticionTokenVoz.parse(datos)
      if (!obtenerSesionCocinando(db))
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
    (_evento, id: unknown): Resultado<ApiChef['recetas']['obtener']> =>
      obtenerReceta(db, esquemaId.parse(id))
  )

  ipcMain.handle(
    CANALES_IPC.recetasBuscar,
    (_evento, preferencias: unknown): Resultado<ApiChef['recetas']['buscar']> =>
      buscarEnBase(db, esquemaPreferencias.parse(preferencias))
  )

  ipcMain.handle(CANALES_IPC.sesionRetomar, (): Resultado<ApiChef['sesion']['retomar']> =>
    retomarCocina(db, Date.now())
  )

  ipcMain.handle(
    CANALES_IPC.sesionIniciar,
    (_evento, datos: unknown): Resultado<ApiChef['sesion']['iniciar']> =>
      iniciarCocina(db, esquemaIniciarCocina.parse(datos), Date.now())
  )

  ipcMain.handle(
    CANALES_IPC.sesionAplicar,
    (_evento, llamada: unknown): Resultado<ApiChef['sesion']['aplicar']> => {
      const aplicacion = aplicarEnCocina(db, esquemaLlamadaHerramienta.parse(llamada), Date.now())
      if (aplicacion.sesion.fase !== 'cocinar') {
        voz.detener()
        lector.detener()
        propietario = null
      }
      return aplicacion
    }
  )
}

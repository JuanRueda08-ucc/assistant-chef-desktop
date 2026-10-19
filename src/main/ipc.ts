import { ipcMain } from 'electron'
import { z } from 'zod'
import { esquemaId } from '@shared/esquemas/receta'
import { PORCIONES_MAX, PORCIONES_MIN, esquemaPreferencias } from '@shared/esquemas/sesion'
import { esquemaLlamadaHerramienta } from '@shared/ia/herramientas'
import { CANALES_IPC, type ApiChef } from '@shared/types/ipc'
import { aplicarEnCocina, iniciarCocina, retomarCocina } from './cocina'
import { buscarEnBase } from './db/busqueda'
import type { BaseDatos } from './db/conexion'
import { listarRecetas, obtenerReceta } from './db/recetas'

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
export function registrarIpc(db: BaseDatos): void {
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
    (_evento, llamada: unknown): Resultado<ApiChef['sesion']['aplicar']> =>
      aplicarEnCocina(db, esquemaLlamadaHerramienta.parse(llamada), Date.now())
  )
}

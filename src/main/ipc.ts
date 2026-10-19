import { ipcMain } from 'electron'
import { esquemaId } from '@shared/esquemas/receta'
import { esquemaPreferencias } from '@shared/esquemas/sesion'
import { CANALES_IPC, type ApiChef } from '@shared/types/ipc'
import { buscarEnBase } from './db/busqueda'
import type { BaseDatos } from './db/conexion'
import { listarRecetas, obtenerReceta } from './db/recetas'

type Resultado<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>

/**
 * Implementa en main los canales de src/shared/types/ipc.ts. Todo argumento que llega del
 * renderer se valida con zod antes de usarse.
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
}

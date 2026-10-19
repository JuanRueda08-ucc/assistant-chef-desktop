// Contrato IPC entre renderer (vía preload) y main. Los nombres de canal se usan en ambos lados.

import type { Receta } from './receta'

export const CANALES_IPC = {
  recetasListar: 'recetas:listar',
  recetasObtener: 'recetas:obtener'
} as const

/** Lo necesario para listar recetas sin cargar ingredientes ni pasos. */
export type ResumenReceta = Pick<
  Receta,
  | 'id'
  | 'slug'
  | 'titulo'
  | 'descripcion'
  | 'porcionesBase'
  | 'tiempoTotalMin'
  | 'tiempoActivoMin'
  | 'dificultad'
  | 'origen'
  | 'estadoRevision'
  | 'imagen'
>

/** API que el preload expone como `window.api`. */
export interface ApiChef {
  recetas: {
    listar(): Promise<ResumenReceta[]>
    obtener(id: string): Promise<Receta | null>
  }
}

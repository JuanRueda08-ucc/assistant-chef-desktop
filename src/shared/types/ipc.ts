// Contrato IPC entre renderer (vía preload) y main. Los nombres de canal se usan en ambos lados.

import type { ResultadoBusqueda } from './busqueda'
import type { Receta } from './receta'
import type { Preferencias } from './sesion'

export const CANALES_IPC = {
  recetasListar: 'recetas:listar',
  recetasObtener: 'recetas:obtener',
  recetasBuscar: 'recetas:buscar'
} as const

/** Lo necesario para listar recetas y mostrar sus etiquetas sin cargar ingredientes ni pasos. */
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
  | 'dietas'
  | 'alergenos'
  | 'equipo'
  | 'imagen'
>

/** API que el preload expone como `window.api`. */
export interface ApiChef {
  recetas: {
    listar(): Promise<ResumenReceta[]>
    obtener(id: string): Promise<Receta | null>
    buscar(preferencias: Preferencias): Promise<ResultadoBusqueda>
  }
}

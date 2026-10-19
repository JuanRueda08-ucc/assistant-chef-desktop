// Contrato IPC entre renderer (vía preload) y main. Los nombres de canal se usan en ambos lados.

import type { AplicacionHerramienta, LlamadaHerramienta } from '../ia/herramientas'
import type { ResultadoBusqueda } from './busqueda'
import type { Ingrediente, Receta } from './receta'
import type { Preferencias, SesionCocina } from './sesion'

export const CANALES_IPC = {
  catalogoIngredientes: 'catalogo:ingredientes',
  recetasListar: 'recetas:listar',
  recetasObtener: 'recetas:obtener',
  recetasBuscar: 'recetas:buscar',
  sesionRetomar: 'sesion:retomar',
  sesionIniciar: 'sesion:iniciar',
  sesionAplicar: 'sesion:aplicar'
} as const

export interface DatosIniciarCocina {
  recetaId: string
  porciones: number
  preferencias: Preferencias
}

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
  catalogo: {
    /** Catálogo completo de ingredientes, ordenado por nombre. */
    ingredientes(): Promise<Ingrediente[]>
  }
  recetas: {
    listar(): Promise<ResumenReceta[]>
    obtener(id: string): Promise<Receta | null>
    buscar(preferencias: Preferencias): Promise<ResultadoBusqueda>
  }
  sesion: {
    /** La sesión que estaba cocinando al cerrar la app (temporizadores al día), o `null`. */
    retomar(): Promise<SesionCocina | null>
    /** Empieza a cocinar; descarta la sesión cocinando anterior, si había. */
    iniciar(datos: DatosIniciarCocina): Promise<SesionCocina>
    /** Aplica una herramienta (botón, orden local o modelo) y guarda si tuvo efecto. */
    aplicar(llamada: LlamadaHerramienta): Promise<AplicacionHerramienta>
  }
}

// Ideas de recetas que propone el chef con la IA (tarea 39, decisión 0019): cortas, para elegir.
// La receta completa se escribe solo para la idea elegida (tarea 40).

import type { Alergeno, Dieta, Dificultad, Equipo, RecetaGenerada } from './receta'

export const FUENTES_IDEA = ['internet', 'memoria'] as const
/** `internet`: Gemini buscó en Google. `memoria`: la creó sin buscar, y la pantalla lo indica. */
export type FuenteIdea = (typeof FUENTES_IDEA)[number]

export interface IdeaModelo {
  titulo: string
  descripcion: string
  /** Nombres sin cantidades. El código decide qué tienes, qué falta y qué se descarta. */
  ingredientes: string[]
  tiempoTotalMin: number
  dificultad: Dificultad
}

export interface FuenteWeb {
  titulo: string
  url: string
}

/** Lo que el backend envía al proveedor. */
export interface PeticionIdeas {
  ingredientes: string[]
  porciones: number
  restricciones: Dieta[]
  alergias: Alergeno[]
  tiempoMaxMin: number | null
  nivel: Dificultad | null
  equipo: Equipo[]
  /** Títulos que ya se mostraron, para «dame otras». */
  excluir: string[]
}

export interface RespuestaIdeas {
  ideas: IdeaModelo[]
  fuente: FuenteIdea
  fuentes: FuenteWeb[]
  /** HTML de Google que sus términos exigen mostrar junto a un resultado con búsqueda. */
  sugerenciasBusqueda: string | null
}

/** Idea ya comprobada por el código. */
export interface IdeaReceta extends IdeaModelo {
  id: string
  tienes: string[]
  faltan: string[]
  /** Fuera del catálogo: no se pueden comprobar sus alérgenos ni si encajan con una dieta. */
  sinVerificar: string[]
}

export type ResultadoIdeas =
  | {
      ok: true
      ideas: IdeaReceta[]
      fuente: FuenteIdea
      fuentes: FuenteWeb[]
      sugerenciasBusqueda: string | null
    }
  | { ok: false; mensaje: string }

export type ResultadoRecetaGenerada =
  ({ ok: true } & RecetaGenerada) | { ok: false; mensaje: string }

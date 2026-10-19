// Resultado de buscar recetas (docs/modelo-recetas.md, "Elegir recetas"). Lo calcula
// `buscarRecetas` en src/shared/recetas/busqueda.ts y lo muestra la pantalla Elegir.

import type { ResumenReceta } from './ipc'

export const MOTIVOS_DESCARTE = [
  'no_revisada',
  'restriccion',
  'alergia',
  'equipo',
  'tiempo',
  'nivel'
] as const
export type MotivoDescarte = (typeof MOTIVOS_DESCARTE)[number]

/** Una sustitución que el usuario puede hacer con lo que tiene para cubrir un faltante. */
export interface OpcionSustitucion {
  sustitucionId: string
  ingredienteDestinoId: string
  nombreDestino: string
  ratio: number
  impacto: string
  /** `true` si la sustitución es específica de esta receta. */
  especifica: boolean
}

/** Ingrediente no opcional de la receta que el usuario no tiene. */
export interface Faltante {
  ingredienteId: string
  nombre: string
  /** Primero las específicas de la receta, luego las generales. Vacía si no hay ninguna. */
  sustituciones: OpcionSustitucion[]
}

export interface ResultadoReceta {
  receta: ResumenReceta
  /** Ingredientes distintos no opcionales de la receta (el "de 12" de "tienes 8 de 12"). */
  ingredientesObligatorios: number
  /** Ingredientes no opcionales cubiertos (los del usuario y los básicos de despensa), de 0 a 1. */
  cobertura: number
  /** Igual que `cobertura`, contando también los faltantes que tienen sustitución. */
  coberturaConSustituciones: number
  /** Para ordenar: cobertura menos penalización por faltante, más bonus por sustitución. */
  puntuacion: number
  /** Panel "qué falta". */
  faltantes: Faltante[]
  /** Opcionales que el usuario no tiene; no penalizan, solo se informan. */
  opcionalesFaltantes: { ingredienteId: string; nombre: string }[]
}

export interface Descarte {
  recetaId: string
  /** Todos los filtros duros que no pasa. */
  motivos: MotivoDescarte[]
}

export interface ResultadoBusqueda {
  /** Ordenados de mejor a peor. */
  resultados: ResultadoReceta[]
  descartadas: Descarte[]
  /** Ninguna receta llega al umbral de cobertura: conviene ofrecer una receta generada (tarea 17). */
  ofrecerGenerada: boolean
}

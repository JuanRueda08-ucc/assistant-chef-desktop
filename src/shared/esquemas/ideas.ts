// Esquemas zod que espejan src/shared/types/ideas.ts.

import { z } from 'zod'
import {
  FUENTES_IDEA,
  type FuenteWeb,
  type IdeaModelo,
  type PeticionIdeas,
  type RespuestaIdeas
} from '../types/ideas'
import type { Afirmar, Igual } from './coincidencia'
import { esquemaAlergeno, esquemaDieta, esquemaDificultad, esquemaEquipo } from './receta'
import { esquemaPreferencias } from './sesion'

export const MAX_IDEAS = 4

const nombre = z.string().trim().min(1).max(100)

export const esquemaIdeaModelo = z.strictObject({
  titulo: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().min(1).max(400),
  ingredientes: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  tiempoTotalMin: z.number().int().positive().max(1440),
  dificultad: esquemaDificultad
})

export const esquemaFuenteWeb = z.strictObject({
  titulo: z.string().trim().min(1).max(200),
  url: z.url({ protocol: /^https$/ })
})

export const esquemaPeticionIdeas = z.strictObject({
  ingredientes: z.array(nombre).min(1).max(150),
  porciones: z.number().int().positive().max(100),
  restricciones: z.array(esquemaDieta),
  alergias: z.array(esquemaAlergeno),
  tiempoMaxMin: z.number().int().positive().nullable(),
  nivel: esquemaDificultad.nullable(),
  equipo: z.array(esquemaEquipo),
  excluir: z.array(z.string().trim().min(1).max(120)).max(100)
})

export const esquemaRespuestaIdeas = z.strictObject({
  ideas: z.array(esquemaIdeaModelo).min(1).max(MAX_IDEAS),
  fuente: z.enum(FUENTES_IDEA),
  fuentes: z.array(esquemaFuenteWeb).max(20),
  sugerenciasBusqueda: z.string().max(50_000).nullable()
})

/** Lo que el renderer pide a main. Main convierte la despensa en nombres. */
export const esquemaProponerIpc = z.strictObject({
  preferencias: esquemaPreferencias,
  excluir: z.array(z.string().max(120)).max(100)
})

/** Lo que el renderer pide a main para escribir la receta de una idea. */
export const esquemaGenerarIpc = z.strictObject({
  idea: esquemaIdeaModelo,
  preferencias: esquemaPreferencias
})

export type _ComprobarIdeaModelo = Afirmar<Igual<z.output<typeof esquemaIdeaModelo>, IdeaModelo>>
export type _ComprobarFuenteWeb = Afirmar<Igual<z.output<typeof esquemaFuenteWeb>, FuenteWeb>>
export type _ComprobarPeticionIdeas = Afirmar<
  Igual<z.output<typeof esquemaPeticionIdeas>, PeticionIdeas>
>
export type _ComprobarRespuestaIdeas = Afirmar<
  Igual<z.output<typeof esquemaRespuestaIdeas>, RespuestaIdeas>
>

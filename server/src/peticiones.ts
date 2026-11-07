// Esquemas de lo que llega al backend (cuerpos de las peticiones) y de lo que devuelve el
// proveedor. Nada se usa sin pasar por aquí.

import { z } from 'zod'
import {
  esquemaAlergeno,
  esquemaDieta,
  esquemaId,
  esquemaIngrediente
} from '@shared/esquemas/receta'
import { esquemaIdeaModelo } from '@shared/esquemas/ideas'
import { esquemaPreferencias } from '@shared/esquemas/sesion'
import { CONTEXTOS_SUSTITUCION } from '@shared/types/receta'

/** Identificador de la instalación de la app, en la cabecera `X-Instalacion`. */
export const esquemaInstalacion = z.string().regex(/^[A-Za-z0-9-]{8,64}$/)

const catalogo = z.array(esquemaIngrediente).min(1).max(5000)

export const esquemaPeticionReceta = z.strictObject({
  preferencias: esquemaPreferencias,
  catalogo,
  tecnicas: z
    .array(z.strictObject({ id: esquemaId, nombre: z.string().min(1) }))
    .max(1000)
    .default([]),
  /** La idea elegida; la receta la desarrolla. */
  idea: esquemaIdeaModelo.nullable().default(null)
})

export const esquemaPeticionSustitucion = z.strictObject({
  ingredienteId: esquemaId,
  recetaId: esquemaId.nullable().default(null),
  tituloReceta: z.string().min(1).max(200).nullable().default(null),
  preferencias: z.strictObject({
    ingredientes: z.array(esquemaId).default([]),
    restricciones: z.array(esquemaDieta).default([]),
    alergias: z.array(esquemaAlergeno).default([])
  }),
  catalogo
})

export { esquemaPeticionIdeas } from '@shared/esquemas/ideas'

export const esquemaPeticionVoz = z.strictObject({})

/** Ocho segundos de PCM16 a 16 kHz en un WAV, en base64 (unos 342 KB). */
export const esquemaPeticionTranscripcion = z.strictObject({
  audio: z.base64().min(1).max(350_000)
})

/** Respuesta del proveedor para el token de voz. */
export { esquemaTokenVoz } from '@shared/esquemas/voz'

/** Una sugerencia del modelo; se descartan las que no cumplen, sin fallar el resto. */
export const esquemaSugerenciaModelo = z.object({
  ingredienteDestinoId: z.string(),
  ratio: z.number().positive().max(10),
  impacto: z.string().trim().min(1).max(200),
  contexto: z.enum(CONTEXTOS_SUSTITUCION).optional()
})

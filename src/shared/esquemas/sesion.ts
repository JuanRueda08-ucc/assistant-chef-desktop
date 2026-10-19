// Esquemas zod que espejan src/shared/types/sesion.ts. Validan la sesión al leerla de SQLite.

import { z } from 'zod'
import {
  ESTADOS_TEMPORIZADOR,
  FASES,
  OBJETIVOS_SENALAR,
  type EstadoAvatar,
  type EventoSesion,
  type Preferencias,
  type SesionCocina,
  type SustitucionAplicada,
  type Temporizador
} from '../types/sesion'
import type { Afirmar, Igual } from './coincidencia'
import {
  esquemaAlergeno,
  esquemaDieta,
  esquemaDificultad,
  esquemaEquipo,
  esquemaId,
  esquemaReceta
} from './receta'

/** Límites de `cambiar_porciones` en docs/ia-chef.md. */
export const PORCIONES_MIN = 1
export const PORCIONES_MAX = 20

const esquemaPorciones = z.number().int().min(PORCIONES_MIN).max(PORCIONES_MAX)

export const esquemaEstadoAvatar = z.discriminatedUnion('accion', [
  z.strictObject({ accion: z.literal('hablar') }),
  z.strictObject({ accion: z.literal('senalar'), objetivo: z.enum(OBJETIVOS_SENALAR) }),
  z.strictObject({ accion: z.literal('esperar') }),
  z.strictObject({ accion: z.literal('celebrar'), intensidad: z.enum(['breve', 'completa']) })
])

export const esquemaPreferencias = z.strictObject({
  ingredientes: z.array(esquemaId),
  porciones: esquemaPorciones,
  restricciones: z.array(esquemaDieta),
  alergias: z.array(esquemaAlergeno),
  tiempoMaxMin: z.number().int().positive().nullable(),
  nivel: esquemaDificultad.nullable(),
  equipo: z.array(esquemaEquipo)
})

export const esquemaSustitucionAplicada = z.strictObject({
  ingredienteOrigenId: esquemaId,
  ingredienteDestinoId: esquemaId,
  ratio: z.number().positive(),
  sustitucionId: esquemaId.nullable()
})

export const esquemaTemporizador = z.strictObject({
  id: z.string().min(1),
  etiqueta: z.string().trim().min(1),
  pasoId: esquemaId.nullable(),
  duracionSeg: z.number().int().positive(),
  estado: z.enum(ESTADOS_TEMPORIZADOR),
  iniciadoEn: z.number().int().nonnegative().nullable(),
  restanteSeg: z.number().nonnegative()
})

export const esquemaEventoSesion = z.strictObject({
  en: z.number().int().nonnegative(),
  tipo: z.string().min(1),
  descripcion: z.string()
})

export const esquemaSesionCocina = z.strictObject({
  id: z.string().min(1),
  fase: z.enum(FASES),
  preferencias: esquemaPreferencias,
  recetaId: esquemaId.nullable(),
  recetaAdaptada: esquemaReceta.nullable(),
  porciones: esquemaPorciones,
  sustituciones: z.array(esquemaSustitucionAplicada),
  pasoActual: z.number().int().positive().nullable(),
  pasosHechos: z.array(esquemaId),
  temporizadores: z.array(esquemaTemporizador),
  eventos: z.array(esquemaEventoSesion),
  actualizadaEn: z.iso.datetime()
})

export type _ComprobarEstadoAvatar = Afirmar<
  Igual<z.output<typeof esquemaEstadoAvatar>, EstadoAvatar>
>
export type _ComprobarPreferencias = Afirmar<
  Igual<z.output<typeof esquemaPreferencias>, Preferencias>
>
export type _ComprobarSustitucionAplicada = Afirmar<
  Igual<z.output<typeof esquemaSustitucionAplicada>, SustitucionAplicada>
>
export type _ComprobarTemporizador = Afirmar<
  Igual<z.output<typeof esquemaTemporizador>, Temporizador>
>
export type _ComprobarEventoSesion = Afirmar<
  Igual<z.output<typeof esquemaEventoSesion>, EventoSesion>
>
export type _ComprobarSesionCocina = Afirmar<
  Igual<z.output<typeof esquemaSesionCocina>, SesionCocina>
>

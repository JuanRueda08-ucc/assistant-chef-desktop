// Chats con el chef guardados por cuenta (decisiones 0024 y 0025). Viven en la tabla `chats` de
// Supabase, protegida para que cada cuenta solo lea y escriba los suyos; nunca en el equipo.

import type { ContenidoChat } from '../ia/chat'

/** Lo que un turno añadió a la despensa, calculado por la app (no por el modelo). */
export interface CambiosTurno {
  /** Ingredientes del catálogo añadidos en este turno. */
  ingredientes: string[]
  /** Ingredientes fuera del catálogo añadidos en este turno. */
  sinIdentificar: string[]
  /** Porciones nuevas, o `null` si no cambiaron. */
  porciones: number | null
}

export interface TurnoConversacion {
  /** `null` cuando lo inicia un botón de la app, como «Buscar recetas con esto». */
  pregunta: string | null
  respuesta: string
  cambios: CambiosTurno
  /** El turno buscó recetas o pidió ideas: la respuesta lleva tarjetas. */
  recetas: boolean
}

/** Un chat con el chef, con su nombre (pedido del autor, 2026-11-08). */
export interface ChatChef {
  /** UUID que pone la app al empezar el chat. */
  id: string
  /** Provisional (lo escrito por la persona) hasta que llega el de la IA. */
  titulo: string
  tituloDeIA: boolean
  turnos: TurnoConversacion[]
  /** Contexto que se manda al modelo, para seguir el chat al volver a él. */
  contexto: ContenidoChat[][]
  /** Última modificación, en milisegundos. */
  actualizado: number
}

/** Máximos que comprueban la app, main y la tabla. */
export const MAX_TURNOS_CHAT = 12
export const MAX_CONTEXTO_CHAT = 4
export const MAX_CHATS_LISTA = 50

// Esquemas zod que espejan src/shared/types/chats.ts. Main valida con ellos lo que manda el
// renderer y lo que devuelve Supabase.

import { z } from 'zod'
import { esquemaContenidoChat } from '../ia/chat'
import {
  MAX_CONTEXTO_CHAT,
  MAX_TURNOS_CHAT,
  type CambiosTurno,
  type ChatChef,
  type TurnoConversacion
} from '../types/chats'
import type { Afirmar, Igual } from './coincidencia'

const id = z.string().min(1).max(100)

export const esquemaCambiosTurno = z.strictObject({
  ingredientes: z.array(id).max(100),
  sinIdentificar: z.array(z.string().min(1).max(100)).max(100),
  porciones: z.number().int().min(1).max(100).nullable()
})

export const esquemaTurnoConversacion = z.strictObject({
  pregunta: z.string().max(4000).nullable(),
  respuesta: z.string().max(8000),
  cambios: esquemaCambiosTurno,
  recetas: z.boolean()
})

export const esquemaChatChef = z.strictObject({
  id: z.uuid(),
  titulo: z.string().trim().min(1).max(200),
  tituloDeIA: z.boolean(),
  turnos: z.array(esquemaTurnoConversacion).max(MAX_TURNOS_CHAT),
  contexto: z.array(z.array(esquemaContenidoChat).max(40)).max(MAX_CONTEXTO_CHAT),
  actualizado: z.number().int().nonnegative()
})

export type _ComprobarCambiosTurno = Afirmar<
  Igual<z.output<typeof esquemaCambiosTurno>, CambiosTurno>
>
export type _ComprobarTurnoConversacion = Afirmar<
  Igual<z.output<typeof esquemaTurnoConversacion>, TurnoConversacion>
>
export type _ComprobarChatChef = Afirmar<Igual<z.output<typeof esquemaChatChef>, ChatChef>>

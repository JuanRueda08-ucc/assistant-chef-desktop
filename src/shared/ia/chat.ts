import { z } from 'zod'
import { esquemaPreferencias } from '../esquemas/sesion'

// Formato del transporte generateContent. Sus opcionales y firmas opacas se conservan tal
// cual para continuar llamadas de Gemini; no son campos del estado de la app.
const funcion = { name: z.string().min(1).max(80), id: z.string().max(200).optional() }
export const esquemaParteChat = z
  .strictObject({
    text: z.string().max(8000).optional(),
    thought: z.boolean().optional(),
    thoughtSignature: z.string().max(65536).optional(),
    functionCall: z
      .strictObject({ ...funcion, args: z.record(z.string(), z.unknown()) })
      .optional(),
    functionResponse: z
      .strictObject({ ...funcion, response: z.record(z.string(), z.unknown()) })
      .optional()
  })
  .refine(
    (p) =>
      [p.text !== undefined, !!p.functionCall, !!p.functionResponse].filter(Boolean).length === 1
  )
export const esquemaContenidoChat = z
  .strictObject({
    role: z.enum(['user', 'model']),
    parts: z.array(esquemaParteChat).min(1).max(12)
  })
  .refine((c) =>
    c.parts.every((p) =>
      c.role === 'model'
        ? !p.functionResponse
        : !p.functionCall && !p.thought && !p.thoughtSignature
    )
  )
export type ContenidoChat = z.output<typeof esquemaContenidoChat>
export type LlamadaChat = NonNullable<ContenidoChat['parts'][number]['functionCall']>
const mensajes = z
  .array(esquemaContenidoChat)
  .min(1)
  .max(40)
  .refine((m) => JSON.stringify(m).length <= 300_000, 'La conversación es demasiado larga.')
const pantalla = z.enum(['preparar', 'elegir', 'cocinar'])
export const esquemaChatIpc = z.strictObject({
  pantalla,
  preferencias: esquemaPreferencias,
  mensajes
})
export type PeticionChatIpc = z.output<typeof esquemaChatIpc>
export const esquemaPeticionChat = z.strictObject({
  pantalla,
  contexto: z.string().min(1).max(100_000),
  mensajes
})
export type PeticionChat = z.output<typeof esquemaPeticionChat>
export const esquemaRespuestaChat = z.strictObject({
  contenido: esquemaContenidoChat.refine((c) => c.role === 'model'),
  simulado: z.boolean()
})
export type RespuestaChat = z.output<typeof esquemaRespuestaChat>

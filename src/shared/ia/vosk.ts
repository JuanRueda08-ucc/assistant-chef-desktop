import { z } from 'zod'
import type { ResultadoVosk } from '../types/voz'

export const CONFIANZA_ORDEN_MIN = 0.8
const esquemaResultado = z.object({
  text: z.string().max(200),
  result: z.array(z.object({ conf: z.number().min(0).max(1) })).default([])
})

/** Confianza de la palabra menos segura; nunca ejecutamos resultados parciales. */
export function resultadoVosk(bruto: unknown): ResultadoVosk | null {
  const r = esquemaResultado.safeParse(bruto)
  if (!r.success || !r.data.text.trim()) return null
  return {
    texto: r.data.text,
    confianza: r.data.result.length ? Math.min(...r.data.result.map((p) => p.conf)) : 0
  }
}

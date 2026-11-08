// Título de cada chat con el chef, como en los asistentes de conversación (pedido del autor,
// 2026-11-08). Lo propone la IA a partir del primer intercambio; mientras llega, o si falla, la app
// usa el principio de lo que escribió la persona. Puro.

import { z } from 'zod'

export const LARGO_MAX_TITULO = 40

export const esquemaPeticionTitulo = z.strictObject({
  pregunta: z.string().trim().min(1).max(2000),
  respuesta: z.string().max(4000)
})
export type PeticionTitulo = z.output<typeof esquemaPeticionTitulo>

export const esquemaRespuestaTitulo = z.strictObject({ titulo: z.string().nullable() })

/**
 * Deja el título en una línea corta: sin comillas, prefijos («Título:»), punto final ni espacios de
 * más, con mayúscula inicial. Si pasa del largo, se corta en la última palabra entera. `null` si
 * no queda nada.
 */
export function limpiarTitulo(bruto: string): string | null {
  let t = (bruto.split(/\r?\n/).find((l) => l.trim()) ?? '')
    .replace(/^\s*(t[ií]tulo|nombre)\s*:\s*/i, '')
    .replace(/[*_#`"“”«»¿?¡!]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '')
    .trim()
  if (!t) return null
  if (t.length > LARGO_MAX_TITULO) {
    const corte = t.slice(0, LARGO_MAX_TITULO + 1)
    const espacio = corte.lastIndexOf(' ')
    t = (espacio > 10 ? corte.slice(0, espacio) : corte.slice(0, LARGO_MAX_TITULO)).trim()
    t = t.replace(/[.,;:]+$/, '').replace(/\s+(y|de|con|para|el|la|los|las|un|una)$/i, '')
  }
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1)
}

/** El que se ve mientras llega el de la IA, o si no llega. */
export function tituloProvisional(texto: string): string {
  return limpiarTitulo(texto) ?? 'Conversación con el chef'
}

// Comprobaciones en código de una receta escrita por la IA (tarea 40, decisión 0019). El modelo no
// siempre cumple las instrucciones. Son filtros, no una garantía: la interfaz siempre avisa.

import {
  DIFICULTADES,
  type Ingrediente,
  type IngredienteReceta,
  type RecetaGenerada
} from '../types/receta'
import type { Preferencias } from '../types/sesion'
import { normalizarTexto } from './catalogo'
import { indexar } from './etiquetas'
import { choca, esProteinaAnimal } from './ideas'

/** Id para un ingrediente fuera del catálogo: «Leche de coco» → `nuevo_leche_de_coco`. */
export function idIngredienteNuevo(nombre: string): string {
  const base = normalizarTexto(nombre)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `nuevo_${base || 'ingrediente'}`
}

/**
 * Lo que impide mostrar la receta, en frases que también sirven para que el modelo la corrija.
 * Lista vacía si pasa. Main la repite al empezar, por si cambiaron las alergias mientras tanto.
 */
export function problemasRecetaGenerada(
  { receta, ingredientesNuevos }: RecetaGenerada,
  preferencias: Preferencias,
  catalogo: readonly Ingrediente[]
): string[] {
  const problemas: string[] = []
  const porId = indexar([...catalogo, ...ingredientesNuevos])

  if (choca(receta.titulo, null, preferencias))
    problemas.push('el título nombra algo que choca con las alergias o la dieta')
  receta.pasos.forEach((paso) => {
    if (choca(paso.texto, null, preferencias))
      problemas.push(`el paso ${paso.orden} nombra algo que choca con las alergias o la dieta`)
  })

  for (const ir of receta.ingredientes) {
    const ingrediente = porId.get(ir.ingredienteId)
    if (!ingrediente) {
      problemas.push(`ingrediente que no está en el catálogo: ${ir.ingredienteId}`)
      continue
    }
    if (choca(ingrediente.nombre, ingrediente, preferencias))
      problemas.push(`${ingrediente.nombre} choca con las alergias o la dieta`)

    const usos = receta.pasos.filter((p) =>
      p.ingredientes.some((ip) => ip.ingredienteRecetaId === ir.id)
    )
    if (esProteinaAnimal(ingrediente) && !usos.some((p) => p.seguridad !== null))
      problemas.push(
        `falta \`seguridad\` (temperatura o señal de cocción) en un paso que use ${ingrediente.nombre}`
      )
  }

  if (preferencias.tiempoMaxMin !== null && receta.tiempoTotalMin > preferencias.tiempoMaxMin)
    problemas.push(`tarda más de ${preferencias.tiempoMaxMin} minutos`)
  if (
    preferencias.nivel !== null &&
    DIFICULTADES.indexOf(receta.dificultad) > DIFICULTADES.indexOf(preferencias.nivel)
  )
    problemas.push(`supera la dificultad ${preferencias.nivel}`)
  // Sin equipo indicado no se filtra, igual que en la búsqueda.
  const sinEquipo = receta.equipo.filter(
    (e) => preferencias.equipo.length > 0 && !preferencias.equipo.includes(e)
  )
  if (sinEquipo.length > 0) problemas.push(`usa equipo que no hay: ${sinEquipo.join(', ')}`)
  if (receta.pasos.some((p) => (p.temporizador?.segundos ?? 0) > receta.tiempoTotalMin * 60))
    problemas.push('un temporizador dura más que el tiempo total de la receta')

  return problemas
}

/**
 * Los ingredientes de la cuenta más los que escribió a mano, con el id que tendrían en una receta
 * guardada. Permite reconocer su «yuca» en Mis recetas sin que cuente para buscar en el catálogo.
 */
export function ingredientesConLibres(
  preferencias: Pick<Preferencias, 'ingredientes' | 'ingredientesSinIdentificar'>
): string[] {
  return [
    ...preferencias.ingredientes,
    ...preferencias.ingredientesSinIdentificar.map(idIngredienteNuevo)
  ]
}

export type EstadoIngredienteGenerado = 'tienes' | 'basico' | 'falta' | 'opcional'

/** Si la persona tiene el ingrediente, calculado en código como en las recetas guardadas. */
export function estadoIngredienteGenerado(
  ir: Pick<IngredienteReceta, 'ingredienteId' | 'opcional'>,
  ingrediente: Ingrediente | undefined,
  preferencias: Pick<Preferencias, 'ingredientes' | 'ingredientesSinIdentificar'>
): EstadoIngredienteGenerado {
  if (preferencias.ingredientes.includes(ir.ingredienteId)) return 'tienes'
  const nombre = normalizarTexto(ingrediente?.nombre ?? '')
  if (preferencias.ingredientesSinIdentificar.some((t) => normalizarTexto(t) === nombre))
    return 'tienes'
  if (ingrediente?.esBasicoDespensa) return 'basico'
  return ir.opcional ? 'opcional' : 'falta'
}

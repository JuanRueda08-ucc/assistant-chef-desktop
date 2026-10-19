// Aplicar una sustitución a una receta (docs/modelo-recetas.md, "Sustituciones").
// El resultado es una copia: la sustitución vive en la sesión, no en la receta guardada.

import type { Receta, Sustitucion } from '../types/receta'
import { conEtiquetas, type Catalogo } from './etiquetas'
import { redondear } from './redondeo'

/**
 * Cambia cada uso de `ingredienteOrigenId` por `ingredienteDestinoId`, multiplica la cantidad por
 * `ratio` (misma unidad) y recalcula dietas y alérgenos con el catálogo.
 *
 * Aplícala sobre la receta original y escala después (`escalarReceta`), para no redondear dos
 * veces sobre cantidades ya escaladas.
 *
 * Lanza un error si la sustitución es de otra receta, si la receta no usa el ingrediente de
 * origen o si el destino no está en el catálogo.
 */
export function aplicarSustitucion(
  receta: Receta,
  sustitucion: Pick<
    Sustitucion,
    'id' | 'ingredienteOrigenId' | 'ingredienteDestinoId' | 'ratio' | 'recetaId'
  >,
  catalogo: Catalogo
): Receta {
  if (sustitucion.recetaId !== null && sustitucion.recetaId !== receta.id) {
    throw new Error(
      `la sustitución ${sustitucion.id} es de la receta ${sustitucion.recetaId}, no de ${receta.id}`
    )
  }
  if (!receta.ingredientes.some((ir) => ir.ingredienteId === sustitucion.ingredienteOrigenId)) {
    throw new Error(
      `la receta ${receta.id} no usa ${sustitucion.ingredienteOrigenId}, no se puede sustituir`
    )
  }

  const sustituida: Receta = {
    ...receta,
    ingredientes: receta.ingredientes.map((ir) => {
      if (ir.ingredienteId !== sustitucion.ingredienteOrigenId) return ir
      const cantidad =
        ir.cantidad === null || ir.unidad === 'al_gusto' || ir.unidad === 'pizca'
          ? ir.cantidad
          : redondear(ir.cantidad * sustitucion.ratio, ir.redondeo ?? 1)
      return { ...ir, ingredienteId: sustitucion.ingredienteDestinoId, cantidad }
    })
  }
  // conEtiquetas copia la receta y falla si el destino no está en el catálogo.
  return conEtiquetas(sustituida, catalogo)
}

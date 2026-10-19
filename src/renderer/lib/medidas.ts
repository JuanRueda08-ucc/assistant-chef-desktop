// Cómo se muestra un ingrediente con su cantidad en Cocinar: el nombre arriba y, debajo, la
// medida casera con la exacta entre paréntesis y la preparación. Puro, para poder probarlo.

import { aUnidadCasera, formatearMedida } from '@shared/recetas/unidades'
import type { Ingrediente, Unidad } from '@shared/types/receta'

export interface IngredienteMostrado {
  nombre: string
  detalle: string
}

export function describirIngrediente(datos: {
  cantidad: number | null
  unidad: Unidad
  ingrediente: Pick<Ingrediente, 'nombre' | 'densidadGMl' | 'pesoUnidadG'> | undefined
  /** Si el ingrediente no está en el catálogo. */
  idIngrediente: string
  preparacion?: string | null
}): IngredienteMostrado {
  const nombre = datos.ingrediente?.nombre ?? datos.idIngrediente
  const partes: string[] = []

  if (datos.unidad === 'al_gusto' || datos.cantidad === null) {
    partes.push('al gusto')
  } else {
    const medida = aUnidadCasera(
      datos.cantidad,
      datos.unidad,
      datos.ingrediente ?? { densidadGMl: null, pesoUnidadG: null }
    )
    let texto = formatearMedida(medida)
    if (medida.unidad === 'unidad' && medida.cantidad !== null) {
      texto += medida.cantidad > 1 ? ' unidades' : ' unidad'
    }
    if ((datos.unidad === 'g' || datos.unidad === 'ml') && medida.unidad !== datos.unidad) {
      texto += ` (${datos.cantidad} ${datos.unidad})`
    }
    partes.push(texto)
  }
  if (datos.preparacion) partes.push(datos.preparacion)
  return { nombre, detalle: partes.join(', ') }
}

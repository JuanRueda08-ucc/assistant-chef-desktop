// Datos de prueba compartidos por los tests de src/shared/recetas/. Usa la semilla real.

import { z } from 'zod'
import ingredientesSemilla from '../../../db/seed/ingredientes.json'
import arrozConPolloSemilla from '../../../db/seed/recetas/arroz-con-pollo.json'
import { esquemaIngrediente, esquemaReceta } from '../esquemas/receta'
import type { Ingrediente, Receta } from '../types/receta'

/** Catálogo de la semilla. */
export const catalogo: Ingrediente[] = z.array(esquemaIngrediente).parse(ingredientesSemilla)

/** Arroz con pollo (4 porciones) validado, sin etiquetas derivadas. */
export function arrozConPollo(): Receta {
  return esquemaReceta.parse(arrozConPolloSemilla)
}

/** Ingrediente de la receta que usa `ingredienteId` del catálogo. */
export function ingredienteDe(
  receta: Receta,
  ingredienteId: string
): Receta['ingredientes'][number] {
  const ir = receta.ingredientes.find((i) => i.ingredienteId === ingredienteId)
  if (!ir) throw new Error(`la receta no usa ${ingredienteId}`)
  return ir
}

/** Ingrediente de catálogo con valores por defecto. */
export function ingrediente(datos: Partial<Ingrediente> & Pick<Ingrediente, 'id'>): Ingrediente {
  return esquemaIngrediente.parse({ nombre: datos.id, categoria: 'despensa', ...datos })
}

/**
 * Receta mínima de un paso con los ingredientes dados (todos usados en el paso). `campos`
 * sobrescribe los de la cabecera (id, titulo, tiempoTotalMin…).
 */
export function recetaCon(
  ingredientes: Record<string, unknown>[],
  campos: Record<string, unknown> = {}
): Receta {
  return esquemaReceta.parse({
    id: 'prueba',
    slug: 'prueba',
    titulo: 'Prueba',
    descripcion: 'Receta de prueba.',
    porcionesBase: 2,
    tiempoTotalMin: 10,
    tiempoActivoMin: 10,
    dificultad: 'facil',
    origen: 'revisada',
    estadoRevision: 'revisada',
    ...campos,
    ingredientes: ingredientes.map((ir, i) => ({ id: `ir_${i + 1}`, ...ir })),
    pasos: [
      {
        id: 'p1',
        orden: 1,
        texto: 'Mezcla todo.',
        requiereConfirmacion: false,
        ingredientes: ingredientes.map((_, i) => ({
          ingredienteRecetaId: `ir_${i + 1}`,
          fraccion: 1
        }))
      }
    ]
  })
}

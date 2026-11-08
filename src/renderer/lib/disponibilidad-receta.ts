// Qué ingredientes de una receta tiene la persona, cuáles le faltan y cuáles son básicos: lo usan el
// detalle de Elegir y el desplegable de «Para inspirarte hoy» en Inicio (tarea 45). Puro.

import {
  estadoIngredienteGenerado,
  type EstadoIngredienteGenerado
} from '@shared/recetas/receta-generada'
import { unirLista } from '@shared/recetas/lista'
import { NOMBRE_ALERGENO, NOMBRE_DIETA } from '@shared/textos'
import type { Faltante, MotivoDescarte, OpcionSustitucion } from '@shared/types/busqueda'
import type { Ingrediente, Receta } from '@shared/types/receta'
import type { Preferencias } from '@shared/types/sesion'
import { describirIngrediente } from './medidas'

export interface IngredienteConEstado {
  id: string
  estado: EstadoIngredienteGenerado
  nombre: string
  detalle: string
  sustituciones: OpcionSustitucion[]
}

/**
 * Los ingredientes de la receta (ya escalada) con su estado. Los faltantes de la búsqueda mandan y
 * aportan las sustituciones; sin ellos, se calcula igual que en las recetas generadas.
 */
export function ingredientesConEstado(
  receta: Pick<Receta, 'ingredientes'>,
  faltantes: readonly Faltante[],
  catalogo: readonly Ingrediente[],
  preferencias: Pick<Preferencias, 'ingredientes' | 'ingredientesSinIdentificar'>
): IngredienteConEstado[] {
  const faltan = new Map(faltantes.map((f) => [f.ingredienteId, f]))
  return receta.ingredientes.map((ir) => {
    const ingrediente = catalogo.find((i) => i.id === ir.ingredienteId)
    const faltante = faltan.get(ir.ingredienteId)
    return {
      id: ir.id,
      estado: faltante ? 'falta' : estadoIngredienteGenerado(ir, ingrediente, preferencias),
      sustituciones: faltante?.sustituciones ?? [],
      ...describirIngrediente({
        cantidad: ir.cantidad,
        unidad: ir.unidad,
        ingrediente,
        idIngrediente: ir.ingredienteId,
        preparacion: null
      })
    }
  })
}

/** Por qué no se propone una receta, en palabras, a partir de los motivos de la búsqueda. */
export function textoDescarte(
  motivos: readonly MotivoDescarte[],
  receta: Pick<Receta, 'alergenos' | 'dietas'>,
  preferencias: Pick<Preferencias, 'alergias' | 'restricciones'>
): string {
  const minusculas = (t: string): string => t.toLocaleLowerCase('es')
  const frases: Record<MotivoDescarte, () => string> = {
    alergia: () =>
      `Contiene ${unirLista(
        receta.alergenos
          .filter((a) => preferencias.alergias.includes(a))
          .map((a) => minusculas(NOMBRE_ALERGENO[a]))
      )}, y lo marcaste como alergia.`,
    restriccion: () =>
      `No encaja con tu dieta: ${unirLista(
        preferencias.restricciones
          .filter((d) => !receta.dietas.includes(d))
          .map((d) => minusculas(NOMBRE_DIETA[d]))
      )}.`,
    no_revisada: () => 'Aún no está revisada.',
    equipo: () => 'Necesita equipo de cocina que no tienes.',
    tiempo: () => 'Tarda más que tu tiempo máximo.',
    nivel: () => 'Es más difícil que tu nivel.'
  }
  return motivos.map((m) => frases[m]()).join(' ')
}

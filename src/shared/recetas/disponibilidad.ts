import type { Ingrediente, Receta } from '../types/receta'

export const MENSAJE_SIN_INGREDIENTES =
  'Selecciona al menos un ingrediente o díselo al chef antes de buscar recetas.'

/** Los básicos asumidos no sustituyen a una selección explícita del usuario. */
export function hayIngredientesSeleccionados(
  seleccion: readonly string[],
  catalogo: readonly Ingrediente[]
): boolean {
  const ids = new Set(seleccion)
  return catalogo.some((i) => !i.esBasicoDespensa && ids.has(i.id))
}

/** Cuenta solo ingredientes obligatorios distintos, como la cobertura de la búsqueda. */
export function recuentoDisponibilidad(
  receta: Pick<Receta, 'ingredientes'>,
  seleccion: readonly string[],
  catalogo: readonly Ingrediente[]
): { seleccionados: number; basicos: string[] } {
  const obligatorios = new Set(
    receta.ingredientes.filter((i) => !i.opcional).map((i) => i.ingredienteId)
  )
  const ids = new Set(seleccion)
  const usados = catalogo.filter((i) => obligatorios.has(i.id))
  return {
    seleccionados: usados.filter((i) => !i.esBasicoDespensa && ids.has(i.id)).length,
    basicos: usados.filter((i) => i.esBasicoDespensa).map((i) => i.nombre.toLocaleLowerCase('es'))
  }
}

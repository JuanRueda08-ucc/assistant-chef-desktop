// Dietas y alérgenos de una receta, derivados del catálogo. Nunca se escriben a mano ni se
// aceptan del modelo (AGENTS.md, reglas del dominio).

import {
  ALERGENOS,
  DIETAS,
  type Alergeno,
  type Dieta,
  type Ingrediente,
  type Receta
} from '../types/receta'

export interface Etiquetas {
  dietas: Dieta[]
  alergenos: Alergeno[]
}

export type Catalogo = ReadonlyMap<string, Ingrediente> | readonly Ingrediente[]

/**
 * Dietas con las que un ingrediente es incompatible: las del catálogo más las que se deducen
 * con seguridad de sus alérgenos y de otras dietas.
 */
export function dietasIncompatiblesDe(ingrediente: Ingrediente): Set<Dieta> {
  const incompatibles = new Set<Dieta>(ingrediente.dietasIncompatibles)
  const alergenos = new Set<Alergeno>(ingrediente.alergenos)

  if (alergenos.has('gluten')) incompatibles.add('sin_gluten')
  if (alergenos.has('lacteos')) incompatibles.add('sin_lactosa')
  // Pescado y marisco no son vegetarianos.
  if (alergenos.has('pescado') || alergenos.has('crustaceos') || alergenos.has('moluscos')) {
    incompatibles.add('vegetariana')
  }
  // Huevo y lácteos no son veganos; lo que no es vegetariano tampoco es vegano.
  if (alergenos.has('huevo') || alergenos.has('lacteos') || incompatibles.has('vegetariana')) {
    incompatibles.add('vegana')
  }
  return incompatibles
}

/**
 * Dietas compatibles y alérgenos de la receta, en el orden de `DIETAS` y `ALERGENOS`.
 * Los ingredientes opcionales también cuentan: es más seguro avisar de más.
 * Lanza un error si un ingrediente no está en el catálogo (no se puede etiquetar a ciegas).
 */
export function derivarEtiquetas(
  receta: Pick<Receta, 'ingredientes'>,
  catalogo: Catalogo
): Etiquetas {
  const porId = comoMapa(catalogo)
  const alergenos = new Set<Alergeno>()
  const incompatibles = new Set<Dieta>()

  for (const ir of receta.ingredientes) {
    const ingrediente = porId.get(ir.ingredienteId)
    if (!ingrediente) throw new Error(`ingrediente fuera del catálogo: ${ir.ingredienteId}`)
    ingrediente.alergenos.forEach((a) => alergenos.add(a))
    dietasIncompatiblesDe(ingrediente).forEach((d) => incompatibles.add(d))
  }

  return {
    dietas: DIETAS.filter((d) => !incompatibles.has(d)),
    alergenos: ALERGENOS.filter((a) => alergenos.has(a))
  }
}

/** Devuelve una copia de la receta con `dietas` y `alergenos` recalculados. */
export function conEtiquetas(receta: Receta, catalogo: Catalogo): Receta {
  return { ...structuredClone(receta), ...derivarEtiquetas(receta, catalogo) }
}

/** El catálogo como `Map` por id, tal cual si ya lo es. */
export function comoMapa(catalogo: Catalogo): ReadonlyMap<string, Ingrediente> {
  return esLista(catalogo) ? indexar(catalogo) : catalogo
}

function esLista(catalogo: Catalogo): catalogo is readonly Ingrediente[] {
  return Array.isArray(catalogo)
}

export function indexar(ingredientes: readonly Ingrediente[]): Map<string, Ingrediente> {
  return new Map(ingredientes.map((i) => [i.id, i]))
}

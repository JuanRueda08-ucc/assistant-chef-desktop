import { buscarRecetas, evaluarReceta } from '@shared/recetas/busqueda'
import { hayIngredientesSeleccionados } from '@shared/recetas/disponibilidad'
import type { EvaluacionReceta, ResultadoBusqueda } from '@shared/types/busqueda'
import type { Preferencias } from '@shared/types/sesion'
import { listarIngredientes, listarSustituciones } from './catalogo'
import type { BaseDatos } from './conexion'
import { problemasRecetaGenerada, ingredientesConLibres } from '@shared/recetas/receta-generada'
import { listarMisRecetas } from './mis-recetas'
import { listarRecetasCompletas, obtenerReceta } from './recetas'

/** Ejecuta la búsqueda pura sobre los datos de la base y, con cuenta, sobre sus recetas guardadas. */
export function buscarEnBase(
  db: BaseDatos,
  preferencias: Preferencias,
  incluirBorradores = false,
  usuarioId: string | null = null
): ResultadoBusqueda {
  const catalogo = listarIngredientes(db)
  if (!hayIngredientesSeleccionados(preferencias.ingredientes, catalogo))
    return { resultados: [], descartadas: [], ofrecerGenerada: false }
  // Las palabras cuentan también: un ingrediente sin verificar no tiene alérgenos conocidos.
  const mias = (usuarioId ? listarMisRecetas(db, usuarioId) : []).filter(
    (g) => problemasRecetaGenerada(g, preferencias, catalogo).length === 0
  )
  return buscarRecetas(
    { ...preferencias, ingredientes: ingredientesConLibres(preferencias) },
    [...listarRecetasCompletas(db), ...mias.map((g) => g.receta)],
    [...catalogo, ...mias.flatMap((g) => g.ingredientesNuevos)],
    listarSustituciones(db),
    { incluirBorradores }
  )
}

/**
 * Evalúa una receta de la base (no de Mis recetas) con las mismas reglas que `buscarEnBase`.
 * `null` si no existe.
 */
export function evaluarEnBase(
  db: BaseDatos,
  recetaId: string,
  preferencias: Preferencias,
  incluirBorradores = false
): EvaluacionReceta | null {
  const receta = obtenerReceta(db, recetaId)
  if (!receta) return null
  return evaluarReceta(
    { ...preferencias, ingredientes: ingredientesConLibres(preferencias) },
    receta,
    listarIngredientes(db),
    listarSustituciones(db),
    { incluirBorradores }
  )
}

import { buscarRecetas } from '@shared/recetas/busqueda'
import { hayIngredientesSeleccionados } from '@shared/recetas/disponibilidad'
import type { ResultadoBusqueda } from '@shared/types/busqueda'
import type { Preferencias } from '@shared/types/sesion'
import { listarIngredientes, listarSustituciones } from './catalogo'
import type { BaseDatos } from './conexion'
import { listarRecetasCompletas } from './recetas'

/** Ejecuta la búsqueda pura sobre los datos de la base. */
export function buscarEnBase(db: BaseDatos, preferencias: Preferencias): ResultadoBusqueda {
  const catalogo = listarIngredientes(db)
  if (!hayIngredientesSeleccionados(preferencias.ingredientes, catalogo))
    return { resultados: [], descartadas: [], ofrecerGenerada: false }
  return buscarRecetas(preferencias, listarRecetasCompletas(db), catalogo, listarSustituciones(db))
}

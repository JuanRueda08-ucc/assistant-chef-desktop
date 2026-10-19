import { buscarRecetas } from '@shared/recetas/busqueda'
import type { ResultadoBusqueda } from '@shared/types/busqueda'
import type { Preferencias } from '@shared/types/sesion'
import { listarIngredientes, listarSustituciones } from './catalogo'
import type { BaseDatos } from './conexion'
import { listarRecetasCompletas } from './recetas'

/** Ejecuta la búsqueda pura sobre los datos de la base. */
export function buscarEnBase(db: BaseDatos, preferencias: Preferencias): ResultadoBusqueda {
  return buscarRecetas(
    preferencias,
    listarRecetasCompletas(db),
    listarIngredientes(db),
    listarSustituciones(db)
  )
}

// «Mis recetas» (tarea 41, decisión 0019): recetas de la IA que cada cuenta decidió guardar. Se
// guardan como `RecetaGenerada` en JSON, sin mezclarse con las tablas de recetas ni con el catálogo.

import { esquemaRecetaGenerada } from '@shared/esquemas/receta'
import { conEtiquetas } from '@shared/recetas/etiquetas'
import type { Ingrediente, RecetaGenerada } from '@shared/types/receta'
import { listarIngredientes } from './catalogo'
import type { BaseDatos } from './conexion'

/** Las guardadas en este equipo, las más recientes primero, sin recalcular etiquetas. */
export function leerMisRecetasGuardadas(db: BaseDatos, usuarioId: string): RecetaGenerada[] {
  const filas = db
    .prepare('SELECT datos FROM recetas_usuario WHERE usuario_id = ? ORDER BY guardada_en DESC, id')
    .all(usuarioId) as { datos: string }[]
  return filas.flatMap((fila) => {
    const guardada = esquemaRecetaGenerada.safeParse(JSON.parse(fila.datos))
    return guardada.success ? [guardada.data] : []
  })
}

/** Etiquetas recalculadas con el catálogo de hoy; se omiten las que ya no se pueden calcular. */
export function prepararMisRecetas(
  guardadas: readonly RecetaGenerada[],
  catalogo: readonly Ingrediente[]
): RecetaGenerada[] {
  return guardadas.flatMap(({ receta, ingredientesNuevos }) => {
    try {
      return [
        { receta: conEtiquetas(receta, [...catalogo, ...ingredientesNuevos]), ingredientesNuevos }
      ]
    } catch {
      // Usa un ingrediente retirado del catálogo: sin él no se pueden calcular sus alérgenos.
      return []
    }
  })
}

/** Las más recientes primero. Las etiquetas se recalculan con el catálogo de hoy. */
export function listarMisRecetas(db: BaseDatos, usuarioId: string): RecetaGenerada[] {
  return prepararMisRecetas(leerMisRecetasGuardadas(db, usuarioId), listarIngredientes(db))
}

/** Tras subirlas a la cuenta en la nube (0025), se borran del equipo. */
export function borrarMisRecetasLocales(db: BaseDatos, usuarioId: string): void {
  db.prepare('DELETE FROM recetas_usuario WHERE usuario_id = ?').run(usuarioId)
}

export function obtenerMiReceta(
  db: BaseDatos,
  usuarioId: string,
  recetaId: string
): RecetaGenerada | null {
  return listarMisRecetas(db, usuarioId).find((g) => g.receta.id === recetaId) ?? null
}

/** Guardar dos veces la misma receta no la repite. */
export function guardarMiReceta(
  db: BaseDatos,
  usuarioId: string,
  generada: RecetaGenerada,
  ahora: number
): void {
  const valida = esquemaRecetaGenerada.parse(generada)
  db.prepare(
    `INSERT INTO recetas_usuario (usuario_id, id, datos, guardada_en)
       VALUES (@usuarioId, @id, @datos, @guardadaEn)
     ON CONFLICT (usuario_id, id) DO NOTHING`
  ).run({
    usuarioId,
    id: valida.receta.id,
    datos: JSON.stringify(valida),
    guardadaEn: new Date(ahora).toISOString()
  })
}

export function quitarMiReceta(db: BaseDatos, usuarioId: string, recetaId: string): void {
  db.prepare('DELETE FROM recetas_usuario WHERE usuario_id = ? AND id = ?').run(usuarioId, recetaId)
}

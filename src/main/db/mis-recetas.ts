// «Mis recetas» (tarea 41, decisión 0019): recetas de la IA que cada cuenta decidió guardar. Se
// guardan como `RecetaGenerada` en JSON, sin mezclarse con las tablas de recetas ni con el catálogo.

import { esquemaRecetaGenerada } from '@shared/esquemas/receta'
import { conEtiquetas } from '@shared/recetas/etiquetas'
import type { RecetaGenerada } from '@shared/types/receta'
import { listarIngredientes } from './catalogo'
import type { BaseDatos } from './conexion'

/** Las más recientes primero. Las etiquetas se recalculan con el catálogo de hoy. */
export function listarMisRecetas(db: BaseDatos, usuarioId: string): RecetaGenerada[] {
  const filas = db
    .prepare('SELECT datos FROM recetas_usuario WHERE usuario_id = ? ORDER BY guardada_en DESC, id')
    .all(usuarioId) as { datos: string }[]
  const catalogo = listarIngredientes(db)
  return filas.flatMap((fila) => {
    const guardada = esquemaRecetaGenerada.safeParse(JSON.parse(fila.datos))
    if (!guardada.success) return []
    const { receta, ingredientesNuevos } = guardada.data
    try {
      return [
        {
          receta: conEtiquetas(receta, [...catalogo, ...ingredientesNuevos]),
          ingredientesNuevos
        }
      ]
    } catch {
      // Usa un ingrediente retirado del catálogo: sin él no se pueden calcular sus alérgenos.
      return []
    }
  })
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

import { z } from 'zod'
import { esquemaIngrediente, esquemaSustitucion } from '@shared/esquemas/receta'
import type { Ingrediente, Sustitucion } from '@shared/types/receta'
import type { BaseDatos } from './conexion'

interface FilaIngrediente {
  id: string
  nombre: string
  sinonimos: string
  categoria: string
  es_basico_despensa: number
  alergenos: string
  dietas_incompatibles: string
  densidad_g_ml: number | null
  peso_unidad_g: number | null
}

interface FilaSustitucion {
  id: string
  ingrediente_origen_id: string
  ingrediente_destino_id: string
  ratio: number
  receta_id: string | null
  contexto: string
  resuelve: string
  impacto: string
  fuente: string
}

/** Catálogo completo de ingredientes, ordenado por nombre y validado con el esquema. */
export function listarIngredientes(db: BaseDatos): Ingrediente[] {
  const filas = db
    .prepare('SELECT * FROM ingredientes ORDER BY nombre COLLATE NOCASE')
    .all() as FilaIngrediente[]
  return z.array(esquemaIngrediente).parse(
    filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      sinonimos: JSON.parse(f.sinonimos),
      categoria: f.categoria,
      esBasicoDespensa: f.es_basico_despensa === 1,
      alergenos: JSON.parse(f.alergenos),
      dietasIncompatibles: JSON.parse(f.dietas_incompatibles),
      densidadGMl: f.densidad_g_ml,
      pesoUnidadG: f.peso_unidad_g
    }))
  )
}

/** Todas las sustituciones (generales y de receta), validadas con el esquema. */
export function listarSustituciones(db: BaseDatos): Sustitucion[] {
  const filas = db.prepare('SELECT * FROM sustituciones ORDER BY id').all() as FilaSustitucion[]
  return z.array(esquemaSustitucion).parse(
    filas.map((f) => ({
      id: f.id,
      ingredienteOrigenId: f.ingrediente_origen_id,
      ingredienteDestinoId: f.ingrediente_destino_id,
      ratio: f.ratio,
      recetaId: f.receta_id,
      contexto: f.contexto,
      resuelve: JSON.parse(f.resuelve),
      impacto: f.impacto,
      fuente: f.fuente
    }))
  )
}

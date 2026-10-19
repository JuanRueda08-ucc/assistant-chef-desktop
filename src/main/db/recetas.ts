import { esquemaReceta } from '@shared/esquemas/receta'
import type { Receta } from '@shared/types/receta'
import type { ResumenReceta } from '@shared/types/ipc'
import type { BaseDatos } from './conexion'

// Filas tal como las devuelve SQLite (snake_case, listas en JSON, booleanos 0/1).

interface FilaReceta {
  id: string
  slug: string
  titulo: string
  descripcion: string
  porciones_base: number
  tiempo_total_min: number
  tiempo_activo_min: number
  dificultad: string
  origen: string
  estado_revision: string
  dietas: string
  alergenos: string
  equipo: string
  imagen: string | null
}

interface FilaIngredienteReceta {
  id: string
  ingrediente_id: string
  cantidad: number | null
  unidad: string
  escalado: string
  redondeo: number | null
  preparacion: string | null
  grupo: string | null
  opcional: number
}

interface FilaPaso {
  id: string
  orden: number
  texto: string
  texto_voz: string | null
  duracion_seg: number | null
  temporizador_etiqueta: string | null
  temporizador_segundos: number | null
  senal_hecho: string | null
  tecnica_id: string | null
  requiere_confirmacion: number
  consejo: string | null
  seguridad: string | null
}

interface FilaIngredientePaso {
  paso_id: string
  ingrediente_receta_id: string
  fraccion: number
}

function resumen(fila: FilaReceta): ResumenReceta {
  const receta = esquemaReceta.shape
  return {
    id: fila.id,
    slug: fila.slug,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    porcionesBase: fila.porciones_base,
    tiempoTotalMin: fila.tiempo_total_min,
    tiempoActivoMin: fila.tiempo_activo_min,
    dificultad: receta.dificultad.parse(fila.dificultad),
    origen: receta.origen.parse(fila.origen),
    estadoRevision: receta.estadoRevision.parse(fila.estado_revision),
    imagen: fila.imagen
  }
}

/** Todas las recetas (cualquier estado de revisión), ordenadas por título. */
export function listarRecetas(db: BaseDatos): ResumenReceta[] {
  const filas = db
    .prepare('SELECT * FROM recetas ORDER BY titulo COLLATE NOCASE')
    .all() as FilaReceta[]
  return filas.map(resumen)
}

/** Receta completa con ingredientes y pasos, validada con el esquema; `null` si no existe. */
export function obtenerReceta(db: BaseDatos, id: string): Receta | null {
  const fila = db.prepare('SELECT * FROM recetas WHERE id = ?').get(id) as FilaReceta | undefined
  if (!fila) return null

  const ingredientes = db
    .prepare('SELECT * FROM receta_ingredientes WHERE receta_id = ? ORDER BY posicion')
    .all(id) as FilaIngredienteReceta[]
  const pasos = db
    .prepare('SELECT * FROM pasos WHERE receta_id = ? ORDER BY orden')
    .all(id) as FilaPaso[]
  const usados = db
    .prepare('SELECT * FROM paso_ingredientes WHERE receta_id = ? ORDER BY paso_id, posicion')
    .all(id) as FilaIngredientePaso[]

  return esquemaReceta.parse({
    ...resumen(fila),
    dietas: JSON.parse(fila.dietas),
    alergenos: JSON.parse(fila.alergenos),
    equipo: JSON.parse(fila.equipo),
    ingredientes: ingredientes.map((ir) => ({
      id: ir.id,
      ingredienteId: ir.ingrediente_id,
      cantidad: ir.cantidad,
      unidad: ir.unidad,
      escalado: ir.escalado,
      redondeo: ir.redondeo,
      preparacion: ir.preparacion,
      grupo: ir.grupo,
      opcional: ir.opcional === 1
    })),
    pasos: pasos.map((paso) => ({
      id: paso.id,
      orden: paso.orden,
      texto: paso.texto,
      textoVoz: paso.texto_voz,
      ingredientes: usados
        .filter((u) => u.paso_id === paso.id)
        .map((u) => ({ ingredienteRecetaId: u.ingrediente_receta_id, fraccion: u.fraccion })),
      duracionSeg: paso.duracion_seg,
      temporizador:
        paso.temporizador_etiqueta !== null && paso.temporizador_segundos !== null
          ? { etiqueta: paso.temporizador_etiqueta, segundos: paso.temporizador_segundos }
          : null,
      senalHecho: paso.senal_hecho,
      tecnicaId: paso.tecnica_id,
      requiereConfirmacion: paso.requiere_confirmacion === 1,
      consejo: paso.consejo,
      seguridad: paso.seguridad
    }))
  })
}

import type { ResumenReceta } from '../types/ipc'
import type { Receta } from '../types/receta'

/** Campos de la receta que se envían para listar (sin ingredientes ni pasos). */
export function resumirReceta(receta: Receta): ResumenReceta {
  return {
    id: receta.id,
    slug: receta.slug,
    titulo: receta.titulo,
    descripcion: receta.descripcion,
    porcionesBase: receta.porcionesBase,
    tiempoTotalMin: receta.tiempoTotalMin,
    tiempoActivoMin: receta.tiempoActivoMin,
    dificultad: receta.dificultad,
    origen: receta.origen,
    estadoRevision: receta.estadoRevision,
    dietas: [...receta.dietas],
    alergenos: [...receta.alergenos],
    equipo: [...receta.equipo],
    imagen: receta.imagen
  }
}

// Crear la sesión de cocina y reconstruir la receta adaptada.

import { escalarReceta } from '../recetas/escalado'
import type { Catalogo } from '../recetas/etiquetas'
import { aplicarSustitucion } from '../recetas/sustituciones'
import type { Receta } from '../types/receta'
import type { Preferencias, SesionCocina, SustitucionAplicada } from '../types/sesion'

/** Máximo de eventos guardados en la sesión (historial corto). */
export const MAX_EVENTOS = 50

/**
 * Receta que se muestra: las sustituciones de la sesión aplicadas en orden sobre la receta
 * original y después el escalado. Siempre desde la original, para no acumular redondeos.
 */
export function adaptarReceta(
  original: Receta,
  sustituciones: readonly SustitucionAplicada[],
  porciones: number,
  catalogo: Catalogo
): Receta {
  const sustituida = sustituciones.reduce(
    (receta, s, i) =>
      aplicarSustitucion(
        receta,
        {
          id: s.sustitucionId ?? `sesion_${i + 1}`,
          ingredienteOrigenId: s.ingredienteOrigenId,
          ingredienteDestinoId: s.ingredienteDestinoId,
          ratio: s.ratio,
          recetaId: null
        },
        catalogo
      ),
    original
  )
  return escalarReceta(sustituida, porciones).receta
}

export interface DatosNuevaSesion {
  id: string
  preferencias: Preferencias
  /** Receta original (con etiquetas derivadas). */
  receta: Receta
  porciones: number
  catalogo: Catalogo
  ahora: number
}

/** Sesión en fase `cocinar`, en el paso 1 y con la receta ya escalada. */
export function crearSesionCocina(datos: DatosNuevaSesion): SesionCocina {
  if (datos.receta.estadoRevision === 'retirada') {
    throw new Error(`la receta ${datos.receta.id} está retirada`)
  }
  return {
    id: datos.id,
    fase: 'cocinar',
    preferencias: structuredClone(datos.preferencias),
    recetaId: datos.receta.id,
    recetaAdaptada: adaptarReceta(datos.receta, [], datos.porciones, datos.catalogo),
    porciones: datos.porciones,
    sustituciones: [],
    pasoActual: 1,
    pasosHechos: [],
    temporizadores: [],
    eventos: [{ en: datos.ahora, tipo: 'inicio', descripcion: `Empieza "${datos.receta.titulo}"` }],
    actualizadaEn: new Date(datos.ahora).toISOString()
  }
}

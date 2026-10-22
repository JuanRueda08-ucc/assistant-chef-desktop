// Estado de la sesión de cocina y del avatar. Debe coincidir con docs/ia-chef.md.
// `SesionCocina` solo cambia a través de las herramientas del chef (tarea 8).

import type { Alergeno, Dieta, Dificultad, Equipo, Receta } from './receta'

export const FASES = ['preparar', 'elegir', 'cocinar', 'terminado'] as const
export type Fase = (typeof FASES)[number]

export const ESTADOS_TEMPORIZADOR = ['corriendo', 'pausado', 'terminado', 'cancelado'] as const
export type EstadoTemporizador = (typeof ESTADOS_TEMPORIZADOR)[number]

export const OBJETIVOS_SENALAR = ['temporizadores', 'ingredientes', 'panel'] as const
export type ObjetivoSenalar = (typeof OBJETIVOS_SENALAR)[number]

/**
 * Lo que hace el avatar. El componente `Avatar` lo recibe y lo traduce a Rive (o a otra
 * implementación) sin que el resto de la app sepa cómo se anima.
 */
export type EstadoAvatar =
  | { accion: 'hablar' }
  | { accion: 'senalar'; objetivo: ObjetivoSenalar }
  | { accion: 'esperar' }
  | { accion: 'celebrar'; intensidad: 'breve' | 'completa' }

export interface Preferencias {
  /** Ids del catálogo que el usuario tiene. */
  ingredientes: string[]
  /**
   * Lo que el usuario escribió o dijo y no está en el catálogo (decisión 0015). Se muestra en su
   * lista, pero no cuenta para buscar recetas ni para etiquetas hasta identificarlo.
   */
  ingredientesSinIdentificar: string[]
  porciones: number
  restricciones: Dieta[]
  alergias: Alergeno[]
  tiempoMaxMin: number | null
  nivel: Dificultad | null
  equipo: Equipo[]
}

/** Sustitución aplicada en la sesión; no modifica la receta guardada. */
export interface SustitucionAplicada {
  ingredienteOrigenId: string
  ingredienteDestinoId: string
  ratio: number
  /** Fila de `sustituciones` de la que sale; `null` si la propuso el modelo. */
  sustitucionId: string | null
}

/**
 * Temporizador basado en reloj: el restante se calcula con `iniciadoEn`, no con un contador,
 * para sobrevivir a reinicios.
 */
export interface Temporizador {
  id: string
  etiqueta: string
  pasoId: string | null
  duracionSeg: number
  estado: EstadoTemporizador
  /** Epoch en ms del último inicio o reanudación; `null` si no está corriendo. */
  iniciadoEn: number | null
  /** Segundos que quedaban en `iniciadoEn` (o al pausar). */
  restanteSeg: number
}

/** Historial corto para depurar y para el contexto del modelo. */
export interface EventoSesion {
  /** Epoch en ms. */
  en: number
  tipo: string
  descripcion: string
}

export interface SesionCocina {
  id: string
  fase: Fase
  preferencias: Preferencias
  recetaId: string | null
  /** Copia ya escalada y con sustituciones: lo que se muestra. */
  recetaAdaptada: Receta | null
  porciones: number
  sustituciones: SustitucionAplicada[]
  /** `orden` del paso actual; `null` fuera de la fase `cocinar`. */
  pasoActual: number | null
  /** Ids de los pasos hechos. */
  pasosHechos: string[]
  temporizadores: Temporizador[]
  eventos: EventoSesion[]
  /** ISO 8601. */
  actualizadaEn: string
}

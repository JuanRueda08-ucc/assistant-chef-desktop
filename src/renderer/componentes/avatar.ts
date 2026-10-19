// Qué pose del chef corresponde a cada EstadoAvatar (docs/diseno.md, "Chef"). Puro, para poder
// probarlo y para que la versión Rive use la misma tabla como entradas de su máquina de estados.

import type { EstadoAvatar, ObjetivoSenalar } from '@shared/types/sesion'

export const POSES = [
  'estatico',
  'hablando',
  'escuchando',
  'esperando',
  'derecha',
  'izquierda',
  'arriba',
  'abajo',
  'celebracionLeve',
  'celebracionFinal'
] as const
export type Pose = (typeof POSES)[number]

/**
 * Hacia dónde mira el chef para señalar cada objetivo, según la disposición de Cocinar: el chef
 * está a la derecha, los temporizadores arriba y los ingredientes y el panel de técnica a su
 * izquierda.
 */
export const DIRECCION_OBJETIVO: Record<ObjetivoSenalar, Pose> = {
  temporizadores: 'arriba',
  ingredientes: 'izquierda',
  panel: 'izquierda'
}

/** `escuchando` tiene prioridad: mientras el micrófono escucha, el chef escucha (tarea 16). */
export function poseDe(estado: EstadoAvatar, escuchando = false): Pose {
  if (escuchando) return 'escuchando'
  switch (estado.accion) {
    case 'hablar':
      return 'hablando'
    case 'esperar':
      return 'esperando'
    case 'senalar':
      return DIRECCION_OBJETIVO[estado.objetivo]
    case 'celebrar':
      return estado.intensidad === 'completa' ? 'celebracionFinal' : 'celebracionLeve'
  }
}

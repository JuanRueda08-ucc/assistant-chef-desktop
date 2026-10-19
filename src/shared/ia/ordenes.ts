import { normalizarTexto } from '../recetas/catalogo'
import { restanteSeg } from '../cocina/temporizadores'
import type { Temporizador } from '../types/sesion'
import type { AccionTemporizador, LlamadaHerramienta } from './herramientas'

/** Una sola fuente para el intérprete y la gramática cerrada de Vosk. */
export const FRASES_ORDENES = [
  'chef',
  'siguiente',
  'listo',
  'atras',
  'repite',
  'repetir',
  'pausa',
  'pausa el temporizador',
  'reanuda',
  'reanuda el temporizador',
  'para el temporizador'
] as const

export type OrdenLocal =
  | { local: 'activar' | 'repetir' }
  | { local: 'temporizador'; accion: 'pausar' | 'reanudar' | 'cancelar' }

/**
 * Solo frases completas: nunca confirma por encontrar «listo» dentro de otra oración.
 * Repetir/activar no son herramientas. Un temporizador sin nombre se resuelve con el estado,
 * sin inventar un id ni elegir entre varios. Lo desconocido no se envía automáticamente a IA.
 */
export function interpretarOrden(texto: string): LlamadaHerramienta | OrdenLocal | null {
  const orden = normalizarTexto(texto)
    .replace(/[.,!?¡¿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^chef /, '')
  switch (orden) {
    case 'chef':
      return { local: 'activar' }
    case 'siguiente':
    case 'listo':
      return { nombre: 'avanzar_paso', argumentos: {}, confirmado: true }
    case 'atras':
      return { nombre: 'retroceder_paso', argumentos: {}, confirmado: false }
    case 'repite':
    case 'repetir':
      return { local: 'repetir' }
    case 'pausa':
    case 'pausa el temporizador':
      return { local: 'temporizador', accion: 'pausar' }
    case 'reanuda':
    case 'reanuda el temporizador':
      return { local: 'temporizador', accion: 'reanudar' }
    case 'para el temporizador':
      return { local: 'temporizador', accion: 'cancelar' }
    default:
      return null
  }
}

/** Solo actúa si hay un único candidato; en otro caso la interfaz ofrece botones. */
export function resolverTemporizador(
  accion: Extract<AccionTemporizador, 'pausar' | 'reanudar' | 'cancelar'>,
  temporizadores: readonly Temporizador[],
  ahora: number
): LlamadaHerramienta | null {
  const candidatos = temporizadores.filter((t) => {
    if (t.estado === 'cancelado') return false
    if (accion === 'cancelar') return true
    if (accion === 'reanudar') return t.estado === 'pausado'
    return t.estado === 'corriendo' && restanteSeg(t, ahora) > 0
  })
  if (candidatos.length !== 1) return null
  return {
    nombre: 'controlar_temporizador',
    argumentos: { id: candidatos[0]!.id, accion },
    confirmado: false
  }
}

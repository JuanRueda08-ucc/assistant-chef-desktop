import { capturarAudio } from './audio'
import { TurnoConsulta } from './turno'

/**
 * Graba una frase para el chat (decisión 0020): hasta 8 s o una pausa, solo en memoria. El micrófono
 * se cierra siempre al terminar, también si se cancela. Devuelve `null` si no se oyó a nadie.
 */
export async function dictar(
  signal: AbortSignal,
  capturar: typeof capturarAudio = capturarAudio
): Promise<ArrayBuffer | null> {
  const turno = new TurnoConsulta()
  const interno = new AbortController()
  const cancelar = (): void => interno.abort()
  signal.addEventListener('abort', cancelar, { once: true })
  let cerrar: (() => void) | null = null
  try {
    await new Promise<void>((resolve, reject) => {
      interno.signal.addEventListener('abort', () => resolve(), { once: true })
      capturar((audio) => {
        if (turno.agregar(audio)) resolve()
      }, interno.signal).then((c) => {
        cerrar = c
      }, reject)
    })
  } finally {
    signal.removeEventListener('abort', cancelar)
    interno.abort()
    ;(cerrar as (() => void) | null)?.()
  }
  if (signal.aborted || !turno.tieneHabla) return null
  const total = turno.audio.reduce((n, a) => n + a.byteLength, 0)
  const pcm = new Uint8Array(total)
  let posicion = 0
  for (const parte of turno.audio) {
    pcm.set(new Uint8Array(parte), posicion)
    posicion += parte.byteLength
  }
  return pcm.buffer
}

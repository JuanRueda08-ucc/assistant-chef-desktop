import { describe, expect, it, vi } from 'vitest'
import { dictar } from './dictado'

const MS_100 = 3200
const voz = (): ArrayBuffer => new Int16Array(MS_100 / 2).fill(8000).buffer
const silencio = (): ArrayBuffer => new Int16Array(MS_100 / 2).buffer

/** Micrófono falso: entrega los fragmentos y anota si se cerró. */
function microfono(fragmentos: ArrayBuffer[]): {
  capturar: Parameters<typeof dictar>[1]
  cerrado: () => boolean
} {
  const cerrar = vi.fn()
  return {
    cerrado: () => cerrar.mock.calls.length > 0,
    capturar: async (alAudio) => {
      queueMicrotask(() => fragmentos.forEach(alAudio))
      return cerrar
    }
  }
}

describe('dictar', () => {
  it('termina tras una pausa, devuelve la frase y cierra el micrófono', async () => {
    const m = microfono([
      ...Array.from({ length: 5 }, voz),
      ...Array.from({ length: 10 }, silencio)
    ])
    const pcm = await dictar(new AbortController().signal, m.capturar)
    expect(pcm?.byteLength).toBe(15 * MS_100)
    expect(m.cerrado()).toBe(true)
  })

  it('devuelve null si solo hubo silencio, a los ocho segundos', async () => {
    const m = microfono(Array.from({ length: 80 }, silencio))
    expect(await dictar(new AbortController().signal, m.capturar)).toBeNull()
    expect(m.cerrado()).toBe(true)
  })

  it('al cancelar devuelve null y cierra el micrófono', async () => {
    const control = new AbortController()
    const m = microfono([voz()])
    const pendiente = dictar(control.signal, m.capturar)
    await new Promise((r) => setTimeout(r, 0))
    control.abort()
    expect(await pendiente).toBeNull()
    expect(m.cerrado()).toBe(true)
  })

  it('propaga si no se puede abrir el micrófono', async () => {
    const capturar = vi.fn().mockRejectedValue(new Error('sin permiso'))
    await expect(dictar(new AbortController().signal, capturar)).rejects.toThrow('sin permiso')
  })
})

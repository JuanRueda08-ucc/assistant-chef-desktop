import { afterEach, describe, expect, it, vi } from 'vitest'
import { capturarAudio } from './audio'

afterEach(() => vi.unstubAllGlobals())

describe('ciclo de vida del micrófono', () => {
  it('cierra tracks si getUserMedia termina después de salir de Cocinar', async () => {
    let entregar!: (stream: unknown) => void
    const stop = vi.fn()
    const cerrar = vi.fn()
    class ContextoFalso {
      state = 'running'
      resume = vi.fn().mockResolvedValue(undefined)
      close = cerrar
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }
    }
    vi.stubGlobal('AudioContext', ContextoFalso)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((resolve) => {
            entregar = resolve
          })
      }
    })
    const abort = new AbortController()
    const captura = capturarAudio(vi.fn(), abort.signal)
    await Promise.resolve()
    abort.abort()
    entregar({ getTracks: () => [{ stop }] })
    await expect(captura).rejects.toThrow('cancelada')
    expect(stop).toHaveBeenCalled()
    expect(cerrar).toHaveBeenCalled()
  })
})

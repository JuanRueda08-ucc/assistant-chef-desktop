import workletUrl from './captura-worklet.js?url'
import { aPcm16 } from './pcm'

export async function capturarAudio(
  alAudio: (audio: ArrayBuffer) => void,
  signal: AbortSignal
): Promise<() => void> {
  const contexto = new AudioContext({ sampleRate: 16000 })
  let stream: MediaStream | null = null
  let fuente: MediaStreamAudioSourceNode | null = null
  let captura: AudioWorkletNode | null = null
  const cerrar = (): void => {
    captura?.disconnect()
    captura?.port.close()
    fuente?.disconnect()
    stream?.getTracks().forEach((t) => t.stop())
    if (contexto.state !== 'closed') void contexto.close()
  }
  signal.addEventListener('abort', cerrar, { once: true })
  try {
    await contexto.resume()
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    // getUserMedia no es abortable; si cambió la pantalla mientras esperaba, se cierran tracks.
    if (signal.aborted) {
      cerrar()
      throw new Error('Captura cancelada.')
    }
    await contexto.audioWorklet.addModule(workletUrl)
    if (signal.aborted) {
      cerrar()
      throw new Error('Captura cancelada.')
    }
    fuente = contexto.createMediaStreamSource(stream)
    captura = new AudioWorkletNode(contexto, 'captura-chef')
    captura.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (!signal.aborted) alAudio(aPcm16(e.data))
    }
    fuente.connect(captura)
    // El worklet produce silencio: la conexión mantiene el procesamiento sin reproducir el micro.
    captura.connect(contexto.destination)
    return cerrar
  } catch (error) {
    cerrar()
    throw error
  }
}

export function crearReproductor(): {
  reproducir: (base64: string, frecuencia: number) => void
  interrumpir: () => void
  pendienteMs: () => number
  cerrar: () => void
} {
  const contexto = new AudioContext({ sampleRate: 24000 })
  void contexto.resume()
  let fin = 0
  const fuentes = new Set<AudioBufferSourceNode>()
  const interrumpir = (): void => {
    fuentes.forEach((f) => f.stop())
    fuentes.clear()
    fin = 0
  }
  return {
    reproducir(base64, frecuencia) {
      if (contexto.state === 'closed') return
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const vista = new DataView(bytes.buffer)
      const buffer = contexto.createBuffer(1, Math.floor(bytes.length / 2), frecuencia)
      const canal = buffer.getChannelData(0)
      for (let i = 0; i < canal.length; i++) canal[i] = vista.getInt16(i * 2, true) / 32768
      const fuente = contexto.createBufferSource()
      fuente.buffer = buffer
      fuente.connect(contexto.destination)
      fuentes.add(fuente)
      fuente.onended = () => {
        fuentes.delete(fuente)
        fuente.disconnect()
      }
      fin = Math.max(contexto.currentTime, fin)
      fuente.start(fin)
      fin += buffer.duration
    },
    interrumpir,
    pendienteMs: () => Math.max(0, (fin - contexto.currentTime) * 1000),
    cerrar() {
      interrumpir()
      if (contexto.state !== 'closed') void contexto.close()
    }
  }
}

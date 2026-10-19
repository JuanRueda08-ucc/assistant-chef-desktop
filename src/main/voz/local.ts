import { join } from 'node:path'
import type { Worker } from 'node:worker_threads'
import crearWorker from './vosk-worker?nodeWorker'
import type { ResultadoVosk, ResultadoVozLocal } from '@shared/types/voz'
import type { RespuestaWorker } from './protocolo'

export interface VozLocal {
  iniciar: () => Promise<ResultadoVozLocal>
  reconocer: (audio: ArrayBuffer) => Promise<ResultadoVosk | null>
  reset: () => Promise<void>
  detener: () => void
}

/** Un worker por captura; backpressure y timeout evitan colas de PCM sin límite. */
export function crearVozLocal(carpeta: string): VozLocal {
  let worker: Worker | null = null
  let secuencia = 0
  let pendiente: {
    id: number
    resolver: (r: ResultadoVosk | null) => void
    rechazar: (e: Error) => void
    reloj: ReturnType<typeof setTimeout>
  } | null = null

  function rechazar(mensaje: string): void {
    if (!pendiente) return
    clearTimeout(pendiente.reloj)
    pendiente.rechazar(new Error(mensaje))
    pendiente = null
  }
  function pedir(accion: 'audio' | 'reset', audio?: ArrayBuffer): Promise<ResultadoVosk | null> {
    if (!worker || pendiente) return Promise.resolve(null)
    return new Promise((resolver, rechazarPeticion) => {
      const id = ++secuencia
      pendiente = {
        id,
        resolver,
        rechazar: rechazarPeticion,
        reloj: setTimeout(() => rechazar('Vosk tardó demasiado en responder.'), 15_000)
      }
      worker!.postMessage(
        accion === 'audio' ? { id, accion, audio: new Uint8Array(audio!) } : { id, accion }
      )
    })
  }
  const servicio: VozLocal = {
    async iniciar() {
      servicio.detener()
      const nombre =
        process.platform === 'win32'
          ? 'libvosk.dll'
          : process.platform === 'darwin'
            ? 'libvosk.dylib'
            : 'libvosk.so'
      const instancia = crearWorker({
        workerData: {
          biblioteca: join(carpeta, `${process.platform}-${process.arch}`, nombre),
          modelo: join(carpeta, 'vosk-model-small-es-0.42')
        }
      })
      worker = instancia
      return new Promise((resolve) => {
        let iniciado = false
        const reloj = setTimeout(() => {
          servicio.detener()
          resolve({ ok: false, mensaje: 'Vosk tardó demasiado en cargar.' })
        }, 30_000)
        const fallo = (): void => {
          if (worker === instancia) rechazar('Se cerró el reconocimiento local.')
          clearTimeout(reloj)
          if (!iniciado)
            resolve({ ok: false, mensaje: 'No pude iniciar Vosk. Ejecuta npm run voz:preparar.' })
          if (worker === instancia) worker = null
        }
        instancia.on('error', fallo)
        instancia.on('exit', fallo)
        instancia.on('message', (r: RespuestaWorker) => {
          if (r.id === 0) {
            iniciado = true
            clearTimeout(reloj)
            resolve(r.error ? { ok: false, mensaje: r.error } : { ok: true })
          } else if (pendiente?.id === r.id) {
            if (r.error) rechazar(r.error)
            else {
              clearTimeout(pendiente.reloj)
              pendiente.resolver(r.resultado)
              pendiente = null
            }
          }
        })
      })
    },
    reconocer: (audio) => pedir('audio', audio),
    async reset() {
      await pedir('reset')
    },
    detener() {
      rechazar('Escucha detenida.')
      const anterior = worker
      worker = null
      if (anterior) {
        // Liberar el modelo C antes de salir: terminate() por sí solo deja memoria nativa viva.
        anterior.postMessage({ id: ++secuencia, accion: 'cerrar' })
        const cierre = setTimeout(() => {
          void anterior.terminate()
        }, 1500)
        anterior.once('exit', () => clearTimeout(cierre))
      }
    }
  }
  return servicio
}

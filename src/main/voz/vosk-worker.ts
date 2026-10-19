import { parentPort, workerData } from 'node:worker_threads'
import { crearVosk } from './nativo'
import type { PeticionWorker, RespuestaWorker } from './protocolo'

const datos = workerData as { biblioteca: string; modelo: string }
try {
  const vosk = crearVosk(datos.biblioteca, datos.modelo)
  parentPort!.postMessage({ id: 0, resultado: null, error: null } satisfies RespuestaWorker)
  parentPort!.on('message', (peticion: PeticionWorker) => {
    if (peticion.accion === 'cerrar') {
      vosk.cerrar()
      parentPort!.close()
      return
    }
    try {
      const resultado =
        peticion.accion === 'audio' ? vosk.reconocer(peticion.audio) : (vosk.reset(), null)
      parentPort!.postMessage({ id: peticion.id, resultado, error: null } satisfies RespuestaWorker)
    } catch {
      parentPort!.postMessage({
        id: peticion.id,
        resultado: null,
        error: 'El reconocimiento local falló.'
      } satisfies RespuestaWorker)
    }
  })
  parentPort!.on('close', () => vosk.cerrar())
} catch {
  parentPort!.postMessage({
    id: 0,
    resultado: null,
    error: 'No pude cargar Vosk. Ejecuta npm run voz:preparar y vuelve a intentarlo.'
  } satisfies RespuestaWorker)
  parentPort!.close()
}

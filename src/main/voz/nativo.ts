import { load } from 'koffi'
import { FRASES_ORDENES } from '@shared/ia/ordenes'
import { resultadoVosk } from '@shared/ia/vosk'
import type { ResultadoVosk } from '@shared/types/voz'

/** Puente mínimo a la API C oficial de Vosk. Solo se instancia dentro del worker. */
export function crearVosk(
  biblioteca: string,
  carpetaModelo: string
): {
  reconocer: (audio: Uint8Array) => ResultadoVosk | null
  reset: () => void
  cerrar: () => void
} {
  const lib = load(biblioteca)
  // Firmas contrastadas con vosk_api.h; los punteros opacos de Koffi 3 son bigint.
  const nuevoModelo = lib.func('void *vosk_model_new(str)') as (ruta: string) => bigint | null
  const liberarModelo = lib.func('void vosk_model_free(void *)') as (modelo: bigint) => void
  const nuevoReconocedor = lib.func('void *vosk_recognizer_new_grm(void *, float, str)') as (
    modelo: bigint,
    frecuencia: number,
    gramatica: string
  ) => bigint | null
  const palabras = lib.func('void vosk_recognizer_set_words(void *, int)') as (
    reconocedor: bigint,
    habilitar: number
  ) => void
  const aceptar = lib.func('int vosk_recognizer_accept_waveform(void *, const uint8_t *, int)') as (
    reconocedor: bigint,
    audio: Uint8Array,
    longitud: number
  ) => number
  const resultado = lib.func('str vosk_recognizer_result(void *)') as (
    reconocedor: bigint
  ) => string
  const reset = lib.func('void vosk_recognizer_reset(void *)') as (reconocedor: bigint) => void
  const liberar = lib.func('void vosk_recognizer_free(void *)') as (reconocedor: bigint) => void
  lib.func('void vosk_set_log_level(int)')(-1)
  const modelo = nuevoModelo(carpetaModelo)
  if (!modelo) throw new Error('No se pudo cargar el modelo español de Vosk.')
  const gramatica = JSON.stringify([
    ...FRASES_ORDENES,
    ...FRASES_ORDENES.filter((f) => f !== 'chef').map((f) => `chef ${f}`),
    '[unk]'
  ])
  const reconocedor = nuevoReconocedor(modelo, 16000, gramatica)
  if (!reconocedor) {
    liberarModelo(modelo)
    throw new Error('Vosk no pudo crear la gramática de órdenes.')
  }
  palabras(reconocedor, 1)
  let cerrado = false
  return {
    reconocer(audio) {
      if (cerrado) return null
      const estado = aceptar(reconocedor, audio, audio.byteLength)
      if (estado < 0) throw new Error('Vosk no pudo procesar el audio.')
      return estado === 1 ? resultadoVosk(JSON.parse(resultado(reconocedor))) : null
    },
    reset() {
      if (!cerrado) reset(reconocedor)
    },
    cerrar() {
      if (cerrado) return
      cerrado = true
      liberar(reconocedor)
      liberarModelo(modelo)
    }
  }
}

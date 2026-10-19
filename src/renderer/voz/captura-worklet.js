/* global AudioWorkletProcessor, registerProcessor */
// 100 ms a 16 kHz: carga acotada para IPC y Vosk, fuera del hilo de la interfaz.
class CapturaChef extends AudioWorkletProcessor {
  constructor() {
    super()
    this.muestras = new Float32Array(1600)
    this.posicion = 0
  }
  process(entradas) {
    const canal = entradas[0]?.[0]
    if (canal) {
      for (const muestra of canal) {
        this.muestras[this.posicion++] = muestra
        if (this.posicion === this.muestras.length) {
          this.port.postMessage(this.muestras, [this.muestras.buffer])
          this.muestras = new Float32Array(1600)
          this.posicion = 0
        }
      }
    }
    return true
  }
}
registerProcessor('captura-chef', CapturaChef)

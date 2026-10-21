import { amplitud } from './pcm'

/** Consulta PCM16 mono/16 kHz, acotada a ocho segundos y sin reconocimiento de órdenes. */
export class TurnoConsulta {
  readonly audio: ArrayBuffer[] = []
  private duracionMs = 0
  private hablaMs = 0
  private silencioMs = 0

  get tieneHabla(): boolean {
    return this.hablaMs >= 200
  }

  agregar(audio: ArrayBuffer): boolean {
    const disponible = Math.max(0, Math.round((8000 - this.duracionMs) * 32))
    const fragmento = audio.byteLength <= disponible ? audio : audio.slice(0, disponible)
    if (fragmento.byteLength) {
      this.audio.push(fragmento)
      const ms = fragmento.byteLength / 32
      this.duracionMs += ms
      if (amplitud(fragmento) > 0.015) {
        this.hablaMs += ms
        this.silencioMs = 0
      } else this.silencioMs += ms
    }
    return this.duracionMs >= 8000 || (this.tieneHabla && this.silencioMs >= 900)
  }
}

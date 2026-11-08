import { dictar } from './dictado'

/**
 * «Hablar» en el chat (0020): una frase de hasta ocho segundos que se transcribe y se envía sola.
 * Lo usan el panel lateral y la pantalla de conversación (44). Nunca abre una escucha continua.
 */
export class DictadoChat {
  estado = $state<'apagada' | 'escuchando' | 'entendiendo'>('apagada')
  error = $state<string | null>(null)
  private control: AbortController | null = null

  detener(): void {
    this.control?.abort()
  }

  async hablar(enviar: (texto: string) => Promise<void>): Promise<void> {
    if (this.estado !== 'apagada') return
    this.error = null
    const control = new AbortController()
    this.control = control
    this.estado = 'escuchando'
    let pcm: ArrayBuffer | null = null
    try {
      await window.api.voz.dictadoIniciar({})
      pcm = await dictar(control.signal)
      if (!pcm && !control.signal.aborted) this.error = 'No te oí. Inténtalo de nuevo o escríbelo.'
    } catch {
      this.error = 'No pude abrir el micrófono. Revisa el permiso del sistema o escríbelo.'
    } finally {
      // El micrófono ya está cerrado; el permiso también se retira aunque esto falle.
      void window.api.voz.dictadoTerminar({}).catch(() => {})
    }
    if (!pcm || control.signal.aborted) {
      this.estado = 'apagada'
      return
    }
    this.estado = 'entendiendo'
    try {
      const r = await window.api.voz.transcribir(pcm)
      if (control.signal.aborted) return
      this.estado = 'apagada'
      if (r.ok) await enviar(r.texto)
      else this.error = r.mensaje
    } catch {
      this.error = 'No pude entender el audio. Inténtalo de nuevo o escríbelo.'
    } finally {
      this.estado = 'apagada'
    }
  }
}

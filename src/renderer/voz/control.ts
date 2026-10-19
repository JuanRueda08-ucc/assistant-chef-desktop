import type { ApiChef } from '@shared/types/ipc'
import type { SesionCocina } from '@shared/types/sesion'
import type { LlamadaHerramienta, ResultadoHerramienta } from '@shared/ia/herramientas'
import { interpretarOrden, resolverTemporizador } from '@shared/ia/ordenes'
import { CONFIANZA_ORDEN_MIN } from '@shared/ia/vosk'
import { capturarAudio, crearReproductor } from './audio'
import { GeminiLive } from './gemini-live'
import { amplitud } from './pcm'

export type EstadoVoz = 'apagado' | 'iniciando' | 'local' | 'escuchando' | 'pensando' | 'hablando'
interface EventosVoz {
  sesion: () => SesionCocina | null
  disponible: () => boolean
  aplicar: (llamada: LlamadaHerramienta) => Promise<ResultadoHerramienta | null>
  decir: (texto: string) => void
  temporizadores: () => void
  confirmar: (texto: string | null) => void
  estado: (estado: EstadoVoz) => void
  error: (mensaje: string | null) => void
}

export class ControlVoz {
  private abort: AbortController | null = null
  private reproductor: ReturnType<typeof crearReproductor> | null = null
  private live: GeminiLive | null = null
  private estado: EstadoVoz = 'apagado'
  private procesando = false
  private silencioHasta = 0
  private audio: ArrayBuffer[] = []
  private hayHabla = false
  private reloj: ReturnType<typeof setTimeout> | undefined
  private inactividad: ReturnType<typeof setTimeout> | undefined
  private pendiente: { texto: string; version: string } | null = null

  constructor(
    private readonly api: ApiChef,
    private readonly eventos: EventosVoz
  ) {}

  async iniciar(): Promise<void> {
    this.detener()
    if (this.eventos.sesion()?.fase !== 'cocinar') return
    const abort = new AbortController()
    this.abort = abort
    this.cambiar('iniciando')
    this.eventos.error(null)
    try {
      this.reproductor = crearReproductor()
      const local = await this.api.voz.iniciar({})
      if (abort.signal.aborted) return
      if (!local.ok) throw new Error(local.mensaje)
      await capturarAudio((audio) => {
        void this.recibir(audio)
      }, abort.signal)
      if (!abort.signal.aborted) this.cambiar('local')
    } catch (error) {
      if (abort.signal.aborted) return
      this.detener()
      this.eventos.error(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'No tengo permiso para usar el micrófono. Puedes seguir con los botones.'
          : error instanceof Error
            ? error.message
            : 'No pude iniciar el micrófono.'
      )
    }
  }

  detener(): void {
    this.abort?.abort()
    this.abort = null
    clearTimeout(this.reloj)
    clearTimeout(this.inactividad)
    this.live?.cerrar()
    this.live = null
    this.reproductor?.cerrar()
    this.reproductor = null
    this.audio = []
    this.pendiente = null
    this.eventos.confirmar(null)
    this.cambiar('apagado')
    void this.api.voz.detener({}).catch(() => {
      /* La ventana puede estar cerrándose. */
    })
  }

  /** También se usa desde el botón visible; activar el micrófono sigue siendo explícito. */
  activar(): void {
    if (!this.abort || this.abort.signal.aborted || !this.eventos.disponible()) return
    clearTimeout(this.reloj)
    clearTimeout(this.inactividad)
    this.reproductor?.interrumpir()
    this.audio = []
    this.hayHabla = false
    this.cambiar('escuchando')
    this.reloj = setTimeout(() => {
      void this.enviarConsulta()
    }, 8000)
  }

  async repetir(): Promise<void> {
    const sesion = this.eventos.sesion()
    const paso = sesion?.recetaAdaptada?.pasos.find((p) => p.orden === sesion.pasoActual)
    if (!paso) return
    const abort = this.abort
    clearTimeout(this.reloj)
    this.audio = []
    this.reproductor?.interrumpir()
    if (abort) this.cambiar('hablando')
    this.eventos.decir(paso.textoVoz ?? paso.texto)
    try {
      const r = await this.api.voz.repetir({})
      if (!r.ok) this.eventos.error(r.mensaje)
      if (abort && abort === this.abort) {
        await this.api.voz.reset({})
        this.silencioHasta = Date.now() + 350
        this.cambiar('local')
      }
    } catch {
      this.eventos.error('No pude leer el paso. Puedes verlo en el globo del chef.')
      if (abort === this.abort && abort) this.cambiar('local')
    }
  }

  async confirmarOrden(): Promise<void> {
    const pendiente = this.pendiente
    this.pendiente = null
    this.eventos.confirmar(null)
    if (pendiente && pendiente.version === this.eventos.sesion()?.actualizadaEn)
      await this.ejecutar(pendiente.texto)
    else this.eventos.error('El paso cambió. Usa los controles del paso actual.')
  }

  private cambiar(estado: EstadoVoz): void {
    this.estado = estado
    this.eventos.estado(estado)
  }

  private async recibir(audio: ArrayBuffer): Promise<void> {
    const abort = this.abort
    if (
      Date.now() < this.silencioHasta ||
      !abort ||
      abort.signal.aborted ||
      this.procesando ||
      !this.eventos.disponible() ||
      !['local', 'escuchando'].includes(this.estado)
    )
      return
    if (this.estado === 'escuchando') {
      if (this.audio.length < 80) this.audio.push(audio)
      if (amplitud(audio) > 0.015) this.hayHabla = true
    }
    this.procesando = true
    try {
      const r = await this.api.voz.reconocer(audio)
      if (
        abort !== this.abort ||
        abort.signal.aborted ||
        !r ||
        !['local', 'escuchando'].includes(this.estado)
      )
        return
      const orden = interpretarOrden(r.texto)
      if (orden) {
        clearTimeout(this.reloj)
        this.audio = []
        if (r.confianza < CONFIANZA_ORDEN_MIN) {
          this.pendiente = { texto: r.texto, version: this.eventos.sesion()!.actualizadaEn }
          this.eventos.confirmar(r.texto)
          this.cambiar('local')
        } else await this.ejecutar(r.texto)
      } else if (this.estado === 'escuchando' && this.hayHabla) await this.enviarConsulta()
    } catch {
      if (abort === this.abort && !abort.signal.aborted) {
        this.detener()
        this.eventos.error('Se interrumpió Vosk. Vuelve a activar el micrófono o usa los botones.')
      }
    } finally {
      this.procesando = false
    }
  }

  private async ejecutar(texto: string): Promise<void> {
    const orden = interpretarOrden(texto)
    this.pendiente = null
    this.eventos.confirmar(null)
    this.cambiar(this.abort ? 'local' : 'apagado')
    if (!orden) return
    if ('local' in orden) {
      if (orden.local === 'activar') this.activar()
      else if (orden.local === 'repetir') await this.repetir()
      else if ('accion' in orden) {
        const llamada = resolverTemporizador(
          orden.accion,
          this.eventos.sesion()?.temporizadores ?? [],
          Date.now()
        )
        if (llamada) await this.eventos.aplicar(llamada)
        else {
          this.eventos.temporizadores()
          this.eventos.decir('Elige el temporizador con los botones de la pantalla.')
        }
      }
    } else if (this.eventos.disponible()) await this.eventos.aplicar(orden)
  }

  private async enviarConsulta(): Promise<void> {
    clearTimeout(this.reloj)
    const abort = this.abort
    if (!abort || abort.signal.aborted || this.estado !== 'escuchando') return
    if (!this.hayHabla || !this.audio.length) {
      this.cambiar('local')
      return
    }
    const audio = this.audio
    this.audio = []
    this.cambiar('pensando')
    try {
      await this.api.voz.reset({})
      if (abort !== this.abort) return
      if (!this.live) {
        const r = await this.api.voz.token({})
        if (abort !== this.abort) return
        if (!r.ok) throw new Error(r.error.mensaje)
        const live = new GeminiLive({
          sesion: this.eventos.sesion,
          aplicar: this.eventos.aplicar,
          texto: this.eventos.decir,
          audio: (base64, frecuencia) => {
            this.cambiar('hablando')
            this.reproductor?.reproducir(base64, frecuencia)
          },
          interrumpir: () => this.reproductor?.interrumpir(),
          finTurno: (pregunta) => {
            clearTimeout(this.reloj)
            this.reloj = setTimeout(
              () => {
                if (abort !== this.abort) return
                if (pregunta) this.activar()
                else this.cambiar('local')
                clearTimeout(this.inactividad)
                this.inactividad = setTimeout(() => {
                  this.live?.cerrar()
                  this.live = null
                }, 60_000)
              },
              (this.reproductor?.pendienteMs() ?? 0) + 150
            )
          },
          error: (mensaje) => {
            if (abort === this.abort) {
              clearTimeout(this.reloj)
              this.live = null
              this.cambiar('local')
              this.eventos.error(mensaje)
            }
          }
        })
        this.live = live
        await live.conectar(r.credencial)
      }
      if (abort !== this.abort) return
      this.live.enviarTurno(audio)
      this.reloj = setTimeout(() => {
        this.live?.cerrar()
        this.live = null
        this.reproductor?.interrumpir()
        this.cambiar('local')
        this.eventos.error(
          'La voz tardó demasiado en responder. Di «Chef» para volver a intentarlo.'
        )
      }, 45_000)
    } catch (error) {
      if (abort !== this.abort) return
      this.live?.cerrar()
      this.live = null
      this.cambiar('local')
      this.eventos.error(error instanceof Error ? error.message : 'No pude abrir la sesión de voz.')
    }
  }
}

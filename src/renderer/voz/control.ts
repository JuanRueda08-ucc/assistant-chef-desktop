import type { ApiChef } from '@shared/types/ipc'
import type { SesionCocina } from '@shared/types/sesion'
import type { LlamadaHerramienta, ResultadoHerramienta } from '@shared/ia/herramientas'
import { interpretarOrden, resolverTemporizador } from '@shared/ia/ordenes'
import { CONFIANZA_ORDEN_MIN } from '@shared/ia/vosk'
import { capturarAudio, crearReproductor } from './audio'
import { GeminiLive } from './gemini-live'
import { TurnoConsulta } from './turno'

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
  private consulta: TurnoConsulta | null = null
  private versionConsulta: string | null = null
  private reloj: ReturnType<typeof setTimeout> | undefined
  private inactividad: ReturnType<typeof setTimeout> | undefined
  private pendiente: { texto: string; version: string } | null = null
  private lectura = 0
  private pasoVigente: string

  private versionPaso(): string {
    const sesion = this.eventos.sesion()
    return JSON.stringify([sesion?.id, sesion?.fase, sesion?.pasoActual])
  }

  /** También invalida audio ya encolado cuando la narración automática está silenciada. */
  sincronizarPaso(): void {
    const actual = this.versionPaso()
    if (actual === this.pasoVigente) return
    this.pasoVigente = actual
    this.callar()
  }
  callar(): void {
    this.lectura += 1
    this.cancelarConsulta()
    this.reproductor?.interrumpir()
    this.silencioHasta = Date.now() + 350
    void this.api.voz.callar({}).catch(() => {})
    this.cambiar(this.abort ? 'local' : 'apagado')
  }
  get microfonoActivo(): boolean {
    return this.abort !== null
  }

  private versionSesion(): string {
    const sesion = this.eventos.sesion()
    return JSON.stringify([sesion?.id, sesion?.pasoActual, sesion?.actualizadaEn])
  }

  private cancelarConsulta(): void {
    clearTimeout(this.reloj)
    clearTimeout(this.inactividad)
    this.consulta = null
    this.versionConsulta = null
    this.live?.cerrar()
    this.live = null
  }

  constructor(
    private readonly api: ApiChef,
    private readonly eventos: EventosVoz
  ) {
    this.pasoVigente = this.versionPaso()
  }

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
    this.lectura += 1
    this.abort?.abort()
    this.abort = null
    this.cancelarConsulta()
    this.reproductor?.cerrar()
    this.reproductor = null
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
    this.lectura += 1
    this.eventos.error(null)
    this.pendiente = null
    this.eventos.confirmar(null)
    void this.api.voz.reset({}).catch(() => {})
    this.reproductor?.interrumpir()
    this.consulta = new TurnoConsulta()
    this.versionConsulta = this.versionSesion()
    this.cambiar('escuchando')
    this.reloj = setTimeout(() => {
      void this.enviarConsulta()
    }, 8000)
  }

  async repetir(): Promise<void> {
    const sesion = this.eventos.sesion()
    const paso = sesion?.recetaAdaptada?.pasos.find((p) => p.orden === sesion.pasoActual)
    if (!paso) return
    const lectura = ++this.lectura
    this.cancelarConsulta()
    this.eventos.error(null)
    const vigente = (): boolean =>
      lectura === this.lectura &&
      this.eventos.sesion()?.fase === 'cocinar' &&
      this.eventos.sesion()?.id === sesion!.id &&
      this.eventos.sesion()?.pasoActual === paso.orden
    const abort = this.abort
    clearTimeout(this.reloj)
    this.reproductor?.interrumpir()
    this.cambiar('hablando')
    this.eventos.decir(paso.textoVoz ?? paso.texto)
    try {
      let natural = false
      try {
        const audio = await this.api.voz.narrar({ sesionId: sesion!.id, pasoId: paso.id })
        if (!vigente()) return
        if (audio) {
          this.reproductor ??= crearReproductor()
          await this.reproductor.reproducirArchivo(audio.datos)
          natural = true
        }
      } catch {
        /* Respaldo local cuando Gemini no está disponible. */
      }
      if (!vigente()) return
      if (!natural) {
        this.eventos.error(
          'Usando la voz local de respaldo. La voz natural necesita Gemini configurado y conexión.'
        )
        const r = await this.api.voz.repetir({})
        if (!r.ok && vigente()) this.eventos.error(r.mensaje)
      }
    } catch {
      if (vigente()) this.eventos.error('No pude leer el paso. Puedes verlo en el globo del chef.')
    } finally {
      if (vigente()) {
        if (abort && abort === this.abort) await this.api.voz.reset({}).catch(() => {})
        this.silencioHasta = Date.now() + 350
        this.cambiar(this.abort ? 'local' : 'apagado')
      }
    }
  }

  async confirmarOrden(): Promise<void> {
    const pendiente = this.pendiente
    this.pendiente = null
    this.eventos.confirmar(null)
    if (pendiente && pendiente.version === this.versionSesion())
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
      !this.eventos.disponible() ||
      !['local', 'escuchando'].includes(this.estado)
    )
      return
    if (this.estado === 'escuchando') {
      // Una pregunta abierta nunca vuelve a la gramática cerrada de Vosk (0013).
      if (this.consulta?.agregar(audio)) void this.enviarConsulta()
      return
    }
    if (this.procesando) return
    const version = this.versionSesion()
    this.procesando = true
    try {
      const r = await this.api.voz.reconocer(audio)
      if (
        abort !== this.abort ||
        abort.signal.aborted ||
        !r ||
        this.estado !== 'local' ||
        version !== this.versionSesion()
      )
        return
      const orden = interpretarOrden(r.texto)
      if (orden) {
        clearTimeout(this.reloj)
        if (r.confianza < CONFIANZA_ORDEN_MIN) {
          this.pendiente = { texto: r.texto, version: this.versionSesion() }
          this.eventos.confirmar(r.texto)
          this.cambiar('local')
        } else await this.ejecutar(r.texto)
      }
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
    const consulta = this.consulta
    this.consulta = null
    if (!consulta?.tieneHabla || this.versionConsulta !== this.versionSesion()) {
      this.cambiar('local')
      return
    }
    const audio = consulta.audio
    const lectura = this.lectura
    const version = this.versionSesion()
    const vigente = (): boolean => {
      if (abort !== this.abort || abort.signal.aborted || lectura !== this.lectura) return false
      if (version !== this.versionSesion()) {
        this.cancelarConsulta()
        this.cambiar('local')
        return false
      }
      return true
    }
    this.cambiar('pensando')
    try {
      await this.api.voz.reset({})
      if (!vigente()) return
      if (!this.live) {
        const r = await this.api.voz.token({})
        if (!vigente()) return
        if (!r.ok) throw new Error(r.error.mensaje)
        const live: GeminiLive = new GeminiLive({
          sesion: this.eventos.sesion,
          aplicar: this.eventos.aplicar,
          texto: this.eventos.decir,
          audio: (base64, frecuencia) => {
            if (this.live !== live || abort !== this.abort) return
            this.cambiar('hablando')
            this.reproductor?.reproducir(base64, frecuencia)
          },
          interrumpir: () => this.reproductor?.interrumpir(),
          finTurno: () => {
            if (this.live !== live || abort !== this.abort) return
            clearTimeout(this.reloj)
            this.reloj = setTimeout(
              () => {
                if (this.live !== live || abort !== this.abort) return
                this.silencioHasta = Date.now() + 350
                void this.api.voz.reset({}).catch(() => {})
                this.cambiar('local')
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
            if (abort === this.abort && this.live === live) {
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
      if (!vigente()) return
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
      if (!vigente()) return
      this.live?.cerrar()
      this.live = null
      this.cambiar('local')
      this.eventos.error(error instanceof Error ? error.message : 'No pude abrir la sesión de voz.')
    }
  }
}

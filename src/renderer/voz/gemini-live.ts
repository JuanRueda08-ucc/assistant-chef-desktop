import { z } from 'zod'
import { contextoCompacto } from '@shared/ia/contexto'
import {
  INSTRUCCIONES_CHEF,
  MODELO_GEMINI_LIVE,
  VERSION_GEMINI,
  VOZ_GEMINI
} from '@shared/ia/gemini'
import {
  ARGUMENTOS,
  DEFINICIONES_HERRAMIENTAS,
  NOMBRES_HERRAMIENTAS,
  type LlamadaHerramienta,
  type ResultadoHerramienta
} from '@shared/ia/herramientas'
import type { SesionCocina } from '@shared/types/sesion'
import type { TokenVoz } from '@shared/types/voz'
import { aBase64 } from './pcm'

const esquemaFuncion = z.object({ id: z.string().min(1), name: z.string(), args: z.unknown() })
const esquemaMensaje = z.object({
  setupComplete: z.object({}).optional(),
  toolCall: z.object({ functionCalls: z.array(esquemaFuncion).max(20) }).optional(),
  toolCallCancellation: z.object({ ids: z.array(z.string()) }).optional(),
  goAway: z.object({}).optional(),
  error: z.unknown().optional(),
  serverContent: z
    .object({
      interrupted: z.boolean().optional(),
      turnComplete: z.boolean().optional(),
      outputTranscription: z.object({ text: z.string() }).optional(),
      modelTurn: z
        .object({
          parts: z.array(
            z.object({
              inlineData: z.object({ data: z.string(), mimeType: z.string() }).optional()
            })
          )
        })
        .optional()
    })
    .optional()
})

export interface EventosLive {
  sesion: () => SesionCocina | null
  aplicar: (llamada: LlamadaHerramienta) => Promise<ResultadoHerramienta | null>
  texto: (texto: string) => void
  audio: (base64: string, frecuencia: number) => void
  interrumpir: () => void
  finTurno: (pregunta: boolean) => void
  error: (mensaje: string) => void
}

/** Socket directo con token efímero. El transporte inyectable permite tests sin red. */
export class GeminiLive {
  private socket: WebSocket | null = null
  private listo = false
  private cerrado = false
  private transcripcion = ''
  private canceladas = new Set<string>()
  private ejecutadas = new Set<string>()
  private cola: Promise<void> = Promise.resolve()
  private falloConexion: (() => void) | null = null
  private turno: string | null = null

  private versionSesion(): string | null {
    const sesion = this.eventos.sesion()
    return sesion?.fase === 'cocinar'
      ? JSON.stringify([sesion.id, sesion.pasoActual, sesion.actualizadaEn])
      : null
  }

  constructor(
    private readonly eventos: EventosLive,
    private readonly crearSocket: (url: string) => WebSocket = (url) => new WebSocket(url)
  ) {}

  conectar(credencial: TokenVoz): Promise<void> {
    if (this.cerrado || Date.parse(credencial.expiraEn) <= Date.now())
      return Promise.reject(new Error('La credencial de voz caducó.'))
    if (credencial.token.startsWith('falso_'))
      return Promise.reject(
        new Error(
          'Modo de prueba: las órdenes locales funcionan. Para conversar configura Gemini en el backend.'
        )
      )
    const socket = this.crearSocket(
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${VERSION_GEMINI}.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(credencial.token)}`
    )
    this.socket = socket
    socket.binaryType = 'arraybuffer'
    return new Promise((resolve, reject) => {
      const reloj = setTimeout(() => {
        this.cerrar()
        reject(new Error('El servicio de voz tardó demasiado en conectar.'))
      }, 15_000)
      this.falloConexion = () => {
        clearTimeout(reloj)
        reject(new Error('No pude conectar con la voz del chef.'))
      }
      socket.onopen = () =>
        this.enviar({
          setup: {
            model: `models/${MODELO_GEMINI_LIVE}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ_GEMINI } } }
            },
            systemInstruction: { parts: [{ text: INSTRUCCIONES_CHEF }] },
            tools: [
              {
                functionDeclarations: DEFINICIONES_HERRAMIENTAS.map((d) => ({
                  name: d.nombre,
                  description: d.descripcion,
                  parametersJsonSchema: d.parametros
                }))
              }
            ],
            realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
            outputAudioTranscription: {}
          }
        })
      socket.onmessage = (evento) => {
        void this.leerMensaje(evento.data)
          .then((mensaje) => {
            if (this.cerrado || !mensaje) return
            if (mensaje.setupComplete) {
              this.listo = true
              clearTimeout(reloj)
              this.falloConexion = null
              resolve()
            }
            // Cancelaciones se registran inmediatamente, incluso mientras otra herramienta espera IPC.
            mensaje.toolCallCancellation?.ids.forEach((id) => this.canceladas.add(id))
            this.cola = this.cola
              .then(() => this.procesar(mensaje))
              .catch(() => this.fallar('La sesión de voz recibió una respuesta inválida.'))
          })
          .catch(() => this.fallar('La sesión de voz recibió un mensaje inválido.'))
      }
      socket.onerror = () =>
        this.fallar('Se interrumpió la conexión de voz. Puedes seguir con órdenes locales.')
      socket.onclose = () => {
        if (!this.cerrado)
          this.fallar('La conexión de voz terminó. Di «Chef» para volver a conectar.')
      }
    })
  }

  enviarTurno(audio: readonly ArrayBuffer[]): void {
    const sesion = this.eventos.sesion()
    if (!this.listo || this.cerrado || sesion?.fase !== 'cocinar') return
    this.turno = this.versionSesion()
    this.transcripcion = ''
    this.enviar({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: contextoCompacto(sesion, Date.now()) }] }],
        turnComplete: false
      }
    })
    this.enviar({ realtimeInput: { activityStart: {} } })
    for (const fragmento of audio)
      this.enviar({
        realtimeInput: { audio: { data: aBase64(fragmento), mimeType: 'audio/pcm;rate=16000' } }
      })
    this.enviar({ realtimeInput: { activityEnd: {} } })
  }

  cerrar(): void {
    this.cerrado = true
    this.listo = false
    this.turno = null
    this.falloConexion?.()
    this.falloConexion = null
    this.socket?.close()
    this.socket = null
  }

  private enviar(cuerpo: unknown): void {
    if (!this.cerrado && this.socket?.readyState === 1) this.socket.send(JSON.stringify(cuerpo))
  }

  private fallar(mensaje: string): void {
    if (this.cerrado) return
    this.cerrar()
    this.eventos.interrumpir()
    this.eventos.error(mensaje)
  }

  private async leerMensaje(dato: unknown): Promise<z.output<typeof esquemaMensaje> | null> {
    const texto =
      typeof dato === 'string'
        ? dato
        : dato instanceof Blob
          ? await dato.text()
          : dato instanceof ArrayBuffer
            ? new TextDecoder().decode(dato)
            : ''
    return esquemaMensaje.parse(JSON.parse(texto))
  }

  private async procesar(mensaje: z.output<typeof esquemaMensaje>): Promise<void> {
    if (this.cerrado) return
    if (mensaje.goAway || mensaje.error) {
      this.fallar('El servicio de voz cerró la sesión. Di «Chef» para volver a conectar.')
      return
    }
    // Una respuesta para el paso anterior no puede hablar ni actuar sobre el nuevo.
    if (this.turno === null || this.turno !== this.versionSesion()) {
      if (!mensaje.setupComplete) {
        this.fallar('El paso o la sesión cambiaron. Haz tu consulta sobre el paso actual.')
      }
      return
    }
    for (const llamada of mensaje.toolCall?.functionCalls ?? []) {
      if (this.turno !== this.versionSesion()) {
        this.fallar('El paso o la sesión cambiaron. Haz tu consulta sobre el paso actual.')
        return
      }
      if (this.cerrado || this.canceladas.has(llamada.id) || this.ejecutadas.has(llamada.id))
        continue
      this.ejecutadas.add(llamada.id)
      const nombre = z.enum(NOMBRES_HERRAMIENTAS).safeParse(llamada.name)
      let resultado: unknown = {
        ok: false,
        error: { codigo: 'argumentos_invalidos', mensaje: 'Herramienta o argumentos inválidos.' }
      }
      if (nombre.success) {
        const argumentos = ARGUMENTOS[nombre.data].safeParse(llamada.args)
        if (argumentos.success && this.eventos.sesion()?.fase === 'cocinar') {
          // NUNCA se lee confirmado del modelo ni de su transcripción.
          const aplicado = await this.eventos.aplicar({
            nombre: nombre.data,
            argumentos: argumentos.data,
            confirmado: false
          })
          resultado = aplicado ?? {
            ok: false,
            error: { codigo: 'ocupado', mensaje: 'Espera a que termine la acción actual.' }
          }
          // El resultado de esta herramienta puede actualizar la sesión legítimamente.
          if (aplicado?.ok) this.turno = this.versionSesion()
        }
      }
      const sesion = this.eventos.sesion()
      if (!this.cerrado && !this.canceladas.has(llamada.id))
        this.enviar({
          toolResponse: {
            functionResponses: [
              {
                id: llamada.id,
                name: llamada.name,
                response: {
                  resultado,
                  contexto: sesion ? contextoCompacto(sesion, Date.now()) : 'sin sesión'
                }
              }
            ]
          }
        })
    }
    if (this.turno !== this.versionSesion()) {
      this.fallar('El paso o la sesión cambiaron. Haz tu consulta sobre el paso actual.')
      return
    }
    const contenido = mensaje.serverContent
    if (!contenido || this.cerrado) return
    if (contenido.interrupted) {
      this.eventos.interrumpir()
      this.transcripcion = ''
    }
    if (contenido.outputTranscription) {
      this.transcripcion += contenido.outputTranscription.text
      this.eventos.texto(this.transcripcion)
    }
    for (const parte of contenido.modelTurn?.parts ?? []) {
      const datos = parte.inlineData
      if (datos?.mimeType.startsWith('audio/pcm')) {
        const frecuencia = Number(/rate=(\d+)/.exec(datos.mimeType)?.[1] ?? 24000)
        if (frecuencia >= 8000 && frecuencia <= 48000) this.eventos.audio(datos.data, frecuencia)
      }
    }
    if (contenido.turnComplete) this.eventos.finTurno(/\?\s*$/.test(this.transcripcion))
  }
}

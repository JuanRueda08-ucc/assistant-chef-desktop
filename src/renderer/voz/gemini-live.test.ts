import { afterEach, describe, expect, it, vi } from 'vitest'
import { sesionNueva } from '@shared/cocina/fixtures.test-utils'
import { GeminiLive, type EventosLive } from './gemini-live'

class SocketFalso {
  readyState = 1
  binaryType = ''
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((evento: { data: string }) => void) | null = null
  enviados: Record<string, unknown>[] = []
  send(texto: string): void {
    this.enviados.push(JSON.parse(texto) as Record<string, unknown>)
  }
  close(): void {
    this.readyState = 3
  }
  recibir(cuerpo: unknown): void {
    this.onmessage?.({ data: JSON.stringify(cuerpo) })
  }
}

const tick = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
const credencial = (): { token: string; expiraEn: string } => ({
  token: 'auth_tokens/test',
  expiraEn: new Date(Date.now() + 60_000).toISOString()
})
const conexiones: GeminiLive[] = []
afterEach(() => {
  conexiones.splice(0).forEach((c) => c.cerrar())
})

async function banco(conTurno = true): Promise<{
  live: GeminiLive
  socket: SocketFalso
  eventos: EventosLive
  sesion: ReturnType<typeof sesionNueva>
  crearSocket: ReturnType<typeof vi.fn>
}> {
  const sesion = sesionNueva()
  const eventos: EventosLive = {
    sesion: () => sesion,
    aplicar: vi.fn().mockResolvedValue({
      ok: false,
      error: { codigo: 'falta_confirmacion', mensaje: 'Confirma con un botón' }
    }),
    audio: vi.fn(),
    texto: vi.fn(),
    interrumpir: vi.fn(),
    finTurno: vi.fn(),
    error: vi.fn()
  }
  const socket = new SocketFalso()
  const crearSocket = vi.fn(() => socket as unknown as WebSocket)
  const live = new GeminiLive(eventos, crearSocket)
  conexiones.push(live)
  const conectado = live.conectar(credencial())
  socket.onopen!()
  socket.recibir({ setupComplete: {} })
  await conectado
  if (conTurno) live.enviarTurno([])
  return { live, socket, eventos, sesion, crearSocket }
}

describe('Gemini Live con WebSocket simulado (sin red)', () => {
  it('usa token efímero, declara las nueve herramientas y espera setupComplete', async () => {
    const { socket, crearSocket } = await banco()
    expect(crearSocket.mock.calls[0]).toBeDefined()
    expect(socket.enviados[0]).toMatchObject({
      setup: {
        model: 'models/gemini-3.8-live',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } } }
        },
        realtimeInputConfig: { automaticActivityDetection: { disabled: true } }
      }
    })
    expect(JSON.stringify(socket.enviados[0])).toContain('parametersJsonSchema')
    expect(JSON.stringify(socket.enviados[0])).toContain('terminar_receta')
    expect(JSON.stringify(socket.enviados[0])).not.toContain('PROVEEDOR_IA_API_KEY')
  })
  it('envía contexto fresco y PCM en cada turno con límites explícitos de actividad', async () => {
    const { live, socket, sesion } = await banco(false)
    live.enviarTurno([new Uint8Array([0, 1]).buffer])
    expect(socket.enviados[1]).toMatchObject({ clientContent: { turnComplete: false } })
    expect(JSON.stringify(socket.enviados[1])).toContain('paso 1 de 9')
    expect(socket.enviados[2]).toEqual({ realtimeInput: { activityStart: {} } })
    expect(socket.enviados[3]).toEqual({
      realtimeInput: { audio: { data: 'AAE=', mimeType: 'audio/pcm;rate=16000' } }
    })
    expect(socket.enviados[4]).toEqual({ realtimeInput: { activityEnd: {} } })
    sesion.pasoActual = 2
    live.enviarTurno([])
    expect(JSON.stringify(socket.enviados[5])).toContain('paso 2 de 9')
  })
  it('el modelo no puede confirmar, ni repetir ids, ni ejecutar llamadas inválidas', async () => {
    const { socket, eventos } = await banco()
    socket.recibir({
      toolCall: { functionCalls: [{ id: 'uno', name: 'avanzar_paso', args: {}, confirmado: true }] }
    })
    await tick()
    expect(eventos.aplicar).toHaveBeenCalledWith({
      nombre: 'avanzar_paso',
      argumentos: {},
      confirmado: false
    })
    expect(JSON.stringify(socket.enviados)).toContain('falta_confirmacion')
    socket.recibir({
      toolCall: {
        functionCalls: [
          { id: 'uno', name: 'avanzar_paso', args: {} },
          { id: 'dos', name: 'borrar_todo', args: {} },
          { id: 'tres', name: 'avanzar_paso', args: { confirmado: true } }
        ]
      }
    })
    await tick()
    expect(eventos.aplicar).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(socket.enviados)).toContain('argumentos_invalidos')
  })
  it('ejecuta en serie y respeta cancelación de herramientas pendientes', async () => {
    const { socket, eventos } = await banco()
    let resolver!: () => void
    eventos.aplicar = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          resolver = () => resolve(null)
        })
    )
    socket.recibir({
      toolCall: {
        functionCalls: [
          { id: 'uno', name: 'retroceder_paso', args: {} },
          { id: 'dos', name: 'avanzar_paso', args: {} }
        ]
      }
    })
    await tick()
    socket.recibir({ toolCallCancellation: { ids: ['dos'] } })
    await tick()
    resolver()
    await tick()
    expect(eventos.aplicar).toHaveBeenCalledTimes(1)
  })
  it('procesa audio, transcripción, interrupción y pregunta al terminar el turno', async () => {
    const { socket, eventos } = await banco()
    socket.recibir({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { data: 'AAA=', mimeType: 'audio/pcm;rate=24000' } }] },
        outputTranscription: { text: '¿Seguimos?' },
        turnComplete: true
      }
    })
    await tick()
    expect(eventos.audio).toHaveBeenCalledWith('AAA=', 24000)
    expect(eventos.texto).toHaveBeenCalledWith('¿Seguimos?')
    expect(eventos.finTurno).toHaveBeenCalledWith(true)
    socket.recibir({ serverContent: { interrupted: true } })
    await tick()
    expect(eventos.interrumpir).toHaveBeenCalledOnce()
  })
  it('no conecta con falso o token caducado y no ejecuta tras cerrar', async () => {
    const { live, socket, eventos, sesion } = await banco()
    const crear = vi.fn()
    const falso = new GeminiLive(eventos, crear)
    await expect(falso.conectar({ ...credencial(), token: 'falso_test' })).rejects.toThrow(
      'Modo de prueba'
    )
    await expect(
      falso.conectar({ ...credencial(), expiraEn: '2000-01-01T00:00:00.000Z' })
    ).rejects.toThrow('caducó')
    expect(crear).not.toHaveBeenCalled()
    sesion.fase = 'terminado'
    socket.recibir({ toolCall: { functionCalls: [{ id: 'uno', name: 'avanzar_paso', args: {} }] } })
    await tick()
    expect(eventos.aplicar).not.toHaveBeenCalled()
    live.cerrar()
    socket.recibir({
      toolCall: { functionCalls: [{ id: 'dos', name: 'retroceder_paso', args: {} }] }
    })
    await tick()
    expect(eventos.aplicar).not.toHaveBeenCalled()
  })
  it('informa cierre y rechaza mensajes malformados sin datos internos', async () => {
    const { socket, eventos } = await banco()
    socket.onmessage!({ data: '{no JSON' })
    await tick()
    expect(eventos.error).toHaveBeenCalledWith('La sesión de voz recibió un mensaje inválido.')
    expect(socket.readyState).toBe(3)
  })
  it.each(['paso', 'sesion', 'version'])(
    'descarta herramientas, voz y texto de otro %s',
    async (cambio) => {
      const { socket, eventos, sesion } = await banco()
      if (cambio === 'paso') sesion.pasoActual = 2
      else if (cambio === 'sesion') sesion.id = 'otra-sesion'
      else sesion.actualizadaEn = new Date(Date.now() + 1000).toISOString()
      socket.recibir({
        toolCall: { functionCalls: [{ id: 'tardia', name: 'retroceder_paso', args: {} }] },
        serverContent: {
          outputTranscription: { text: 'Vuelve al paso uno.' },
          modelTurn: { parts: [{ inlineData: { data: 'AAA=', mimeType: 'audio/pcm;rate=24000' } }] }
        }
      })
      await tick()
      expect(eventos.aplicar).not.toHaveBeenCalled()
      expect(eventos.audio).not.toHaveBeenCalled()
      expect(eventos.texto).not.toHaveBeenCalled()
      expect(socket.readyState).toBe(3)
    }
  )
  it('no ejecuta una segunda herramienta si cambió el paso mientras esperaba IPC', async () => {
    const { socket, eventos, sesion } = await banco()
    let resolver!: () => void
    eventos.aplicar = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          resolver = () => resolve(null)
        })
    )
    socket.recibir({
      toolCall: {
        functionCalls: [
          { id: 'uno', name: 'retroceder_paso', args: {} },
          { id: 'dos', name: 'retroceder_paso', args: {} }
        ]
      }
    })
    await tick()
    sesion.pasoActual = 2
    resolver()
    await tick()
    expect(eventos.aplicar).toHaveBeenCalledOnce()
    expect(socket.readyState).toBe(3)
  })
})

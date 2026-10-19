import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sesionNueva } from '@shared/cocina/fixtures.test-utils'
import type { ApiChef } from '@shared/types/ipc'
import { ControlVoz } from './control'

const audio = vi.hoisted(() => ({
  recibir: null as ((audio: ArrayBuffer) => void) | null,
  signal: null as AbortSignal | null,
  reproducirArchivo: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('./audio', () => ({
  crearReproductor: () => ({
    reproducirArchivo: audio.reproducirArchivo,
    cerrar: vi.fn(),
    interrumpir: vi.fn(),
    reproducir: vi.fn(),
    pendienteMs: () => 0
  }),
  capturarAudio: vi.fn(async (recibir: (audio: ArrayBuffer) => void, signal: AbortSignal) => {
    audio.recibir = recibir
    audio.signal = signal
    return vi.fn()
  })
}))
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})
const tick = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

function banco(): {
  control: ControlVoz
  api: ApiChef
  eventos: ConstructorParameters<typeof ControlVoz>[1]
  sesion: ReturnType<typeof sesionNueva>
} {
  const sesion = sesionNueva()
  const api = {
    voz: {
      iniciar: vi.fn().mockResolvedValue({ ok: true }),
      detener: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined),
      reconocer: vi.fn().mockResolvedValue(null),
      repetir: vi.fn().mockResolvedValue({ ok: true }),
      narrar: vi.fn().mockResolvedValue(null),
      callar: vi.fn().mockResolvedValue(undefined),
      token: vi.fn().mockResolvedValue({
        ok: false,
        error: { codigo: 'sin_conexion', mensaje: 'Sin conexión' }
      })
    }
  } as unknown as ApiChef
  const eventos = {
    sesion: () => sesion,
    disponible: () => sesion.fase === 'cocinar',
    aplicar: vi.fn().mockResolvedValue(null),
    decir: vi.fn(),
    temporizadores: vi.fn(),
    confirmar: vi.fn(),
    estado: vi.fn(),
    error: vi.fn()
  }
  return { control: new ControlVoz(api, eventos), api, eventos, sesion }
}

describe('control de voz (sin micro ni red reales)', () => {
  it('lee con Gemini sin abrir micrófono y no usa el respaldo si recibe audio', async () => {
    const { control, api } = banco()
    vi.mocked(api.voz.narrar).mockResolvedValue({ datos: 'AAAA', mimeType: 'audio/wav' })
    await control.repetir()
    expect(api.voz.iniciar).not.toHaveBeenCalled()
    expect(api.voz.repetir).not.toHaveBeenCalled()
    expect(audio.reproducirArchivo).toHaveBeenCalledWith('AAAA')
    control.detener()
  })
  it('no reproduce una respuesta de un paso que ya cambió', async () => {
    const { control, api, sesion } = banco()
    let resolver!: (valor: null) => void
    vi.mocked(api.voz.narrar).mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolver = resolve
        })
    )
    const leyendo = control.repetir()
    sesion.pasoActual = 2
    resolver(null)
    await leyendo
    expect(api.voz.repetir).not.toHaveBeenCalled()
    control.detener()
  })
  it('solo inicia en cocinar y cierra captura al detener', async () => {
    const { control, api, sesion } = banco()
    sesion.fase = 'preparar'
    await control.iniciar()
    expect(api.voz.iniciar).not.toHaveBeenCalled()
    sesion.fase = 'cocinar'
    await control.iniciar()
    expect(audio.signal?.aborted).toBe(false)
    control.detener()
    expect(audio.signal?.aborted).toBe(true)
  })
  it('siguiente y repetir se resuelven en local sin pedir token', async () => {
    const { control, api, eventos } = banco()
    await control.iniciar()
    vi.mocked(api.voz.reconocer).mockResolvedValueOnce({ texto: 'siguiente', confianza: 0.98 })
    audio.recibir!(new Int16Array(1600).buffer)
    await tick()
    expect(eventos.aplicar).toHaveBeenCalledWith({
      nombre: 'avanzar_paso',
      argumentos: {},
      confirmado: true
    })
    vi.mocked(api.voz.reconocer).mockResolvedValueOnce({ texto: 'repite', confianza: 0.99 })
    audio.recibir!(new Int16Array(1600).buffer)
    await tick()
    expect(api.voz.repetir).toHaveBeenCalledOnce()
    expect(api.voz.token).not.toHaveBeenCalled()
    control.detener()
  })
  it('baja confianza exige botón y descarta confirmaciones si cambia la sesión', async () => {
    const { control, api, eventos, sesion } = banco()
    await control.iniciar()
    vi.mocked(api.voz.reconocer).mockResolvedValueOnce({ texto: 'listo', confianza: 0.5 })
    audio.recibir!(new Int16Array(1600).buffer)
    await tick()
    expect(eventos.aplicar).not.toHaveBeenCalled()
    expect(eventos.confirmar).toHaveBeenCalledWith('listo')
    sesion.actualizadaEn = new Date().toISOString()
    await control.confirmarOrden()
    expect(eventos.aplicar).not.toHaveBeenCalled()
    control.detener()
  })
  it('ignora audio abierto sin Chef; tras Chef conserva botones si cae el backend', async () => {
    const { control, api, eventos } = banco()
    await control.iniciar()
    const pcm = new Int16Array(1600).fill(4000).buffer
    vi.mocked(api.voz.reconocer).mockResolvedValueOnce({ texto: '[unk]', confianza: 0 })
    audio.recibir!(pcm)
    await tick()
    expect(api.voz.token).not.toHaveBeenCalled()
    vi.mocked(api.voz.reconocer).mockResolvedValueOnce({ texto: 'chef', confianza: 0.99 })
    audio.recibir!(pcm)
    await tick()
    vi.mocked(api.voz.reconocer).mockResolvedValueOnce({ texto: '[unk]', confianza: 0 })
    audio.recibir!(pcm)
    await tick()
    expect(api.voz.token).toHaveBeenCalledOnce()
    expect(eventos.error).toHaveBeenCalledWith('Sin conexión')
    expect(eventos.estado).toHaveBeenLastCalledWith('local')
    control.detener()
  })
  it('cierra la ventana de ocho segundos sin enviar silencio ni abrir token', async () => {
    const { control, api, eventos } = banco()
    await control.iniciar()
    control.activar()
    await vi.advanceTimersByTimeAsync(8000)
    expect(api.voz.token).not.toHaveBeenCalled()
    expect(eventos.estado).toHaveBeenLastCalledWith('local')
    control.detener()
  })
})

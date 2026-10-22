import { describe, expect, it, vi } from 'vitest'
import { MODELO_GEMINI_LIVE, MODELO_TEXTO, MODELO_TEXTO_RESPALDO } from '@shared/ia/gemini'
import { crearApp } from '../app'
import { AlmacenMemoria, Limitador } from '../limite'
import { cuentasFalsas, cuerpoReceta, cuerpoSustitucion, post, T0 } from '../fixtures.test-utils'
import { ProveedorGemini } from './gemini'
import { crearProveedor } from './index'
import { esquemaPeticionReceta, esquemaPeticionSustitucion } from '../peticiones'

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), { status })

describe('ProveedorGemini (transporte simulado, sin red)', () => {
  it('narra el texto exacto con voz natural y valida el audio devuelto', async () => {
    const solicitar = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'audio', mime_type: 'audio/wav', data: 'AAAA' }]
          }
        ]
      })
    )
    const proveedor = new ProveedorGemini('solo-test', { fetch: solicitar })
    expect(await proveedor.narrar('Añade el arroz.')).toEqual({
      datos: 'AAAA',
      mimeType: 'audio/wav'
    })
    const [url, opciones] = solicitar.mock.calls[0]!
    expect(url).toContain('/v1beta/interactions')
    expect(JSON.parse(opciones!.body as string)).toMatchObject({
      model: 'gemini-3.8-flash-tts',
      input: [{ content: [{ text: 'Añade el arroz.' }] }],
      generation_config: { speech_config: [{ voice: 'Sulafat' }] }
    })
  })
  it('registra Gemini, exige clave solo para Gemini y conserva falso por defecto', () => {
    expect(crearProveedor({}).nombre).toBe('falso')
    expect(crearProveedor({ PROVEEDOR_IA: 'falso' }).nombre).toBe('falso')
    expect(() => crearProveedor({ PROVEEDOR_IA: 'gemini' })).toThrow('PROVEEDOR_IA_API_KEY')
    expect(
      crearProveedor({ PROVEEDOR_IA: 'gemini', PROVEEDOR_IA_API_KEY: 'solo-test' }).nombre
    ).toBe('gemini')
  })
  it('solicita un token de un uso con ventana de apertura de un minuto y modelo restringido', async () => {
    const solicitar = vi.fn<typeof fetch>().mockResolvedValue(json({ name: 'auth_tokens/prueba' }))
    const proveedor = new ProveedorGemini('solo-test', { fetch: solicitar, ahora: () => T0 })
    expect(await proveedor.crearTokenVoz('instalacion-test')).toEqual({
      token: 'auth_tokens/prueba',
      expiraEn: new Date(T0 + 60_000).toISOString()
    })
    const [url, opciones] = solicitar.mock.calls[0]!
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/auth_tokens')
    expect(opciones?.headers).toMatchObject({ 'x-goog-api-key': 'solo-test' })
    expect(JSON.parse(opciones!.body as string)).toEqual({
      uses: 1,
      expireTime: new Date(T0 + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(T0 + 60_000).toISOString(),
      fieldMask: 'model,generationConfig',
      bidiGenerateContentSetup: {
        model: `models/${MODELO_GEMINI_LIVE}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } } }
        }
      }
    })
  })
  it('las rutas mantienen validación y no exponen la clave ni errores internos de Google', async () => {
    const solicitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ error: { message: 'solo-test' } }, 429))
    const registrarError = vi.fn()
    const manejar = crearApp({
      proveedor: new ProveedorGemini('solo-test', { fetch: solicitar }),
      limitador: new Limitador(new AlmacenMemoria()),
      cuentas: cuentasFalsas,
      registrarError
    })
    const respuesta = await manejar(post('/voz/token'))
    expect(respuesta.status).toBe(502)
    expect(await respuesta.text()).not.toContain('solo-test')
    expect(JSON.stringify(registrarError.mock.calls)).not.toContain('solo-test')
  })
  it.each([{}, { name: 'clave-permanente' }, { name: '' }])(
    'rechaza un token malformado %j',
    async (bruto) => {
      const proveedor = new ProveedorGemini('solo-test', {
        fetch: vi.fn<typeof fetch>().mockResolvedValue(json(bruto))
      })
      await expect(proveedor.crearTokenVoz('instalacion-test')).rejects.toThrow(
        'formato inesperado'
      )
    }
  )
  it.each([
    [503, 'proveedor_saturado'],
    [504, 'proveedor_timeout'],
    [429, 'proveedor_sin_cuota'],
    [403, 'proveedor_no_autorizado']
  ])('transporta HTTP %s como %s sin cuerpo privado ni reintentos', async (estado, codigo) => {
    const solicitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ error: { message: 'solo-test' } }, Number(estado)))
    const manejar = crearApp({
      proveedor: new ProveedorGemini('solo-test', { fetch: solicitar }),
      limitador: new Limitador(new AlmacenMemoria()),
      cuentas: cuentasFalsas,
      registrarError: vi.fn()
    })
    const respuesta = await manejar(post('/voz/token'))
    expect(respuesta.status).toBe(502)
    const cuerpo = await respuesta.json()
    expect(cuerpo).toMatchObject({ error: { codigo } })
    expect(JSON.stringify(cuerpo)).not.toContain('solo-test')
    expect(solicitar).toHaveBeenCalledOnce()
  })
  it.each(['TimeoutError', 'TypeError'])(
    'distingue el transporte %s sin datos privados',
    async (nombre) => {
      const error = new Error('solo-test')
      error.name = nombre
      const proveedor = new ProveedorGemini('solo-test', {
        fetch: vi.fn<typeof fetch>().mockRejectedValue(error)
      })
      await expect(proveedor.crearTokenVoz('instalacion-test')).rejects.toMatchObject({
        codigo: nombre === 'TimeoutError' ? 'proveedor_timeout' : 'proveedor_sin_conexion'
      })
    }
  )
  it.each([
    ['503 saturado', async (): Promise<Response> => json({ error: { message: 'x' } }, 503)],
    [
      'sin respuesta a tiempo',
      async (): Promise<Response> => {
        const e = new Error('solo-test')
        e.name = 'TimeoutError'
        throw e
      }
    ]
  ])('si el modelo principal está %s, repite una vez con el de respaldo', async (_caso, fallo) => {
    const respuesta = { candidates: [{ content: { role: 'model', parts: [{ text: 'Hola' }] } }] }
    const solicitar = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(fallo)
      .mockResolvedValueOnce(json(respuesta))
    const proveedor = new ProveedorGemini('solo-test', { fetch: solicitar })
    const contenido = await proveedor.conversar({
      pantalla: 'preparar',
      contexto: '{}',
      mensajes: [{ role: 'user', parts: [{ text: 'hola' }] }]
    })
    expect(contenido.parts[0]).toEqual({ text: 'Hola' })
    expect(String(solicitar.mock.calls[0]![0])).toContain(`models/${MODELO_TEXTO}:`)
    expect(String(solicitar.mock.calls[1]![0])).toContain(`models/${MODELO_TEXTO_RESPALDO}:`)
    expect(solicitar.mock.calls[1]![1]!.body).toBe(solicitar.mock.calls[0]![1]!.body)
  })
  it('no repite con el respaldo si Google rechaza la petición o la cuota', async () => {
    for (const estado of [400, 429]) {
      const solicitar = vi.fn<typeof fetch>().mockResolvedValue(json({}, estado))
      const proveedor = new ProveedorGemini('solo-test', { fetch: solicitar })
      await expect(
        proveedor.conversar({
          pantalla: 'preparar',
          contexto: '{}',
          mensajes: [{ role: 'user', parts: [{ text: 'hola' }] }]
        })
      ).rejects.toThrow()
      expect(solicitar).toHaveBeenCalledOnce()
    }
  })
  it('implementa generación, reintento con error y sugerencias en JSON', async () => {
    const solicitar = vi.fn<typeof fetch>().mockImplementation(async () =>
      json({
        candidates: [
          {
            content: {
              parts: [{ thought: true, text: 'interno' }, { text: '{"titulo":"Prueba"}' }]
            }
          }
        ]
      })
    )
    const proveedor = new ProveedorGemini('solo-test', { fetch: solicitar })
    expect(
      await proveedor.generarReceta(esquemaPeticionReceta.parse(cuerpoReceta()), 'faltan pasos')
    ).toEqual({
      titulo: 'Prueba'
    })
    expect(solicitar.mock.calls[0]![1]!.body).toContain('faltan pasos')
    expect(
      await proveedor.sugerirSustituciones(esquemaPeticionSustitucion.parse(cuerpoSustitucion()))
    ).toEqual({ titulo: 'Prueba' })
  })
  it('oculta errores de transporte y rechaza contenido vacío o JSON inválido', async () => {
    const solicitar = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('clave solo-test'))
      .mockResolvedValueOnce(json({ candidates: [] }))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: 'no JSON' }] } }] }))
    const proveedor = new ProveedorGemini('solo-test', { fetch: solicitar })
    await expect(proveedor.crearTokenVoz('instalacion-test')).rejects.toThrow('conectar')
    await expect(
      proveedor.generarReceta(esquemaPeticionReceta.parse(cuerpoReceta()), null)
    ).rejects.toThrow('contenido JSON')
    await expect(
      proveedor.generarReceta(esquemaPeticionReceta.parse(cuerpoReceta()), null)
    ).rejects.toThrow('JSON válido')
  })
})

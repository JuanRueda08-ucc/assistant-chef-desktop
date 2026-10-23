import { describe, expect, it, vi } from 'vitest'
import { crearClienteBackend } from './backend'

const AHORA = Date.UTC(2026, 9, 19)
const credencial = { token: 'auth_tokens/test', expiraEn: new Date(AHORA + 60_000).toISOString() }

describe('cliente backend en main (sin red)', () => {
  it('consulta el chat con la instalación y oculta errores HTTP', async () => {
    const peticion = {
      pantalla: 'cocinar' as const,
      contexto: 'paso_actual: corta',
      mensajes: [{ role: 'user' as const, parts: [{ text: 'técnica' }] }]
    }
    const solicitar = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            contenido: { role: 'model', parts: [{ text: 'Usa el cuchillo con cuidado.' }] },
            simulado: true
          })
        )
    )
    const cliente = crearClienteBackend('http://localhost:8787', 'instalacion-test', solicitar)
    expect((await cliente.conversar(peticion)).simulado).toBe(true)
    expect(String(solicitar.mock.calls[0]![0])).toBe('http://localhost:8787/chat')
    expect(solicitar.mock.calls[0]![1]?.headers).toMatchObject({
      'x-instalacion': 'instalacion-test'
    })
    solicitar.mockResolvedValue(new Response('detalle privado', { status: 429 }))
    await expect(cliente.conversar(peticion)).rejects.toThrow('límite')
    solicitar.mockResolvedValue(new Response('detalle privado', { status: 502 }))
    await expect(cliente.conversar(peticion)).rejects.toThrow('servicio de IA no pudo responder')
  })
  it('envía el token de la cuenta y avisa si el backend lo rechaza', async () => {
    const solicitar = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 }))
    const caducada = vi.fn()
    const cliente = crearClienteBackend(
      'http://localhost:8787',
      'instalacion-test',
      solicitar,
      () => AHORA,
      { token: async () => 'tok', caducada }
    )
    const r = await cliente.pedirTokenVoz()
    expect(r.ok || r.error.codigo).toBe('sin_sesion')
    expect(solicitar.mock.calls[0]![1]?.headers).toMatchObject({ authorization: 'Bearer tok' })
    await expect(
      cliente.conversar({
        pantalla: 'preparar',
        contexto: '{}',
        mensajes: [{ role: 'user', parts: [{ text: 'hola' }] }]
      })
    ).rejects.toThrow('sesión ha caducado')
    expect(caducada).toHaveBeenCalledTimes(2)
  })
  it.each([
    ['proveedor_timeout', 'tardó demasiado'],
    ['proveedor_saturado', 'temporalmente ocupada'],
    ['proveedor_sin_cuota', 'límite de uso'],
    ['proveedor_sin_conexion', 'no pudo conectar con la IA'],
    ['proveedor_no_autorizado', 'configuración de acceso']
  ])('explica %s sin mostrar el mensaje privado ni reintentar', async (codigo, texto) => {
    const solicitar = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { codigo, mensaje: 'secreto privado' } }), {
        status: 502
      })
    )
    const cliente = crearClienteBackend('http://localhost:8787', 'instalacion-test', solicitar)
    await expect(
      cliente.conversar({
        pantalla: 'cocinar',
        contexto: 'paso 1',
        mensajes: [{ role: 'user', parts: [{ text: 'Explica el paso' }] }]
      })
    ).rejects.toThrow(texto)
    expect(solicitar).toHaveBeenCalledOnce()
  })
  it('hace POST con id de instalación y valida el token', async () => {
    const solicitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(credencial)))
    const cliente = crearClienteBackend(
      'http://localhost:8787/api/',
      'instalacion-test',
      solicitar,
      () => AHORA
    )
    expect(await cliente.pedirTokenVoz()).toEqual({ ok: true, credencial })
    const [url, opciones] = solicitar.mock.calls[0]!
    expect(String(url)).toBe('http://localhost:8787/api/voz/token')
    expect(opciones).toMatchObject({
      method: 'POST',
      body: '{}',
      redirect: 'error',
      headers: { 'x-instalacion': 'instalacion-test' }
    })
  })
  it('distingue un timeout del chat de la falta de backend y no reintenta', async () => {
    const error = new Error('secreto privado')
    error.name = 'TimeoutError'
    const solicitar = vi.fn<typeof fetch>().mockRejectedValue(error)
    const cliente = crearClienteBackend('http://localhost:8787', 'instalacion-test', solicitar)
    await expect(
      cliente.conversar({
        pantalla: 'cocinar',
        contexto: 'paso 1',
        mensajes: [{ role: 'user', parts: [{ text: 'Explica' }] }]
      })
    ).rejects.toThrow('tardó demasiado')
    expect(solicitar).toHaveBeenCalledOnce()
  })
  it.each([
    'http://externo.com',
    'https://usuario:clave@ejemplo.com',
    'https://ejemplo.com?clave=x',
    'file:///privado'
  ])('rechaza URL %s', (url) => {
    expect(() => crearClienteBackend(url, 'instalacion-test')).toThrow('CHEF_API_URL')
  })
  it.each([
    ['429', 429, 'limite_superado'],
    ['502', 502, 'servicio_no_disponible']
  ])('traduce HTTP %s sin detalles internos', async (_nombre, estado, codigo) => {
    const solicitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secreto interno', { status: Number(estado) }))
    const resultado = await crearClienteBackend(
      'http://localhost',
      'instalacion-test',
      solicitar
    ).pedirTokenVoz()
    expect(resultado).toMatchObject({ ok: false, error: { codigo } })
    expect(JSON.stringify(resultado)).not.toContain('secreto interno')
  })
  it('traduce desconexión o timeout sin propagar datos internos', async () => {
    const solicitar = vi.fn<typeof fetch>().mockRejectedValue(new Error('detalle interno'))
    expect(
      await crearClienteBackend('http://localhost', 'instalacion-test', solicitar).pedirTokenVoz()
    ).toMatchObject({ ok: false, error: { codigo: 'sin_conexion' } })
  })
  it.each([
    {},
    { ...credencial, expiraEn: new Date(AHORA).toISOString() },
    { ...credencial, extra: 'no' },
    'no JSON'
  ])('rechaza cuerpo inválido o caducado %j', async (cuerpo) => {
    const solicitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)))
    expect(
      await crearClienteBackend(
        'http://localhost',
        'instalacion-test',
        solicitar,
        () => AHORA
      ).pedirTokenVoz()
    ).toMatchObject({ ok: false, error: { codigo: 'respuesta_invalida' } })
  })
})

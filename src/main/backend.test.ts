import { describe, expect, it, vi } from 'vitest'
import { crearClienteBackend } from './backend'

const AHORA = Date.UTC(2026, 9, 19)
const credencial = { token: 'auth_tokens/test', expiraEn: new Date(AHORA + 60_000).toISOString() }

describe('cliente backend en main (sin red)', () => {
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

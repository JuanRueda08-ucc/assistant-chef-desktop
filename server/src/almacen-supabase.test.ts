import { describe, expect, it, vi } from 'vitest'
import { AlmacenSupabase, claveSecretaDesdeEntorno } from './almacen-supabase'
import { Limitador } from './limite'

describe('contadores de uso en Supabase', () => {
  it('llama a consumir_cupo con la clave secreta y aplica el límite', async () => {
    let usadas = 0
    const solicitar = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(++usadas)))
    const limitador = new Limitador(
      new AlmacenSupabase('https://p.supabase.co', 'sb_secret_x', solicitar),
      { voz: 1, chat: 1, recetas: 1, sustituciones: 1 }
    )
    const ahora = Date.UTC(2026, 9, 23, 10)
    expect((await limitador.consumir('usuario:u1', 'chat', ahora)).permitido).toBe(true)
    expect((await limitador.consumir('usuario:u1', 'chat', ahora)).permitido).toBe(false)
    const [url, init] = solicitar.mock.calls[0]!
    expect(url).toBe('https://p.supabase.co/rest/v1/rpc/consumir_cupo')
    expect(init?.headers).toEqual({ 'content-type': 'application/json', apikey: 'sb_secret_x' })
    expect(JSON.parse(init!.body as string)).toEqual({
      p_clave: 'chat:usuario:u1',
      p_dia: '2026-10-23'
    })
  })

  it('falla si la base no responde bien, para no saltarse el límite', async () => {
    const almacen = new AlmacenSupabase(
      'https://p.supabase.co',
      'k',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 500 }))
    )
    await expect(almacen.incrementar('chat:u', '2026-10-23')).rejects.toThrow('HTTP 500')
  })

  it('toma la clave secreta nueva o la heredada', () => {
    expect(claveSecretaDesdeEntorno({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_a"}' })).toBe(
      'sb_secret_a'
    )
    expect(claveSecretaDesdeEntorno({ SUPABASE_SERVICE_ROLE_KEY: 'jwt-heredado' })).toBe(
      'jwt-heredado'
    )
    expect(() => claveSecretaDesdeEntorno({})).toThrow('clave secreta')
  })
})

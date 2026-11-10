import { describe, expect, it, vi } from 'vitest'
import { AlmacenSupabase, claveSecretaDesdeEntorno, crearBorrarCuenta } from './almacen-supabase'
import { Limitador } from './limite'

describe('contadores de uso en Supabase', () => {
  it('llama a consumir_cupo con la clave secreta y aplica el límite', async () => {
    let usadas = 0
    const solicitar = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(++usadas)))
    const limitador = new Limitador(
      new AlmacenSupabase('https://p.supabase.co', 'sb_secret_x', solicitar),
      { voz: 1, chat: 1, recetas: 1, sustituciones: 1, imagenes: 1 }
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

  it('lee lo usado hoy con una sola consulta, sin cambiarlo', async () => {
    const solicitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify([{ clave: 'chat:usuario:u1', usadas: 7 }]), { status: 200 })
      )
    const limitador = new Limitador(
      new AlmacenSupabase('https://p.supabase.co', 'sb_secret_x', solicitar)
    )
    const uso = await limitador.uso('usuario:u1', Date.UTC(2026, 10, 9, 22))
    expect(uso.grupos.chat).toEqual({ limite: 120, usadas: 7, restantes: 113 })
    expect(uso.grupos.voz).toEqual({ limite: 40, usadas: 0, restantes: 40 })
    expect(uso.reinicioEn).toBe(Date.UTC(2026, 10, 10))
    const [url, init] = solicitar.mock.calls[0]!
    const u = new URL(String(url))
    expect(u.pathname).toBe('/rest/v1/uso_diario')
    expect(u.searchParams.get('dia')).toBe('eq.2026-11-09')
    expect(u.searchParams.get('clave')).toContain('"chat:usuario:u1"')
    expect(init).toMatchObject({ method: 'GET', headers: { apikey: 'sb_secret_x' } })
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

describe('borrar una cuenta (0026)', () => {
  const ID = '0b4f4a3e-9c7d-4c55-8a7e-3c2b1a0f9e8d'
  it('borra sus contadores y la cuenta con la clave secreta', async () => {
    const solicitar = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
    await crearBorrarCuenta('https://p.supabase.co', 'sb_secret_x', solicitar)(ID)
    const [uso, cuenta] = solicitar.mock.calls
    const u = new URL(String(uso![0]))
    expect(u.pathname).toBe('/rest/v1/uso_diario')
    expect(u.searchParams.get('clave')).toBe(`like.*:usuario:${ID}`)
    expect(String(cuenta![0])).toBe(`https://p.supabase.co/auth/v1/admin/users/${ID}`)
    expect(cuenta![1]).toMatchObject({ method: 'DELETE', headers: { apikey: 'sb_secret_x' } })
  })

  it('rechaza ids raros y falla si Supabase no la borra', async () => {
    const ok = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
    await expect(crearBorrarCuenta('https://p.supabase.co', 'k', ok)('a*b')).rejects.toThrow()
    expect(ok).not.toHaveBeenCalled()
    const falla = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
    await expect(crearBorrarCuenta('https://p.supabase.co', 'k', falla)(ID)).rejects.toThrow(
      'HTTP 500'
    )
  })
})

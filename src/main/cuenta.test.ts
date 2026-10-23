import { describe, expect, it } from 'vitest'
import { crearCuenta, type AlmacenSesion, type SesionGuardada } from './cuenta'

// Supabase Auth simulado: solo lo que usa main (/signup, /verify, /token, /user, /logout,
// /recover, /resend), con la forma de sus respuestas y `error_code`.
const URL_SB = new URL('https://proyecto.supabase.co')
const CLAVE = 'sb_publishable_prueba'

function supabaseFalso(): {
  solicitar: typeof fetch
  llamadas: { ruta: string; apikey: string | null }[]
  caer: () => void
} {
  let n = 0
  const usuarios = new Map<
    string,
    { id: string; password: string; nombre: string; confirmado: boolean }
  >()
  const codigos = new Map<string, { codigo: string; tipo: 'email' | 'recovery' }>()
  const accesos = new Map<string, string>() // jwt → email
  const renovaciones = new Map<string, string>() // refresh → email
  const llamadas: { ruta: string; apikey: string | null }[] = []
  let caidas = false

  const json = (cuerpo: unknown, status = 200): Response =>
    new Response(JSON.stringify(cuerpo), { status })
  const errorCodigo = (error_code: string, status = 400): Response =>
    json({ code: status, error_code, msg: error_code }, status)
  function sesionDe(email: string): Response {
    const acceso = `jwt-${++n}`
    const renovacion = `rt-${n}`
    accesos.set(acceso, email)
    renovaciones.set(renovacion, email)
    return json({ access_token: acceso, refresh_token: renovacion, expires_in: 3600 })
  }

  const solicitar: typeof fetch = async (url, init) => {
    if (caidas) throw new TypeError('fetch failed')
    const u = new URL(String(url))
    const ruta = u.pathname.replace('/auth/v1', '') + u.search
    const cabeceras = new Headers(init?.headers)
    llamadas.push({ ruta, apikey: cabeceras.get('apikey') })
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : {}
    const bearer = cabeceras.get('authorization')?.replace('Bearer ', '') ?? ''
    switch (ruta) {
      case '/signup': {
        if (!usuarios.has(cuerpo.email))
          usuarios.set(cuerpo.email, {
            id: `u${++n}`,
            password: cuerpo.password,
            nombre: cuerpo.data?.nombre ?? '',
            confirmado: false
          })
        // Igual respuesta si ya existía: no revela cuentas.
        codigos.set(cuerpo.email, { codigo: '111111', tipo: 'email' })
        return json({ id: 'x' })
      }
      case '/resend':
        codigos.set(cuerpo.email, { codigo: '222222', tipo: 'email' })
        return json({})
      case '/recover':
        if (usuarios.has(cuerpo.email))
          codigos.set(cuerpo.email, { codigo: '333333', tipo: 'recovery' })
        return json({})
      case '/verify': {
        const esperado = codigos.get(cuerpo.email)
        if (!esperado || esperado.codigo !== cuerpo.token || esperado.tipo !== cuerpo.type)
          return errorCodigo('otp_expired', 403)
        codigos.delete(cuerpo.email)
        usuarios.get(cuerpo.email)!.confirmado = true
        return sesionDe(cuerpo.email)
      }
      case '/token?grant_type=password': {
        const usuario = usuarios.get(cuerpo.email)
        if (!usuario || usuario.password !== cuerpo.password)
          return errorCodigo('invalid_credentials')
        if (!usuario.confirmado) return errorCodigo('email_not_confirmed')
        return sesionDe(cuerpo.email)
      }
      case '/token?grant_type=refresh_token': {
        const email = renovaciones.get(cuerpo.refresh_token)
        if (!email) return errorCodigo('refresh_token_not_found')
        renovaciones.delete(cuerpo.refresh_token) // un solo uso
        return sesionDe(email)
      }
      case '/user': {
        const email = accesos.get(bearer)
        if (!email) return errorCodigo('bad_jwt', 401)
        const usuario = usuarios.get(email)!
        if (init?.method === 'PUT') {
          usuario.password = cuerpo.password
          return json({ id: usuario.id })
        }
        return json({
          id: usuario.id,
          email,
          email_confirmed_at: usuario.confirmado ? '2026-10-23T00:00:00Z' : null,
          user_metadata: { nombre: usuario.nombre }
        })
      }
      case '/logout?scope=local': {
        const email = accesos.get(bearer)
        for (const [rt, e] of renovaciones) if (e === email) renovaciones.delete(rt)
        return new Response(null, { status: 204 })
      }
    }
    return json({}, 404)
  }
  return {
    solicitar,
    llamadas,
    caer: () => {
      caidas = true
    }
  }
}

function almacen(): AlmacenSesion & { valor: SesionGuardada | null } {
  return {
    valor: null,
    leer() {
      return this.valor
    },
    guardar(s) {
      this.valor = s
    }
  }
}

const datos = { nombre: 'Luis', email: 'luis@example.com', contrasena: 'sarten-2026' }

describe('cuenta en main con Supabase Auth', () => {
  it('registra, confirma con código, guarda la sesión y la recupera al reiniciar', async () => {
    const sb = supabaseFalso()
    const guardado = almacen()
    const cuenta = crearCuenta({
      supabaseUrl: URL_SB,
      clavePublica: CLAVE,
      almacen: guardado,
      solicitar: sb.solicitar
    })
    expect(await cuenta.iniciar()).toEqual({ usuario: null, sinConexion: false })
    expect((await cuenta.registrar(datos)).ok).toBe(true)
    const antes = await cuenta.entrar(datos)
    expect(antes.ok || antes.error.codigo).toBe('correo_sin_verificar')
    const mal = await cuenta.verificar({ email: datos.email, codigo: '000000' })
    expect(mal.ok || mal.error.codigo).toBe('codigo_invalido')

    const bien = await cuenta.verificar({ email: datos.email, codigo: '111111' })
    expect(bien.ok && bien.estado.usuario).toMatchObject({ nombre: 'Luis', email: datos.email })
    expect(await cuenta.token()).toBe(guardado.valor?.acceso)
    expect(sb.llamadas.every((l) => l.apikey === CLAVE)).toBe(true)

    // Otro arranque: renueva con el refresh token y sigue dentro.
    const otra = crearCuenta({
      supabaseUrl: URL_SB,
      clavePublica: CLAVE,
      almacen: guardado,
      solicitar: sb.solicitar
    })
    expect((await otra.iniciar()).usuario?.email).toBe(datos.email)
  })

  it('renueva el JWT antes de que caduque, una sola vez aunque lo pidan a la vez', async () => {
    const sb = supabaseFalso()
    let reloj = 0
    const cuenta = crearCuenta({
      supabaseUrl: URL_SB,
      clavePublica: CLAVE,
      almacen: almacen(),
      solicitar: sb.solicitar,
      ahora: () => reloj
    })
    await cuenta.registrar(datos)
    await cuenta.verificar({ email: datos.email, codigo: '111111' })
    const primero = await cuenta.token()
    reloj = 3600_000 - 30_000 // quedan 30 s
    const [a, b] = await Promise.all([cuenta.token(), cuenta.token()])
    expect(a).not.toBe(primero)
    expect(b).toBe(a)
    expect(sb.llamadas.filter((l) => l.ruta.includes('refresh_token'))).toHaveLength(1)
  })

  it('salir anula la sesión: el refresh token ya no sirve al reiniciar', async () => {
    const sb = supabaseFalso()
    const guardado = almacen()
    const cuenta = crearCuenta({
      supabaseUrl: URL_SB,
      clavePublica: CLAVE,
      almacen: guardado,
      solicitar: sb.solicitar
    })
    await cuenta.registrar(datos)
    await cuenta.verificar({ email: datos.email, codigo: '111111' })
    const copia = guardado.valor!
    await cuenta.salir()
    expect(cuenta.estado().usuario).toBeNull()
    expect(guardado.valor).toBeNull()
    guardado.valor = copia
    const otra = crearCuenta({
      supabaseUrl: URL_SB,
      clavePublica: CLAVE,
      almacen: guardado,
      solicitar: sb.solicitar
    })
    expect((await otra.iniciar()).usuario).toBeNull()
    const mal = await otra.entrar({ email: datos.email, contrasena: 'otra-clave-1' })
    expect(mal.ok || mal.error.codigo).toBe('credenciales')
  })

  it('cambia la contraseña con el código de recuperación sin dejar la sesión abierta', async () => {
    const sb = supabaseFalso()
    const cuenta = crearCuenta({
      supabaseUrl: URL_SB,
      clavePublica: CLAVE,
      almacen: almacen(),
      solicitar: sb.solicitar
    })
    await cuenta.registrar(datos)
    await cuenta.verificar({ email: datos.email, codigo: '111111' })
    await cuenta.salir()
    expect((await cuenta.recuperar(datos.email)).ok).toBe(true)
    const r = await cuenta.restablecer({
      email: datos.email,
      codigo: '333333',
      contrasena: 'nueva-sarten-1'
    })
    expect(r.ok && r.estado.usuario).toBeNull()
    expect((await cuenta.entrar({ email: datos.email, contrasena: 'nueva-sarten-1' })).ok).toBe(
      true
    )
  })

  it('sin red conserva la sesión guardada y lo indica', async () => {
    const sb = supabaseFalso()
    sb.caer()
    const guardado = almacen()
    guardado.valor = {
      acceso: 'jwt-viejo',
      renovacion: 'rt-viejo',
      caducaEn: 0,
      usuario: { id: 'u1', nombre: 'Luis', email: datos.email }
    }
    const cuenta = crearCuenta({
      supabaseUrl: URL_SB,
      clavePublica: CLAVE,
      almacen: guardado,
      solicitar: sb.solicitar
    })
    expect(await cuenta.iniciar()).toEqual({ usuario: guardado.valor.usuario, sinConexion: true })
    const r = await cuenta.entrar(datos)
    expect(r.ok || r.error.codigo).toBe('sin_conexion')
  })
})

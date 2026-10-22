import Database from 'better-sqlite3'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Correo, TipoCodigo } from './correo'
import { crearCuentas, migrarCuentas, type Cuentas } from './cuentas'

// Better Auth real sobre SQLite en memoria; el correo se captura en vez de enviarse.
const codigos: { destino: string; codigo: string; tipo: TipoCodigo }[] = []
const correo: Correo = {
  modo: 'consola',
  enviarCodigo: async (destino, codigo, tipo) => {
    codigos.push({ destino, codigo, tipo })
  }
}
const ultimoCodigo = async (tipo: TipoCodigo): Promise<string> => {
  await new Promise((r) => setTimeout(r, 20))
  return codigos.filter((c) => c.tipo === tipo).at(-1)!.codigo
}

const URL_BASE = 'http://localhost:8787'
let cuentas: Cuentas

const post = (ruta: string, cuerpo: unknown, token?: string): Promise<Response> =>
  cuentas.manejar(
    new Request(`${URL_BASE}/auth${ruta}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token && { authorization: `Bearer ${token}` })
      },
      body: JSON.stringify(cuerpo)
    })
  )
const usuario = (token: string): ReturnType<Cuentas['usuario']> =>
  cuentas.usuario(new Headers({ authorization: `Bearer ${token}` }))

beforeAll(async () => {
  const opciones = {
    db: new Database(':memory:'),
    secreto: 'secreto-de-prueba-con-mas-de-32-caracteres',
    url: URL_BASE,
    correo
  }
  await migrarCuentas(opciones)
  cuentas = crearCuentas(opciones)
})

describe('cuentas con Better Auth', () => {
  const email = 'ana@example.com'
  let token = ''

  it('registra, exige verificar el correo y entra con el código', async () => {
    const registro = await post('/sign-up/email', { name: 'Ana', email, password: 'cocina-1234' })
    expect(registro.status).toBe(200)
    expect(registro.headers.get('set-auth-token')).toBeNull()

    const sinVerificar = await post('/sign-in/email', { email, password: 'cocina-1234' })
    expect(sinVerificar.status).toBe(403)

    const verificar = await post('/email-otp/verify-email', {
      email,
      otp: await ultimoCodigo('email-verification')
    })
    expect(verificar.status).toBe(200)
    // Con autoSignInAfterVerification, verificar ya devuelve un token de sesión.
    expect(verificar.headers.get('set-auth-token')).toBeTruthy()

    const entrar = await post('/sign-in/email', { email, password: 'cocina-1234' })
    expect(entrar.status).toBe(200)
    token = entrar.headers.get('set-auth-token') ?? ''
    expect(token).not.toBe('')
    expect(await usuario(token)).toMatchObject({ nombre: 'Ana', email })
    const sesion = await cuentas.manejar(
      new Request(`${URL_BASE}/auth/get-session`, {
        headers: { authorization: `Bearer ${token}` }
      })
    )
    expect(await sesion.json()).toMatchObject({ user: { name: 'Ana', email, emailVerified: true } })
  })

  it('rechaza contraseñas incorrectas y tokens inválidos', async () => {
    expect((await post('/sign-in/email', { email, password: 'otra-clave-99' })).status).toBe(401)
    expect(await usuario('token-inventado')).toBeNull()
    expect(await cuentas.usuario(new Headers())).toBeNull()
  })

  it('cierra la sesión y deja de aceptar su token', async () => {
    expect((await post('/sign-out', {}, token)).status).toBe(200)
    expect(await usuario(token)).toBeNull()
  })

  it('cambia la contraseña con el código de recuperación', async () => {
    expect((await post('/email-otp/request-password-reset', { email })).status).toBe(200)
    const reset = await post('/email-otp/reset-password', {
      email,
      otp: await ultimoCodigo('forget-password'),
      password: 'nueva-clave-5678'
    })
    expect(reset.status).toBe(200)
    expect((await post('/sign-in/email', { email, password: 'cocina-1234' })).status).toBe(401)
    expect((await post('/sign-in/email', { email, password: 'nueva-clave-5678' })).status).toBe(200)
  })
})

import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { crearCuentas, type Cuentas } from './cuentas'

// JWT como los de Supabase Auth, firmados con una clave de prueba (ES256).
const URL_SUPABASE = 'https://proyecto-prueba.supabase.co'
const EMISOR = `${URL_SUPABASE}/auth/v1`
let firmar: (
  datos?: Record<string, unknown>,
  opciones?: { exp?: string; iss?: string }
) => Promise<string>
let otraFirma: () => Promise<string>
let cuentas: Cuentas

const conToken = (token: string): Headers => new Headers({ authorization: `Bearer ${token}` })

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'clave-1', alg: 'ES256' }
  const jwks: JSONWebKeySet = { keys: [jwk] }
  firmar = (datos = {}, opciones = {}) =>
    new SignJWT({
      email: 'ana@example.com',
      role: 'authenticated',
      is_anonymous: false,
      user_metadata: { nombre: 'Ana' },
      ...datos
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'clave-1' })
      .setSubject('usuario-1')
      .setIssuer(opciones.iss ?? EMISOR)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(opciones.exp ?? '1h')
      .sign(privateKey)
  const ajena = await generateKeyPair('ES256')
  otraFirma = () =>
    new SignJWT({ email: 'x@example.com', role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'clave-1' })
      .setSubject('intruso')
      .setIssuer(EMISOR)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(ajena.privateKey)
  cuentas = crearCuentas({ supabaseUrl: URL_SUPABASE, jwks })
})

describe('JWT de Supabase en el backend', () => {
  it('acepta un JWT válido y devuelve el usuario', async () => {
    expect(await cuentas.usuario(conToken(await firmar()))).toEqual({
      id: 'usuario-1',
      nombre: 'Ana',
      email: 'ana@example.com'
    })
  })

  it('rechaza sin token, caducado, de otro emisor, firmado con otra clave o anónimo', async () => {
    expect(await cuentas.usuario(new Headers())).toBeNull()
    expect(await cuentas.usuario(conToken('no-es-un-jwt'))).toBeNull()
    expect(await cuentas.usuario(conToken(await firmar({}, { exp: '-1m' })))).toBeNull()
    expect(
      await cuentas.usuario(conToken(await firmar({}, { iss: 'https://otro.supabase.co/auth/v1' })))
    ).toBeNull()
    expect(await cuentas.usuario(conToken(await otraFirma()))).toBeNull()
    expect(await cuentas.usuario(conToken(await firmar({ is_anonymous: true })))).toBeNull()
    expect(await cuentas.usuario(conToken(await firmar({ role: 'anon' })))).toBeNull()
  })
})

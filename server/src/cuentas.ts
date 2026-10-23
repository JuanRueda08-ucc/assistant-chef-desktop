// Cuentas con Supabase Auth (decisión 0017). Supabase registra, envía los códigos y emite un JWT
// de acceso; el backend solo comprueba ese JWT en cada petición con las claves públicas del
// proyecto (JWKS), sin preguntar a Supabase ni guardar cuentas.

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey
} from 'jose'

export interface UsuarioVerificado {
  id: string
  nombre: string
  email: string
}

/** Lo que necesita app.ts: separado de Supabase para poder simularlo en los tests. */
export interface Cuentas {
  /** Usuario del JWT `Authorization: Bearer`, o `null` si falta, caducó o no es válido. */
  usuario(cabeceras: Headers): Promise<UsuarioVerificado | null>
}

export interface OpcionesCuentas {
  /** URL del proyecto: https://<ref>.supabase.co */
  supabaseUrl: string
  /** Claves públicas ya conocidas (en Edge Functions, SUPABASE_JWKS); si no, se descargan. */
  jwks?: JSONWebKeySet
}

export function crearCuentas(opciones: OpcionesCuentas): Cuentas {
  const emisor = `${opciones.supabaseUrl.replace(/\/$/, '')}/auth/v1`
  const claves: JWTVerifyGetKey = opciones.jwks?.keys.length
    ? createLocalJWKSet(opciones.jwks)
    : createRemoteJWKSet(new URL(`${emisor}/.well-known/jwks.json`))
  return {
    async usuario(cabeceras) {
      const token = /^Bearer (\S+)$/.exec(cabeceras.get('authorization') ?? '')?.[1]
      if (!token) return null
      try {
        // Firma, caducidad, emisor y audiencia; solo usuarios con sesión, no anónimos.
        const { payload } = await jwtVerify(token, claves, {
          issuer: emisor,
          audience: 'authenticated'
        })
        if (payload.role !== 'authenticated' || payload.is_anonymous === true) return null
        if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null
        const metadatos = (payload.user_metadata ?? {}) as Record<string, unknown>
        const nombre = typeof metadatos.nombre === 'string' ? metadatos.nombre : ''
        return { id: payload.sub, nombre, email: payload.email }
      } catch {
        return null
      }
    }
  }
}

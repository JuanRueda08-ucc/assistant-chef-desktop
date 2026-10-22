// Cuentas reales con Better Auth (decisión 0016). Correo y contraseña, verificación y
// recuperación con códigos de 6 cifras por correo (plugin emailOTP) y token de sesión en la
// cabecera Authorization (plugin bearer), porque la app de escritorio no usa cookies.
// Las cuentas viven en su propia SQLite del backend, separada del chef.sqlite de cada instalación.

import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { bearer, emailOTP } from 'better-auth/plugins'
import type Database from 'better-sqlite3'
import { CONTRASENA_MAX, CONTRASENA_MIN } from '@shared/esquemas/cuenta'
import { ORIGEN_APP } from '@shared/types/cuenta'
import type { Correo } from './correo'

/** Prefijo de las rutas de Better Auth en el backend: `POST /auth/sign-in/email`, etc. */
export const RUTA_CUENTAS = '/auth'
/** Una sesión dura 30 días y se renueva si se usa pasado un día. */
const SESION_SEG = 60 * 60 * 24 * 30
const RENOVAR_SEG = 60 * 60 * 24

export interface UsuarioVerificado {
  id: string
  nombre: string
  email: string
}

/** Lo que necesita app.ts: separado de Better Auth para poder simularlo en los tests. */
export interface Cuentas {
  /** Atiende `/auth/*`. */
  manejar(peticion: Request): Promise<Response>
  /** Usuario de la sesión del token Bearer, o `null` si falta, caducó o no es válido. */
  usuario(cabeceras: Headers): Promise<UsuarioVerificado | null>
}

export interface OpcionesCuentas {
  db: Database.Database
  /** BETTER_AUTH_SECRET: al menos 32 caracteres. */
  secreto: string
  /** URL pública del backend (BETTER_AUTH_URL). */
  url: string
  correo: Correo
}

function opciones(o: OpcionesCuentas): Parameters<typeof betterAuth>[0] {
  return {
    database: o.db,
    secret: o.secreto,
    baseURL: o.url,
    basePath: RUTA_CUENTAS,
    // La app de escritorio llama desde main con este origen fijo (ver ORIGEN_APP).
    trustedOrigins: [ORIGEN_APP],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: CONTRASENA_MIN,
      maxPasswordLength: CONTRASENA_MAX,
      revokeSessionsOnPasswordReset: true
    },
    emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true },
    session: { expiresIn: SESION_SEG, updateAge: RENOVAR_SEG },
    plugins: [
      bearer(),
      emailOTP({
        overrideDefaultEmailVerification: true,
        otpLength: 6,
        expiresIn: 10 * 60,
        // Sin await: el tiempo de respuesta no debe delatar si el correo existe.
        sendVerificationOTP: async ({ email, otp, type }) => {
          void o.correo
            .enviarCodigo(email, otp, type)
            .catch((error: unknown) => console.error('No se pudo enviar el código', error))
        }
      })
    ]
  }
}

/** Crea las tablas de Better Auth que falten. Idempotente; se llama al arrancar. */
export async function migrarCuentas(o: OpcionesCuentas): Promise<void> {
  const { runMigrations } = await getMigrations(opciones(o))
  await runMigrations()
}

export function crearCuentas(o: OpcionesCuentas): Cuentas {
  const auth = betterAuth(opciones(o))
  return {
    manejar: (peticion) => auth.handler(peticion),
    async usuario(cabeceras) {
      if (!cabeceras.get('authorization')?.startsWith('Bearer ')) return null
      const sesion = await auth.api.getSession({ headers: cabeceras })
      if (!sesion?.user.emailVerified) return null
      return { id: sesion.user.id, nombre: sesion.user.name, email: sesion.user.email }
    }
  }
}

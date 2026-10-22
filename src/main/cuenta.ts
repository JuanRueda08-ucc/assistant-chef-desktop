// Cuenta del usuario en el proceso principal (decisión 0016). Habla con las rutas `/auth/*` del
// backend (Better Auth), guarda el token de sesión cifrado y lo añade a las llamadas de IA. El
// renderer solo recibe `EstadoCuenta`: el token nunca cruza el puente IPC.

import { z } from 'zod'
import { esquemaUsuario } from '@shared/esquemas/cuenta'
import { ORIGEN_APP } from '@shared/types/cuenta'
import type {
  CodigoErrorCuenta,
  DatosCodigo,
  DatosEntrar,
  DatosRegistro,
  DatosRestablecer,
  EstadoCuenta,
  ResultadoCuenta,
  Usuario
} from '@shared/types/cuenta'

/** Dónde se guarda la sesión entre arranques; en index.ts, un archivo cifrado con safeStorage. */
export interface AlmacenSesion {
  leer(): SesionGuardada | null
  guardar(sesion: SesionGuardada | null): void
}
export interface SesionGuardada {
  token: string
  usuario: Usuario
}
export const esquemaSesionGuardada = z.strictObject({
  token: z.string().min(1),
  usuario: esquemaUsuario
})

const esquemaRespuestaSesion = z
  .object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      emailVerified: z.boolean()
    })
  })
  .nullable()

const MENSAJES: Record<CodigoErrorCuenta, string> = {
  datos_invalidos: 'Revisa los datos del formulario.',
  credenciales: 'El correo o la contraseña no coinciden.',
  correo_sin_verificar: 'Confirma tu correo con el código que te enviamos.',
  correo_en_uso: 'Ya hay una cuenta con ese correo. Entra o recupera tu contraseña.',
  codigo_invalido: 'El código no es correcto o ha caducado. Pide uno nuevo.',
  demasiados_intentos: 'Demasiados intentos. Espera un poco y vuelve a probar.',
  sin_conexion: 'No pude conectar con el servidor de cuentas. Comprueba tu conexión.',
  servicio: 'El servidor de cuentas no pudo responder. Inténtalo de nuevo.'
}
const POR_CODIGO_BETTER_AUTH: Record<string, CodigoErrorCuenta> = {
  INVALID_EMAIL_OR_PASSWORD: 'credenciales',
  USER_NOT_FOUND: 'credenciales',
  EMAIL_NOT_VERIFIED: 'correo_sin_verificar',
  USER_ALREADY_EXISTS: 'correo_en_uso',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'correo_en_uso',
  INVALID_OTP: 'codigo_invalido',
  OTP_EXPIRED: 'codigo_invalido',
  TOO_MANY_ATTEMPTS: 'demasiados_intentos',
  INVALID_EMAIL: 'datos_invalidos',
  PASSWORD_TOO_SHORT: 'datos_invalidos',
  PASSWORD_TOO_LONG: 'datos_invalidos'
}

export const fallo = (codigo: CodigoErrorCuenta, mensaje = MENSAJES[codigo]): ResultadoCuenta => ({
  ok: false,
  error: { codigo, mensaje }
})

export type Cuenta = ReturnType<typeof crearCuenta>

export function crearCuenta(opciones: {
  /** URL base del backend, ya validada por crearClienteBackend. */
  apiUrl: URL
  almacen: AlmacenSesion
  solicitar?: typeof fetch
}): {
  iniciar(): Promise<EstadoCuenta>
  estado(): EstadoCuenta
  token(): string | null
  registrar(datos: DatosRegistro): Promise<ResultadoCuenta>
  verificar(datos: DatosCodigo): Promise<ResultadoCuenta>
  reenviarCodigo(email: string): Promise<ResultadoCuenta>
  entrar(datos: DatosEntrar): Promise<ResultadoCuenta>
  salir(): Promise<ResultadoCuenta>
  recuperar(email: string): Promise<ResultadoCuenta>
  restablecer(datos: DatosRestablecer): Promise<ResultadoCuenta>
  /** El backend rechazó el token (401): se olvida la sesión. */
  caducada(): void
} {
  const solicitar = opciones.solicitar ?? fetch
  const base = opciones.apiUrl.pathname.replace(/\/$/, '')
  let sesion: SesionGuardada | null = null
  let sinConexion = false

  const estado = (): EstadoCuenta => ({ usuario: sesion?.usuario ?? null, sinConexion })
  const ok = (): ResultadoCuenta => ({ ok: true, estado: estado() })
  function guardar(nueva: SesionGuardada | null): void {
    sesion = nueva
    sinConexion = false
    opciones.almacen.guardar(nueva)
  }

  async function pedir(
    ruta: string,
    cuerpo: unknown,
    token: string | null = null
  ): Promise<Response | ResultadoCuenta> {
    try {
      return await solicitar(new URL(`${base}/auth${ruta}`, opciones.apiUrl.origin), {
        method: cuerpo === undefined ? 'GET' : 'POST',
        headers: {
          origin: ORIGEN_APP,
          ...(cuerpo !== undefined && { 'content-type': 'application/json' }),
          ...(token && { authorization: `Bearer ${token}` })
        },
        ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
        redirect: 'error',
        signal: AbortSignal.timeout(15_000)
      })
    } catch {
      return fallo('sin_conexion')
    }
  }
  async function error(respuesta: Response): Promise<ResultadoCuenta> {
    const cuerpo = z
      .object({ code: z.string() })
      .safeParse(await respuesta.json().catch(() => null))
    const codigo = cuerpo.success ? POR_CODIGO_BETTER_AUTH[cuerpo.data.code] : undefined
    if (codigo) return fallo(codigo)
    if (respuesta.status === 429) return fallo('demasiados_intentos')
    if (respuesta.status === 401) return fallo('credenciales')
    return fallo(respuesta.status < 500 ? 'datos_invalidos' : 'servicio')
  }
  /** Con el token recién recibido, pide el usuario y guarda la sesión. */
  async function abrirSesion(respuesta: Response): Promise<ResultadoCuenta> {
    const token = respuesta.headers.get('set-auth-token')
    if (!token) return fallo('servicio')
    const r = await pedir('/get-session', undefined, token)
    if (!(r instanceof Response)) return r
    const datos = esquemaRespuestaSesion.safeParse(await r.json().catch(() => null))
    if (!r.ok || !datos.success || !datos.data) return fallo('servicio')
    if (!datos.data.user.emailVerified) return fallo('correo_sin_verificar')
    const { id, name, email } = datos.data.user
    guardar({ token, usuario: { id, nombre: name, email } })
    return ok()
  }
  /** Para acciones sin sesión nueva (registro, reenviar, recuperar). */
  async function simple(ruta: string, cuerpo: unknown): Promise<ResultadoCuenta> {
    const r = await pedir(ruta, cuerpo)
    if (!(r instanceof Response)) return r
    return r.ok ? ok() : error(r)
  }

  return {
    async iniciar() {
      sesion = opciones.almacen.leer()
      if (!sesion) return estado()
      const r = await pedir('/get-session', undefined, sesion.token)
      if (!(r instanceof Response) || r.status >= 500) {
        // Sin red se conserva la sesión para cocinar con lo local; la IA dirá que no conecta.
        sinConexion = true
        return estado()
      }
      const datos = esquemaRespuestaSesion.safeParse(await r.json().catch(() => null))
      if (!r.ok || !datos.success || !datos.data?.user.emailVerified) guardar(null)
      else {
        const { id, name, email } = datos.data.user
        guardar({ token: sesion.token, usuario: { id, nombre: name, email } })
      }
      return estado()
    },
    estado,
    token: () => sesion?.token ?? null,
    registrar: (d) =>
      simple('/sign-up/email', { name: d.nombre, email: d.email, password: d.contrasena }),
    async verificar(d) {
      const r = await pedir('/email-otp/verify-email', { email: d.email, otp: d.codigo })
      if (!(r instanceof Response)) return r
      return r.ok ? abrirSesion(r) : error(r)
    },
    reenviarCodigo: (email) =>
      simple('/email-otp/send-verification-otp', { email, type: 'email-verification' }),
    async entrar(d) {
      const r = await pedir('/sign-in/email', { email: d.email, password: d.contrasena })
      if (!(r instanceof Response)) return r
      return r.ok ? abrirSesion(r) : error(r)
    },
    async salir() {
      const token = sesion?.token ?? null
      guardar(null)
      // Aunque falle la red, la sesión local queda cerrada; el token caducará en el servidor.
      if (token) await pedir('/sign-out', {}, token)
      return ok()
    },
    recuperar: (email) => simple('/email-otp/request-password-reset', { email }),
    restablecer: (d) =>
      simple('/email-otp/reset-password', {
        email: d.email,
        otp: d.codigo,
        password: d.contrasena
      }),
    caducada: () => guardar(null)
  }
}

// Cuenta del usuario en el proceso principal (decisión 0017). Habla con la API REST de Supabase
// Auth (/auth/v1), guarda cifrados el JWT de acceso y el refresh token, renueva el JWT antes de
// que caduque y lo añade a las llamadas al backend. El renderer solo recibe `EstadoCuenta`.

import { z } from 'zod'
import { esquemaUsuario } from '@shared/esquemas/cuenta'
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
  /** JWT de acceso (caduca en una hora, por defecto). */
  acceso: string
  /** Refresh token: de un solo uso; cada renovación devuelve uno nuevo. */
  renovacion: string
  /** Epoch ms en que caduca `acceso`. */
  caducaEn: number
  usuario: Usuario
}
export const esquemaSesionGuardada = z.strictObject({
  acceso: z.string().min(1),
  renovacion: z.string().min(1),
  caducaEn: z.number(),
  usuario: esquemaUsuario
})

/** Renueva el JWT cuando le queda menos de esto. */
const MARGEN_RENOVAR_MS = 60_000

const esquemaTokens = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive()
})
const esquemaUsuarioSupabase = z.object({
  id: z.string(),
  email: z.string(),
  email_confirmed_at: z.string().nullish(),
  user_metadata: z.object({ nombre: z.string().optional() }).passthrough().nullish()
})

const MENSAJES: Record<CodigoErrorCuenta, string> = {
  datos_invalidos: 'Revisa los datos del formulario.',
  credenciales: 'El correo o la contraseña no coinciden.',
  correo_sin_verificar: 'Confirma tu correo con el código que te enviamos.',
  correo_en_uso: 'Ya hay una cuenta con ese correo. Entra o recupera tu contraseña.',
  codigo_invalido: 'El código no es correcto o ha caducado. Pide uno nuevo.',
  demasiados_intentos: 'Demasiados intentos o correos seguidos. Espera un poco y vuelve a probar.',
  sin_conexion: 'No pude conectar con el servidor de cuentas. Comprueba tu conexión.',
  servicio: 'El servidor de cuentas no pudo responder. Inténtalo de nuevo.'
}
/** `error_code` de Supabase Auth → código de la app. */
const POR_CODIGO_SUPABASE: Record<string, CodigoErrorCuenta> = {
  invalid_credentials: 'credenciales',
  email_not_confirmed: 'correo_sin_verificar',
  user_already_exists: 'correo_en_uso',
  email_exists: 'correo_en_uso',
  otp_expired: 'codigo_invalido',
  otp_disabled: 'servicio',
  over_email_send_rate_limit: 'demasiados_intentos',
  over_request_rate_limit: 'demasiados_intentos',
  weak_password: 'datos_invalidos',
  validation_failed: 'datos_invalidos',
  email_address_invalid: 'datos_invalidos',
  same_password: 'datos_invalidos',
  refresh_token_not_found: 'credenciales',
  refresh_token_already_used: 'credenciales',
  session_not_found: 'credenciales'
}

export const fallo = (codigo: CodigoErrorCuenta, mensaje = MENSAJES[codigo]): ResultadoCuenta => ({
  ok: false,
  error: { codigo, mensaje }
})

export type Cuenta = ReturnType<typeof crearCuenta>

export function crearCuenta(opciones: {
  /** URL del proyecto de Supabase (https://<ref>.supabase.co). */
  supabaseUrl: URL
  /** Clave publicable del proyecto (sb_publishable_…): pública por diseño. */
  clavePublica: string
  almacen: AlmacenSesion
  solicitar?: typeof fetch
  ahora?: () => number
}): {
  iniciar(): Promise<EstadoCuenta>
  estado(): EstadoCuenta
  /** JWT vigente para el backend; lo renueva si está a punto de caducar. */
  token(): Promise<string | null>
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
  const ahora = opciones.ahora ?? Date.now
  const base = `${opciones.supabaseUrl.origin}/auth/v1`
  let sesion: SesionGuardada | null = null
  let sinConexion = false
  let renovando: Promise<string | null> | null = null

  const estado = (): EstadoCuenta => ({ usuario: sesion?.usuario ?? null, sinConexion })
  const ok = (): ResultadoCuenta => ({ ok: true, estado: estado() })
  function guardar(nueva: SesionGuardada | null): void {
    sesion = nueva
    sinConexion = false
    opciones.almacen.guardar(nueva)
  }

  async function pedir(
    ruta: string,
    opcionesPeticion: { metodo?: 'GET' | 'POST' | 'PUT'; cuerpo?: unknown; token?: string } = {}
  ): Promise<Response | ResultadoCuenta> {
    const { metodo = 'POST', cuerpo, token } = opcionesPeticion
    try {
      return await solicitar(`${base}${ruta}`, {
        method: metodo,
        headers: {
          apikey: opciones.clavePublica,
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
      .object({ error_code: z.string().optional(), error: z.string().optional() })
      .safeParse(await respuesta.json().catch(() => null))
    const clave = cuerpo.success ? (cuerpo.data.error_code ?? cuerpo.data.error) : undefined
    const codigo = clave ? POR_CODIGO_SUPABASE[clave] : undefined
    if (codigo) return fallo(codigo)
    if (respuesta.status === 429) return fallo('demasiados_intentos')
    if (respuesta.status === 401 || respuesta.status === 403) return fallo('codigo_invalido')
    return fallo(respuesta.status < 500 ? 'datos_invalidos' : 'servicio')
  }
  /** Con los tokens recién recibidos, pide el usuario y guarda la sesión. */
  async function abrirSesion(respuesta: Response): Promise<ResultadoCuenta> {
    const tokens = esquemaTokens.safeParse(await respuesta.json().catch(() => null))
    if (!tokens.success) return fallo('servicio')
    const r = await pedir('/user', { metodo: 'GET', token: tokens.data.access_token })
    if (!(r instanceof Response)) return r
    const usuario = esquemaUsuarioSupabase.safeParse(await r.json().catch(() => null))
    if (!r.ok || !usuario.success) return fallo('servicio')
    if (!usuario.data.email_confirmed_at) return fallo('correo_sin_verificar')
    guardar({
      acceso: tokens.data.access_token,
      renovacion: tokens.data.refresh_token,
      caducaEn: ahora() + tokens.data.expires_in * 1000,
      usuario: {
        id: usuario.data.id,
        nombre: usuario.data.user_metadata?.nombre ?? '',
        email: usuario.data.email
      }
    })
    return ok()
  }
  /** Para acciones sin sesión nueva (registro, reenviar, recuperar). */
  async function simple(ruta: string, cuerpo: unknown): Promise<ResultadoCuenta> {
    const r = await pedir(ruta, { cuerpo })
    if (!(r instanceof Response)) return r
    return r.ok ? ok() : error(r)
  }
  /** Cambia el refresh token por un JWT nuevo. Una sola renovación a la vez. */
  function renovar(): Promise<string | null> {
    renovando ??= (async () => {
      const actual = sesion
      if (!actual) return null
      const r = await pedir('/token?grant_type=refresh_token', {
        cuerpo: { refresh_token: actual.renovacion }
      })
      if (!(r instanceof Response) || r.status >= 500) {
        // Sin red se conserva la sesión para cocinar con lo local; la IA dirá que no conecta.
        sinConexion = true
        return actual.acceso
      }
      if (!r.ok) {
        guardar(null)
        return null
      }
      const tokens = esquemaTokens.safeParse(await r.json().catch(() => null))
      if (!tokens.success) return actual.acceso
      guardar({
        ...actual,
        acceso: tokens.data.access_token,
        renovacion: tokens.data.refresh_token,
        caducaEn: ahora() + tokens.data.expires_in * 1000
      })
      return tokens.data.access_token
    })().finally(() => {
      renovando = null
    })
    return renovando
  }

  return {
    async iniciar() {
      sesion = opciones.almacen.leer()
      // Renovar al arrancar comprueba también que la sesión no se cerró en otro sitio.
      if (sesion) await renovar()
      return estado()
    },
    estado,
    async token() {
      if (!sesion) return null
      if (sesion.caducaEn - ahora() > MARGEN_RENOVAR_MS) return sesion.acceso
      return renovar()
    },
    registrar: (d) =>
      simple('/signup', { email: d.email, password: d.contrasena, data: { nombre: d.nombre } }),
    async verificar(d) {
      const r = await pedir('/verify', {
        cuerpo: { type: 'email', email: d.email, token: d.codigo }
      })
      if (!(r instanceof Response)) return r
      return r.ok ? abrirSesion(r) : error(r)
    },
    reenviarCodigo: (email) => simple('/resend', { type: 'signup', email }),
    async entrar(d) {
      const r = await pedir('/token?grant_type=password', {
        cuerpo: { email: d.email, password: d.contrasena }
      })
      if (!(r instanceof Response)) return r
      return r.ok ? abrirSesion(r) : error(r)
    },
    async salir() {
      const acceso = sesion?.acceso ?? null
      guardar(null)
      // Anula los refresh tokens; el JWT emitido caduca solo (como mucho, una hora).
      if (acceso) await pedir('/logout?scope=local', { token: acceso })
      return ok()
    },
    recuperar: (email) => simple('/recover', { email }),
    async restablecer(d) {
      // El código de recuperación abre una sesión temporal con la que se cambia la contraseña;
      // después se cierra para que la persona entre con la nueva.
      const r = await pedir('/verify', {
        cuerpo: { type: 'recovery', email: d.email, token: d.codigo }
      })
      if (!(r instanceof Response)) return r
      if (!r.ok) return error(r)
      const tokens = esquemaTokens.safeParse(await r.json().catch(() => null))
      if (!tokens.success) return fallo('servicio')
      const cambio = await pedir('/user', {
        metodo: 'PUT',
        cuerpo: { password: d.contrasena },
        token: tokens.data.access_token
      })
      if (!(cambio instanceof Response)) return cambio
      if (!cambio.ok) return error(cambio)
      await pedir('/logout?scope=local', { token: tokens.data.access_token })
      return ok()
    },
    caducada: () => guardar(null)
  }
}

// Cuentas reales (decisión 0016). El renderer solo ve el usuario y el resultado de cada acción;
// el token de sesión vive en main y nunca cruza el puente IPC.

/**
 * Origen que main envía a `/auth/*` y que el backend admite (`trustedOrigins`). El fetch de Node
 * añade `sec-fetch-mode` y Better Auth exige entonces un Origin de confianza (protección CSRF).
 */
export const ORIGEN_APP = 'chef-digital://app'

export interface Usuario {
  id: string
  nombre: string
  email: string
}

export interface EstadoCuenta {
  /** `null` si no hay sesión: la app muestra Acceso. */
  usuario: Usuario | null
  /** Hay sesión guardada pero no se pudo comprobar con el backend (sin red). */
  sinConexion: boolean
}

export const CODIGOS_ERROR_CUENTA = [
  'datos_invalidos',
  'credenciales',
  'correo_sin_verificar',
  'correo_en_uso',
  'codigo_invalido',
  'demasiados_intentos',
  'sin_conexion',
  'servicio'
] as const
export type CodigoErrorCuenta = (typeof CODIGOS_ERROR_CUENTA)[number]

export type ResultadoCuenta =
  | { ok: true; estado: EstadoCuenta }
  | { ok: false; error: { codigo: CodigoErrorCuenta; mensaje: string } }

export interface DatosRegistro {
  nombre: string
  email: string
  contrasena: string
}
export interface DatosEntrar {
  email: string
  contrasena: string
}
export interface DatosCodigo {
  email: string
  codigo: string
}
export interface DatosRestablecer {
  email: string
  codigo: string
  contrasena: string
}

import { z } from 'zod'

/** Mensajes públicos: nunca se muestra el cuerpo de error ni la clave del proveedor. */
export const ERRORES_PROVEEDOR = {
  proveedor_timeout:
    'El chef tardó demasiado en responder. Puedes seguir con los botones e intentarlo más tarde.',
  proveedor_sin_conexion:
    'El servicio no pudo conectar con la IA. Puedes seguir con los botones e intentarlo más tarde.',
  proveedor_saturado:
    'La IA está temporalmente ocupada. Puedes seguir con los botones e intentarlo más tarde.',
  proveedor_sin_cuota:
    'El proveedor de IA alcanzó su límite de uso. Puedes seguir con los botones.',
  proveedor_no_autorizado:
    'El servicio de IA rechazó su configuración de acceso. Revisa la configuración del backend.'
} as const

export type CodigoErrorProveedor = keyof typeof ERRORES_PROVEEDOR
export const esquemaCodigoErrorProveedor = z.enum(
  Object.keys(ERRORES_PROVEEDOR) as CodigoErrorProveedor[]
)

import type { ProveedorIA } from '../proveedor'
import { ProveedorFalso } from './falso'
import { ProveedorGemini } from './gemini'

/**
 * Elige el proveedor según `PROVEEDOR_IA`. Sin configuración usa falso (sin red).
 */
export function crearProveedor(entorno: Record<string, string | undefined>): ProveedorIA {
  const nombre = entorno.PROVEEDOR_IA?.trim() || 'falso'
  switch (nombre) {
    case 'falso':
      return new ProveedorFalso()
    case 'gemini':
      return new ProveedorGemini(entorno.PROVEEDOR_IA_API_KEY ?? '')
    default:
      throw new Error(
        `El proveedor de IA "${nombre}" no está implementado. Usa PROVEEDOR_IA=falso o añade un adaptador en server/src/proveedores/.`
      )
  }
}

import type { ProveedorIA } from '../proveedor'
import { ProveedorFalso } from './falso'

/**
 * Elige el proveedor según `PROVEEDOR_IA`. Todavía no hay proveedor real elegido (ver
 * docs/estado.md): para añadir uno, crea un adaptador en esta carpeta que implemente
 * `ProveedorIA`, lea su clave de `PROVEEDOR_IA_API_KEY` y regístralo aquí.
 */
export function crearProveedor(entorno: Record<string, string | undefined>): ProveedorIA {
  const nombre = entorno.PROVEEDOR_IA?.trim() || 'falso'
  switch (nombre) {
    case 'falso':
      return new ProveedorFalso()
    default:
      throw new Error(
        `El proveedor de IA "${nombre}" no está implementado. Usa PROVEEDOR_IA=falso o añade un adaptador en server/src/proveedores/.`
      )
  }
}

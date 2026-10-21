import { ERRORES_PROVEEDOR, type CodigoErrorProveedor } from '@shared/ia/errores'

/** Error saneado que el backend puede transportar sin datos privados del proveedor. */
export class ErrorProveedor extends Error {
  constructor(readonly codigo: CodigoErrorProveedor) {
    super(ERRORES_PROVEEDOR[codigo])
  }
}

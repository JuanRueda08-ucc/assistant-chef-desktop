import { describe, expect, it } from 'vitest'
import { esquemaCodigoErrorProveedor } from './errores'

describe('códigos públicos del proveedor', () => {
  it('acepta causas conocidas y rechaza mensajes arbitrarios del servidor', () => {
    expect(esquemaCodigoErrorProveedor.safeParse('proveedor_timeout').success).toBe(true)
    expect(esquemaCodigoErrorProveedor.safeParse('clave_privada').success).toBe(false)
    expect(esquemaCodigoErrorProveedor.safeParse('El servicio falló: secreto').success).toBe(false)
  })
})

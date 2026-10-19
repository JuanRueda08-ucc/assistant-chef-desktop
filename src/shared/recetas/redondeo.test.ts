import { describe, expect, it } from 'vitest'
import { limpiar, redondear } from './redondeo'

describe('redondear', () => {
  it('redondea al múltiplo más cercano del paso', () => {
    expect(redondear(1234, 50)).toBe(1250)
    expect(redondear(1224, 50)).toBe(1200)
    expect(redondear(4.5, 1)).toBe(5)
    expect(redondear(1.3, 0.5)).toBe(1.5)
  })

  it('nunca devuelve menos que el paso', () => {
    expect(redondear(0.2, 1)).toBe(1)
    expect(redondear(3, 50)).toBe(50)
  })

  it('quita el ruido de coma flotante', () => {
    expect(redondear(0.1 + 0.2, 0.1)).toBe(0.3)
    expect(limpiar(3.0000000000000004)).toBe(3)
  })

  it('rechaza pasos y cantidades no positivos', () => {
    expect(() => redondear(10, 0)).toThrow(RangeError)
    expect(() => redondear(0, 1)).toThrow(RangeError)
    expect(() => redondear(Number.NaN, 1)).toThrow(RangeError)
  })
})

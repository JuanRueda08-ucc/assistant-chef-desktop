import { describe, expect, it } from 'vitest'
import { saludoDelChef } from './saludos'

describe('saludoDelChef', () => {
  it('saluda según la hora la mitad de las veces', () => {
    expect(saludoDelChef(8, 0.1)).toBe('¡Buenos días!')
    expect(saludoDelChef(15, 0.2)).toBe('¡Buenas tardes!')
    expect(saludoDelChef(21, 0.3)).toBe('¡Buenas noches!')
  })

  it('usa el nombre en el saludo por la hora', () => {
    expect(saludoDelChef(8, 0.1, 'Ana')).toBe('¡Buenos días, Ana!')
  })

  it('el resto de las veces elige otro mensaje y no siempre el mismo', () => {
    const mensajes = new Set([0.5, 0.6, 0.7, 0.8, 0.9].map((a) => saludoDelChef(10, a)))
    expect(mensajes.size).toBeGreaterThan(2)
    for (const m of mensajes) expect(m).not.toMatch(/Buenos|Buenas/)
  })
})

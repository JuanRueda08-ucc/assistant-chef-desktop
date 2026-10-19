import { describe, expect, it } from 'vitest'
import { aUnidadCasera, formatearMedida } from './unidades'
import { catalogo, ingrediente } from './fixtures.test-utils'

const del = (id: string): (typeof catalogo)[number] => {
  const i = catalogo.find((c) => c.id === id)
  if (!i) throw new Error(id)
  return i
}
const sinDatos = ingrediente({ id: 'harina' })

describe('aUnidadCasera', () => {
  it('pasa ml a cucharaditas, cucharadas, tazas y litros', () => {
    expect(aUnidadCasera(1, 'ml', sinDatos)).toEqual({ cantidad: 0.25, unidad: 'cucharadita' })
    expect(aUnidadCasera(10, 'ml', sinDatos)).toEqual({ cantidad: 2, unidad: 'cucharadita' })
    expect(aUnidadCasera(30, 'ml', del('aceite_oliva'))).toEqual({
      cantidad: 2,
      unidad: 'cucharada'
    })
    expect(aUnidadCasera(45, 'ml', sinDatos)).toEqual({ cantidad: 3, unidad: 'cucharada' })
    expect(aUnidadCasera(120, 'ml', sinDatos)).toEqual({ cantidad: 0.5, unidad: 'taza' })
    expect(aUnidadCasera(750, 'ml', del('caldo_pollo'))).toEqual({ cantidad: 3.25, unidad: 'taza' })
    expect(aUnidadCasera(1500, 'ml', sinDatos)).toEqual({ cantidad: 1.5, unidad: 'l' })
  })

  it('pasa gramos a volumen con la densidad', () => {
    // 300 g / 0,85 = 353 ml = 1,47 tazas → 1 ½
    expect(aUnidadCasera(300, 'g', del('arroz_blanco'))).toEqual({ cantidad: 1.5, unidad: 'taza' })
    // 8 g / 1,2 = 6,7 ml = 1,33 cucharaditas → 1 ¼
    expect(aUnidadCasera(8, 'g', del('sal'))).toEqual({ cantidad: 1.25, unidad: 'cucharadita' })
  })

  it('pasa gramos a piezas con el peso por unidad', () => {
    expect(aUnidadCasera(800, 'g', del('pollo_muslo'))).toEqual({ cantidad: 4, unidad: 'unidad' })
    // 200 g / 120 g = 1,67 tomates → 1 ½
    expect(aUnidadCasera(200, 'g', del('tomate'))).toEqual({ cantidad: 1.5, unidad: 'unidad' })
  })

  it('si salen menos de media pieza, usa volumen o gramos', () => {
    expect(aUnidadCasera(2, 'g', del('ajo'))).toEqual({ cantidad: 2, unidad: 'g' })
  })

  it('sin densidad ni peso deja gramos, y kg desde 1000 g', () => {
    expect(aUnidadCasera(250, 'g', sinDatos)).toEqual({ cantidad: 250, unidad: 'g' })
    expect(aUnidadCasera(1200, 'g', sinDatos)).toEqual({ cantidad: 1.2, unidad: 'kg' })
  })

  it('deja unidad, pizca y al_gusto tal cual', () => {
    expect(aUnidadCasera(3, 'unidad', del('ajo'))).toEqual({ cantidad: 3, unidad: 'unidad' })
    expect(aUnidadCasera(1, 'pizca', del('sal'))).toEqual({ cantidad: 1, unidad: 'pizca' })
    expect(aUnidadCasera(null, 'al_gusto', del('pimienta_negra'))).toEqual({
      cantidad: null,
      unidad: 'al_gusto'
    })
  })

  it('rechaza cantidades vacías o no positivas fuera de al_gusto', () => {
    expect(() => aUnidadCasera(null, 'g', sinDatos)).toThrow(RangeError)
    expect(() => aUnidadCasera(0, 'ml', sinDatos)).toThrow(RangeError)
  })
})

describe('formatearMedida', () => {
  it.each([
    [{ cantidad: 1.5, unidad: 'taza' }, '1 ½ tazas'],
    [{ cantidad: 1, unidad: 'taza' }, '1 taza'],
    [{ cantidad: 0.25, unidad: 'cucharadita' }, '¼ cucharadita'],
    [{ cantidad: 1.25, unidad: 'cucharadita' }, '1 ¼ cucharaditas'],
    [{ cantidad: 2, unidad: 'cucharada' }, '2 cucharadas'],
    [{ cantidad: 0.75, unidad: 'taza' }, '¾ taza'],
    [{ cantidad: 1.3, unidad: 'taza' }, '1,3 tazas'],
    [{ cantidad: 3, unidad: 'pizca' }, '3 pizcas'],
    [{ cantidad: 800, unidad: 'g' }, '800 g'],
    [{ cantidad: 1.2, unidad: 'kg' }, '1,2 kg'],
    [{ cantidad: 1.5, unidad: 'l' }, '1,5 l'],
    [{ cantidad: 2, unidad: 'unidad' }, '2'],
    [{ cantidad: 1.5, unidad: 'unidad' }, '1 ½'],
    [{ cantidad: null, unidad: 'al_gusto' }, 'al gusto']
  ] as const)('%o → %s', (medida, texto) => {
    expect(formatearMedida(medida)).toBe(texto)
  })
})

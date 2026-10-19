import { describe, expect, it } from 'vitest'
import { cantidadesDelPaso, escalarReceta } from './escalado'
import { arrozConPollo, ingredienteDe, recetaCon } from './fixtures.test-utils'

const cantidad = (receta: ReturnType<typeof arrozConPollo>, id: string): number | null =>
  ingredienteDe(receta, id).cantidad

describe('escalarReceta', () => {
  it('escala lineal multiplicando por el factor y redondeando', () => {
    // 4 → 6 porciones: factor 1,5.
    const { receta, factor } = escalarReceta(arrozConPollo(), 6)
    expect(factor).toBe(1.5)
    expect(cantidad(receta, 'pollo_muslo')).toBe(1200) // 800 × 1,5
    expect(cantidad(receta, 'arroz_blanco')).toBe(450) // 300 × 1,5
    expect(cantidad(receta, 'cebolla')).toBe(230) // 225 → múltiplo de 10
    expect(cantidad(receta, 'ajo')).toBe(5) // 4,5 dientes → 5
  })

  it('escala suave con factor^0,75', () => {
    // 1,5^0,75 = 1,3554
    const { receta } = escalarReceta(arrozConPollo(), 6)
    expect(cantidad(receta, 'sal')).toBe(11) // 8 × 1,3554 = 10,84
    expect(cantidad(receta, 'aceite_oliva')).toBe(40) // 30 × 1,3554 = 40,66 → múltiplo de 5
    expect(cantidad(receta, 'pimenton')).toBe(7) // 5 × 1,3554 = 6,78
  })

  it('el escalado suave no sube del doble del original', () => {
    // 4 → 20: factor 5; 5^0,75 = 3,34 → se acota a 2.
    const { receta } = escalarReceta(arrozConPollo(), 20)
    expect(cantidad(receta, 'sal')).toBe(16)
    expect(cantidad(receta, 'aceite_oliva')).toBe(60)
    expect(cantidad(receta, 'pollo_muslo')).toBe(4000) // lineal no se acota
  })

  it('el escalado suave no baja de la mitad del original', () => {
    // 4 → 1: factor 0,25; 0,25^0,75 = 0,354 → se acota a 0,5.
    const { receta } = escalarReceta(arrozConPollo(), 1)
    expect(cantidad(receta, 'sal')).toBe(4)
    expect(cantidad(receta, 'aceite_oliva')).toBe(15)
    expect(cantidad(receta, 'pollo_muslo')).toBe(200)
  })

  it('fijo no escala', () => {
    for (const porciones of [1, 6, 20]) {
      expect(cantidad(escalarReceta(arrozConPollo(), porciones).receta, 'laurel')).toBe(1)
    }
  })

  it('al_gusto sigue sin cantidad', () => {
    expect(cantidad(escalarReceta(arrozConPollo(), 10).receta, 'pimienta_negra')).toBeNull()
  })

  it('pizca no escala', () => {
    const receta = recetaCon([
      { ingredienteId: 'sal', cantidad: 1, unidad: 'pizca', redondeo: 1 },
      { ingredienteId: 'arroz_blanco', cantidad: 100, unidad: 'g', redondeo: 10 }
    ])
    const escalada = escalarReceta(receta, 8).receta // factor 4
    expect(escalada.ingredientes[0]?.cantidad).toBe(1)
    expect(escalada.ingredientes[1]?.cantidad).toBe(400)
  })

  it('redondea sin llegar nunca a cero', () => {
    // 4 → 1: 3 dientes × 0,25 = 0,75 → 1; 100 g × 0,25 = 25 → 30.
    const { receta } = escalarReceta(arrozConPollo(), 1)
    expect(cantidad(receta, 'ajo')).toBe(1)
    expect(cantidad(receta, 'guisantes')).toBe(30)
  })

  it('con el mismo número de porciones deja las cantidades tal cual', () => {
    const original = arrozConPollo()
    const { receta, factor, aviso } = escalarReceta(original, 4)
    expect(factor).toBe(1)
    expect(aviso).toBeNull()
    expect(receta).toEqual(original)
  })

  it('no escala tiempos ni pasos y actualiza porcionesBase', () => {
    const original = arrozConPollo()
    const { receta } = escalarReceta(original, 10)
    expect(receta.porcionesBase).toBe(10)
    expect(receta.tiempoTotalMin).toBe(original.tiempoTotalMin)
    expect(receta.tiempoActivoMin).toBe(original.tiempoActivoMin)
    expect(receta.pasos).toEqual(original.pasos)
  })

  it('no modifica la receta recibida', () => {
    const original = arrozConPollo()
    const copia = structuredClone(original)
    escalarReceta(original, 12)
    expect(original).toEqual(copia)
  })

  it('avisa con factores mayores que 2 o menores que 0,5', () => {
    expect(escalarReceta(arrozConPollo(), 9).aviso?.tipo).toBe('factor_alto') // 2,25
    expect(escalarReceta(arrozConPollo(), 8).aviso).toBeNull() // 2
    expect(escalarReceta(arrozConPollo(), 2).aviso).toBeNull() // 0,5
    expect(escalarReceta(arrozConPollo(), 1).aviso?.tipo).toBe('factor_bajo') // 0,25
    expect(escalarReceta(arrozConPollo(), 9).aviso?.mensaje).toMatch(/olla más grande/)
  })

  it('rechaza porciones fuera de 1–20 o no enteras', () => {
    for (const porciones of [0, 21, 2.5, Number.NaN]) {
      expect(() => escalarReceta(arrozConPollo(), porciones)).toThrow(RangeError)
    }
  })
})

describe('cantidadesDelPaso', () => {
  it('deriva las cantidades del paso de la fracción', () => {
    const receta = arrozConPollo()
    const paso = receta.pasos[1]! // salpimienta: pollo 1, sal 0,5, pimienta al gusto
    expect(cantidadesDelPaso(receta, paso)).toEqual([
      { ingredienteRecetaId: 'ir_1', ingredienteId: 'pollo_muslo', cantidad: 800, unidad: 'g' },
      { ingredienteRecetaId: 'ir_10', ingredienteId: 'sal', cantidad: 4, unidad: 'g' },
      {
        ingredienteRecetaId: 'ir_11',
        ingredienteId: 'pimienta_negra',
        cantidad: null,
        unidad: 'al_gusto'
      }
    ])
  })

  it('usa las cantidades ya escaladas', () => {
    const { receta } = escalarReceta(arrozConPollo(), 8) // factor 2; sal suave: 8 × 2^0,75 = 13,45 → 13
    const paso = receta.pasos[1]!
    const [pollo, sal] = cantidadesDelPaso(receta, paso)
    expect(pollo?.cantidad).toBe(1600)
    expect(sal?.cantidad).toBe(7) // 13 × 0,5 = 6,5 → 7
  })

  it('un paso sin ingredientes devuelve una lista vacía', () => {
    const receta = arrozConPollo()
    expect(cantidadesDelPaso(receta, receta.pasos[8]!)).toEqual([])
  })

  it('falla si el paso usa un ingrediente que la receta no tiene', () => {
    const receta = arrozConPollo()
    const paso = {
      ...receta.pasos[0]!,
      ingredientes: [{ ingredienteRecetaId: 'ir_99', fraccion: 1 }]
    }
    expect(() => cantidadesDelPaso(receta, paso)).toThrow(/ir_99/)
  })
})

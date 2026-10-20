import { describe, expect, it } from 'vitest'
import { arrozConPollo, catalogo, ingredienteDe } from './fixtures.test-utils'
import { hayIngredientesSeleccionados, recuentoDisponibilidad } from './disponibilidad'

describe('selección explícita y básicos de despensa', () => {
  it('una selección vacía, desconocida o solo de básicos no inicia una búsqueda', () => {
    for (const ids of [[], ['desconocido'], ['sal', 'aceite_oliva', 'pimienta_negra']])
      expect(hayIngredientesSeleccionados(ids, catalogo)).toBe(false)
    expect(hayIngredientesSeleccionados(['sal', 'arroz_blanco'], catalogo)).toBe(true)
  })

  it('distingue los dos ingredientes marcados de los tres básicos del arroz', () => {
    const r = recuentoDisponibilidad(arrozConPollo(), ['pollo_muslo', 'arroz_blanco'], catalogo)
    expect(r.seleccionados).toBe(2)
    expect(r.basicos).toEqual(expect.arrayContaining(['aceite de oliva', 'sal', 'pimienta negra']))
    expect(r.basicos).toHaveLength(3)
  })

  it('no presenta los básicos como una selección del usuario ni los cuenta dos veces', () => {
    const receta = arrozConPollo()
    expect(recuentoDisponibilidad(receta, [], catalogo).seleccionados).toBe(0)
    const r = recuentoDisponibilidad(receta, ['arroz_blanco', 'arroz_blanco', 'sal'], catalogo)
    expect(r.seleccionados).toBe(1)
    expect(r.basicos).toHaveLength(3)
  })

  it('ignora opcionales, ingredientes ajenos y apariciones repetidas del mismo ingrediente', () => {
    const receta = arrozConPollo()
    receta.ingredientes.push({ ...ingredienteDe(receta, 'arroz_blanco'), id: 'arroz_repetido' })
    const r = recuentoDisponibilidad(receta, ['guisantes', 'arroz_blanco', 'no_existe'], catalogo)
    expect(r.seleccionados).toBe(1)
    const soloArroz = { ingredientes: [ingredienteDe(receta, 'arroz_blanco')] }
    expect(recuentoDisponibilidad(soloArroz, ['arroz_blanco'], catalogo)).toEqual({
      seleccionados: 1,
      basicos: []
    })
  })
})

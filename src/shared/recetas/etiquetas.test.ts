import { describe, expect, it } from 'vitest'
import { derivarEtiquetas, dietasIncompatiblesDe, indexar } from './etiquetas'
import { arrozConPollo, catalogo, ingrediente, recetaCon } from './fixtures.test-utils'

const extra = [
  ingrediente({ id: 'leche', alergenos: ['lacteos'] }),
  ingrediente({ id: 'huevo', alergenos: ['huevo'] }),
  ingrediente({ id: 'merluza', alergenos: ['pescado'] }),
  ingrediente({ id: 'harina_trigo', alergenos: ['gluten'] }),
  ingrediente({ id: 'tofu', alergenos: ['soja'] })
]
const conExtra = [...catalogo, ...extra]

const usando = (...ids: string[]): ReturnType<typeof recetaCon> =>
  recetaCon(
    ids.map((ingredienteId) => ({ ingredienteId, cantidad: 100, unidad: 'g', redondeo: 10 }))
  )

describe('derivarEtiquetas', () => {
  it('etiqueta el arroz con pollo', () => {
    expect(derivarEtiquetas(arrozConPollo(), catalogo)).toEqual({
      dietas: ['sin_gluten', 'sin_lactosa'],
      alergenos: ['apio']
    })
  })

  it('una receta solo de verduras es compatible con todas las dietas', () => {
    expect(derivarEtiquetas(usando('cebolla', 'tomate', 'aceite_oliva'), catalogo)).toEqual({
      dietas: ['vegetariana', 'vegana', 'sin_gluten', 'sin_lactosa'],
      alergenos: []
    })
  })

  it('los lácteos quitan sin_lactosa y vegana', () => {
    expect(derivarEtiquetas(usando('tomate', 'leche'), conExtra)).toEqual({
      dietas: ['vegetariana', 'sin_gluten'],
      alergenos: ['lacteos']
    })
  })

  it('el huevo quita vegana pero no vegetariana', () => {
    expect(derivarEtiquetas(usando('huevo'), conExtra).dietas).toEqual([
      'vegetariana',
      'sin_gluten',
      'sin_lactosa'
    ])
  })

  it('el pescado quita vegetariana y vegana', () => {
    expect(derivarEtiquetas(usando('merluza'), conExtra).dietas).toEqual([
      'sin_gluten',
      'sin_lactosa'
    ])
  })

  it('el gluten quita sin_gluten', () => {
    expect(derivarEtiquetas(usando('harina_trigo'), conExtra)).toEqual({
      dietas: ['vegetariana', 'vegana', 'sin_lactosa'],
      alergenos: ['gluten']
    })
  })

  it('une los alérgenos en el orden canónico', () => {
    expect(derivarEtiquetas(usando('tofu', 'harina_trigo', 'leche'), conExtra).alergenos).toEqual([
      'gluten',
      'soja',
      'lacteos'
    ])
  })

  it('los ingredientes opcionales también cuentan', () => {
    const receta = recetaCon([
      { ingredienteId: 'tomate', cantidad: 100, unidad: 'g', redondeo: 10 },
      { ingredienteId: 'leche', cantidad: 50, unidad: 'ml', redondeo: 10, opcional: true }
    ])
    expect(derivarEtiquetas(receta, conExtra).alergenos).toEqual(['lacteos'])
  })

  it('acepta el catálogo como Map', () => {
    expect(derivarEtiquetas(arrozConPollo(), indexar(catalogo)).alergenos).toEqual(['apio'])
  })

  it('falla si un ingrediente no está en el catálogo', () => {
    expect(() => derivarEtiquetas(usando('unicornio'), catalogo)).toThrow(/unicornio/)
  })
})

describe('dietasIncompatiblesDe', () => {
  it('lo que no es vegetariano tampoco es vegano', () => {
    const pollo = catalogo.find((i) => i.id === 'pollo_muslo')!
    expect([...dietasIncompatiblesDe(pollo)].sort()).toEqual(['vegana', 'vegetariana'])
    const jamon = ingrediente({ id: 'jamon', dietasIncompatibles: ['vegetariana'] })
    expect(dietasIncompatiblesDe(jamon).has('vegana')).toBe(true)
  })
})

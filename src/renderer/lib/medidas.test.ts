import { describe, expect, it } from 'vitest'
import { describirIngrediente } from './medidas'

const cebolla = { nombre: 'Cebolla', densidadGMl: null, pesoUnidadG: 150 }
const aceite = { nombre: 'Aceite de oliva', densidadGMl: 0.92, pesoUnidadG: null }
const pollo = { nombre: 'Muslo de pollo', densidadGMl: null, pesoUnidadG: 200 }

describe('describirIngrediente', () => {
  it('piezas con el peso exacto y la preparación', () => {
    expect(
      describirIngrediente({
        cantidad: 150,
        unidad: 'g',
        ingrediente: cebolla,
        idIngrediente: 'cebolla',
        preparacion: 'picada fina'
      })
    ).toEqual({ nombre: 'Cebolla', detalle: '1 unidad (150 g), picada fina' })
    expect(
      describirIngrediente({ cantidad: 800, unidad: 'g', ingrediente: pollo, idIngrediente: 'p' })
        .detalle
    ).toBe('4 unidades (800 g)')
  })

  it('volumen casero con el exacto', () => {
    expect(
      describirIngrediente({ cantidad: 30, unidad: 'ml', ingrediente: aceite, idIngrediente: 'a' })
        .detalle
    ).toBe('2 cucharadas (30 ml)')
  })

  it('unidades y al gusto', () => {
    expect(
      describirIngrediente({
        cantidad: 3,
        unidad: 'unidad',
        ingrediente: { nombre: 'Ajo', densidadGMl: null, pesoUnidadG: 5 },
        idIngrediente: 'ajo',
        preparacion: 'picado'
      })
    ).toEqual({ nombre: 'Ajo', detalle: '3 unidades, picado' })
    expect(
      describirIngrediente({
        cantidad: null,
        unidad: 'al_gusto',
        ingrediente: { nombre: 'Pimienta negra', densidadGMl: 0.5, pesoUnidadG: null },
        idIngrediente: 'pimienta'
      })
    ).toEqual({ nombre: 'Pimienta negra', detalle: 'al gusto' })
  })

  it('usa el id si el ingrediente no está en el catálogo', () => {
    expect(
      describirIngrediente({
        cantidad: 250,
        unidad: 'g',
        ingrediente: undefined,
        idIngrediente: 'x'
      })
    ).toEqual({ nombre: 'x', detalle: '250 g' })
  })
})

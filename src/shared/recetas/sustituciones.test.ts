import { describe, expect, it } from 'vitest'
import { esquemaSustitucion } from '../esquemas/receta'
import { escalarReceta } from './escalado'
import { aplicarSustitucion } from './sustituciones'
import { arrozConPollo, catalogo, ingrediente, ingredienteDe } from './fixtures.test-utils'

const conExtra = [
  ...catalogo,
  ingrediente({ id: 'caldo_verduras', categoria: 'despensa' }),
  ingrediente({ id: 'tofu_firme', categoria: 'proteinas', alergenos: ['soja'] }),
  ingrediente({ id: 'mantequilla', categoria: 'lacteos', alergenos: ['lacteos'] }),
  ingrediente({ id: 'pimienta_blanca', categoria: 'especias' })
]

const sustitucion = (datos: Record<string, unknown>): ReturnType<typeof esquemaSustitucion.parse> =>
  esquemaSustitucion.parse({
    id: 's',
    impacto: 'Cambia el sabor.',
    fuente: 'revisada',
    ratio: 1,
    ...datos
  })

describe('aplicarSustitucion', () => {
  it('cambia el ingrediente, aplica el ratio y redondea', () => {
    const receta = aplicarSustitucion(
      arrozConPollo(),
      sustitucion({
        ingredienteOrigenId: 'pollo_muslo',
        ingredienteDestinoId: 'tofu_firme',
        ratio: 0.75
      }),
      conExtra
    )
    const ir = ingredienteDe(receta, 'tofu_firme')
    expect(ir.id).toBe('ir_1') // los pasos siguen apuntando al mismo ingrediente de receta
    expect(ir.cantidad).toBe(600) // 800 × 0,75
    expect(ir.unidad).toBe('g')
    expect(receta.ingredientes.some((i) => i.ingredienteId === 'pollo_muslo')).toBe(false)
  })

  it('redondea con el redondeo del ingrediente', () => {
    const receta = aplicarSustitucion(
      arrozConPollo(),
      sustitucion({
        ingredienteOrigenId: 'aceite_oliva',
        ingredienteDestinoId: 'mantequilla',
        ratio: 0.8
      }),
      conExtra
    )
    expect(ingredienteDe(receta, 'mantequilla').cantidad).toBe(25) // 30 × 0,8 = 24 → múltiplo de 5
  })

  it('recalcula dietas y alérgenos', () => {
    let receta = aplicarSustitucion(
      arrozConPollo(),
      sustitucion({ ingredienteOrigenId: 'caldo_pollo', ingredienteDestinoId: 'caldo_verduras' }),
      conExtra
    )
    receta = aplicarSustitucion(
      receta,
      sustitucion({
        ingredienteOrigenId: 'pollo_muslo',
        ingredienteDestinoId: 'tofu_firme',
        ratio: 0.75
      }),
      conExtra
    )
    expect(receta.dietas).toEqual(['vegetariana', 'vegana', 'sin_gluten', 'sin_lactosa'])
    expect(receta.alergenos).toEqual(['soja'])
  })

  it('al_gusto sigue sin cantidad', () => {
    const receta = aplicarSustitucion(
      arrozConPollo(),
      sustitucion({
        ingredienteOrigenId: 'pimienta_negra',
        ingredienteDestinoId: 'pimienta_blanca',
        ratio: 0.5
      }),
      conExtra
    )
    expect(ingredienteDe(receta, 'pimienta_blanca').cantidad).toBeNull()
  })

  it('no modifica la receta recibida', () => {
    const original = arrozConPollo()
    const copia = structuredClone(original)
    aplicarSustitucion(
      original,
      sustitucion({ ingredienteOrigenId: 'pollo_muslo', ingredienteDestinoId: 'tofu_firme' }),
      conExtra
    )
    expect(original).toEqual(copia)
  })

  it('se puede escalar después de sustituir', () => {
    const sustituida = aplicarSustitucion(
      arrozConPollo(),
      sustitucion({
        ingredienteOrigenId: 'pollo_muslo',
        ingredienteDestinoId: 'tofu_firme',
        ratio: 0.75
      }),
      conExtra
    )
    expect(ingredienteDe(escalarReceta(sustituida, 8).receta, 'tofu_firme').cantidad).toBe(1200)
  })

  it('rechaza una sustitución de otra receta', () => {
    expect(() =>
      aplicarSustitucion(
        arrozConPollo(),
        sustitucion({
          ingredienteOrigenId: 'pollo_muslo',
          ingredienteDestinoId: 'tofu_firme',
          recetaId: 'lentejas'
        }),
        conExtra
      )
    ).toThrow(/receta lentejas/)
  })

  it('rechaza un ingrediente de origen que la receta no usa', () => {
    expect(() =>
      aplicarSustitucion(
        arrozConPollo(),
        sustitucion({ ingredienteOrigenId: 'mantequilla', ingredienteDestinoId: 'aceite_oliva' }),
        conExtra
      )
    ).toThrow(/no usa mantequilla/)
  })

  it('rechaza un destino fuera del catálogo', () => {
    expect(() =>
      aplicarSustitucion(
        arrozConPollo(),
        sustitucion({ ingredienteOrigenId: 'pollo_muslo', ingredienteDestinoId: 'seitan' }),
        conExtra
      )
    ).toThrow(/seitan/)
  })
})

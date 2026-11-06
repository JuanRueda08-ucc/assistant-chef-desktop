import { describe, expect, it } from 'vitest'
import { preferencias } from '../cocina/fixtures.test-utils'
import { buscarRecetas, destinoPermitido } from './busqueda'
import { derivarEtiquetas, ingredientesSinVerificar } from './etiquetas'
import { ingrediente, recetaCon } from './fixtures.test-utils'
import type { Receta } from '../types/receta'

// Regla de 0019: la IA no decide alérgenos; lo no revisado no garantiza nada.
const arroz = ingrediente({ id: 'arroz', nombre: 'Arroz' })
const tofu = ingrediente({ id: 'tofu', nombre: 'Tofu', alergenosVerificados: false })
const catalogo = [arroz, tofu]
const ir = (id: string, ingredienteId: string, opcional = false): Record<string, unknown> => ({
  id,
  ingredienteId,
  cantidad: 100,
  unidad: 'g',
  redondeo: 10,
  opcional
})
const conEtiquetas = (receta: Receta): Receta => ({
  ...receta,
  ...derivarEtiquetas(receta, catalogo),
  estadoRevision: 'revisada'
})
const verificada = conEtiquetas(recetaCon([ir('ir_1', 'arroz')], { id: 'solo_arroz' }))
const conTofu = conEtiquetas(
  recetaCon([ir('ir_1', 'arroz'), ir('ir_2', 'tofu')], { id: 'con_tofu' })
)

describe('alérgenos sin verificar', () => {
  it('un ingrediente verificado permite declarar dietas; uno sin verificar, ninguna', () => {
    expect(verificada.dietas).toContain('vegana')
    expect(conTofu.dietas).toEqual([])
  })

  it('cuenta también si es opcional, y no inventa alérgenos', () => {
    const opcional = recetaCon([ir('ir_1', 'arroz'), ir('ir_2', 'tofu', true)])
    expect(derivarEtiquetas(opcional, catalogo)).toEqual({ dietas: [], alergenos: [] })
    expect(ingredientesSinVerificar(opcional, catalogo)).toEqual(['Tofu'])
    expect(ingredientesSinVerificar(verificada, catalogo)).toEqual([])
  })

  it('una restricción de dieta descarta la receta; sin restricción, se avisa', () => {
    const buscar = (campos: Parameters<typeof preferencias>[0]): ReturnType<typeof buscarRecetas> =>
      buscarRecetas(preferencias({ ingredientes: ['arroz'], ...campos }), [conTofu], catalogo, [])
    expect(buscar({ restricciones: ['sin_gluten'] }).descartadas).toEqual([
      { recetaId: 'con_tofu', motivos: ['restriccion'] }
    ])
    expect(buscar({}).resultados[0]?.ingredientesSinVerificar).toEqual(['Tofu'])
    // Con alergias sigue visible, pero la interfaz recibe el aviso.
    expect(buscar({ alergias: ['soja'] }).resultados[0]?.ingredientesSinVerificar).toEqual(['Tofu'])
  })

  it('no se propone como sustituto a quien tiene alergias o restricciones', () => {
    expect(destinoPermitido(tofu, { restricciones: [], alergias: ['soja'] })).toBe(false)
    expect(destinoPermitido(tofu, { restricciones: ['vegana'], alergias: [] })).toBe(false)
    expect(destinoPermitido(tofu, { restricciones: [], alergias: [] })).toBe(true)
    expect(destinoPermitido(arroz, { restricciones: ['vegana'], alergias: ['soja'] })).toBe(true)
  })
})

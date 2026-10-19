import { describe, expect, it } from 'vitest'
import { agruparPorCategoria, buscarIngredientes, normalizarTexto } from './catalogo'
import { catalogo, ingrediente } from './fixtures.test-utils'

const ids = (lista: { id: string }[]): string[] => lista.map((i) => i.id)

describe('normalizarTexto', () => {
  it('quita tildes, mayúsculas y espacios sobrantes', () => {
    expect(normalizarTexto('  Pimentón   Dulce ')).toBe('pimenton dulce')
    expect(normalizarTexto('CHÍCHAROS')).toBe('chicharos')
    expect(normalizarTexto('Pingüino')).toBe('pinguino')
  })
})

describe('buscarIngredientes', () => {
  it('sin consulta devuelve todos por nombre', () => {
    const todos = buscarIngredientes(catalogo, '  ')
    expect(todos).toHaveLength(catalogo.length)
    expect(todos[0]?.nombre).toBe('Aceite de oliva')
  })

  it('encuentra por nombre sin distinguir tildes ni mayúsculas', () => {
    expect(ids(buscarIngredientes(catalogo, 'PIMENTON'))).toEqual(['pimenton', 'pimiento_rojo'])
  })

  it('encuentra por sinónimo', () => {
    expect(ids(buscarIngredientes(catalogo, 'arvejas'))).toEqual(['guisantes'])
    expect(ids(buscarIngredientes(catalogo, 'paprika'))).toEqual(['pimenton'])
  })

  it('pone primero lo que empieza por la consulta', () => {
    const lista = [
      ingrediente({ id: 'caldo_pollo', nombre: 'Caldo de pollo' }),
      ingrediente({ id: 'pollo', nombre: 'Pollo' })
    ]
    expect(ids(buscarIngredientes(lista, 'pollo'))).toEqual(['caldo_pollo', 'pollo'])
    expect(ids(buscarIngredientes(lista, 'pol'))).toEqual(['caldo_pollo', 'pollo'])
    expect(ids(buscarIngredientes(lista, 'ollo'))).toEqual(['caldo_pollo', 'pollo'])
    const otra = [
      ingrediente({ id: 'b', nombre: 'Lima' }),
      ingrediente({ id: 'a', nombre: 'Alioli' })
    ]
    expect(ids(buscarIngredientes(otra, 'li'))).toEqual(['b', 'a'])
  })

  it('devuelve una lista vacía si nada coincide', () => {
    expect(buscarIngredientes(catalogo, 'unicornio')).toEqual([])
  })
})

describe('agruparPorCategoria', () => {
  it('agrupa en el orden de las categorías y ordena por nombre', () => {
    const grupos = agruparPorCategoria(catalogo)
    expect([...grupos.keys()]).toEqual([
      'verduras',
      'frutas',
      'proteinas',
      'lacteos',
      'cereales',
      'legumbres',
      'especias',
      'despensa'
    ])
    expect(ids(grupos.get('verduras') ?? [])).toEqual(['ajo', 'cebolla', 'pimiento_rojo', 'tomate'])
    expect(grupos.get('frutas')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { catalogo, ingrediente } from './fixtures.test-utils'
import {
  anadirSinIdentificar,
  explicarPendientes,
  identificarIngrediente,
  MAX_SIN_IDENTIFICAR,
  quitarSinIdentificar,
  resolverIngredientes,
  separarIngredientes
} from './lista'

const ampliado = [
  ...catalogo,
  ingrediente({ id: 'pimiento_verde', nombre: 'Pimiento verde', sinonimos: [] })
]

describe('lista libre de ingredientes', () => {
  it('separa por comas, punto y coma, saltos de línea, «y» y «e» sin repetir', () => {
    expect(separarIngredientes('pollo, arroz y cebolla; ajo\ntomate e hinojo')).toEqual([
      'pollo',
      'arroz',
      'cebolla',
      'ajo',
      'tomate',
      'hinojo'
    ])
    expect(separarIngredientes(' Pollo ,  pollo , , POLLO ')).toEqual(['Pollo'])
    expect(separarIngredientes('yuca')).toEqual(['yuca'])
    expect(separarIngredientes('   ')).toEqual([])
  })

  it('identifica por nombre, sinónimo o id, y nunca elige entre varios candidatos', () => {
    expect(identificarIngrediente(catalogo, 'MORRÓN')).toMatchObject({
      tipo: 'catalogo',
      ingrediente: { id: 'pimiento_rojo' }
    })
    expect(identificarIngrediente(catalogo, 'caldo_pollo')).toMatchObject({ tipo: 'catalogo' })
    const pimiento = identificarIngrediente(ampliado, 'pimiento')
    expect(pimiento.tipo).toBe('ambiguo')
    if (pimiento.tipo === 'ambiguo')
      expect(pimiento.candidatos.map((c) => c.id)).toEqual(['pimiento_rojo', 'pimiento_verde'])
    expect(identificarIngrediente(catalogo, 'tofu')).toEqual({ tipo: 'desconocido' })
  })

  it('resuelve una lista separando reconocidos, básicos, ambiguos y desconocidos', () => {
    const r = resolverIngredientes(ampliado, ['pollo', 'contramuslo', 'sal', 'pimiento', 'tofu'])
    expect(r.ids).toEqual(['pollo_muslo'])
    expect(r.basicos.map((b) => b.id)).toEqual(['sal'])
    expect(r.ambiguos.map((a) => a.texto)).toEqual(['pimiento'])
    expect(r.desconocidos).toEqual(['tofu'])
    expect(explicarPendientes(r)).toBe(
      '«pimiento» puede ser pimiento rojo o pimiento verde: dime cuál. «tofu» no está en el catálogo: queda en tu lista sin identificar. Sal ya lo damos por hecho.'
    )
    expect(explicarPendientes(resolverIngredientes(catalogo, ['ajo']))).toBe('')
  })

  it('guarda los sin identificar sin repetidos, hasta el máximo, y los quita sin tildes', () => {
    expect(anadirSinIdentificar(['Tofu'], ['tofu', ' Ñame ', 'ñame'])).toEqual(['Tofu', 'Ñame'])
    const llena = Array.from({ length: MAX_SIN_IDENTIFICAR }, (_, i) => `cosa ${i}`)
    expect(anadirSinIdentificar(llena, ['otra'])).toHaveLength(MAX_SIN_IDENTIFICAR)
    expect(quitarSinIdentificar(['Tofu', 'Ñame'], ['ÑAME'])).toEqual(['Tofu'])
  })
})

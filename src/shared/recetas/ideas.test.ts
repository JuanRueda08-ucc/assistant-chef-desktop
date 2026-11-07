import { describe, expect, it } from 'vitest'
import { preferencias } from '../cocina/fixtures.test-utils'
import type { IdeaModelo } from '../types/ideas'
import { catalogo } from './fixtures.test-utils'
import { evaluarIdeas } from './ideas'
import type { Preferencias } from '../types/sesion'

const idea = (ingredientes: string[], campos: Partial<IdeaModelo> = {}): IdeaModelo => ({
  titulo: 'Idea',
  descripcion: 'Una idea.',
  ingredientes,
  tiempoTotalMin: 20,
  dificultad: 'facil',
  ...campos
})
const evaluar = (
  ideas: IdeaModelo[],
  prefs: Partial<Preferencias> = {},
  excluir: string[] = []
): ReturnType<typeof evaluarIdeas> =>
  evaluarIdeas(ideas, {
    catalogo,
    preferencias: preferencias({ ingredientes: ['tomate', 'cebolla'], ...prefs }),
    excluir
  })

describe('comprobación de las ideas de la IA', () => {
  it('calcula lo que tienes, lo que falta y lo que no se puede verificar', () => {
    const [r] = evaluar([idea(['Tomate', 'sal', 'huevos', 'yuca'])])
    expect(r?.tienes).toEqual(['Tomate', 'Sal'])
    expect(r?.faltan).toEqual(['Huevo', 'yuca'])
    expect(r?.sinVerificar).toEqual(['yuca'])
    expect(r?.id).toBe('idea_idea')
  })

  it('un ingrediente libre de la despensa cuenta como tuyo, pero sigue sin verificar', () => {
    const [r] = evaluar([idea(['tofu', 'arroz'])], {
      ingredientes: [],
      ingredientesSinIdentificar: ['Tofu']
    })
    expect(r?.tienes).toEqual(['tofu'])
    expect(r?.sinVerificar).toEqual(['tofu'])
    expect(r?.faltan).toEqual(['Arroz blanco'])
  })

  it('descarta las que no usan nada de la despensa', () => {
    expect(evaluar([idea(['sal', 'huevos', 'papa'])])).toEqual([])
  })

  it.each([
    ['catálogo', ['tomate', 'huevos'], { alergias: ['huevo'] }],
    ['fuera del catálogo', ['tomate', 'salsa de maní'], { alergias: ['cacahuete'] }],
    ['con plural y tilde', ['tomate', 'Camarones'], { alergias: ['crustaceos'] }],
    ['lácteo fuera del catálogo', ['tomate', 'crema de leche'], { alergias: ['lacteos'] }],
    ['carne para vegetarianos', ['tomate', 'tocino'], { restricciones: ['vegetariana'] }],
    ['del catálogo para veganos', ['tomate', 'huevos'], { restricciones: ['vegana'] }],
    ['gluten fuera del catálogo', ['tomate', 'pan rallado'], { restricciones: ['sin_gluten'] }]
  ] as [string, string[], Partial<Preferencias>][])(
    'descarta si choca con alergias o dieta: %s',
    (_caso, ingredientes, prefs) => {
      expect(evaluar([idea(ingredientes)], prefs)).toEqual([])
    }
  )

  it('descarta también por lo que nombra el título', () => {
    expect(
      evaluar([idea(['tomate'], { titulo: 'Tomate con queso' })], { alergias: ['lacteos'] })
    ).toEqual([])
  })

  it('sin chocar con nada conocido, se mantiene con el aviso de sin verificar', () => {
    const [r] = evaluar([idea(['tomate', 'yuca'])], {
      alergias: ['soja'],
      restricciones: ['vegana']
    })
    expect(r?.sinVerificar).toEqual(['yuca'])
  })

  it('no se confunde con palabras que solo contienen otra', () => {
    expect(evaluar([idea(['tomate', 'panela'])], { restricciones: ['sin_gluten'] })).toHaveLength(1)
    expect(evaluar([idea(['tomate', 'resina'])], { restricciones: ['vegana'] })).toHaveLength(1)
  })

  it('respeta tiempo y nivel, y no repite títulos ni los ya vistos', () => {
    expect(evaluar([idea(['tomate'], { tiempoTotalMin: 90 })], { tiempoMaxMin: 30 })).toEqual([])
    expect(evaluar([idea(['tomate'], { dificultad: 'avanzada' })], { nivel: 'media' })).toEqual([])
    expect(evaluar([idea(['tomate'], { titulo: 'Sopa' })], {}, ['SOPA'])).toEqual([])
    const dos = [idea(['tomate'], { titulo: 'Sopa' }), idea(['cebolla'], { titulo: 'sopa' })]
    expect(evaluar(dos)).toHaveLength(1)
  })
})

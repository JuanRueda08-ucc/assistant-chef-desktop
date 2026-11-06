import { describe, expect, it } from 'vitest'
import { mencionaSalud, notaPreferencias } from './nota-preferencias'

const vacio = { alergias: [], restricciones: [] }

describe('red de seguridad de alergias en el chat', () => {
  it.each([
    'soy alérgico al maní',
    'Soy muy alérgica a las nueces',
    'soy celíaco',
    '¿el tofu tiene gluten? soy celíaca',
    'somos veganos',
    'soy vegetariano y no como lácteos',
    'tengo alergia al huevo',
    'tenemos intolerancia a la lactosa',
    'no puedo comer gluten',
    'mi hijo tiene alergia a la soja'
  ])('detecta «%s»', (texto) => {
    expect(mencionaSalud(texto)).toBe(true)
  })

  it.each([
    '¿esto es vegano?',
    'tengo tofu, ¿es vegano?',
    'tengo pollo y arroz',
    'quiero una receta vegetariana',
    '¿el tofu tiene gluten?',
    'busca recetas'
  ])('no salta con «%s»', (texto) => {
    expect(mencionaSalud(texto)).toBe(false)
  })

  it('sin hablar de su salud no añade nada', () => {
    expect(notaPreferencias('busca recetas', vacio, vacio)).toBeNull()
  })

  it('avisa si no se guardó nada, diga lo que diga el modelo', () => {
    expect(notaPreferencias('soy celíaco', vacio, vacio)).toContain('no se ha guardado')
  })

  it('muestra lo guardado de verdad, para que se note lo que faltó', () => {
    const nota = notaPreferencias('soy vegetariano y no como lácteos', vacio, {
      alergias: [],
      restricciones: ['vegetariana']
    })
    expect(nota).toContain('dieta: vegetariana')
    expect(nota).toContain('sin alergias')
    expect(
      notaPreferencias('soy alérgico al maní', vacio, {
        alergias: ['cacahuete'],
        restricciones: []
      })
    ).toContain('alergias: cacahuete')
  })
})

import { describe, expect, it } from 'vitest'
import { arrozConPollo, catalogo } from '@shared/recetas/fixtures.test-utils'
import { ingredientesConEstado, textoDescarte } from './disponibilidad-receta'

const despensa = { ingredientes: ['pollo_muslo', 'arroz_blanco'], ingredientesSinIdentificar: [] }

describe('ingredientesConEstado', () => {
  it('marca lo que tienes, los básicos, lo que falta y lo opcional', () => {
    const lista = ingredientesConEstado(arrozConPollo(), [], catalogo, despensa)
    const estado = (nombre: string): string | undefined =>
      lista.find((i) => i.nombre === nombre)?.estado
    expect(estado('Muslo de pollo')).toBe('tienes')
    expect(estado('Sal')).toBe('basico')
    expect(estado('Cebolla')).toBe('falta')
    expect(estado('Guisantes')).toBe('opcional')
    expect(lista[0]?.detalle).toBeTruthy()
  })

  it('los faltantes de la búsqueda mandan y traen sus sustituciones', () => {
    const sustitucion = {
      sustitucionId: 's',
      ingredienteDestinoId: 'caldo_verduras',
      nombreDestino: 'Caldo de verduras',
      ratio: 1,
      impacto: 'Sabor más suave.',
      especifica: false
    }
    const lista = ingredientesConEstado(
      arrozConPollo(),
      [{ ingredienteId: 'sal', nombre: 'Sal', sustituciones: [sustitucion] }],
      catalogo,
      despensa
    )
    const sal = lista.find((i) => i.nombre === 'Sal')
    expect(sal?.estado).toBe('falta')
    expect(sal?.sustituciones).toEqual([sustitucion])
  })
})

describe('textoDescarte', () => {
  it('explica alergias y dieta con nombres, y los demás motivos', () => {
    expect(
      textoDescarte(
        ['alergia', 'restriccion', 'tiempo'],
        { alergenos: ['apio', 'huevo'], dietas: ['sin_gluten'] },
        { alergias: ['huevo'], restricciones: ['vegetariana', 'sin_gluten'] }
      )
    ).toBe(
      'Contiene huevo, y lo marcaste como alergia. No encaja con tu dieta: vegetariana. Tarda más que tu tiempo máximo.'
    )
  })
})

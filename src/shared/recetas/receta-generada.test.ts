import { describe, expect, it } from 'vitest'
import { preferencias } from '../cocina/fixtures.test-utils'
import { esquemaIngrediente } from '../esquemas/receta'
import { indexar } from './etiquetas'
import { arrozConPollo, catalogo } from './fixtures.test-utils'
import {
  estadoIngredienteGenerado,
  idIngredienteNuevo,
  resumenRecetaGenerada,
  ingredientesConLibres,
  problemasRecetaGenerada
} from './receta-generada'
import type { Preferencias } from '../types/sesion'
import type { RecetaGenerada } from '../types/receta'

const yuca = esquemaIngrediente.parse({
  id: 'nuevo_yuca',
  nombre: 'Yuca',
  categoria: 'verduras',
  alergenosVerificados: false
})
const generada = (): RecetaGenerada => ({ receta: arrozConPollo(), ingredientesNuevos: [] })
const problemas = (prefs: Partial<Preferencias> = {}, g = generada()): string[] =>
  problemasRecetaGenerada(g, preferencias(prefs), catalogo)

describe('comprobación de la receta generada', () => {
  it('acepta una receta correcta', () => {
    expect(problemas()).toEqual([])
  })

  it('rechaza lo que choca con alergias o dieta, también si solo lo nombra un paso', () => {
    expect(problemas({ alergias: ['apio'] }).join()).toMatch(/choca/)
    expect(problemas({ restricciones: ['vegetariana'] }).join()).toMatch(/pollo.*choca/)
    const g = generada()
    g.receta.pasos[0]!.texto = 'Añade la mantequilla a la olla.'
    expect(problemas({ alergias: ['lacteos'] }, g)).toContain(
      'el paso 1 nombra algo que choca con las alergias o la dieta'
    )
  })

  it('exige aviso de seguridad en un paso que use proteína animal', () => {
    const g = generada()
    g.receta.pasos.forEach((p) => (p.seguridad = null))
    expect(problemas({}, g).join()).toMatch(/seguridad.*pollo/i)
  })

  it('reconoce la proteína animal de un ingrediente nuevo por su nombre', () => {
    const g = generada()
    g.receta.pasos.forEach((p) => (p.seguridad = null))
    g.receta.ingredientes = [{ ...g.receta.ingredientes[0]!, ingredienteId: 'nuevo_tilapia' }]
    g.receta.pasos.forEach((p) => (p.ingredientes = []))
    g.ingredientesNuevos = [
      esquemaIngrediente.parse({
        id: 'nuevo_tilapia',
        nombre: 'Tilapia',
        categoria: 'proteinas',
        alergenosVerificados: false
      })
    ]
    expect(problemas({}, g).join()).toMatch(/seguridad.*Tilapia/)
  })

  it('rechaza un temporizador más largo que la receta', () => {
    const g = generada()
    g.receta.pasos[2]!.temporizador = {
      etiqueta: 'Largo',
      segundos: g.receta.tiempoTotalMin * 60 + 1
    }
    expect(problemas({}, g).join()).toMatch(/temporizador/)
  })

  it('respeta tiempo, nivel y equipo', () => {
    const { tiempoTotalMin } = generada().receta
    expect(problemas({ tiempoMaxMin: tiempoTotalMin - 1 }).join()).toMatch(/tarda/)
    const g = generada()
    g.receta.dificultad = 'avanzada'
    expect(problemas({ nivel: 'facil' }, g).join()).toMatch(/dificultad/)
    expect(problemas({ equipo: ['microondas'] }).join()).toMatch(/equipo/)
  })

  it('rechaza un ingrediente que no existe', () => {
    const g = generada()
    g.receta.ingredientes[0]!.ingredienteId = 'unicornio'
    expect(problemas({}, g).join()).toMatch(/unicornio/)
  })
})

describe('resumen de la receta generada', () => {
  const despensa = { ingredientes: [], ingredientesSinIdentificar: [] }

  it('no afirma que no tenga alérgenos, ni con la lista vacía', () => {
    const g = generada()
    g.receta.alergenos = []
    const texto = resumenRecetaGenerada(g, despensa, catalogo)
    expect(texto).toMatch(/Revisa las etiquetas/)
    expect(texto).not.toMatch(/no contiene|sin alérgenos/i)
  })

  it('dice lo que contiene, lo que no se puede verificar y lo que falta', () => {
    const g = generada()
    g.receta.alergenos = ['huevo']
    g.receta.ingredientes = [{ ...g.receta.ingredientes[0]!, ingredienteId: 'nuevo_yuca' }]
    g.ingredientesNuevos = [yuca]
    const texto = resumenRecetaGenerada(g, despensa, catalogo)
    expect(texto).toMatch(/Contiene huevo/)
    expect(texto).toMatch(/verificar los alérgenos de Yuca/)
    expect(texto).toMatch(/Te falta: yuca/)
    expect(
      resumenRecetaGenerada(g, { ...despensa, ingredientesSinIdentificar: ['yuca'] }, catalogo)
    ).toMatch(/Tienes todos/)
  })
})

describe('ingredientes de la receta generada', () => {
  it('crea ids válidos para los nuevos', () => {
    expect(idIngredienteNuevo('Leche de coco')).toBe('nuevo_leche_de_coco')
    expect(idIngredienteNuevo('!!!')).toBe('nuevo_ingrediente')
  })

  it('reconoce lo escrito a mano como el id de una receta guardada', () => {
    expect(
      ingredientesConLibres({ ingredientes: ['cebolla'], ingredientesSinIdentificar: ['Yuca'] })
    ).toEqual(['cebolla', 'nuevo_yuca'])
  })

  it('calcula si lo tienes, también con ingredientes libres de la despensa', () => {
    const porId = indexar([...catalogo, yuca])
    const estado = (ingredienteId: string, opcional = false): string =>
      estadoIngredienteGenerado({ ingredienteId, opcional }, porId.get(ingredienteId), {
        ingredientes: ['cebolla'],
        ingredientesSinIdentificar: ['yuca']
      })
    expect(estado('cebolla')).toBe('tienes')
    expect(estado('nuevo_yuca')).toBe('tienes')
    expect(estado('sal')).toBe('basico')
    expect(estado('tomate')).toBe('falta')
    expect(estado('tomate', true)).toBe('opcional')
  })
})

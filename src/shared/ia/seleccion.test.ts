import { describe, expect, it } from 'vitest'
import { preferencias } from '../cocina/fixtures.test-utils'
import { catalogo, ingrediente, arrozConPollo } from '../recetas/fixtures.test-utils'
import { resumirReceta } from '../recetas/resumen'
import { aplicarSeleccion, type EstadoSeleccion } from './seleccion'
import type { ResultadoBusqueda } from '../types/busqueda'

function estado(): EstadoSeleccion {
  return {
    pantalla: 'preparar',
    preferencias: preferencias({ alergias: ['lacteos'], restricciones: ['sin_gluten'] }),
    busqueda: null,
    recetaVisibleId: null
  }
}
const busqueda: ResultadoBusqueda = {
  resultados: [
    {
      receta: resumirReceta(arrozConPollo()),
      ingredientesObligatorios: 1,
      cobertura: 1,
      coberturaConSustituciones: 1,
      puntuacion: 1,
      faltantes: [],
      opcionalesFaltantes: []
    }
  ],
  descartadas: [],
  ofrecerGenerada: false
}

describe('herramientas puras de selección', () => {
  it('el chat pide ingredientes antes de buscar y conserva la pantalla sin selección', () => {
    for (const ingredientes of [[], ['sal']]) {
      const antes = { ...estado(), preferencias: preferencias({ ingredientes }) }
      const r = aplicarSeleccion(antes, 'buscar_recetas', {}, catalogo, busqueda)
      expect(r.ok).toBe(false)
      expect(r.estado).toBe(antes)
      expect(r.decir).toContain('Selecciona al menos un ingrediente')
      expect(r.iniciarRecetaId).toBeNull()
    }
  })
  it('resuelve sinónimos, añade sin duplicados y conserva alergias sin mutar', () => {
    const antes = estado()
    const copia = structuredClone(antes)
    const r = aplicarSeleccion(
      antes,
      'marcar_ingredientes',
      { ingredientes: ['MORRÓN', 'pimiento rojo'], accion: 'anadir' },
      catalogo
    )
    expect(r.ok).toBe(true)
    expect(r.estado.preferencias.ingredientes.filter((i) => i === 'pimiento_rojo')).toHaveLength(1)
    expect(r.estado.preferencias.alergias).toEqual(['lacteos'])
    expect(antes).toEqual(copia)
  })
  it('añade lo reconocido, guarda lo desconocido y pregunta por lo ambiguo', () => {
    const antes = { ...estado(), preferencias: preferencias({ ingredientes: [] }) }
    const ampliado = [
      ...catalogo,
      ingrediente({ id: 'arroz_integral', nombre: 'Arroz integral', sinonimos: ['arroz'] })
    ]
    const r = aplicarSeleccion(
      antes,
      'marcar_ingredientes',
      { ingredientes: ['cebolla, tofu', 'arroz'], accion: 'anadir' },
      ampliado
    )
    expect(r.ok).toBe(true)
    expect(r.estado.preferencias.ingredientes).toEqual(['cebolla'])
    expect(r.estado.preferencias.ingredientesSinIdentificar).toEqual(['tofu'])
    expect(r.decir).toContain('He añadido cebolla.')
    expect(r.decir).toContain('«arroz» puede ser arroz blanco o arroz integral')
    expect(r.decir).toContain('«tofu» no está en el catálogo')
    // Solo ambiguo: no cambia nada y pregunta.
    const ambiguo = aplicarSeleccion(
      antes,
      'marcar_ingredientes',
      { ingredientes: ['arroz'], accion: 'anadir' },
      ampliado
    )
    expect(ambiguo.ok).toBe(false)
    expect(ambiguo.estado).toBe(antes)
    expect(ambiguo.decir).toContain('dime cuál')
  })
  it('quita ingredientes sin identificar y avisa si no estaban en la lista', () => {
    const antes = {
      ...estado(),
      preferencias: preferencias({ ingredientesSinIdentificar: ['Tofu', 'Yuca'] })
    }
    const r = aplicarSeleccion(
      antes,
      'marcar_ingredientes',
      { ingredientes: ['tofu y pollo'], accion: 'quitar' },
      catalogo
    )
    expect(r.estado.preferencias.ingredientesSinIdentificar).toEqual(['Yuca'])
    expect(r.estado.preferencias.ingredientes).toEqual(['arroz_blanco'])
    expect(
      aplicarSeleccion(
        antes,
        'marcar_ingredientes',
        { ingredientes: ['tomate'], accion: 'quitar' },
        catalogo
      ).ok
    ).toBe(false)
  })
  it('quita y reemplaza ingredientes e invalida los resultados anteriores', () => {
    const antes = { ...estado(), busqueda, recetaVisibleId: 'arroz_con_pollo' }
    const r = aplicarSeleccion(
      antes,
      'marcar_ingredientes',
      { ingredientes: ['arroz_blanco'], accion: 'quitar' },
      catalogo
    )
    expect(r.estado.preferencias.ingredientes).toEqual(['pollo_muslo'])
    expect(r.estado.busqueda).toBeNull()
    expect(
      aplicarSeleccion(
        antes,
        'marcar_ingredientes',
        { ingredientes: ['cebolla'], accion: 'reemplazar' },
        catalogo
      ).estado.preferencias.ingredientes
    ).toEqual(['cebolla'])
  })
  it('cambia solo campos indicados y rechaza valores o campos inválidos', () => {
    const antes = estado()
    const r = aplicarSeleccion(
      antes,
      'cambiar_preferencias',
      { porciones: 2, tiempoMaxMin: 30 },
      catalogo
    )
    expect(r.estado.preferencias).toEqual({ ...antes.preferencias, porciones: 2, tiempoMaxMin: 30 })
    for (const a of [{}, { porciones: 21 }, { confirmado: true }, { alergias: ['inventada'] }])
      expect(aplicarSeleccion(antes, 'cambiar_preferencias', a, catalogo).ok).toBe(false)
  })
  it('solo muestra o elige recetas de la búsqueda vigente y no inicia una sesión por sí mismo', () => {
    const antes = estado()
    expect(
      aplicarSeleccion(antes, 'elegir_receta', { recetaId: 'arroz_con_pollo' }, catalogo).ok
    ).toBe(false)
    const buscada = aplicarSeleccion(antes, 'buscar_recetas', {}, catalogo, busqueda)
    expect(buscada.estado.pantalla).toBe('elegir')
    expect(
      aplicarSeleccion(buscada.estado, 'ver_receta', { recetaId: 'arroz_con_pollo' }, catalogo)
        .iniciarRecetaId
    ).toBeNull()
    expect(
      aplicarSeleccion(buscada.estado, 'elegir_receta', { recetaId: 'arroz_con_pollo' }, catalogo)
        .iniciarRecetaId
    ).toBe('arroz_con_pollo')
    expect(
      aplicarSeleccion(buscada.estado, 'elegir_receta', { recetaId: 'inventada' }, catalogo).ok
    ).toBe(false)
    expect(aplicarSeleccion(antes, 'avanzar_paso', {}, catalogo).ok).toBe(false)
  })
})

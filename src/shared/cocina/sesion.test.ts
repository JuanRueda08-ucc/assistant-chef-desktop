import { describe, expect, it } from 'vitest'
import { esquemaSesionCocina } from '../esquemas/sesion'
import { catalogoCocina, contexto, preferencias, sesionNueva, T0 } from './fixtures.test-utils'
import { adaptarReceta, crearSesionCocina } from './sesion'

const cantidadDe = (
  receta: ReturnType<typeof adaptarReceta>,
  id: string
): number | null | undefined => receta.ingredientes.find((i) => i.ingredienteId === id)?.cantidad

describe('crearSesionCocina', () => {
  it('empieza en el paso 1 de la fase cocinar con la receta escalada', () => {
    const sesion = sesionNueva()
    expect(esquemaSesionCocina.safeParse(sesion).success).toBe(true)
    expect(sesion).toMatchObject({
      id: 'sesion_1',
      fase: 'cocinar',
      recetaId: 'arroz_con_pollo',
      porciones: 4,
      pasoActual: 1,
      pasosHechos: [],
      temporizadores: [],
      sustituciones: [],
      actualizadaEn: new Date(T0).toISOString()
    })
    expect(sesion.eventos).toEqual([
      { en: T0, tipo: 'inicio', descripcion: 'Empieza "Arroz con pollo"' }
    ])
    expect(sesion.recetaAdaptada).toEqual(contexto().receta)
  })

  it('escala a las porciones pedidas', () => {
    const sesion = crearSesionCocina({
      id: 's',
      preferencias: preferencias(),
      receta: contexto().receta,
      porciones: 2,
      catalogo: catalogoCocina,
      ahora: T0
    })
    expect(sesion.porciones).toBe(2)
    expect(cantidadDe(sesion.recetaAdaptada!, 'pollo_muslo')).toBe(400)
  })

  it('no permite cocinar una receta retirada', () => {
    expect(() =>
      crearSesionCocina({
        id: 's',
        preferencias: preferencias(),
        receta: { ...contexto().receta, estadoRevision: 'retirada' },
        porciones: 4,
        catalogo: catalogoCocina,
        ahora: T0
      })
    ).toThrow(/retirada/)
  })
})

describe('adaptarReceta', () => {
  it('sustituye sobre la original y escala después', () => {
    const receta = adaptarReceta(
      contexto().receta,
      [
        {
          ingredienteOrigenId: 'pollo_muslo',
          ingredienteDestinoId: 'tofu_firme',
          ratio: 0.75,
          sustitucionId: 'pollo_tofu'
        }
      ],
      8,
      catalogoCocina
    )
    expect(cantidadDe(receta, 'tofu_firme')).toBe(1200) // 800 × 0,75 × 2
    expect(receta.alergenos).toEqual(['soja', 'apio'])
    expect(receta.porcionesBase).toBe(8)
  })

  it('aplica varias sustituciones en orden', () => {
    const receta = adaptarReceta(
      contexto().receta,
      [
        {
          ingredienteOrigenId: 'aceite_oliva',
          ingredienteDestinoId: 'mantequilla',
          ratio: 0.8,
          sustitucionId: null
        },
        {
          ingredienteOrigenId: 'caldo_pollo',
          ingredienteDestinoId: 'caldo_verduras',
          ratio: 1,
          sustitucionId: null
        }
      ],
      4,
      catalogoCocina
    )
    expect(cantidadDe(receta, 'mantequilla')).toBe(25)
    expect(cantidadDe(receta, 'caldo_verduras')).toBe(750)
    expect(receta.alergenos).toEqual(['lacteos'])
  })
})

import { describe, expect, it } from 'vitest'
import { esquemaSustitucion } from '../esquemas/receta'
import type { Receta, Sustitucion } from '../types/receta'
import type { Preferencias } from '../types/sesion'
import { buscarRecetas, UMBRAL_COBERTURA } from './busqueda'
import { conEtiquetas, indexar } from './etiquetas'
import {
  arrozConPollo as arrozSemilla,
  catalogo,
  ingrediente,
  recetaCon
} from './fixtures.test-utils'

const conExtra = [
  ...catalogo,
  ingrediente({ id: 'caldo_verduras' }),
  ingrediente({ id: 'caldo_lacteo', alergenos: ['lacteos'] }),
  ingrediente({ id: 'caldo_soja', alergenos: ['soja'] }),
  ingrediente({ id: 'agua', esBasicoDespensa: true })
]

/** Arroz con pollo revisado y con etiquetas: sin_gluten, sin_lactosa; alérgeno apio; olla; 55 min. */
const arroz = (campos: Partial<Receta> = {}): Receta =>
  conEtiquetas({ ...arrozSemilla(), estadoRevision: 'revisada', ...campos }, conExtra)

/** Ensalada de 10 min sin equipo: cebolla, tomate, aceite y sal. Compatible con todas las dietas. */
const ensalada = (campos: Record<string, unknown> = {}): Receta =>
  conEtiquetas(
    recetaCon(
      [
        { ingredienteId: 'cebolla', cantidad: 100, unidad: 'g', redondeo: 10 },
        { ingredienteId: 'tomate', cantidad: 200, unidad: 'g', redondeo: 10 },
        { ingredienteId: 'aceite_oliva', cantidad: 15, unidad: 'ml', redondeo: 5 },
        { ingredienteId: 'sal', cantidad: 2, unidad: 'g', redondeo: 1 }
      ],
      { id: 'ensalada', slug: 'ensalada', titulo: 'Ensalada', ...campos }
    ),
    conExtra
  )

const preferencias = (campos: Partial<Preferencias> = {}): Preferencias => ({
  ingredientes: [],
  ingredientesSinIdentificar: [],
  porciones: 4,
  restricciones: [],
  alergias: [],
  tiempoMaxMin: null,
  nivel: null,
  equipo: [],
  ...campos
})

const sustitucion = (campos: Record<string, unknown>): Sustitucion =>
  esquemaSustitucion.parse({
    id: 's',
    ingredienteOrigenId: 'caldo_pollo',
    ingredienteDestinoId: 'caldo_verduras',
    ratio: 1,
    impacto: 'Sabor más suave.',
    fuente: 'revisada',
    ...campos
  })

const conPolloYArroz = preferencias({ ingredientes: ['pollo_muslo', 'arroz_blanco'] })

describe('buscarRecetas: filtros duros', () => {
  it('descarta las recetas que no están revisadas', () => {
    const r = buscarRecetas(preferencias(), [arrozSemilla()], conExtra, [])
    expect(r.resultados).toEqual([])
    expect(r.descartadas).toEqual([{ recetaId: 'arroz_con_pollo', motivos: ['no_revisada'] }])
  })

  it('descarta por restricción de dieta', () => {
    const r = buscarRecetas(
      preferencias({ restricciones: ['vegetariana'] }),
      [arroz(), ensalada()],
      conExtra,
      []
    )
    expect(r.resultados.map((x) => x.receta.id)).toEqual(['ensalada'])
    expect(r.descartadas).toEqual([{ recetaId: 'arroz_con_pollo', motivos: ['restriccion'] }])
  })

  it('una receta pasa si cumple todas las restricciones pedidas', () => {
    const r = buscarRecetas(
      preferencias({ restricciones: ['sin_gluten', 'sin_lactosa'] }),
      [arroz()],
      conExtra,
      []
    )
    expect(r.resultados).toHaveLength(1)
  })

  it('descarta por alergia', () => {
    const r = buscarRecetas(preferencias({ alergias: ['apio'] }), [arroz()], conExtra, [])
    expect(r.descartadas[0]?.motivos).toEqual(['alergia'])
  })

  it('descarta si falta equipo; sin equipo indicado no filtra', () => {
    const sinOlla = buscarRecetas(
      preferencias({ equipo: ['sarten'] }),
      [arroz(), ensalada()],
      conExtra,
      []
    )
    expect(sinOlla.resultados.map((x) => x.receta.id)).toEqual(['ensalada'])
    expect(sinOlla.descartadas[0]?.motivos).toEqual(['equipo'])

    const conOlla = buscarRecetas(
      preferencias({ equipo: ['olla', 'sarten'] }),
      [arroz()],
      conExtra,
      []
    )
    expect(conOlla.resultados).toHaveLength(1)
    expect(buscarRecetas(preferencias(), [arroz()], conExtra, []).resultados).toHaveLength(1)
  })

  it('descarta por tiempo máximo', () => {
    expect(
      buscarRecetas(preferencias({ tiempoMaxMin: 30 }), [arroz()], conExtra, []).descartadas[0]
        ?.motivos
    ).toEqual(['tiempo'])
    expect(
      buscarRecetas(preferencias({ tiempoMaxMin: 55 }), [arroz()], conExtra, []).resultados
    ).toHaveLength(1)
  })

  it('descarta recetas más difíciles que el nivel del usuario', () => {
    const media = arroz({ dificultad: 'media' })
    expect(
      buscarRecetas(preferencias({ nivel: 'facil' }), [media], conExtra, []).descartadas[0]?.motivos
    ).toEqual(['nivel'])
    expect(
      buscarRecetas(preferencias({ nivel: 'media' }), [media], conExtra, []).resultados
    ).toHaveLength(1)
    expect(
      buscarRecetas(preferencias({ nivel: 'avanzada' }), [media], conExtra, []).resultados
    ).toHaveLength(1)
  })

  it('reúne todos los motivos de descarte en orden', () => {
    const r = buscarRecetas(
      preferencias({
        restricciones: ['vegana'],
        alergias: ['apio'],
        equipo: ['horno'],
        tiempoMaxMin: 20,
        nivel: 'facil'
      }),
      [arrozSemilla()].map((x) => conEtiquetas({ ...x, dificultad: 'avanzada' }, conExtra)),
      conExtra,
      []
    )
    expect(r.descartadas[0]?.motivos).toEqual([
      'no_revisada',
      'restriccion',
      'alergia',
      'equipo',
      'tiempo',
      'nivel'
    ])
  })
})

describe('buscarRecetas: cobertura y "qué falta"', () => {
  it('calcula la cobertura con los básicos de despensa como presentes', () => {
    // 12 obligatorios (guisantes es opcional). Presentes: pollo, arroz + aceite, sal, pimienta.
    const [r] = buscarRecetas(conPolloYArroz, [arroz()], conExtra, []).resultados
    expect(r?.ingredientesObligatorios).toBe(12)
    expect(r?.cobertura).toBe(0.416667) // 5 / 12
    expect(r?.coberturaConSustituciones).toBe(0.416667)
    expect(r?.puntuacion).toBe(-0.283333) // 5/12 − 7 × 0,1
    expect(r?.faltantes.map((f) => f.ingredienteId)).toEqual([
      'cebolla',
      'pimiento_rojo',
      'ajo',
      'tomate',
      'caldo_pollo',
      'pimenton',
      'laurel'
    ])
    expect(r?.faltantes[0]).toEqual({
      ingredienteId: 'cebolla',
      nombre: 'Cebolla',
      sustituciones: []
    })
  })

  it('los opcionales no penalizan pero se informan', () => {
    const [r] = buscarRecetas(conPolloYArroz, [arroz()], conExtra, []).resultados
    expect(r?.faltantes.some((f) => f.ingredienteId === 'guisantes')).toBe(false)
    expect(r?.opcionalesFaltantes).toEqual([{ ingredienteId: 'guisantes', nombre: 'Guisantes' }])
  })

  it('con todo disponible la cobertura es 1 y no falta nada', () => {
    const [r] = buscarRecetas(
      preferencias({ ingredientes: ['cebolla', 'tomate'] }),
      [ensalada()],
      conExtra,
      []
    ).resultados
    expect(r).toMatchObject({
      cobertura: 1,
      coberturaConSustituciones: 1,
      puntuacion: 1,
      faltantes: [],
      opcionalesFaltantes: []
    })
  })

  it('un ingrediente repetido cuenta una vez, y es obligatorio si alguna aparición lo es', () => {
    const receta = conEtiquetas(
      recetaCon([
        { ingredienteId: 'tomate', cantidad: 100, unidad: 'g', redondeo: 10 },
        { ingredienteId: 'tomate', cantidad: 50, unidad: 'g', redondeo: 10, opcional: true },
        { ingredienteId: 'cebolla', cantidad: 50, unidad: 'g', redondeo: 10 }
      ]),
      conExtra
    )
    const [r] = buscarRecetas(
      preferencias({ ingredientes: ['cebolla'] }),
      [receta],
      conExtra,
      []
    ).resultados
    expect(r?.cobertura).toBe(0.5)
    expect(r?.faltantes.map((f) => f.ingredienteId)).toEqual(['tomate'])
    expect(r?.opcionalesFaltantes).toEqual([])
  })

  it('incluye el resumen de la receta con sus etiquetas', () => {
    const [r] = buscarRecetas(conPolloYArroz, [arroz()], conExtra, []).resultados
    expect(r?.receta).toMatchObject({
      id: 'arroz_con_pollo',
      dietas: ['sin_gluten', 'sin_lactosa'],
      alergenos: ['apio'],
      equipo: ['olla']
    })
    expect(r?.receta).not.toHaveProperty('pasos')
  })
})

describe('buscarRecetas: sustituciones posibles', () => {
  const conCaldo = preferencias({ ingredientes: ['pollo_muslo', 'arroz_blanco', 'caldo_verduras'] })

  it('ofrece la sustitución si el usuario tiene el destino y suma el bonus', () => {
    const [sin] = buscarRecetas(conCaldo, [arroz()], conExtra, []).resultados
    const [con] = buscarRecetas(conCaldo, [arroz()], conExtra, [
      sustitucion({ id: 'caldo' })
    ]).resultados
    const caldo = con?.faltantes.find((f) => f.ingredienteId === 'caldo_pollo')
    expect(caldo?.sustituciones).toEqual([
      {
        sustitucionId: 'caldo',
        ingredienteDestinoId: 'caldo_verduras',
        nombreDestino: 'caldo_verduras',
        ratio: 1,
        impacto: 'Sabor más suave.',
        especifica: false
      }
    ])
    expect(con?.coberturaConSustituciones).toBe(0.5) // (5 + 1) / 12
    expect(con?.cobertura).toBe(sin?.cobertura)
    expect(con!.puntuacion - sin!.puntuacion).toBeCloseTo(0.05, 6)
  })

  it('los básicos de despensa sirven como destino', () => {
    const [r] = buscarRecetas(conPolloYArroz, [arroz()], conExtra, [
      sustitucion({ ingredienteDestinoId: 'agua' })
    ]).resultados
    expect(r?.faltantes.find((f) => f.ingredienteId === 'caldo_pollo')?.sustituciones).toHaveLength(
      1
    )
  })

  it('pone primero las específicas de la receta', () => {
    const [r] = buscarRecetas(conCaldo, [arroz()], conExtra, [
      sustitucion({ id: 'general', ingredienteDestinoId: 'agua' }),
      sustitucion({ id: 'especifica', recetaId: 'arroz_con_pollo' })
    ]).resultados
    const ids = r?.faltantes
      .find((f) => f.ingredienteId === 'caldo_pollo')
      ?.sustituciones.map((s) => [s.sustitucionId, s.especifica])
    expect(ids).toEqual([
      ['especifica', true],
      ['general', false]
    ])
  })

  it('no ofrece sustituciones de otra receta, sin destino disponible o con destino desconocido', () => {
    const [r] = buscarRecetas(conCaldo, [arroz()], conExtra, [
      sustitucion({ id: 'otra_receta', recetaId: 'lentejas' }),
      sustitucion({ id: 'sin_destino', ingredienteDestinoId: 'caldo_soja' }),
      sustitucion({ id: 'desconocido', ingredienteDestinoId: 'caldo_magico' })
    ]).resultados
    expect(r?.faltantes.find((f) => f.ingredienteId === 'caldo_pollo')?.sustituciones).toEqual([])
  })

  it('no ofrece destinos que rompen las restricciones o alergias del usuario', () => {
    const sustituciones = [
      sustitucion({ id: 'lacteo', ingredienteDestinoId: 'caldo_lacteo' }),
      sustitucion({ id: 'soja', ingredienteDestinoId: 'caldo_soja' })
    ]
    const tiene = ['pollo_muslo', 'caldo_lacteo', 'caldo_soja']
    const [r] = buscarRecetas(
      preferencias({ ingredientes: tiene, restricciones: ['sin_lactosa'], alergias: ['soja'] }),
      [arroz()],
      conExtra,
      sustituciones
    ).resultados
    expect(r?.faltantes.find((f) => f.ingredienteId === 'caldo_pollo')?.sustituciones).toEqual([])

    const [libre] = buscarRecetas(
      preferencias({ ingredientes: tiene }),
      [arroz()],
      conExtra,
      sustituciones
    ).resultados
    expect(
      libre?.faltantes.find((f) => f.ingredienteId === 'caldo_pollo')?.sustituciones
    ).toHaveLength(2)
  })
})

describe('buscarRecetas: orden y receta generada', () => {
  it('ordena por puntuación', () => {
    const r = buscarRecetas(
      preferencias({ ingredientes: ['cebolla', 'tomate'] }),
      [arroz(), ensalada()],
      conExtra,
      []
    )
    expect(r.resultados.map((x) => x.receta.id)).toEqual(['ensalada', 'arroz_con_pollo'])
  })

  it('a igual puntuación, menos tiempo y después título', () => {
    const recetas = [
      ensalada({ id: 'c', slug: 'c', titulo: 'Cebiche', tiempoTotalMin: 10, tiempoActivoMin: 5 }),
      ensalada({
        id: 'b',
        slug: 'b',
        titulo: 'Bruschetta',
        tiempoTotalMin: 10,
        tiempoActivoMin: 5
      }),
      ensalada({ id: 'a', slug: 'a', titulo: 'Zarangollo', tiempoTotalMin: 5, tiempoActivoMin: 5 })
    ]
    const r = buscarRecetas(
      preferencias({ ingredientes: ['cebolla', 'tomate'] }),
      recetas,
      conExtra,
      []
    )
    expect(r.resultados.map((x) => x.receta.id)).toEqual(['a', 'b', 'c'])
  })

  it(`ofrece receta generada si ninguna llega al ${UMBRAL_COBERTURA * 100} % de cobertura`, () => {
    expect(buscarRecetas(conPolloYArroz, [arroz()], conExtra, []).ofrecerGenerada).toBe(true)
    expect(buscarRecetas(preferencias(), [], conExtra, []).ofrecerGenerada).toBe(true)
    expect(
      buscarRecetas(
        preferencias({ ingredientes: ['cebolla', 'tomate'] }),
        [arroz(), ensalada()],
        conExtra,
        []
      ).ofrecerGenerada
    ).toBe(false)
  })

  it('las sustituciones cuentan para el umbral', () => {
    // Pollo, arroz, cebolla y pimiento más 3 básicos de despensa.
    const casi = preferencias({
      ingredientes: ['pollo_muslo', 'arroz_blanco', 'cebolla', 'pimiento_rojo']
    })
    // 7 / 12 = 0,58: por debajo del umbral.
    expect(buscarRecetas(casi, [arroz()], conExtra, []).ofrecerGenerada).toBe(true)
    // Con una sustitución para el ajo: 8 / 12 = 0,67.
    const ajo = sustitucion({ id: 'ajo', ingredienteOrigenId: 'ajo', ingredienteDestinoId: 'agua' })
    expect(buscarRecetas(casi, [arroz()], conExtra, [ajo]).ofrecerGenerada).toBe(false)
  })

  it('acepta el catálogo como Map y no modifica las entradas', () => {
    const recetas = [arroz()]
    const copia = structuredClone(recetas)
    const prefs = conPolloYArroz
    const r = buscarRecetas(prefs, recetas, indexar(conExtra), [])
    expect(r.resultados).toHaveLength(1)
    expect(recetas).toEqual(copia)
    expect(prefs.ingredientes).toEqual(['pollo_muslo', 'arroz_blanco'])
  })
})

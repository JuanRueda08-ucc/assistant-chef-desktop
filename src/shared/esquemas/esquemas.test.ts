import { describe, expect, it } from 'vitest'
import ingredientes from '../../../db/seed/ingredientes.json'
import tecnicas from '../../../db/seed/tecnicas.json'
import arrozConPollo from '../../../db/seed/recetas/arroz-con-pollo.json'
import { esquemaReceta, esquemaSustitucion } from './receta'
import { esquemaSemilla } from './semilla'
import { esquemaEstadoAvatar, esquemaSesionCocina } from './sesion'

/** Forma mínima para poder romper la receta de ejemplo campo a campo. */
interface RecetaEditable extends Record<string, unknown> {
  tiempoActivoMin: number
  ingredientes: Record<string, unknown>[]
  pasos: {
    orden: number
    tecnicaId: string | null
    ingredientes: { ingredienteRecetaId: string; fraccion: number }[]
    temporizador: { segundos: number } | null
  }[]
}

/** Copia profunda editable de la receta de ejemplo, para romperla en cada test. */
const receta = (): RecetaEditable => structuredClone(arrozConPollo) as unknown as RecetaEditable

const mensajes = (resultado: {
  success: boolean
  error?: { issues: { message: string }[] }
}): string[] => resultado.error?.issues.map((i) => i.message) ?? []

describe('semilla de db/seed', () => {
  it('pasa la validación completa', () => {
    const resultado = esquemaSemilla.safeParse({
      ingredientes,
      tecnicas,
      recetas: [arrozConPollo]
    })
    expect(mensajes(resultado)).toEqual([])
  })

  it('aplica los valores por defecto de los campos omitidos', () => {
    const r = esquemaReceta.parse(arrozConPollo)
    expect(r.dietas).toEqual([])
    expect(r.alergenos).toEqual([])
    expect(r.ingredientes[0]?.escalado).toBe('lineal')
    expect(r.ingredientes[0]?.opcional).toBe(false)
    expect(r.pasos[8]?.ingredientes).toEqual([])
    expect(r.pasos[0]?.temporizador).toBeNull()
  })

  it('rechaza un ingrediente que no está en el catálogo', () => {
    const r = receta()
    r.ingredientes[0]!.ingredienteId = 'unicornio'
    const resultado = esquemaSemilla.safeParse({ ingredientes, tecnicas, recetas: [r] })
    expect(mensajes(resultado)).toContain('ingrediente fuera del catálogo: unicornio')
  })

  it('rechaza una técnica inexistente', () => {
    const r = receta()
    r.pasos[0]!.tecnicaId = 'flambear'
    const resultado = esquemaSemilla.safeParse({ ingredientes, tecnicas, recetas: [r] })
    expect(mensajes(resultado)).toContain('técnica inexistente: flambear')
  })

  it('rechaza ids repetidos en el catálogo', () => {
    const resultado = esquemaSemilla.safeParse({
      ingredientes: [...ingredientes, ingredientes[0]],
      tecnicas,
      recetas: []
    })
    expect(mensajes(resultado)).toContain('id repetido: pollo_muslo')
  })
})

describe('esquemaReceta', () => {
  it('rechaza campos extra', () => {
    const resultado = esquemaReceta.safeParse({ ...receta(), calorias: 500 })
    expect(resultado.success).toBe(false)
  })

  it('exige que al_gusto vaya sin cantidad', () => {
    const r = receta()
    r.ingredientes[10]!.cantidad = 2
    expect(mensajes(esquemaReceta.safeParse(r))).toContain('al_gusto no lleva cantidad')
  })

  it('exige cantidad y redondeo fuera de al_gusto', () => {
    const r = receta()
    const ir = r.ingredientes[1]!
    ir.cantidad = null
    delete ir.redondeo
    const errores = mensajes(esquemaReceta.safeParse(r))
    expect(errores).toContain('falta la cantidad')
    expect(errores).toContain('falta el redondeo')
  })

  it('exige pasos ordenados desde 1 sin huecos', () => {
    const r = receta()
    r.pasos[1]!.orden = 5
    expect(mensajes(esquemaReceta.safeParse(r))).toContain(
      'los pasos deben estar ordenados desde 1 sin huecos (se esperaba 2)'
    )
  })

  it('rechaza un paso que usa un ingrediente que la receta no tiene', () => {
    const r = receta()
    r.pasos[0]!.ingredientes[0]!.ingredienteRecetaId = 'ir_99'
    expect(mensajes(esquemaReceta.safeParse(r))).toContain(
      'ingrediente de receta inexistente: ir_99'
    )
  })

  it('acota la fracción entre 0 (excluido) y 1', () => {
    for (const fraccion of [0, 1.5]) {
      const r = receta()
      r.pasos[0]!.ingredientes[0]!.fraccion = fraccion
      expect(esquemaReceta.safeParse(r).success).toBe(false)
    }
  })

  it('acota el temporizador del paso entre 10 s y 6 h', () => {
    for (const segundos of [5, 6 * 3600 + 1]) {
      const r = receta()
      r.pasos[2]!.temporizador!.segundos = segundos
      expect(esquemaReceta.safeParse(r).success).toBe(false)
    }
  })

  it('rechaza un tiempo activo mayor que el total', () => {
    const r = receta()
    r.tiempoActivoMin = 90
    expect(mensajes(esquemaReceta.safeParse(r))).toContain('el tiempo activo supera al total')
  })

  it('rechaza valores fuera de las enumeraciones', () => {
    expect(esquemaReceta.safeParse({ ...receta(), dificultad: 'experta' }).success).toBe(false)
    expect(esquemaReceta.safeParse({ ...receta(), equipo: ['wok'] }).success).toBe(false)
  })
})

describe('esquemaSustitucion', () => {
  const base = {
    id: 'mantequilla_aceite',
    ingredienteOrigenId: 'mantequilla',
    ingredienteDestinoId: 'aceite_oliva',
    ratio: 0.8,
    resuelve: ['lacteos', 'sin_lactosa'],
    impacto: 'Sabor más afrutado y textura menos cremosa.',
    fuente: 'revisada'
  }

  it('acepta dietas y alérgenos en `resuelve` y pone valores por defecto', () => {
    const s = esquemaSustitucion.parse(base)
    expect(s.contexto).toBe('cualquiera')
    expect(s.recetaId).toBeNull()
  })

  it('rechaza sustituir un ingrediente por sí mismo', () => {
    const resultado = esquemaSustitucion.safeParse({ ...base, ingredienteDestinoId: 'mantequilla' })
    expect(mensajes(resultado)).toContain('un ingrediente no se sustituye por sí mismo')
  })
})

describe('esquemas de sesión', () => {
  it('valida los cuatro estados del avatar', () => {
    for (const estado of [
      { accion: 'hablar' },
      { accion: 'senalar', objetivo: 'temporizadores' },
      { accion: 'esperar' },
      { accion: 'celebrar', intensidad: 'completa' }
    ]) {
      expect(esquemaEstadoAvatar.safeParse(estado).success).toBe(true)
    }
    expect(esquemaEstadoAvatar.safeParse({ accion: 'senalar' }).success).toBe(false)
  })

  it('valida una sesión de cocina con la receta adaptada', () => {
    const sesion = {
      id: 'sesion_1',
      fase: 'cocinar',
      preferencias: {
        ingredientes: ['pollo_muslo', 'arroz_blanco'],
        porciones: 4,
        restricciones: [],
        alergias: ['apio'],
        tiempoMaxMin: 60,
        nivel: null,
        equipo: ['olla']
      },
      recetaId: 'arroz_con_pollo',
      recetaAdaptada: esquemaReceta.parse(arrozConPollo),
      porciones: 4,
      sustituciones: [],
      pasoActual: 3,
      pasosHechos: ['p1', 'p2'],
      temporizadores: [
        {
          id: 't1',
          etiqueta: 'Dorar pollo',
          pasoId: 'p3',
          duracionSeg: 480,
          estado: 'corriendo',
          iniciadoEn: 1_760_000_000_000,
          restanteSeg: 480
        }
      ],
      eventos: [{ en: 1_760_000_000_000, tipo: 'avanzar_paso', descripcion: 'Paso 3' }],
      actualizadaEn: '2026-10-18T12:00:00Z'
    }
    expect(mensajes(esquemaSesionCocina.safeParse(sesion))).toEqual([])
    expect(esquemaSesionCocina.safeParse({ ...sesion, porciones: 21 }).success).toBe(false)
  })
})

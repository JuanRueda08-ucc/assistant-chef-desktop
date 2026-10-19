import { describe, expect, it } from 'vitest'
import type { ResultadoHerramienta } from '../ia/herramientas'
import type { SesionCocina } from '../types/sesion'
import { aplicarHerramienta } from './aplicar'
import { MAX_EVENTOS } from './sesion'
import { restanteSeg } from './temporizadores'
import { aplicar, congelar, contexto, en, sesionNueva, T0 } from './fixtures.test-utils'

type Exito = Extract<ResultadoHerramienta, { ok: true }>
type Error_ = Extract<ResultadoHerramienta, { ok: false }>

const exito = (r: ResultadoHerramienta): Exito => {
  if (!r.ok) throw new Error(`se esperaba éxito: ${r.error.codigo} ${r.error.mensaje}`)
  return r
}
const error = (r: ResultadoHerramienta): Error_ => {
  if (r.ok) throw new Error('se esperaba un error')
  return r
}

/** Sesión en el paso `orden` (salta con ir_a_paso). */
const enPaso = (orden: number, base: SesionCocina = sesionNueva()): SesionCocina =>
  aplicar(base, 'ir_a_paso', { orden }).sesion

/** Sesión con un temporizador "Pasta" de 600 s creado en T0. */
const conPasta = (): SesionCocina =>
  aplicar(sesionNueva(), 'iniciar_temporizador', { segundos: 600, etiqueta: 'Pasta' }).sesion

const cantidad = (s: SesionCocina, ingredienteId: string): number | null | undefined =>
  s.recetaAdaptada?.ingredientes.find((i) => i.ingredienteId === ingredienteId)?.cantidad

describe('aplicarHerramienta: reglas generales', () => {
  it('si falla devuelve la misma sesión, sin efecto, con un error y algo que decir', () => {
    const sesion = sesionNueva()
    const r = aplicar(sesion, 'retroceder_paso')
    expect(r.sesion).toBe(sesion)
    expect(error(r.resultado).error.codigo).toBe('primer_paso')
    expect(r.resultado.decir).toBeTruthy()
    expect(r.avatar).toEqual({ accion: 'hablar' })
  })

  it('nunca modifica la sesión ni el contexto recibidos', () => {
    const sesion = congelar(conPasta())
    const ctx = congelar(contexto())
    const llamadas: [Parameters<typeof aplicar>[1], unknown][] = [
      ['avanzar_paso', {}],
      ['retroceder_paso', {}],
      ['ir_a_paso', { orden: 3 }],
      ['iniciar_temporizador', { segundos: 60, etiqueta: 'Huevo' }],
      ['controlar_temporizador', { etiqueta: 'Pasta', accion: 'pausar' }],
      ['cambiar_porciones', { porciones: 6 }],
      ['mostrar_tecnica', {}],
      ['sustituir_ingrediente', { ingredienteId: 'pollo_muslo', sustitutoId: 'tofu_firme' }],
      ['terminar_receta', {}]
    ]
    for (const [nombre, argumentos] of llamadas) {
      expect(() =>
        aplicar(sesion, nombre, argumentos, { confirmado: true, ctx, ahora: en(30) })
      ).not.toThrow()
    }
  })

  it('registra un evento y actualiza la fecha en cada éxito', () => {
    const r = aplicar(sesionNueva(), 'avanzar_paso', {}, { confirmado: true, ahora: en(90) })
    expect(r.sesion.eventos.at(-1)).toEqual({
      en: en(90),
      tipo: 'avanzar_paso',
      descripcion: 'Paso 2 de 9'
    })
    expect(r.sesion.actualizadaEn).toBe(new Date(en(90)).toISOString())
  })

  it(`guarda como mucho ${MAX_EVENTOS} eventos`, () => {
    let sesion = sesionNueva()
    for (let i = 0; i < MAX_EVENTOS + 10; i++)
      sesion = aplicar(sesion, 'ir_a_paso', { orden: (i % 9) + 1 }).sesion
    expect(sesion.eventos).toHaveLength(MAX_EVENTOS)
    expect(sesion.eventos.at(-1)?.tipo).toBe('ir_a_paso')
  })

  it('el resultado lleva el resumen del estado', () => {
    const r = aplicar(conPasta(), 'avanzar_paso', {}, { confirmado: true, ahora: en(100) })
    expect(exito(r.resultado).estado).toEqual({
      fase: 'cocinar',
      receta: 'Arroz con pollo',
      porciones: 4,
      pasoActual: 2,
      totalPasos: 9,
      temporizadores: [{ id: 't1', etiqueta: 'Pasta', estado: 'corriendo', restanteSeg: 500 }]
    })
  })

  it('rechaza argumentos inválidos o con campos extra', () => {
    expect(error(aplicar(sesionNueva(), 'ir_a_paso', { orden: '3' }).resultado).error.codigo).toBe(
      'argumentos_invalidos'
    )
    expect(error(aplicar(sesionNueva(), 'ir_a_paso', { orden: 0 }).resultado).error.codigo).toBe(
      'argumentos_invalidos'
    )
    expect(
      error(aplicar(sesionNueva(), 'avanzar_paso', { confirmado: true }).resultado).error.codigo
    ).toBe('argumentos_invalidos')
    expect(error(aplicar(sesionNueva(), 'ir_a_paso', null).resultado).error.mensaje).toMatch(
      /orden/
    )
  })

  it('rechaza una herramienta desconocida', () => {
    const r = aplicarHerramienta(
      sesionNueva(),
      { nombre: 'borrar_todo' as never, argumentos: {}, confirmado: true },
      T0,
      contexto()
    )
    expect(error(r.resultado).error.codigo).toBe('argumentos_invalidos')
  })

  it('solo funciona en la fase cocinar', () => {
    const preparando = {
      ...sesionNueva(),
      fase: 'preparar' as const,
      pasoActual: null,
      recetaAdaptada: null
    }
    expect(error(aplicar(preparando, 'avanzar_paso').resultado).error.codigo).toBe(
      'fase_incorrecta'
    )
  })

  it('falla de forma explícita si el contexto es de otra receta', () => {
    const ctx = { ...contexto(), receta: { ...contexto().receta, id: 'otra' } }
    expect(() => aplicar(sesionNueva(), 'avanzar_paso', {}, { ctx })).toThrow(/otra/)
  })

  it('marca como terminados los temporizadores que acabaron antes de la llamada', () => {
    const r = aplicar(conPasta(), 'ir_a_paso', { orden: 2 }, { ahora: en(601) })
    expect(r.sesion.temporizadores[0]).toMatchObject({ estado: 'terminado', restanteSeg: 0 })
  })
})

describe('avanzar_paso', () => {
  it('exige confirmación si el paso la requiere', () => {
    const sesion = sesionNueva() // paso 1: picar, requiere confirmación
    const r = aplicar(sesion, 'avanzar_paso')
    expect(r.sesion).toBe(sesion)
    expect(error(r.resultado).error.codigo).toBe('falta_confirmacion')
    expect(r.resultado.decir).toBe('Avísame cuando termines este paso.')
  })

  it('usa la señal de hecho del paso al pedir confirmación', () => {
    const r = aplicar(enPaso(3), 'avanzar_paso')
    expect(r.resultado.decir).toBe('Avísame cuando esté listo: cuando esté dorado por ambos lados.')
  })

  it('con confirmación avanza y marca el paso anterior como hecho', () => {
    const r = aplicar(sesionNueva(), 'avanzar_paso', {}, { confirmado: true })
    expect(r.sesion.pasoActual).toBe(2)
    expect(r.sesion.pasosHechos).toEqual(['p1'])
    expect(r.avatar).toEqual({ accion: 'hablar' })
    expect(r.resultado.decir).toBe('Salpimienta el pollo por todos lados.')
    expect(exito(r.resultado).datos).toBeUndefined()
  })

  it('sin confirmación avanza si el paso no la requiere', () => {
    expect(aplicar(enPaso(2), 'avanzar_paso').sesion.pasoActual).toBe(3)
  })

  it('ofrece el temporizador del nuevo paso sin crearlo', () => {
    const r = aplicar(enPaso(2), 'avanzar_paso')
    expect(exito(r.resultado).datos).toEqual({
      temporizadorSugerido: { etiqueta: 'Dorar pollo', segundos: 480, pasoId: 'p3' }
    })
    expect(r.resultado.decir).toMatch(/¿Pongo un temporizador de 8 minutos para Dorar pollo\?$/)
    expect(r.sesion.temporizadores).toEqual([])
  })

  it('no avanza más allá del último paso', () => {
    expect(
      error(aplicar(enPaso(9), 'avanzar_paso', {}, { confirmado: true }).resultado).error.codigo
    ).toBe('ultimo_paso')
  })

  it('no repite pasos en pasosHechos al volver y avanzar', () => {
    let s = aplicar(sesionNueva(), 'avanzar_paso', {}, { confirmado: true }).sesion
    s = aplicar(s, 'retroceder_paso').sesion
    s = aplicar(s, 'avanzar_paso', {}, { confirmado: true }).sesion
    expect(s.pasosHechos).toEqual(['p1'])
  })
})

describe('retroceder_paso e ir_a_paso', () => {
  it('retrocede un paso y lee su texto hablado', () => {
    const r = aplicar(enPaso(4), 'retroceder_paso')
    expect(r.sesion.pasoActual).toBe(3)
    expect(r.resultado.decir).toMatch(/^Calienta el aceite en la olla a fuego medio alto/)
  })

  it('no retrocede desde el primero', () => {
    expect(error(aplicar(sesionNueva(), 'retroceder_paso').resultado).error.codigo).toBe(
      'primer_paso'
    )
  })

  it('salta a un paso existente', () => {
    const r = aplicar(sesionNueva(), 'ir_a_paso', { orden: 8 })
    expect(r.sesion.pasoActual).toBe(8)
    expect(r.avatar).toEqual({ accion: 'hablar' })
    expect(r.resultado.decir).toMatch(/^Baja el fuego, tapa la olla y cocina dieciocho minutos/)
  })

  it('no salta a un paso que no existe', () => {
    const r = aplicar(sesionNueva(), 'ir_a_paso', { orden: 10 })
    expect(error(r.resultado).error.codigo).toBe('paso_inexistente')
    expect(r.resultado.decir).toBe('La receta tiene 9 pasos.')
  })
})

describe('iniciar_temporizador', () => {
  it('crea un temporizador corriendo con nombre', () => {
    const r = aplicar(sesionNueva(), 'iniciar_temporizador', { segundos: 600, etiqueta: ' Pasta ' })
    expect(r.sesion.temporizadores).toEqual([
      {
        id: 't1',
        etiqueta: 'Pasta',
        pasoId: null,
        duracionSeg: 600,
        estado: 'corriendo',
        iniciadoEn: T0,
        restanteSeg: 600
      }
    ])
    expect(r.avatar).toEqual({ accion: 'senalar', objetivo: 'temporizadores' })
    expect(exito(r.resultado).datos).toEqual({ temporizadorId: 't1' })
    expect(r.resultado.decir).toBe('Temporizador de 10 minutos para Pasta en marcha.')
  })

  it('puede asociarse a un paso existente', () => {
    const r = aplicar(sesionNueva(), 'iniciar_temporizador', {
      segundos: 1080,
      etiqueta: 'Arroz',
      pasoId: 'p8'
    })
    expect(r.sesion.temporizadores[0]?.pasoId).toBe('p8')
    const mal = aplicar(sesionNueva(), 'iniciar_temporizador', {
      segundos: 60,
      etiqueta: 'X',
      pasoId: 'p99'
    })
    expect(error(mal.resultado).error.codigo).toBe('paso_inexistente')
  })

  it('acepta de 10 s a 6 h', () => {
    for (const segundos of [10, 21600]) {
      expect(
        aplicar(sesionNueva(), 'iniciar_temporizador', { segundos, etiqueta: 'X' }).resultado.ok
      ).toBe(true)
    }
    for (const segundos of [9, 21601, 30.5]) {
      const r = aplicar(sesionNueva(), 'iniciar_temporizador', { segundos, etiqueta: 'X' })
      expect(error(r.resultado).error.codigo).toBe('argumentos_invalidos')
    }
  })

  it('permite como mucho 4 activos', () => {
    let s = sesionNueva()
    for (const etiqueta of ['A', 'B', 'C', 'D']) {
      s = aplicar(s, 'iniciar_temporizador', { segundos: 60, etiqueta }).sesion
    }
    const quinto = aplicar(s, 'iniciar_temporizador', { segundos: 60, etiqueta: 'E' })
    expect(error(quinto.resultado).error.codigo).toBe('demasiados_temporizadores')

    // Los pausados cuentan; los cancelados no.
    s = aplicar(s, 'controlar_temporizador', { etiqueta: 'A', accion: 'pausar' }).sesion
    expect(aplicar(s, 'iniciar_temporizador', { segundos: 60, etiqueta: 'E' }).resultado.ok).toBe(
      false
    )
    s = aplicar(s, 'controlar_temporizador', { etiqueta: 'B', accion: 'cancelar' }).sesion
    const r = aplicar(s, 'iniciar_temporizador', { segundos: 60, etiqueta: 'E' })
    expect(exito(r.resultado).datos?.temporizadorId).toBe('t5')
  })

  it('no repite la etiqueta de un temporizador activo (sin distinguir mayúsculas)', () => {
    const r = aplicar(conPasta(), 'iniciar_temporizador', { segundos: 60, etiqueta: 'pasta' })
    expect(error(r.resultado).error.codigo).toBe('etiqueta_repetida')
    // Si el anterior ya terminó, sí.
    const tarde = aplicar(
      conPasta(),
      'iniciar_temporizador',
      { segundos: 60, etiqueta: 'Pasta' },
      { ahora: en(700) }
    )
    expect(tarde.resultado.ok).toBe(true)
  })
})

describe('controlar_temporizador', () => {
  it('pausa y reanuda con el reloj', () => {
    const pausado = aplicar(
      conPasta(),
      'controlar_temporizador',
      { id: 't1', accion: 'pausar' },
      { ahora: en(100) }
    )
    expect(pausado.sesion.temporizadores[0]).toMatchObject({
      estado: 'pausado',
      restanteSeg: 500,
      iniciadoEn: null
    })
    expect(pausado.resultado.decir).toBe('Pausé Pasta. Quedan 8 min 20 s.')
    expect(pausado.avatar).toEqual({ accion: 'hablar' })

    const seguido = aplicar(
      pausado.sesion,
      'controlar_temporizador',
      { id: 't1', accion: 'reanudar' },
      { ahora: en(400) }
    )
    const t = seguido.sesion.temporizadores[0]!
    expect(t).toMatchObject({ estado: 'corriendo', restanteSeg: 500, iniciadoEn: en(400) })
    expect(restanteSeg(t, en(500))).toBe(400)
  })

  it('encuentra el temporizador por etiqueta sin distinguir mayúsculas', () => {
    const r = aplicar(conPasta(), 'controlar_temporizador', { etiqueta: 'PASTA', accion: 'pausar' })
    expect(exito(r.resultado).datos).toEqual({ temporizadorId: 't1' })
  })

  it('cancela, y un cancelado ya no se encuentra', () => {
    const r = aplicar(conPasta(), 'controlar_temporizador', {
      etiqueta: 'Pasta',
      accion: 'cancelar'
    })
    expect(r.sesion.temporizadores[0]?.estado).toBe('cancelado')
    expect(exito(r.resultado).estado.temporizadores).toEqual([])
    const otra = aplicar(r.sesion, 'controlar_temporizador', { id: 't1', accion: 'pausar' })
    expect(error(otra.resultado).error.codigo).toBe('temporizador_inexistente')
  })

  it('suma tiempo a uno corriendo', () => {
    const r = aplicar(
      conPasta(),
      'controlar_temporizador',
      { id: 't1', accion: 'sumar', segundos: 60 },
      { ahora: en(100) }
    )
    expect(r.sesion.temporizadores[0]).toMatchObject({ restanteSeg: 560, duracionSeg: 660 })
    expect(r.resultado.decir).toBe('Sumé 1 minuto a Pasta: quedan 9 min 20 s.')
  })

  it('sumar a uno terminado lo vuelve a poner en marcha', () => {
    const r = aplicar(
      conPasta(),
      'controlar_temporizador',
      { etiqueta: 'Pasta', accion: 'sumar', segundos: 60 },
      { ahora: en(900) }
    )
    expect(r.sesion.temporizadores[0]).toMatchObject({
      estado: 'corriendo',
      restanteSeg: 60,
      iniciadoEn: en(900)
    })
  })

  it('no suma por encima de 6 horas', () => {
    const r = aplicar(conPasta(), 'controlar_temporizador', {
      id: 't1',
      accion: 'sumar',
      segundos: 21600
    })
    expect(error(r.resultado).error.codigo).toBe('accion_no_valida')
  })

  it('rechaza acciones que no tocan en el estado actual', () => {
    const terminado = aplicar(
      conPasta(),
      'controlar_temporizador',
      { id: 't1', accion: 'pausar' },
      { ahora: en(700) }
    )
    expect(error(terminado.resultado).error.codigo).toBe('accion_no_valida')
    const corriendo = aplicar(conPasta(), 'controlar_temporizador', {
      id: 't1',
      accion: 'reanudar'
    })
    expect(error(corriendo.resultado).error.codigo).toBe('accion_no_valida')
  })

  it('valida la combinación de argumentos', () => {
    const casos = [
      { accion: 'pausar' }, // sin id ni etiqueta
      { id: 't1', accion: 'sumar' }, // sumar sin segundos
      { id: 't1', accion: 'pausar', segundos: 30 }, // segundos sin sumar
      { id: 't1', accion: 'apagar' }
    ]
    for (const argumentos of casos) {
      expect(
        error(aplicar(conPasta(), 'controlar_temporizador', argumentos).resultado).error.codigo
      ).toBe('argumentos_invalidos')
    }
  })

  it('avisa si la etiqueta es ambigua', () => {
    let s = aplicar(sesionNueva(), 'iniciar_temporizador', {
      segundos: 10,
      etiqueta: 'Huevo'
    }).sesion
    s = aplicar(
      s,
      'iniciar_temporizador',
      { segundos: 10, etiqueta: 'Huevo' },
      { ahora: en(20) }
    ).sesion
    // Los dos terminados con la misma etiqueta: hace falta el id.
    const r = aplicar(
      s,
      'controlar_temporizador',
      { etiqueta: 'Huevo', accion: 'cancelar' },
      { ahora: en(60) }
    )
    expect(error(r.resultado).error.codigo).toBe('temporizador_ambiguo')
    expect(
      aplicar(s, 'controlar_temporizador', { id: 't2', accion: 'cancelar' }, { ahora: en(60) })
        .resultado.ok
    ).toBe(true)
  })

  it('con dos iguales prefiere el activo', () => {
    let s = aplicar(sesionNueva(), 'iniciar_temporizador', {
      segundos: 10,
      etiqueta: 'Huevo'
    }).sesion
    s = aplicar(
      s,
      'iniciar_temporizador',
      { segundos: 300, etiqueta: 'Huevo' },
      { ahora: en(20) }
    ).sesion
    const r = aplicar(
      s,
      'controlar_temporizador',
      { etiqueta: 'Huevo', accion: 'pausar' },
      { ahora: en(30) }
    )
    expect(exito(r.resultado).datos?.temporizadorId).toBe('t2')
  })
})

describe('cambiar_porciones', () => {
  it('recalcula cantidades y conserva el paso', () => {
    const r = aplicar(enPaso(5), 'cambiar_porciones', { porciones: 8 })
    expect(r.sesion.porciones).toBe(8)
    expect(r.sesion.pasoActual).toBe(5)
    expect(cantidad(r.sesion, 'pollo_muslo')).toBe(1600)
    expect(r.sesion.recetaAdaptada?.porcionesBase).toBe(8)
    expect(r.avatar).toEqual({ accion: 'senalar', objetivo: 'ingredientes' })
    expect(exito(r.resultado).datos).toBeUndefined()
    expect(r.resultado.decir).toBe('Listo, cantidades para 8 porciones.')
  })

  it('avisa con factores extremos', () => {
    const r = aplicar(sesionNueva(), 'cambiar_porciones', { porciones: 10 })
    expect(exito(r.resultado).datos?.aviso?.tipo).toBe('factor_alto')
    expect(r.resultado.decir).toMatch(/olla más grande/)
    expect(r.resultado.decir).toMatch(/^Listo, cantidades para 10 porciones\./)
  })

  it('escala siempre desde la original (sin acumular redondeos)', () => {
    let s = aplicar(sesionNueva(), 'cambiar_porciones', { porciones: 3 }).sesion
    s = aplicar(s, 'cambiar_porciones', { porciones: 4 }).sesion
    expect(s.recetaAdaptada).toEqual(contexto().receta)
  })

  it('mantiene las sustituciones aplicadas', () => {
    let s = aplicar(sesionNueva(), 'sustituir_ingrediente', {
      ingredienteId: 'pollo_muslo',
      sustitutoId: 'tofu_firme'
    }).sesion
    s = aplicar(s, 'cambiar_porciones', { porciones: 8 }).sesion
    expect(cantidad(s, 'tofu_firme')).toBe(1200)
  })

  it('acepta de 1 a 20 porciones', () => {
    expect(
      error(aplicar(sesionNueva(), 'cambiar_porciones', { porciones: 21 }).resultado).error.codigo
    ).toBe('argumentos_invalidos')
    expect(
      error(aplicar(sesionNueva(), 'cambiar_porciones', { porciones: 0 }).resultado).error.codigo
    ).toBe('argumentos_invalidos')
    expect(aplicar(sesionNueva(), 'cambiar_porciones', { porciones: 1 }).sesion.porciones).toBe(1)
  })
})

describe('mostrar_tecnica', () => {
  it('muestra la técnica del paso actual por defecto', () => {
    const sesion = sesionNueva()
    const r = aplicar(sesion, 'mostrar_tecnica')
    expect(exito(r.resultado).datos?.tecnica?.id).toBe('picar_brunoise')
    expect(r.avatar).toEqual({ accion: 'senalar', objetivo: 'panel' })
    expect(r.sesion.pasoActual).toBe(1)
    expect(r.sesion.eventos).toHaveLength(sesion.eventos.length + 1)
  })

  it('muestra otra técnica si se pide', () => {
    expect(
      exito(aplicar(enPaso(2), 'mostrar_tecnica', { tecnicaId: 'sellar' }).resultado).datos?.tecnica
        ?.nombre
    ).toBe('Sellar')
  })

  it('falla si el paso no tiene técnica o la técnica no existe', () => {
    expect(error(aplicar(enPaso(2), 'mostrar_tecnica').resultado).error.codigo).toBe('sin_tecnica')
    expect(
      error(aplicar(sesionNueva(), 'mostrar_tecnica', { tecnicaId: 'flambear' }).resultado).error
        .codigo
    ).toBe('tecnica_inexistente')
  })
})

describe('sustituir_ingrediente', () => {
  it('sin sustituto devuelve las opciones sin cambiar la receta', () => {
    const sesion = sesionNueva()
    const r = aplicar(sesion, 'sustituir_ingrediente', { ingredienteId: 'caldo_pollo' })
    expect(exito(r.resultado).datos?.opciones?.map((o) => o.ingredienteDestinoId)).toEqual([
      'caldo_verduras'
    ])
    expect(r.sesion.recetaAdaptada).toBe(sesion.recetaAdaptada)
    expect(r.sesion.sustituciones).toEqual([])
    expect(r.resultado.decir).toBe('En lugar de Caldo de pollo puedes usar Caldo de verduras.')
  })

  it('las opciones respetan las restricciones del usuario', () => {
    const libre = aplicar(sesionNueva(), 'sustituir_ingrediente', { ingredienteId: 'aceite_oliva' })
    expect(exito(libre.resultado).datos?.opciones).toHaveLength(1)
    const sinLactosa = aplicar(
      sesionNueva({ restricciones: ['sin_lactosa'] }),
      'sustituir_ingrediente',
      {
        ingredienteId: 'aceite_oliva'
      }
    )
    expect(exito(sinLactosa.resultado).datos?.opciones).toEqual([])
    expect(sinLactosa.resultado.decir).toBe(
      'No tengo una sustitución revisada para Aceite de oliva.'
    )
  })

  it('con sustituto aplica la sustitución en la sesión y recalcula', () => {
    const r = aplicar(enPaso(3), 'sustituir_ingrediente', {
      ingredienteId: 'pollo_muslo',
      sustitutoId: 'tofu_firme'
    })
    expect(r.sesion.sustituciones).toEqual([
      {
        ingredienteOrigenId: 'pollo_muslo',
        ingredienteDestinoId: 'tofu_firme',
        ratio: 0.75,
        sustitucionId: 'pollo_tofu'
      }
    ])
    expect(cantidad(r.sesion, 'tofu_firme')).toBe(600)
    expect(cantidad(r.sesion, 'pollo_muslo')).toBeUndefined()
    expect(r.sesion.recetaAdaptada?.alergenos).toEqual(['soja', 'apio'])
    expect(r.sesion.pasoActual).toBe(3)
    expect(r.avatar).toEqual({ accion: 'hablar' })
    expect(r.resultado.decir).toBe(
      'Hecho: Tofu firme en lugar de Muslo de pollo. Textura más blanda; dóralo bien.'
    )
  })

  it('falla si el ingrediente no está en la receta', () => {
    const r = aplicar(sesionNueva(), 'sustituir_ingrediente', { ingredienteId: 'mantequilla' })
    expect(error(r.resultado).error.codigo).toBe('ingrediente_no_en_receta')
  })

  it('falla si no hay una sustitución revisada para ese par', () => {
    const r = aplicar(sesionNueva(), 'sustituir_ingrediente', {
      ingredienteId: 'pollo_muslo',
      sustitutoId: 'caldo_verduras'
    })
    expect(error(r.resultado).error.codigo).toBe('sustitucion_no_disponible')
  })

  it('falla si el sustituto rompe las restricciones o alergias', () => {
    const r = aplicar(sesionNueva({ alergias: ['soja'] }), 'sustituir_ingrediente', {
      ingredienteId: 'pollo_muslo',
      sustitutoId: 'tofu_firme'
    })
    expect(error(r.resultado).error.codigo).toBe('rompe_restricciones')
  })

  it('se pueden encadenar sustituciones distintas', () => {
    let s = aplicar(sesionNueva(), 'sustituir_ingrediente', {
      ingredienteId: 'aceite_oliva',
      sustitutoId: 'mantequilla'
    }).sesion
    s = aplicar(s, 'sustituir_ingrediente', {
      ingredienteId: 'caldo_pollo',
      sustitutoId: 'caldo_verduras'
    }).sesion
    expect(s.sustituciones).toHaveLength(2)
    expect(cantidad(s, 'mantequilla')).toBe(25)
    expect(s.recetaAdaptada?.alergenos).toEqual(['lacteos'])
  })
})

describe('terminar_receta', () => {
  it('solo en el último paso', () => {
    const r = aplicar(enPaso(5), 'terminar_receta')
    expect(error(r.resultado).error.codigo).toBe('no_es_ultimo_paso')
    expect(r.resultado.decir).toBe('Aún quedan pasos: vamos por el 5 de 9.')
  })

  it('termina la sesión y celebra', () => {
    const r = aplicar(enPaso(9), 'terminar_receta')
    expect(r.sesion).toMatchObject({ fase: 'terminado', pasoActual: null })
    expect(r.sesion.pasosHechos).toContain('p9')
    expect(r.avatar).toEqual({ accion: 'celebrar', intensidad: 'completa' })
    expect(exito(r.resultado).estado).toMatchObject({ fase: 'terminado', pasoActual: null })
    expect(error(aplicar(r.sesion, 'avanzar_paso').resultado).error.codigo).toBe('fase_incorrecta')
  })
})

describe('una receta de principio a fin', () => {
  it('se cocina entera confirmando cada paso', () => {
    let s = sesionNueva()
    for (let paso = 1; paso < 9; paso++) {
      const r = aplicar(s, 'avanzar_paso', {}, { confirmado: true, ahora: en(paso * 60) })
      expect(r.resultado.ok).toBe(true)
      s = r.sesion
    }
    expect(s.pasoActual).toBe(9)
    s = aplicar(s, 'terminar_receta', {}, { ahora: en(600) }).sesion
    expect(s.fase).toBe('terminado')
    expect(s.pasosHechos).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'])
  })
})

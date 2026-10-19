import { describe, expect, it } from 'vitest'
import type { SesionCocina } from '../types/sesion'
import {
  actualizarTemporizadores,
  cancelar,
  crearTemporizador,
  estaActivo,
  formatearDuracion,
  pausar,
  reanudar,
  restanteSeg,
  siguienteIdTemporizador,
  sumar
} from './temporizadores'

const T0 = 1_760_000_000_000
const seg = (s: number): number => T0 + s * 1000
const pasta = (): ReturnType<typeof crearTemporizador> =>
  crearTemporizador('t1', 'Pasta', 600, null, T0)

describe('temporizadores basados en reloj', () => {
  it('calcula el restante con el reloj, sin bajar de cero', () => {
    const t = pasta()
    expect(restanteSeg(t, T0)).toBe(600)
    expect(restanteSeg(t, seg(100))).toBe(500)
    expect(restanteSeg(t, seg(100.4))).toBe(500)
    expect(restanteSeg(t, seg(700))).toBe(0)
    expect(restanteSeg(t, T0 - 5000)).toBe(600) // reloj hacia atrás: no suma tiempo
  })

  it('pausar congela el restante y reanudar sigue desde ahí', () => {
    const pausado = pausar(pasta(), seg(100))
    expect(pausado).toMatchObject({ estado: 'pausado', restanteSeg: 500, iniciadoEn: null })
    expect(restanteSeg(pausado, seg(10_000))).toBe(500)
    const seguido = reanudar(pausado, seg(200))
    expect(seguido).toMatchObject({ estado: 'corriendo', restanteSeg: 500, iniciadoEn: seg(200) })
    expect(restanteSeg(seguido, seg(300))).toBe(400)
  })

  it('cancelar guarda el restante y deja de estar activo', () => {
    const t = cancelar(pasta(), seg(60))
    expect(t).toMatchObject({ estado: 'cancelado', restanteSeg: 540, iniciadoEn: null })
    expect(estaActivo(t)).toBe(false)
    expect(estaActivo(pasta())).toBe(true)
    expect(estaActivo(pausar(pasta(), T0))).toBe(true)
  })

  it('sumar a uno corriendo conserva lo transcurrido', () => {
    const t = sumar(pasta(), 60, seg(100))
    expect(t).toMatchObject({
      estado: 'corriendo',
      duracionSeg: 660,
      restanteSeg: 560,
      iniciadoEn: seg(100)
    })
    expect(restanteSeg(t, seg(160))).toBe(500)
  })

  it('sumar a uno pausado lo deja pausado', () => {
    const t = sumar(pausar(pasta(), seg(100)), 30, seg(500))
    expect(t).toMatchObject({ estado: 'pausado', restanteSeg: 530, duracionSeg: 630 })
  })

  it('sumar a uno terminado lo vuelve a poner en marcha', () => {
    const terminado = { ...pasta(), estado: 'terminado' as const, restanteSeg: 0, iniciadoEn: null }
    expect(sumar(terminado, 60, seg(900))).toMatchObject({
      estado: 'corriendo',
      restanteSeg: 60,
      iniciadoEn: seg(900),
      duracionSeg: 660
    })
  })

  it('actualizarTemporizadores marca los que llegaron a cero', () => {
    const sesion = {
      temporizadores: [pasta(), crearTemporizador('t2', 'Arroz', 1080, null, T0)]
    } as SesionCocina
    expect(actualizarTemporizadores(sesion, seg(599))).toBe(sesion) // sin cambios: mismo objeto
    const actual = actualizarTemporizadores(sesion, seg(600))
    expect(actual.temporizadores[0]).toMatchObject({
      estado: 'terminado',
      restanteSeg: 0,
      iniciadoEn: null
    })
    expect(actual.temporizadores[1]?.estado).toBe('corriendo')
    expect(sesion.temporizadores[0]?.estado).toBe('corriendo') // no modifica la recibida
  })

  it('genera ids consecutivos', () => {
    expect(siguienteIdTemporizador([])).toBe('t1')
    expect(siguienteIdTemporizador([pasta(), { ...pasta(), id: 't7' }])).toBe('t8')
  })

  it.each([
    [45, '45 segundos'],
    [1, '1 segundo'],
    [60, '1 minuto'],
    [600, '10 minutos'],
    [150, '2 min 30 s'],
    [3600, '1 hora'],
    [7200, '2 horas'],
    [3900, '1 h 5 min']
  ])('formatearDuracion(%i) = %s', (segundos, texto) => {
    expect(formatearDuracion(segundos)).toBe(texto)
  })
})

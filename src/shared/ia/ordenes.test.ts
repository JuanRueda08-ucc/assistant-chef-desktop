import { describe, expect, it } from 'vitest'
import { crearTemporizador } from '../cocina/temporizadores'
import { ARGUMENTOS } from './herramientas'
import { FRASES_ORDENES, interpretarOrden, resolverTemporizador } from './ordenes'

describe('interpretarOrden', () => {
  it.each([
    'siguiente',
    'listo',
    ' ¡Chef, SIGUIENTE! ',
    'chef listo',
    'ya está',
    'ya terminé',
    'hecho',
    'paso completado'
  ])('%s confirma solo este avance', (texto) => {
    expect(interpretarOrden(texto)).toEqual({
      nombre: 'avanzar_paso',
      argumentos: {},
      confirmado: true
    })
  })
  it.each([
    'no estoy listo',
    'no he terminado',
    'todavía no está hecho',
    'no he completado este paso',
    'siguiente receta',
    'chef no avances',
    'repite y siguiente',
    '',
    '[unk]'
  ])('ignora %s', (texto) => {
    expect(interpretarOrden(texto)).toBeNull()
  })
  it('resuelve atrás sin confirmar y repetir/activar sin herramientas', () => {
    expect(interpretarOrden('atrás')).toEqual({
      nombre: 'retroceder_paso',
      argumentos: {},
      confirmado: false
    })
    expect(interpretarOrden('repite')).toEqual({ local: 'repetir' })
    expect(interpretarOrden('chef')).toEqual({ local: 'activar' })
  })
  it('toda la gramática tiene interpretación', () => {
    for (const frase of FRASES_ORDENES) expect(interpretarOrden(frase)).not.toBeNull()
  })
  it.each([
    ['pausa', 'pausar'],
    ['reanuda', 'reanudar'],
    ['para el temporizador', 'cancelar']
  ])('interpreta %s sin inventar id', (texto, accion) => {
    expect(interpretarOrden(texto)).toEqual({ local: 'temporizador', accion })
  })
})

describe('resolverTemporizador', () => {
  const pasta = crearTemporizador('t1', 'Pasta', 60, null, 0)
  it('genera argumentos válidos para un único candidato', () => {
    const llamada = resolverTemporizador('pausar', [pasta], 1_000)
    expect(llamada).toEqual({
      nombre: 'controlar_temporizador',
      argumentos: { id: 't1', accion: 'pausar' },
      confirmado: false
    })
    expect(ARGUMENTOS.controlar_temporizador.safeParse(llamada?.argumentos).success).toBe(true)
  })
  it('no elige entre varios ni actúa sobre estados incompatibles', () => {
    expect(resolverTemporizador('pausar', [], 0)).toBeNull()
    expect(resolverTemporizador('pausar', [pasta, { ...pasta, id: 't2' }], 0)).toBeNull()
    expect(resolverTemporizador('pausar', [pasta], 60_000)).toBeNull()
    expect(resolverTemporizador('reanudar', [pasta], 0)).toBeNull()
    expect(resolverTemporizador('cancelar', [{ ...pasta, estado: 'cancelado' }], 0)).toBeNull()
    expect(resolverTemporizador('reanudar', [{ ...pasta, estado: 'pausado' }], 0)?.nombre).toBe(
      'controlar_temporizador'
    )
  })
})

import { describe, expect, it } from 'vitest'
import { poseDe } from './avatar'

describe('poseDe', () => {
  it('traduce cada estado del avatar a una pose', () => {
    expect(poseDe({ accion: 'hablar' })).toBe('hablando')
    expect(poseDe({ accion: 'esperar' })).toBe('esperando')
    expect(poseDe({ accion: 'senalar', objetivo: 'temporizadores' })).toBe('arriba')
    expect(poseDe({ accion: 'senalar', objetivo: 'ingredientes' })).toBe('izquierda')
    expect(poseDe({ accion: 'senalar', objetivo: 'panel' })).toBe('izquierda')
    expect(poseDe({ accion: 'celebrar', intensidad: 'breve' })).toBe('celebracionLeve')
    expect(poseDe({ accion: 'celebrar', intensidad: 'completa' })).toBe('celebracionFinal')
  })

  it('mientras escucha, escucha', () => {
    expect(poseDe({ accion: 'hablar' }, true)).toBe('escuchando')
  })
})

import { describe, expect, it } from 'vitest'
import { TurnoConsulta } from './turno'

const pcm = (ms: number, valor = 5000): ArrayBuffer => new Int16Array(ms * 16).fill(valor).buffer

describe('fin de consulta sin gramática de órdenes', () => {
  it('tolera pausas cortas y termina tras 900 ms de silencio', () => {
    const turno = new TurnoConsulta()
    expect(turno.agregar(pcm(300))).toBe(false)
    expect(turno.agregar(pcm(600, 0))).toBe(false)
    expect(turno.agregar(pcm(200))).toBe(false)
    expect(turno.agregar(pcm(800, 0))).toBe(false)
    expect(turno.agregar(pcm(100, 0))).toBe(true)
    expect(turno.tieneHabla).toBe(true)
  })
  it('no envía silencio ni un golpe breve, y acota los bytes de PCM', () => {
    const turno = new TurnoConsulta()
    turno.agregar(pcm(100))
    expect(turno.agregar(pcm(8000, 0))).toBe(true)
    expect(turno.tieneHabla).toBe(false)
    expect(turno.audio.reduce((total, a) => total + a.byteLength, 0)).toBe(256000)
    turno.agregar(pcm(1000))
    expect(turno.audio.reduce((total, a) => total + a.byteLength, 0)).toBe(256000)
  })
})

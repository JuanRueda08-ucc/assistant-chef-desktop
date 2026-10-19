import { describe, expect, it } from 'vitest'
import { aBase64, amplitud, aPcm16 } from './pcm'

describe('PCM de voz', () => {
  it('convierte y limita a signed PCM16 LE y conserva silencio', () => {
    const pcm = aPcm16(new Float32Array([-2, -1, 0, 1, 2]))
    expect([...new Int16Array(pcm)]).toEqual([-32768, -32768, 0, 32767, 32767])
    expect(amplitud(aPcm16(new Float32Array(1600)))).toBe(0)
    expect(amplitud(aPcm16(new Float32Array([1, -1])))).toBeGreaterThan(0.99)
    expect(aBase64(new Uint8Array([0, 1, 255]).buffer)).toBe('AAH/')
  })
})

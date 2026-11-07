import { describe, expect, it } from 'vitest'
import { pcmAWavBase64 } from './wav'

describe('pcmAWavBase64', () => {
  it('escribe una cabecera WAV de PCM16 mono a 16 kHz seguida del audio', () => {
    const wav = Buffer.from(pcmAWavBase64(new Uint8Array([1, 2, 3, 4]).buffer), 'base64')
    expect(wav.length).toBe(48)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(16000)
    expect(wav.readUInt32LE(40)).toBe(4)
    expect([...wav.subarray(44)]).toEqual([1, 2, 3, 4])
  })
})

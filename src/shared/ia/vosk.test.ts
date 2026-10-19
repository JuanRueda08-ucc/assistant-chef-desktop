import { describe, expect, it } from 'vitest'
import { resultadoVosk } from './vosk'

describe('resultadoVosk', () => {
  it('usa la palabra menos segura y no da confianza a texto sin palabras', () => {
    expect(
      resultadoVosk({ text: 'chef siguiente', result: [{ conf: 0.99 }, { conf: 0.6 }] })
    ).toEqual({ texto: 'chef siguiente', confianza: 0.6 })
    expect(resultadoVosk({ text: 'listo' })?.confianza).toBe(0)
  })
  it.each([null, {}, { text: '' }, { partial: 'listo' }, { text: 'listo', result: [{ conf: 2 }] }])(
    'ignora entrada inválida o parcial %j',
    (bruto) => {
      expect(resultadoVosk(bruto)).toBeNull()
    }
  )
})

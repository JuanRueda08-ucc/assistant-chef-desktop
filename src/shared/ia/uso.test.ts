import { describe, expect, it } from 'vitest'
import { avisoUsoChat, esquemaUsoDiario, textoReinicio, type UsoDiario } from './uso'

const grupo = (limite: number, usadas: number): UsoDiario['grupos']['chat'] => ({
  limite,
  usadas,
  restantes: Math.max(0, limite - usadas)
})
const uso = (chatUsadas: number): UsoDiario => ({
  grupos: {
    chat: grupo(120, chatUsadas),
    voz: grupo(40, 0),
    recetas: grupo(20, 0),
    sustituciones: grupo(60, 0),
    imagenes: grupo(20, 0)
  },
  reinicioEn: 1_000_000
})

describe('uso diario', () => {
  it('valida la respuesta del backend', () => {
    expect(esquemaUsoDiario.parse(uso(3))).toEqual(uso(3))
    expect(esquemaUsoDiario.safeParse({ ...uso(3), grupos: {} }).success).toBe(false)
  })

  it('avisa en el chat solo cuando quedan pocos mensajes', () => {
    expect(avisoUsoChat(null)).toBeNull()
    expect(avisoUsoChat(uso(100))).toBeNull()
    expect(avisoUsoChat(uso(110))).toBe('Te quedan 10 mensajes del chef hoy.')
    expect(avisoUsoChat(uso(119))).toBe('Te queda 1 mensaje del chef hoy.')
    expect(avisoUsoChat(uso(130))).toBe(
      'Ya usaste todos los mensajes del chef de hoy. Los botones siguen disponibles.'
    )
  })

  it('dice cuándo se renuevan', () => {
    expect(textoReinicio(3_600_000 * 5, 0)).toBe('Se renuevan en 5 h')
    expect(textoReinicio(40 * 60_000, 0)).toBe('Se renuevan en 40 min')
    expect(textoReinicio(0, 10)).toBe('Se renuevan en 1 min')
  })
})

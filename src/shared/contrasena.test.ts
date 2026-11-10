import { describe, expect, it } from 'vitest'
import { faltasContrasena, mensajeContrasena } from './contrasena'

describe('contraseña', () => {
  it('acepta una contraseña con todo', () => {
    expect(faltasContrasena('Cocina#2026')).toEqual([])
    expect(mensajeContrasena('Cocina#2026')).toBeNull()
  })

  it('dice exactamente lo que falta', () => {
    expect(faltasContrasena('cocina2026')).toEqual(['mayuscula', 'simbolo'])
    expect(mensajeContrasena('cocina2026')).toBe(
      'A tu contraseña le falta: una letra mayúscula (A-Z) y un símbolo, como ! @ # $ % o *.'
    )
    expect(mensajeContrasena('Cocina2026')).toBe(
      'A tu contraseña le falta: un símbolo, como ! @ # $ % o *.'
    )
  })

  it('cuenta el largo y todo lo demás en una contraseña vacía', () => {
    expect(faltasContrasena('')).toEqual(['largo', 'minuscula', 'mayuscula', 'numero', 'simbolo'])
  })

  it('usa los mismos símbolos que Supabase y no cuenta letras con tilde como mayúsculas', () => {
    expect(faltasContrasena('Cocina_2026')).toEqual([])
    expect(faltasContrasena('cocinÁ#2026')).toEqual(['mayuscula'])
    expect(faltasContrasena('Cocina 2026')).toEqual(['simbolo'])
  })
})

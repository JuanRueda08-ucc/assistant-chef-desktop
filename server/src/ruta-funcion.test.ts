import { describe, expect, it } from 'vitest'
import { rutaSinFuncion } from './ruta-funcion'

describe('ruta dentro de la Edge Function', () => {
  it('quita el nombre de la función y conserva la ruta del backend', () => {
    expect(rutaSinFuncion('https://p.supabase.co/chef/chat')).toBe('https://p.supabase.co/chat')
    expect(rutaSinFuncion('https://p.supabase.co/functions/v1/chef/voz/token')).toBe(
      'https://p.supabase.co/voz/token'
    )
    expect(rutaSinFuncion('https://p.supabase.co/chef')).toBe('https://p.supabase.co/')
    expect(rutaSinFuncion('https://p.supabase.co/chefsito/chat')).toBe(
      'https://p.supabase.co/chefsito/chat'
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  type DespensaTurno,
  cambiosDelTurno,
  etiquetasVigentes,
  hayCambios,
  SIN_CAMBIOS,
  textoFaltan
} from './conversacion'

const despensa = (ingredientes: string[], libres: string[] = [], porciones = 4): DespensaTurno => ({
  ingredientes,
  ingredientesSinIdentificar: libres,
  porciones
})

describe('cambiosDelTurno', () => {
  it('devuelve solo lo añadido en el turno', () => {
    const c = cambiosDelTurno(
      despensa(['sal', 'pollo']),
      despensa(['sal', 'pollo', 'arroz'], ['ají dulce'], 2)
    )
    expect(c).toEqual({ ingredientes: ['arroz'], sinIdentificar: ['ají dulce'], porciones: 2 })
    expect(hayCambios(c)).toBe(true)
  })

  it('no cuenta lo quitado ni porciones iguales', () => {
    const c = cambiosDelTurno(despensa(['pollo', 'arroz']), despensa(['pollo']))
    expect(c).toEqual(SIN_CAMBIOS)
    expect(hayCambios(c)).toBe(false)
  })
})

describe('etiquetasVigentes', () => {
  it('oculta lo que ya no está en la despensa', () => {
    const c = { ingredientes: ['pollo', 'arroz'], sinIdentificar: ['ají dulce'], porciones: 2 }
    expect(etiquetasVigentes(c, despensa(['arroz']))).toEqual({
      ingredientes: ['arroz'],
      sinIdentificar: [],
      porciones: 2
    })
  })
})

describe('textoFaltan', () => {
  it('usa singular, plural y «Tienes todo»', () => {
    expect(textoFaltan(0)).toBe('Tienes todo')
    expect(textoFaltan(1)).toBe('Te falta 1')
    expect(textoFaltan(3)).toBe('Te faltan 3')
  })
})

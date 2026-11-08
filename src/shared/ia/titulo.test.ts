import { describe, expect, it } from 'vitest'
import { esquemaPeticionTitulo, LARGO_MAX_TITULO, limpiarTitulo, tituloProvisional } from './titulo'

describe('limpiarTitulo', () => {
  it('quita comillas, prefijos, signos y el punto final', () => {
    expect(limpiarTitulo('Título: «Arroz con pollo para 2».')).toBe('Arroz con pollo para 2')
    expect(limpiarTitulo('**pasta rápida**\nOtra línea')).toBe('Pasta rápida')
    expect(limpiarTitulo('  ¿Algo rápido para 2?  ')).toBe('Algo rápido para 2')
  })

  it('corta en una palabra entera sin dejar «y» o «con» al final', () => {
    const t = limpiarTitulo(
      'Tengo pollo, arroz, cebolla y tomate y quiero algo rápido para cenar con mi familia'
    )
    expect(t!.length).toBeLessThanOrEqual(LARGO_MAX_TITULO)
    expect(t).toBe('Tengo pollo, arroz, cebolla y tomate')
  })

  it('devuelve null si no queda nada', () => {
    expect(limpiarTitulo('  "" ')).toBeNull()
    expect(tituloProvisional('¿?')).toBe('Conversación con el chef')
  })
})

describe('esquemaPeticionTitulo', () => {
  it('exige la pregunta y limita los largos', () => {
    expect(esquemaPeticionTitulo.safeParse({ pregunta: ' ', respuesta: '' }).success).toBe(false)
    expect(
      esquemaPeticionTitulo.safeParse({ pregunta: 'hola', respuesta: 'x'.repeat(4001) }).success
    ).toBe(false)
    expect(esquemaPeticionTitulo.safeParse({ pregunta: 'hola', respuesta: '' }).success).toBe(true)
  })
})

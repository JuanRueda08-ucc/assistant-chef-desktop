import { describe, expect, it } from 'vitest'
import { banco, post } from './fixtures.test-utils'

describe('POST /voz/narrar', () => {
  it('falso no usa red y permite el respaldo local', async () => {
    const r = await banco().manejar(post('/voz/narrar', { texto: 'Pica la cebolla.' }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ audio: null })
  })
  it('rechaza texto vacío o instrucciones fuera del contrato antes del proveedor', async () => {
    expect((await banco().manejar(post('/voz/narrar', { texto: '' }))).status).toBe(400)
    expect(
      (await banco().manejar(post('/voz/narrar', { texto: 'hola', apiKey: 'no' }))).status
    ).toBe(400)
  })
})

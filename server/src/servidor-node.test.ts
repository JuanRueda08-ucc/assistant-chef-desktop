import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { banco, cuerpoReceta, INSTALACION } from './fixtures.test-utils'
import { iniciarServidor, MAX_CUERPO_BYTES } from './servidor-node'

let servidor: Server
let url: string

beforeAll(async () => {
  ;({ servidor, url } = await iniciarServidor(banco().manejar, 0))
})

afterAll(() => {
  servidor.close()
})

describe('servidor HTTP de Node', () => {
  it('responde las tres rutas en local con el proveedor falso', async () => {
    const pedir = (ruta: string, cuerpo: unknown): Promise<Response> =>
      fetch(url + ruta, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-instalacion': INSTALACION },
        body: JSON.stringify(cuerpo)
      })
    expect((await pedir('/voz/token', {})).status).toBe(200)
    const receta = await pedir('/recetas/generar', cuerpoReceta())
    expect(receta.status).toBe(200)
    expect((await receta.json()).receta.origen).toBe('generada')
    const { catalogo } = cuerpoReceta()
    const sustitucion = await pedir('/sustituciones/sugerir', {
      ingredienteId: 'cebolla',
      preferencias: {},
      catalogo
    })
    expect(sustitucion.status).toBe(200)
    expect(Array.isArray((await sustitucion.json()).sustituciones)).toBe(true)
  })

  it('rechaza cuerpos demasiado grandes', async () => {
    const r = await fetch(url + '/recetas/generar', {
      method: 'POST',
      headers: { 'x-instalacion': INSTALACION },
      body: 'x'.repeat(MAX_CUERPO_BYTES + 1)
    })
    expect(r.status).toBe(413)
  })
})

// Adaptador para ejecutar el backend con el servidor HTTP de Node (desarrollo local y tests).
// En una plataforma serverless se exporta directamente el manejador de `crearApp`.

import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/** Cuerpos más grandes se rechazan con 413 (un catálogo de miles de ingredientes cabe de sobra). */
export const MAX_CUERPO_BYTES = 2 * 1024 * 1024

async function leerCuerpo(req: IncomingMessage): Promise<Buffer | null> {
  const partes: Buffer[] = []
  let total = 0
  for await (const parte of req) {
    const trozo = parte as Buffer
    total += trozo.length
    if (total > MAX_CUERPO_BYTES) return null
    partes.push(trozo)
  }
  return Buffer.concat(partes)
}

export function iniciarServidor(
  manejar: (peticion: Request) => Promise<Response>,
  puerto: number,
  host = '127.0.0.1'
): Promise<{ servidor: Server; url: string }> {
  const servidor = createServer(async (req, res) => {
    const cuerpo = await leerCuerpo(req)
    if (cuerpo === null) {
      res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          error: { codigo: 'peticion_invalida', mensaje: 'Cuerpo demasiado grande.' }
        })
      )
      return
    }
    const cabeceras = new Headers()
    for (const [nombre, valor] of Object.entries(req.headers)) {
      if (typeof valor === 'string') cabeceras.set(nombre, valor)
      else if (Array.isArray(valor)) cabeceras.set(nombre, valor.join(', '))
    }
    const metodo = req.method ?? 'GET'
    const peticion = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
      method: metodo,
      headers: cabeceras,
      ...(metodo !== 'GET' && metodo !== 'HEAD' && { body: new Uint8Array(cuerpo) })
    })
    const respuesta = await manejar(peticion)
    res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers))
    res.end(Buffer.from(await respuesta.arrayBuffer()))
  })
  return new Promise((resolver) => {
    servidor.listen(puerto, host, () => {
      const { port } = servidor.address() as AddressInfo
      resolver({ servidor, url: `http://${host}:${port}` })
    })
  })
}

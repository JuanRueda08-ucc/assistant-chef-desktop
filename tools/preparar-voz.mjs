import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { MODELO, NATIVOS } from './recursos-voz.mjs'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destino = resolve(raiz, 'resources/voz')
const cache = resolve(raiz, '.cache-voz')
const plataforma = process.argv[2] ?? `${process.platform}-${process.arch}`
const nativo = NATIVOS[plataforma]
if (!nativo)
  throw new Error(`Vosk no tiene un binario preparado para ${plataforma}. No se cambia de motor.`)

async function preparar(recurso, salida) {
  await mkdir(cache, { recursive: true })
  const archivo = resolve(cache, recurso.archivo)
  let bytes
  try {
    bytes = await readFile(archivo)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    console.info(`Descargando ${recurso.archivo}…`)
    const respuesta = await fetch(recurso.url, { signal: AbortSignal.timeout(300_000) })
    if (!respuesta.ok) throw new Error(`Descarga Vosk: HTTP ${respuesta.status}`, { cause: error })
    bytes = Buffer.from(await respuesta.arrayBuffer())
    await writeFile(archivo, bytes)
  }
  if (createHash('sha256').update(bytes).digest('hex') !== recurso.sha256) {
    throw new Error(`SHA-256 incorrecto: ${archivo}. Revisa la descarga antes de continuar.`)
  }
  // Solo los archivos del prefijo esperado. Ningún symlink del ZIP se materializa como enlace.
  const entradas = unzipSync(bytes)
  for (const [nombre, contenido] of Object.entries(entradas)) {
    if (!nombre.startsWith(`${recurso.carpeta}/`) || nombre.endsWith('/')) continue
    const ruta = resolve(salida, nombre.slice(recurso.carpeta.length + 1))
    const relativa = relative(salida, ruta)
    if (relativa.startsWith('..') || isAbsolute(relativa))
      throw new Error('Ruta inválida en el archivo Vosk.')
    await mkdir(dirname(ruta), { recursive: true })
    await writeFile(ruta, contenido)
  }
  if (recurso.biblioteca) await readFile(resolve(salida, recurso.biblioteca))
  console.info(`Preparado ${recurso.carpeta}`)
}

await preparar(MODELO, resolve(destino, MODELO.carpeta))
await preparar(nativo, resolve(destino, plataforma))
// Licencias de la biblioteca y del modelo (Apache 2.0); se incluyen con extraResources.
await writeFile(
  resolve(destino, 'LICENCIAS.txt'),
  'Vosk API y vosk-model-small-es-0.42: Apache License 2.0.\nhttps://github.com/alphacep/vosk-api/blob/master/COPYING\nhttps://alphacephei.com/vosk/models\n'
)
await writeFile(
  resolve(destino, 'LICENSE-Vosk.txt'),
  await readFile(resolve(raiz, 'tools/vosk-LICENSE.txt'))
)

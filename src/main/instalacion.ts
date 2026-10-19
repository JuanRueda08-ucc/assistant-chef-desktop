import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const esquemaIdInstalacion = z.uuid()

/** Se conserva al reiniciar; nunca se regenera silenciosamente si el archivo está corrupto. */
export function obtenerIdInstalacion(carpetaDatos: string): string {
  mkdirSync(carpetaDatos, { recursive: true })
  const archivo = join(carpetaDatos, 'instalacion-id')
  try {
    return esquemaIdInstalacion.parse(readFileSync(archivo, 'utf8').trim())
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  const id = randomUUID()
  try {
    writeFileSync(archivo, id, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    return id
  } catch (error) {
    // Otra ventana/proceso pudo crearlo entre la lectura y la escritura exclusiva.
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
    return esquemaIdInstalacion.parse(readFileSync(archivo, 'utf8').trim())
  }
}

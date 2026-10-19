import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { obtenerIdInstalacion } from './instalacion'

const carpetas: string[] = []
afterEach(() => {
  for (const carpeta of carpetas.splice(0)) rmSync(carpeta, { recursive: true, force: true })
})

describe('id de instalación persistente', () => {
  it('genera una vez, conserva al reabrir y separa instalaciones', () => {
    const a = mkdtempSync(join(tmpdir(), 'chef-id-'))
    const b = mkdtempSync(join(tmpdir(), 'chef-id-'))
    carpetas.push(a, b)
    const id = obtenerIdInstalacion(a)
    expect(id).toMatch(/^[a-z0-9-]{36}$/)
    expect(readFileSync(join(a, 'instalacion-id'), 'utf8')).toBe(id)
    expect(obtenerIdInstalacion(a)).toBe(id)
    expect(obtenerIdInstalacion(b)).not.toBe(id)
  })
  it('no reemplaza silenciosamente un archivo inválido', () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'chef-id-'))
    carpetas.push(carpeta)
    writeFileSync(join(carpeta, 'instalacion-id'), 'corrupto')
    expect(() => obtenerIdInstalacion(carpeta)).toThrow()
    expect(readFileSync(join(carpeta, 'instalacion-id'), 'utf8')).toBe('corrupto')
  })
})

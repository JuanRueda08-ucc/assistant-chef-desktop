// Comprueba que las enumeraciones de db/schema.sql coinciden con las de src/shared/types/.
// Si cambias una lista en un lado y no en el otro, este test falla (regla de AGENTS.md).

import { describe, expect, it } from 'vitest'
import esquemaSql from '../../../db/schema.sql?raw'
import {
  CATEGORIAS_INGREDIENTE,
  CONTEXTOS_SUSTITUCION,
  DIFICULTADES,
  ESTADOS_REVISION,
  FUENTES_SUSTITUCION,
  ORIGENES,
  TIPOS_ESCALADO,
  UNIDADES
} from '@shared/types/receta'
import { FASES } from '@shared/types/sesion'

/** Valores de cada `CHECK (columna IN ('a', 'b'))` del esquema, por columna. */
function valoresCheck(sql: string): Map<string, string[][]> {
  const porColumna = new Map<string, string[][]>()
  for (const [, columna, lista] of sql.matchAll(/CHECK \((\w+) IN \(([^)]*)\)\)/g)) {
    if (!columna || lista === undefined || lista.includes('0, 1')) continue
    const valores = [...lista.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '')
    porColumna.set(columna, [...(porColumna.get(columna) ?? []), valores])
  }
  return porColumna
}

describe('db/schema.sql', () => {
  const checks = valoresCheck(esquemaSql)

  it.each([
    ['categoria', CATEGORIAS_INGREDIENTE],
    ['dificultad', DIFICULTADES],
    ['origen', ORIGENES],
    ['estado_revision', ESTADOS_REVISION],
    ['unidad', UNIDADES],
    ['escalado', TIPOS_ESCALADO],
    ['contexto', CONTEXTOS_SUSTITUCION],
    ['fuente', FUENTES_SUSTITUCION],
    ['fase', FASES]
  ])('el CHECK de %s coincide con los tipos', (columna, esperados) => {
    const listas = checks.get(columna)
    expect(listas, `no hay CHECK para ${columna}`).toBeDefined()
    for (const valores of listas ?? []) {
      expect(valores).toEqual([...esperados])
    }
  })
})

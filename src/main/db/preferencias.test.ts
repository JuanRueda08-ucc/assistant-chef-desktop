import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { preferencias } from '@shared/cocina/fixtures.test-utils'
import { abrirBase, type BaseDatos } from './conexion'
import { guardarPreferencias, leerPreferencias } from './preferencias'

let db: BaseDatos
const T0 = Date.UTC(2026, 10, 6)

beforeEach(() => {
  db = abrirBase(':memory:')
})
afterEach(() => db.close())

describe('despensa y preferencias por cuenta', () => {
  it('sin nada guardado devuelve null', () => {
    expect(leerPreferencias(db, 'ana')).toBeNull()
  })

  it('guarda, sustituye y conserva alergias e ingredientes sin identificar', () => {
    const datos = preferencias({
      ingredientes: ['cebolla'],
      ingredientesSinIdentificar: ['Tofu'],
      alergias: ['lacteos']
    })
    guardarPreferencias(db, 'ana', datos, T0)
    expect(leerPreferencias(db, 'ana')).toEqual(datos)
    guardarPreferencias(db, 'ana', { ...datos, ingredientes: [] }, T0 + 1000)
    expect(leerPreferencias(db, 'ana')?.ingredientes).toEqual([])
  })

  it('cada cuenta tiene su propia despensa', () => {
    guardarPreferencias(db, 'ana', preferencias({ ingredientes: ['cebolla'] }), T0)
    guardarPreferencias(db, 'luis', preferencias({ ingredientes: ['ajo'] }), T0)
    expect(leerPreferencias(db, 'ana')?.ingredientes).toEqual(['cebolla'])
    expect(leerPreferencias(db, 'luis')?.ingredientes).toEqual(['ajo'])
  })

  it('rechaza guardar datos inválidos e ignora los guardados con formato antiguo', () => {
    expect(() => guardarPreferencias(db, 'ana', { ...preferencias(), porciones: 0 }, T0)).toThrow()
    db.prepare(
      "INSERT INTO preferencias_usuario VALUES ('vieja', '{\"formato\":1}', '2026-01-01T00:00:00Z')"
    ).run()
    expect(leerPreferencias(db, 'vieja')).toBeNull()
  })
})

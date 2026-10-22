import Database from 'better-sqlite3'
import esquemaSql from '../../../db/schema.sql?raw'

export type BaseDatos = Database.Database

/**
 * Abre (o crea) la base SQLite y aplica db/schema.sql, que es idempotente.
 * `ruta` puede ser ':memory:' para tests.
 */
export function abrirBase(ruta: string): BaseDatos {
  const db = new Database(ruta)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrarSesionesPorUsuario(db)
  db.exec(esquemaSql)
  return db
}

/**
 * Bases creadas antes de las cuentas (0016): añade `usuario_id` y quita el índice de una sola
 * sesión cocinando, que schema.sql sustituye por uno por cuenta. Idempotente.
 */
function migrarSesionesPorUsuario(db: BaseDatos): void {
  const columnas = db.prepare("SELECT name FROM pragma_table_info('sesiones')").all() as {
    name: string
  }[]
  if (columnas.length === 0 || columnas.some((c) => c.name === 'usuario_id')) return
  db.exec(`ALTER TABLE sesiones ADD COLUMN usuario_id TEXT;
    DROP INDEX IF EXISTS sesiones_una_cocinando;`)
}

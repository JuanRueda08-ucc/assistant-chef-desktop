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
  db.exec(esquemaSql)
  return db
}

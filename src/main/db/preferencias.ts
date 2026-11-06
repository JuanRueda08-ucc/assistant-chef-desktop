import { esquemaPreferencias } from '@shared/esquemas/sesion'
import type { Preferencias } from '@shared/types/sesion'
import type { BaseDatos } from './conexion'

/** Despensa, preferencias y alergias guardadas de la cuenta (decisión 0019), o `null`. */
export function leerPreferencias(db: BaseDatos, usuarioId: string): Preferencias | null {
  const fila = db
    .prepare('SELECT datos FROM preferencias_usuario WHERE usuario_id = ?')
    .get(usuarioId) as { datos: string } | undefined
  if (!fila) return null
  // Si el formato ya no es válido se empieza de cero en vez de impedir que la app arranque.
  const datos = esquemaPreferencias.safeParse(JSON.parse(fila.datos))
  return datos.success ? datos.data : null
}

export function guardarPreferencias(
  db: BaseDatos,
  usuarioId: string,
  preferencias: Preferencias,
  ahora: number
): void {
  const validas = esquemaPreferencias.parse(preferencias)
  db.prepare(
    `INSERT INTO preferencias_usuario (usuario_id, datos, actualizada_en)
       VALUES (@usuarioId, @datos, @actualizadaEn)
     ON CONFLICT (usuario_id) DO UPDATE SET datos = excluded.datos,
       actualizada_en = excluded.actualizada_en`
  ).run({
    usuarioId,
    datos: JSON.stringify(validas),
    actualizadaEn: new Date(ahora).toISOString()
  })
}

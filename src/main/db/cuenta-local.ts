// Lo que una cuenta deja en este equipo (despensa, receta en curso y recetas aún sin subir). Se
// borra al borrar la cuenta (0026); el resto de sus datos estaba en Supabase.

import type { BaseDatos } from './conexion'

export function borrarDatosDeCuenta(db: BaseDatos, usuarioId: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM preferencias_usuario WHERE usuario_id = ?').run(usuarioId)
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuarioId)
    db.prepare('DELETE FROM recetas_usuario WHERE usuario_id = ?').run(usuarioId)
  })()
}

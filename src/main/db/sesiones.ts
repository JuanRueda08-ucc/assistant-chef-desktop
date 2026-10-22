import { esquemaSesionCocina } from '@shared/esquemas/sesion'
import type { SesionCocina } from '@shared/types/sesion'
import type { BaseDatos } from './conexion'

interface FilaSesion {
  datos: string
}

/**
 * Guarda la sesión completa (la valida antes) a nombre de la cuenta. Se llama en cada cambio.
 * Una sesión nunca cambia de cuenta: si el id ya es de otra, no se toca.
 */
export function guardarSesion(db: BaseDatos, sesion: SesionCocina, usuarioId: string): void {
  const valida = esquemaSesionCocina.parse(sesion)
  db.prepare(
    `INSERT INTO sesiones (id, usuario_id, fase, datos, actualizada_en)
       VALUES (@id, @usuarioId, @fase, @datos, @actualizadaEn)
     ON CONFLICT (id) DO UPDATE SET fase = excluded.fase, datos = excluded.datos,
       actualizada_en = excluded.actualizada_en
     WHERE sesiones.usuario_id = excluded.usuario_id`
  ).run({
    id: valida.id,
    usuarioId,
    fase: valida.fase,
    datos: JSON.stringify(valida),
    actualizadaEn: valida.actualizadaEn
  })
}

export function obtenerSesion(db: BaseDatos, id: string, usuarioId: string): SesionCocina | null {
  const fila = db
    .prepare('SELECT datos FROM sesiones WHERE id = ? AND usuario_id = ?')
    .get(id, usuarioId) as FilaSesion | undefined
  return fila ? esquemaSesionCocina.parse(JSON.parse(fila.datos)) : null
}

/** La sesión de la cuenta en fase `cocinar` (solo puede haber una por cuenta), o `null`. */
export function obtenerSesionCocinando(db: BaseDatos, usuarioId: string): SesionCocina | null {
  const fila = db
    .prepare("SELECT datos FROM sesiones WHERE fase = 'cocinar' AND usuario_id = ?")
    .get(usuarioId) as FilaSesion | undefined
  return fila ? esquemaSesionCocina.parse(JSON.parse(fila.datos)) : null
}

/** Borra la sesión de la cuenta en fase `cocinar`, si hay (al empezar otra receta). */
export function descartarSesionCocinando(db: BaseDatos, usuarioId: string): void {
  db.prepare("DELETE FROM sesiones WHERE fase = 'cocinar' AND usuario_id = ?").run(usuarioId)
}

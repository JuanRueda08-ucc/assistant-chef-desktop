import { esquemaSesionCocina } from '@shared/esquemas/sesion'
import type { SesionCocina } from '@shared/types/sesion'
import type { BaseDatos } from './conexion'

interface FilaSesion {
  datos: string
}

/** Guarda la sesión completa (la valida antes). Se llama en cada cambio. */
export function guardarSesion(db: BaseDatos, sesion: SesionCocina): void {
  const valida = esquemaSesionCocina.parse(sesion)
  db.prepare(
    `INSERT INTO sesiones (id, fase, datos, actualizada_en) VALUES (@id, @fase, @datos, @actualizadaEn)
     ON CONFLICT (id) DO UPDATE SET fase = excluded.fase, datos = excluded.datos,
       actualizada_en = excluded.actualizada_en`
  ).run({
    id: valida.id,
    fase: valida.fase,
    datos: JSON.stringify(valida),
    actualizadaEn: valida.actualizadaEn
  })
}

export function obtenerSesion(db: BaseDatos, id: string): SesionCocina | null {
  const fila = db.prepare('SELECT datos FROM sesiones WHERE id = ?').get(id) as
    FilaSesion | undefined
  return fila ? esquemaSesionCocina.parse(JSON.parse(fila.datos)) : null
}

/** La sesión en fase `cocinar` (solo puede haber una), o `null`. */
export function obtenerSesionCocinando(db: BaseDatos): SesionCocina | null {
  const fila = db.prepare("SELECT datos FROM sesiones WHERE fase = 'cocinar'").get() as
    FilaSesion | undefined
  return fila ? esquemaSesionCocina.parse(JSON.parse(fila.datos)) : null
}

/** Borra la sesión en fase `cocinar`, si hay (al empezar otra receta). */
export function descartarSesionCocinando(db: BaseDatos): void {
  db.prepare("DELETE FROM sesiones WHERE fase = 'cocinar'").run()
}

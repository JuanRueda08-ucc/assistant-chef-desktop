// Sesión de cocina en el proceso principal: crear, retomar y aplicar herramientas, guardando
// en SQLite después de cada cambio. La lógica vive en src/shared/cocina/; aquí solo se cargan
// los datos de la base y se persiste.

import { randomUUID } from 'crypto'
import { aplicarHerramienta, type ContextoCocina } from '@shared/cocina/aplicar'
import { crearSesionCocina } from '@shared/cocina/sesion'
import { actualizarTemporizadores } from '@shared/cocina/temporizadores'
import type { AplicacionHerramienta, LlamadaHerramienta } from '@shared/ia/herramientas'
import type { DatosIniciarCocina } from '@shared/types/ipc'
import type { SesionCocina } from '@shared/types/sesion'
import { listarIngredientes, listarSustituciones, listarTecnicas } from './db/catalogo'
import type { BaseDatos } from './db/conexion'
import { obtenerReceta } from './db/recetas'
import { descartarSesionCocinando, guardarSesion, obtenerSesionCocinando } from './db/sesiones'

/**
 * Empieza a cocinar una receta. Si había otra sesión cocinando, se descarta (solo puede haber
 * una). Devuelve la sesión nueva, ya guardada.
 */
export function iniciarCocina(
  db: BaseDatos,
  datos: DatosIniciarCocina,
  ahora: number,
  id: string = randomUUID()
): SesionCocina {
  const receta = obtenerReceta(db, datos.recetaId)
  if (!receta) throw new Error(`no existe la receta ${datos.recetaId}`)
  const sesion = crearSesionCocina({
    id,
    preferencias: datos.preferencias,
    receta,
    porciones: datos.porciones,
    catalogo: listarIngredientes(db),
    ahora
  })
  db.transaction(() => {
    descartarSesionCocinando(db)
    guardarSesion(db, sesion)
  })()
  return sesion
}

/**
 * La sesión que estaba cocinando al cerrar la app, con los temporizadores puestos al día con el
 * reloj (los que acabaron mientras tanto quedan como terminados). `null` si no hay ninguna.
 */
export function retomarCocina(db: BaseDatos, ahora: number): SesionCocina | null {
  const guardada = obtenerSesionCocinando(db)
  if (!guardada) return null
  const actual = actualizarTemporizadores(guardada, ahora)
  if (actual !== guardada) guardarSesion(db, actual)
  return actual
}

/**
 * Aplica una herramienta a la sesión que está cocinando y guarda el resultado si tuvo efecto.
 * Lanza un error si no hay ninguna sesión cocinando.
 */
export function aplicarEnCocina(
  db: BaseDatos,
  llamada: LlamadaHerramienta,
  ahora: number
): AplicacionHerramienta {
  const sesion = obtenerSesionCocinando(db)
  if (!sesion) throw new Error('no hay ninguna sesión de cocina activa')
  const aplicacion = aplicarHerramienta(sesion, llamada, ahora, contextoDe(db, sesion))
  if (aplicacion.resultado.ok) guardarSesion(db, aplicacion.sesion)
  return aplicacion
}

function contextoDe(db: BaseDatos, sesion: SesionCocina): ContextoCocina {
  const receta = sesion.recetaId === null ? null : obtenerReceta(db, sesion.recetaId)
  if (!receta) throw new Error(`la receta de la sesión ${sesion.id} ya no existe`)
  return {
    receta,
    catalogo: listarIngredientes(db),
    sustituciones: listarSustituciones(db),
    tecnicas: listarTecnicas(db)
  }
}

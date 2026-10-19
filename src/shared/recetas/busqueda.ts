// Elegir recetas: filtros duros, puntuación por cobertura y panel "qué falta"
// (docs/modelo-recetas.md, "Elegir recetas").

import type {
  Descarte,
  Faltante,
  MotivoDescarte,
  OpcionSustitucion,
  ResultadoBusqueda,
  ResultadoReceta
} from '../types/busqueda'
import { DIFICULTADES, type Ingrediente, type Receta, type Sustitucion } from '../types/receta'
import type { Preferencias } from '../types/sesion'
import { comoMapa, dietasIncompatiblesDe, type Catalogo } from './etiquetas'
import { limpiar } from './redondeo'
import { resumirReceta } from './resumen'

/** Lo que resta a la puntuación cada faltante no opcional. */
export const PENALIZACION_FALTANTE = 0.1
/** Lo que devuelve a la puntuación cada faltante que se puede sustituir con lo que hay. */
export const BONUS_SUSTITUCION = 0.05
/** Si ninguna receta llega a esta `coberturaConSustituciones`, conviene ofrecer una generada. */
export const UMBRAL_COBERTURA = 0.6

/**
 * Busca recetas para las preferencias del usuario.
 *
 * Filtros duros (una receta que no los pasa va a `descartadas` con todos sus motivos):
 * `estadoRevision = revisada`; la receta cumple todas las `restricciones` (sus `dietas` derivadas);
 * no tiene ningún alérgeno de `alergias`; todo su `equipo` está en el del usuario (lista vacía =
 * sin filtro); `tiempoTotalMin ≤ tiempoMaxMin` (si hay); `dificultad ≤ nivel` (si hay).
 *
 * Puntuación: `cobertura − PENALIZACION_FALTANTE × faltantes + BONUS_SUSTITUCION × faltantes con
 * sustitución`. Los básicos de despensa cuentan como presentes y los opcionales no cuentan.
 * Empates: menos faltantes, menos tiempo total, título.
 *
 * Las recetas deben llevar `dietas` y `alergenos` ya derivados del catálogo.
 */
export function buscarRecetas(
  preferencias: Preferencias,
  recetas: readonly Receta[],
  catalogo: Catalogo,
  sustituciones: readonly Sustitucion[]
): ResultadoBusqueda {
  const porId = comoMapa(catalogo)
  const disponibles = new Set(preferencias.ingredientes)
  const tiene = (ingredienteId: string): boolean =>
    disponibles.has(ingredienteId) || porId.get(ingredienteId)?.esBasicoDespensa === true

  const resultados: ResultadoReceta[] = []
  const descartadas: Descarte[] = []

  for (const receta of recetas) {
    const motivos = motivosDescarte(receta, preferencias)
    if (motivos.length > 0) {
      descartadas.push({ recetaId: receta.id, motivos })
      continue
    }
    resultados.push(puntuar(receta, preferencias, porId, sustituciones, tiene))
  }

  resultados.sort(
    (a, b) =>
      b.puntuacion - a.puntuacion ||
      a.faltantes.length - b.faltantes.length ||
      a.receta.tiempoTotalMin - b.receta.tiempoTotalMin ||
      a.receta.titulo.localeCompare(b.receta.titulo, 'es')
  )

  return {
    resultados,
    descartadas,
    ofrecerGenerada: !resultados.some((r) => r.coberturaConSustituciones >= UMBRAL_COBERTURA)
  }
}

export function motivosDescarte(receta: Receta, preferencias: Preferencias): MotivoDescarte[] {
  const motivos: MotivoDescarte[] = []
  if (receta.estadoRevision !== 'revisada') motivos.push('no_revisada')
  if (!preferencias.restricciones.every((d) => receta.dietas.includes(d))) {
    motivos.push('restriccion')
  }
  if (receta.alergenos.some((a) => preferencias.alergias.includes(a))) motivos.push('alergia')
  if (
    preferencias.equipo.length > 0 &&
    !receta.equipo.every((e) => preferencias.equipo.includes(e))
  ) {
    motivos.push('equipo')
  }
  if (preferencias.tiempoMaxMin !== null && receta.tiempoTotalMin > preferencias.tiempoMaxMin) {
    motivos.push('tiempo')
  }
  if (
    preferencias.nivel !== null &&
    DIFICULTADES.indexOf(receta.dificultad) > DIFICULTADES.indexOf(preferencias.nivel)
  ) {
    motivos.push('nivel')
  }
  return motivos
}

function puntuar(
  receta: Receta,
  preferencias: Preferencias,
  porId: ReadonlyMap<string, Ingrediente>,
  sustituciones: readonly Sustitucion[],
  tiene: (ingredienteId: string) => boolean
): ResultadoReceta {
  const nombre = (id: string): string => porId.get(id)?.nombre ?? id
  // Un mismo ingrediente puede aparecer dos veces en la receta: cuenta una sola vez, y es
  // obligatorio si alguna de sus apariciones no es opcional.
  const obligatorios = new Set(
    receta.ingredientes.filter((ir) => !ir.opcional).map((ir) => ir.ingredienteId)
  )
  const opcionales = new Set(
    receta.ingredientes
      .filter((ir) => ir.opcional && !obligatorios.has(ir.ingredienteId))
      .map((ir) => ir.ingredienteId)
  )

  const faltantes: Faltante[] = [...obligatorios]
    .filter((id) => !tiene(id))
    .map((id) => ({
      ingredienteId: id,
      nombre: nombre(id),
      sustituciones: opcionesPara(id, receta.id, preferencias, porId, sustituciones, tiene)
    }))

  const total = obligatorios.size
  const sustituibles = faltantes.filter((f) => f.sustituciones.length > 0).length
  const cobertura = total === 0 ? 1 : (total - faltantes.length) / total
  const coberturaConSustituciones =
    total === 0 ? 1 : (total - faltantes.length + sustituibles) / total

  return {
    receta: resumirReceta(receta),
    cobertura: limpiar(cobertura),
    coberturaConSustituciones: limpiar(coberturaConSustituciones),
    puntuacion: limpiar(
      cobertura - PENALIZACION_FALTANTE * faltantes.length + BONUS_SUSTITUCION * sustituibles
    ),
    faltantes,
    opcionalesFaltantes: [...opcionales]
      .filter((id) => !tiene(id))
      .map((id) => ({ ingredienteId: id, nombre: nombre(id) }))
  }
}

/**
 * Sustituciones para un faltante: de la receta o generales, cuyo destino el usuario tiene y no
 * rompe sus restricciones ni alergias. El `contexto` (horneado, salteado) no se comprueba aquí.
 */
function opcionesPara(
  ingredienteId: string,
  recetaId: string,
  preferencias: Preferencias,
  porId: ReadonlyMap<string, Ingrediente>,
  sustituciones: readonly Sustitucion[],
  tiene: (ingredienteId: string) => boolean
): OpcionSustitucion[] {
  return sustituciones
    .filter(
      (s) =>
        s.ingredienteOrigenId === ingredienteId &&
        (s.recetaId === null || s.recetaId === recetaId) &&
        tiene(s.ingredienteDestinoId) &&
        respetaPreferencias(porId.get(s.ingredienteDestinoId), preferencias)
    )
    .map((s) => ({
      sustitucionId: s.id,
      ingredienteDestinoId: s.ingredienteDestinoId,
      nombreDestino: porId.get(s.ingredienteDestinoId)?.nombre ?? s.ingredienteDestinoId,
      ratio: s.ratio,
      impacto: s.impacto,
      especifica: s.recetaId !== null
    }))
    .sort((a, b) => Number(b.especifica) - Number(a.especifica))
}

/** Un destino fuera del catálogo no se ofrece: no se puede comprobar que sea seguro. */
function respetaPreferencias(
  destino: Ingrediente | undefined,
  preferencias: Preferencias
): boolean {
  if (!destino) return false
  const incompatibles = dietasIncompatiblesDe(destino)
  return (
    !preferencias.restricciones.some((d) => incompatibles.has(d)) &&
    !destino.alergenos.some((a) => preferencias.alergias.includes(a))
  )
}

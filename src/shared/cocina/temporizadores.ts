// Temporizadores basados en reloj (docs/ia-chef.md, "Estado de sesión"). El restante no se lleva
// con un contador: se calcula con `iniciadoEn` y la hora actual, así sobrevive a cerrar la app.

import type { SesionCocina, Temporizador } from '../types/sesion'

/** Corriendo o pausado: cuenta para el máximo de activos. */
export function estaActivo(t: Temporizador): boolean {
  return t.estado === 'corriendo' || t.estado === 'pausado'
}

/** Segundos que quedan en `ahora` (epoch ms), nunca negativos. */
export function restanteSeg(t: Temporizador, ahora: number): number {
  if (t.estado !== 'corriendo' || t.iniciadoEn === null) return t.restanteSeg
  const transcurridos = Math.max(0, (ahora - t.iniciadoEn) / 1000)
  return Math.max(0, Math.round(t.restanteSeg - transcurridos))
}

/** Nuevo temporizador corriendo desde `ahora`. */
export function crearTemporizador(
  id: string,
  etiqueta: string,
  segundos: number,
  pasoId: string | null,
  ahora: number
): Temporizador {
  return {
    id,
    etiqueta,
    pasoId,
    duracionSeg: segundos,
    estado: 'corriendo',
    iniciadoEn: ahora,
    restanteSeg: segundos
  }
}

export function pausar(t: Temporizador, ahora: number): Temporizador {
  return { ...t, estado: 'pausado', restanteSeg: restanteSeg(t, ahora), iniciadoEn: null }
}

export function reanudar(t: Temporizador, ahora: number): Temporizador {
  return { ...t, estado: 'corriendo', iniciadoEn: ahora }
}

export function cancelar(t: Temporizador, ahora: number): Temporizador {
  return { ...t, estado: 'cancelado', restanteSeg: restanteSeg(t, ahora), iniciadoEn: null }
}

/**
 * Suma segundos. Si estaba terminado vuelve a correr con esos segundos ("dale un minuto más").
 * Si estaba pausado sigue pausado.
 */
export function sumar(t: Temporizador, segundos: number, ahora: number): Temporizador {
  if (t.estado === 'terminado') {
    return {
      ...t,
      estado: 'corriendo',
      duracionSeg: t.duracionSeg + segundos,
      restanteSeg: segundos,
      iniciadoEn: ahora
    }
  }
  if (t.estado === 'corriendo') {
    // Se reinicia el ancla en `ahora` para no perder lo ya transcurrido.
    return {
      ...t,
      duracionSeg: t.duracionSeg + segundos,
      restanteSeg: restanteSeg(t, ahora) + segundos,
      iniciadoEn: ahora
    }
  }
  return { ...t, duracionSeg: t.duracionSeg + segundos, restanteSeg: t.restanteSeg + segundos }
}

/**
 * Marca como terminados los temporizadores que llegaron a cero. Devuelve la misma sesión si
 * nada cambió (para no persistir sin motivo).
 */
export function actualizarTemporizadores(sesion: SesionCocina, ahora: number): SesionCocina {
  let cambio = false
  const temporizadores = sesion.temporizadores.map((t) => {
    if (t.estado !== 'corriendo' || restanteSeg(t, ahora) > 0) return t
    cambio = true
    return { ...t, estado: 'terminado' as const, restanteSeg: 0, iniciadoEn: null }
  })
  return cambio ? { ...sesion, temporizadores } : sesion
}

/** Siguiente id libre: t1, t2… (determinista, sin azar). */
export function siguienteIdTemporizador(temporizadores: readonly Temporizador[]): string {
  const maximo = temporizadores.reduce((max, t) => {
    const n = /^t(\d+)$/.exec(t.id)?.[1]
    return n === undefined ? max : Math.max(max, Number(n))
  }, 0)
  return `t${maximo + 1}`
}

/** "10 minutos", "1 h 5 min", "45 segundos", "2 min 30 s": para mostrar y para `decir`. */
export function formatearDuracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  const h = Math.floor(s / 3600)
  const min = Math.floor((s % 3600) / 60)
  const seg = s % 60
  if (h > 0) return min > 0 ? `${h} h ${min} min` : `${h} ${h === 1 ? 'hora' : 'horas'}`
  if (min > 0) {
    if (seg > 0) return `${min} min ${seg} s`
    return `${min} ${min === 1 ? 'minuto' : 'minutos'}`
  }
  return `${seg} ${seg === 1 ? 'segundo' : 'segundos'}`
}

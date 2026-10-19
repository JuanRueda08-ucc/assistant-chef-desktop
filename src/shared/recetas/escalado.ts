// Adaptar cantidades a otras porciones (docs/modelo-recetas.md, "Adaptar cantidades").
// Solo cambian cantidades: tiempos, pasos y temporizadores no escalan.

import type { IngredienteReceta, Paso, Receta, Unidad } from '../types/receta'
import { PORCIONES_MAX, PORCIONES_MIN } from '../esquemas/sesion'
import { limpiar, redondear } from './redondeo'

/** Exponente del escalado `suave` (sal, especias, levadura). */
export const EXPONENTE_SUAVE = 0.75
/** Por encima o por debajo de estos factores la app avisa. */
export const FACTOR_AVISO_ALTO = 2
export const FACTOR_AVISO_BAJO = 0.5

export interface AvisoEscalado {
  tipo: 'factor_alto' | 'factor_bajo'
  mensaje: string
}

export interface RecetaEscalada {
  /** Copia con las cantidades escaladas y redondeadas; `porcionesBase` pasa a ser `porciones`. */
  receta: Receta
  /** porciones / porcionesBase de la receta original. */
  factor: number
  aviso: AvisoEscalado | null
}

export interface CantidadPaso {
  ingredienteRecetaId: string
  ingredienteId: string
  /** `null` si la unidad es `al_gusto`. */
  cantidad: number | null
  unidad: Unidad
}

/**
 * Escala la receta a `porciones` (entero entre 1 y 20). Escala siempre desde la receta original:
 * no encadenes escalados sobre una receta ya escalada, porque los redondeos se acumulan.
 * No modifica la receta recibida.
 */
export function escalarReceta(receta: Receta, porciones: number): RecetaEscalada {
  if (!Number.isInteger(porciones) || porciones < PORCIONES_MIN || porciones > PORCIONES_MAX) {
    throw new RangeError(
      `porciones debe ser un entero entre ${PORCIONES_MIN} y ${PORCIONES_MAX}: ${porciones}`
    )
  }

  const factor = porciones / receta.porcionesBase
  const copia = structuredClone(receta)
  copia.porcionesBase = porciones
  // Con factor 1 las cantidades quedan tal como se escribieron (sin redondear de nuevo).
  if (factor !== 1) {
    copia.ingredientes = copia.ingredientes.map((ir) => ({
      ...ir,
      cantidad: escalarCantidad(ir, factor)
    }))
  }

  return { receta: copia, factor: limpiar(factor), aviso: avisoEscalado(factor) }
}

/** Cantidad escalada y redondeada de un ingrediente; `null` para `al_gusto`. */
export function escalarCantidad(ir: IngredienteReceta, factor: number): number | null {
  if (ir.unidad === 'al_gusto' || ir.cantidad === null) return null
  // Una pizca es una pizca: no se escala.
  if (ir.unidad === 'pizca' || ir.escalado === 'fijo') return ir.cantidad

  const bruta =
    ir.escalado === 'lineal'
      ? ir.cantidad * factor
      : Math.min(
          Math.max(ir.cantidad * factor ** EXPONENTE_SUAVE, ir.cantidad / 2),
          ir.cantidad * 2
        )
  return redondear(bruta, ir.redondeo ?? 1)
}

/**
 * Cantidades que usa un paso, derivadas de la `fraccion` de cada ingrediente sobre la cantidad
 * de la receta (que ya puede estar escalada). Redondea con el `redondeo` del ingrediente.
 */
export function cantidadesDelPaso(receta: Receta, paso: Paso): CantidadPaso[] {
  return paso.ingredientes.map((ip) => {
    const ir = receta.ingredientes.find((i) => i.id === ip.ingredienteRecetaId)
    if (!ir) {
      throw new Error(
        `el paso ${paso.id} usa un ingrediente inexistente: ${ip.ingredienteRecetaId}`
      )
    }
    const cantidad =
      ir.cantidad === null || ir.unidad === 'al_gusto'
        ? null
        : ip.fraccion === 1
          ? ir.cantidad
          : redondear(ir.cantidad * ip.fraccion, ir.redondeo ?? 1)
    return {
      ingredienteRecetaId: ir.id,
      ingredienteId: ir.ingredienteId,
      cantidad,
      unidad: ir.unidad
    }
  })
}

/** Aviso para un factor de escalado extremo; `null` entre 0,5 y 2. */
export function avisoEscalado(factor: number): AvisoEscalado | null {
  if (factor > FACTOR_AVISO_ALTO) {
    return {
      tipo: 'factor_alto',
      mensaje:
        'Son muchas más porciones que la receta original: puede que necesites una olla más grande o cocinar en tandas.'
    }
  }
  if (factor < FACTOR_AVISO_BAJO) {
    return {
      tipo: 'factor_bajo',
      mensaje:
        'Son muchas menos porciones que la receta original: usa un recipiente más pequeño y vigila que no se pase.'
    }
  }
  return null
}

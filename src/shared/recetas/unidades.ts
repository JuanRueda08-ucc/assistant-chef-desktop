// Conversión de unidades canónicas (g, ml, unidad) a unidades caseras, solo para mostrar.
// La receta siempre se guarda y se calcula en unidades canónicas.

import type { Ingrediente, Unidad } from '../types/receta'
import { limpiar, redondear } from './redondeo'

export const UNIDADES_CASERAS = [
  'g',
  'kg',
  'ml',
  'l',
  'cucharadita',
  'cucharada',
  'taza',
  'unidad',
  'pizca',
  'al_gusto'
] as const
export type UnidadCasera = (typeof UNIDADES_CASERAS)[number]

export interface MedidaCasera {
  /** `null` solo con `al_gusto`. */
  cantidad: number | null
  unidad: UnidadCasera
}

/** Equivalencias en ml. */
export const ML_CUCHARADITA = 5
export const ML_CUCHARADA = 15
export const ML_TAZA = 240

/** Por debajo de esto, contar piezas no tiene sentido (media cebolla sí, un quinto no). */
const UNIDADES_MINIMAS = 0.5

/**
 * Elige la medida casera para mostrar una cantidad canónica:
 * - `g` con `pesoUnidadG` → piezas (de ½ en ½), si salen al menos ½.
 * - `g` con `densidadGMl` → volumen; `g` sin datos → g (kg desde 1000 g).
 * - `ml` → volumen: cucharaditas (< 15 ml, de ¼ en ¼), cucharadas (< 60 ml, de ½ en ½),
 *   tazas (< 1000 ml, de ¼ en ¼) y litros.
 * - `unidad`, `pizca` y `al_gusto` se muestran tal cual.
 */
export function aUnidadCasera(
  cantidad: number | null,
  unidad: Unidad,
  ingrediente: Pick<Ingrediente, 'densidadGMl' | 'pesoUnidadG'>
): MedidaCasera {
  if (unidad === 'al_gusto') return { cantidad: null, unidad: 'al_gusto' }
  if (cantidad === null || !(cantidad > 0)) {
    throw new RangeError(`cantidad no válida para ${unidad}: ${cantidad}`)
  }
  if (unidad === 'unidad' || unidad === 'pizca') return { cantidad, unidad }
  if (unidad === 'ml') return volumen(cantidad)

  if (ingrediente.pesoUnidadG !== null) {
    const piezas = cantidad / ingrediente.pesoUnidadG
    if (piezas >= UNIDADES_MINIMAS) return { cantidad: redondear(piezas, 0.5), unidad: 'unidad' }
  }
  if (ingrediente.densidadGMl !== null) return volumen(cantidad / ingrediente.densidadGMl)
  if (cantidad >= 1000) return { cantidad: limpiar(Math.round(cantidad / 10) / 100), unidad: 'kg' }
  return { cantidad, unidad: 'g' }
}

function volumen(ml: number): MedidaCasera {
  if (ml < ML_CUCHARADA) {
    return { cantidad: redondear(ml / ML_CUCHARADITA, 0.25), unidad: 'cucharadita' }
  }
  if (ml < 4 * ML_CUCHARADA) {
    return { cantidad: redondear(ml / ML_CUCHARADA, 0.5), unidad: 'cucharada' }
  }
  if (ml < 1000) return { cantidad: redondear(ml / ML_TAZA, 0.25), unidad: 'taza' }
  return { cantidad: redondear(ml / 1000, 0.25), unidad: 'l' }
}

const FRACCIONES: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' }

const NOMBRES: Record<UnidadCasera, [singular: string, plural: string]> = {
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  ml: ['ml', 'ml'],
  l: ['l', 'l'],
  cucharadita: ['cucharadita', 'cucharaditas'],
  cucharada: ['cucharada', 'cucharadas'],
  taza: ['taza', 'tazas'],
  unidad: ['', ''],
  pizca: ['pizca', 'pizcas'],
  al_gusto: ['al gusto', 'al gusto']
}

/** Medidas que se leen mejor con fracciones (½ taza) que con decimales (0,5 taza). */
const CON_FRACCIONES = new Set<UnidadCasera>([
  'cucharadita',
  'cucharada',
  'taza',
  'unidad',
  'pizca'
])

/**
 * Texto para la interfaz: "1 ½ tazas", "¼ cucharadita", "800 g", "1,2 kg", "al gusto".
 * Con `unidad` devuelve solo el número ("2"); la interfaz añade el nombre del ingrediente.
 */
export function formatearMedida(medida: MedidaCasera): string {
  if (medida.unidad === 'al_gusto' || medida.cantidad === null) return 'al gusto'
  const [singular, plural] = NOMBRES[medida.unidad]
  const nombre = medida.cantidad > 1 ? plural : singular
  const numero = CON_FRACCIONES.has(medida.unidad)
    ? conFraccion(medida.cantidad)
    : String(limpiar(medida.cantidad)).replace('.', ',')
  return nombre ? `${numero} ${nombre}` : numero
}

function conFraccion(valor: number): string {
  const entero = Math.floor(valor)
  const resto = FRACCIONES[String(limpiar(valor - entero))]
  if (limpiar(valor - entero) === 0) return String(entero)
  if (resto === undefined) return String(limpiar(valor)).replace('.', ',')
  return entero === 0 ? resto : `${entero} ${resto}`
}

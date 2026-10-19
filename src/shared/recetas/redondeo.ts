/**
 * Redondea `valor` al múltiplo más cercano de `paso`, sin bajar de `paso` (una cantidad positiva
 * nunca se muestra como 0). Corrige el ruido de coma flotante (0.1 + 0.2).
 */
export function redondear(valor: number, paso: number): number {
  if (!(paso > 0)) throw new RangeError(`paso de redondeo no válido: ${paso}`)
  if (!(valor > 0)) throw new RangeError(`cantidad no válida: ${valor}`)
  const redondeado = Math.round(valor / paso) * paso
  return limpiar(Math.max(redondeado, paso))
}

/** Quita el ruido de coma flotante (3.0000000000000004 → 3). */
export function limpiar(valor: number): number {
  return Number(valor.toFixed(6))
}

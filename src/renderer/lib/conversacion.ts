// Pantalla de conversación con el chef (tarea 44): qué elementos acompañan a cada respuesta. Se
// calcula desde el estado de la app antes y después del turno, nunca desde lo que diga el modelo.

export interface DespensaTurno {
  ingredientes: string[]
  ingredientesSinIdentificar: string[]
  porciones: number
}

/** Lo que el turno cambió en la despensa, para mostrarlo como etiquetas en la respuesta. */
export interface CambiosTurno {
  /** Ingredientes del catálogo añadidos en este turno. */
  ingredientes: string[]
  /** Ingredientes fuera del catálogo añadidos en este turno. */
  sinIdentificar: string[]
  /** Porciones nuevas, o `null` si no cambiaron. */
  porciones: number | null
}

export const SIN_CAMBIOS: CambiosTurno = { ingredientes: [], sinIdentificar: [], porciones: null }

export function cambiosDelTurno(antes: DespensaTurno, despues: DespensaTurno): CambiosTurno {
  const nuevos = (a: string[], b: string[]): string[] => b.filter((x) => !a.includes(x))
  return {
    ingredientes: nuevos(antes.ingredientes, despues.ingredientes),
    sinIdentificar: nuevos(antes.ingredientesSinIdentificar, despues.ingredientesSinIdentificar),
    porciones: antes.porciones === despues.porciones ? null : despues.porciones
  }
}

export function hayCambios(c: CambiosTurno): boolean {
  return c.ingredientes.length > 0 || c.sinIdentificar.length > 0 || c.porciones !== null
}

/**
 * Las etiquetas que siguen en la despensa: si la persona quitó una (aquí o en Preparar), deja de
 * mostrarse en la respuesta en la que apareció.
 */
export function etiquetasVigentes(c: CambiosTurno, despensa: DespensaTurno): CambiosTurno {
  return {
    ingredientes: c.ingredientes.filter((id) => despensa.ingredientes.includes(id)),
    sinIdentificar: c.sinIdentificar.filter((n) => despensa.ingredientesSinIdentificar.includes(n)),
    porciones: c.porciones
  }
}

/** «Te faltan 3», «Te falta 1» o «Tienes todo», como en las tarjetas de Elegir. */
export function textoFaltan(n: number): string {
  return n === 0 ? 'Tienes todo' : `Te ${n === 1 ? 'falta' : 'faltan'} ${n}`
}

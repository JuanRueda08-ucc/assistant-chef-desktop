// Red de seguridad del chat (decisión 0019): el modelo puede decir que anotó una alergia sin
// hacerlo, o guardar solo una parte. Si la persona habla de sus alergias o dieta, la app añade lo
// que quedó guardado de verdad, calculado del estado y no de lo que diga el modelo.

import { normalizarTexto } from '../recetas/catalogo'
import { unirLista } from '../recetas/lista'
import { NOMBRE_ALERGENO, NOMBRE_DIETA } from '../textos'
import type { Preferencias } from '../types/sesion'

type Salud = Pick<Preferencias, 'alergias' | 'restricciones'>

// En primera persona, para no saltar con preguntas como «¿esto es vegano?».
const MENCIONA =
  /\b(soy|somos) (\w+ )?(alergic|intoleran|celiac|vegan|vegetarian)|\b(tengo|tenemos) (\w+ )?(alergia|intolerancia|celiaquia)|\bme (da|dan|cae|caen) mal\b|\b(alergia|intolerancia) (a|al|a la|a los|a las)\b|\bno (como|comemos|puedo comer|podemos comer|tomo|tomamos)\b/

export function mencionaSalud(texto: string): boolean {
  return MENCIONA.test(normalizarTexto(texto))
}

const iguales = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x))

/** Nota para añadir a la respuesta del chef, o `null` si no habló de su salud. */
export function notaPreferencias(texto: string, antes: Salud, despues: Salud): string | null {
  if (!mencionaSalud(texto)) return null
  const cambio =
    !iguales(antes.alergias, despues.alergias) ||
    !iguales(antes.restricciones, despues.restricciones)
  if (!cambio)
    return 'Aviso de la app: no se ha guardado ningún cambio de alergias o dieta. Compruébalo en Preferencias.'
  const partes = [
    despues.alergias.length
      ? `alergias: ${unirLista(despues.alergias.map((a) => NOMBRE_ALERGENO[a].toLocaleLowerCase('es')))}`
      : 'sin alergias',
    despues.restricciones.length
      ? `dieta: ${unirLista(despues.restricciones.map((d) => NOMBRE_DIETA[d].toLocaleLowerCase('es')))}`
      : 'sin dieta'
  ]
  return `Guardado en tus preferencias: ${partes.join('; ')}. Revisa que no falte nada.`
}

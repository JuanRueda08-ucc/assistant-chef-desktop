// Sustituciones propuestas por el modelo cuando la tabla no tiene ninguna
// (docs/modelo-recetas.md, "Sustituciones", paso 3).

import { esquemaSustitucion } from '@shared/esquemas/receta'
import { destinoPermitido } from '@shared/recetas/busqueda'
import { comoMapa, dietasIncompatiblesDe } from '@shared/recetas/etiquetas'
import {
  ALERGENOS,
  DIETAS,
  type Alergeno,
  type Dieta,
  type Ingrediente,
  type Sustitucion
} from '@shared/types/receta'
import { esquemaSugerenciaModelo } from './peticiones'
import type { PeticionSustitucion } from './proveedor'

export const MAX_SUGERENCIAS = 3

/**
 * Se queda con las sugerencias válidas: destino en el catálogo, distinto del origen, sin repetir y
 * compatible con las restricciones y alergias del usuario. Como mucho `MAX_SUGERENCIAS`, en el
 * orden del modelo. Las que no cumplen se descartan sin fallar el resto.
 */
export function filtrarSugerencias(
  bruta: unknown,
  peticion: PeticionSustitucion,
  nuevoId: () => string
): Sustitucion[] {
  if (!Array.isArray(bruta)) return []
  const porId = comoMapa(peticion.catalogo)
  const origen = porId.get(peticion.ingredienteId)
  const vistos = new Set<string>()
  const elegidas: Sustitucion[] = []

  for (const item of bruta) {
    const sugerencia = esquemaSugerenciaModelo.safeParse(item)
    if (!sugerencia.success) continue
    const destino = porId.get(sugerencia.data.ingredienteDestinoId)
    if (!destino || destino.id === peticion.ingredienteId || vistos.has(destino.id)) continue
    if (!destinoPermitido(destino, peticion.preferencias)) continue
    vistos.add(destino.id)
    elegidas.push(
      esquemaSustitucion.parse({
        id: nuevoId(),
        ingredienteOrigenId: peticion.ingredienteId,
        ingredienteDestinoId: destino.id,
        ratio: sugerencia.data.ratio,
        recetaId: peticion.recetaId,
        contexto: sugerencia.data.contexto ?? 'cualquiera',
        resuelve: origen ? resueltos(origen, destino) : [],
        impacto: sugerencia.data.impacto,
        fuente: 'generada'
      })
    )
    if (elegidas.length === MAX_SUGERENCIAS) break
  }
  return elegidas
}

/** Dietas y alérgenos que el cambio permite evitar (los calcula el código, no el modelo). */
export function resueltos(origen: Ingrediente, destino: Ingrediente): (Dieta | Alergeno)[] {
  const incompatiblesOrigen = dietasIncompatiblesDe(origen)
  const incompatiblesDestino = dietasIncompatiblesDe(destino)
  return [
    ...DIETAS.filter((d) => incompatiblesOrigen.has(d) && !incompatiblesDestino.has(d)),
    ...ALERGENOS.filter((a) => origen.alergenos.includes(a) && !destino.alergenos.includes(a))
  ]
}

// Consultas sobre el catálogo de ingredientes para la pantalla Preparar (y, más adelante, para
// reconocer ingredientes por voz).

import {
  CATEGORIAS_INGREDIENTE,
  type CategoriaIngrediente,
  type Ingrediente
} from '../types/receta'

/** Minúsculas, sin tildes ni diéresis y sin espacios sobrantes: "Pimentón " → "pimenton". */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ingredientes cuyo nombre o algún sinónimo contiene la consulta (sin distinguir tildes ni
 * mayúsculas). Primero los que empiezan por la consulta, después por nombre. Una consulta vacía
 * devuelve todos, por nombre.
 */
export function buscarIngredientes(
  ingredientes: readonly Ingrediente[],
  consulta: string
): Ingrediente[] {
  const q = normalizarTexto(consulta)
  const porNombre = (a: Ingrediente, b: Ingrediente): number =>
    a.nombre.localeCompare(b.nombre, 'es')
  if (q === '') return [...ingredientes].sort(porNombre)

  const puntuados = ingredientes.flatMap((ingrediente) => {
    const textos = [ingrediente.nombre, ...ingrediente.sinonimos].map(normalizarTexto)
    if (textos.some((t) => t.startsWith(q) || t.split(' ').some((p) => p.startsWith(q)))) {
      return [{ ingrediente, prioridad: 0 }]
    }
    if (textos.some((t) => t.includes(q))) return [{ ingrediente, prioridad: 1 }]
    return []
  })
  return puntuados
    .sort((a, b) => a.prioridad - b.prioridad || porNombre(a.ingrediente, b.ingrediente))
    .map((p) => p.ingrediente)
}

/** Ingredientes por categoría, en el orden de `CATEGORIAS_INGREDIENTE` y por nombre dentro de cada una. */
export function agruparPorCategoria(
  ingredientes: readonly Ingrediente[]
): Map<CategoriaIngrediente, Ingrediente[]> {
  const grupos = new Map<CategoriaIngrediente, Ingrediente[]>(
    CATEGORIAS_INGREDIENTE.map((c) => [c, []])
  )
  for (const ingrediente of ingredientes) grupos.get(ingrediente.categoria)?.push(ingrediente)
  for (const lista of grupos.values()) lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return grupos
}

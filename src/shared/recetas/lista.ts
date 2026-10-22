// Lista libre de ingredientes (tarea 28, decisión 0015): convertir lo que escribe o dice el
// usuario en ingredientes del catálogo sin perder lo que no se reconoce. Lo usan el buscador de
// Preparar y la herramienta marcar_ingredientes del chat.

import type { Ingrediente } from '../types/receta'
import { buscarIngredientes, normalizarTexto } from './catalogo'

/** Máximo de ingredientes sin identificar que se guardan; el resto se ignora y se avisa. */
export const MAX_SIN_IDENTIFICAR = 50
/** Candidatos que se ofrecen cuando un texto encaja con varios ingredientes. */
export const MAX_CANDIDATOS = 6

/**
 * Separa «pollo, arroz y cebolla» en `['pollo', 'arroz', 'cebolla']`. Admite comas, punto y
 * coma, saltos de línea y las conjunciones «y»/«e». Quita repetidos sin distinguir tildes.
 */
export function separarIngredientes(texto: string): string[] {
  const vistos = new Set<string>()
  return texto
    .split(/[,;\n]|\s+(?:y|e)\s+/iu)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => {
      const clave = normalizarTexto(t)
      if (!clave || vistos.has(clave)) return false
      vistos.add(clave)
      return true
    })
}

export type Identificacion =
  | { tipo: 'catalogo'; ingrediente: Ingrediente }
  | { tipo: 'ambiguo'; candidatos: Ingrediente[] }
  | { tipo: 'desconocido' }

/**
 * Busca un texto en el catálogo: primero coincidencia exacta con id, nombre o sinónimo; si no,
 * por contenido (`buscarIngredientes`). Nunca elige entre varios candidatos.
 */
export function identificarIngrediente(
  catalogo: readonly Ingrediente[],
  texto: string
): Identificacion {
  const q = normalizarTexto(texto)
  const exactos = catalogo.filter((i) =>
    [i.id, i.nombre, ...i.sinonimos].some((n) => normalizarTexto(n) === q)
  )
  const candidatos = exactos.length ? exactos : buscarIngredientes(catalogo, q)
  if (candidatos.length === 1) return { tipo: 'catalogo', ingrediente: candidatos[0]! }
  if (candidatos.length > 1)
    return { tipo: 'ambiguo', candidatos: candidatos.slice(0, MAX_CANDIDATOS) }
  return { tipo: 'desconocido' }
}

export interface ListaResuelta {
  /** Ids del catálogo reconocidos, sin básicos de despensa ni repetidos. */
  ids: string[]
  /** Básicos de despensa mencionados: se dan por hechos (0014) y no se añaden. */
  basicos: Ingrediente[]
  /** Textos que encajan con varios ingredientes: hay que preguntar cuál. */
  ambiguos: { texto: string; candidatos: Ingrediente[] }[]
  /** Textos que no están en el catálogo: quedan en la lista sin identificar. */
  desconocidos: string[]
}

export function resolverIngredientes(
  catalogo: readonly Ingrediente[],
  textos: readonly string[]
): ListaResuelta {
  const resultado: ListaResuelta = { ids: [], basicos: [], ambiguos: [], desconocidos: [] }
  for (const texto of textos) {
    const id = identificarIngrediente(catalogo, texto)
    if (id.tipo === 'ambiguo') resultado.ambiguos.push({ texto, candidatos: id.candidatos })
    else if (id.tipo === 'desconocido') resultado.desconocidos.push(texto)
    else if (id.ingrediente.esBasicoDespensa) {
      if (!resultado.basicos.includes(id.ingrediente)) resultado.basicos.push(id.ingrediente)
    } else if (!resultado.ids.includes(id.ingrediente.id)) resultado.ids.push(id.ingrediente.id)
  }
  return resultado
}

/** Añade textos sin identificar conservando el orden, sin repetidos y hasta el máximo. */
export function anadirSinIdentificar(
  lista: readonly string[],
  textos: readonly string[]
): string[] {
  const resultado = [...lista]
  const claves = new Set(lista.map(normalizarTexto))
  for (const texto of textos) {
    const clave = normalizarTexto(texto)
    if (!clave || claves.has(clave) || resultado.length >= MAX_SIN_IDENTIFICAR) continue
    claves.add(clave)
    resultado.push(texto.trim())
  }
  return resultado
}

/** Quita de la lista sin identificar los textos indicados (sin distinguir tildes ni mayúsculas). */
export function quitarSinIdentificar(
  lista: readonly string[],
  textos: readonly string[]
): string[] {
  const quitar = new Set(textos.map(normalizarTexto))
  return lista.filter((t) => !quitar.has(normalizarTexto(t)))
}

/** «A», «A y B», «A, B y C» (o con «o»). */
export function unirLista(nombres: readonly string[], conjuncion: 'y' | 'o' = 'y'): string {
  return nombres.length <= 1
    ? (nombres[0] ?? '')
    : `${nombres.slice(0, -1).join(', ')} ${conjuncion} ${nombres[nombres.length - 1]}`
}

/** Frase para el usuario sobre lo que no se pudo añadir directamente (vacía si todo entró). */
export function explicarPendientes(resuelta: ListaResuelta): string {
  const partes: string[] = []
  for (const { texto, candidatos } of resuelta.ambiguos)
    partes.push(
      `«${texto}» puede ser ${unirLista(
        candidatos.map((c) => c.nombre.toLocaleLowerCase('es')),
        'o'
      )}: dime cuál.`
    )
  if (resuelta.desconocidos.length)
    partes.push(
      `${unirLista(resuelta.desconocidos.map((t) => `«${t}»`))} no ${resuelta.desconocidos.length === 1 ? 'está' : 'están'} en el catálogo: ${resuelta.desconocidos.length === 1 ? 'queda' : 'quedan'} en tu lista sin identificar.`
    )
  if (resuelta.basicos.length)
    partes.push(
      `${unirLista(resuelta.basicos.map((b) => b.nombre))} ya ${resuelta.basicos.length === 1 ? 'lo damos' : 'los damos'} por hecho.`
    )
  return partes.join(' ')
}

// Comprobación en código de las ideas de la IA (decisión 0019). El modelo no siempre cumple las
// instrucciones: aquí se calcula lo que tienes y lo que falta, y se descarta lo que choque con tus
// alergias o tu dieta. Son filtros de seguridad, no una garantía: la interfaz siempre avisa.

import type { IdeaModelo, IdeaReceta } from '../types/ideas'
import { DIFICULTADES, type Alergeno, type Dieta, type Ingrediente } from '../types/receta'
import type { Preferencias } from '../types/sesion'
import { normalizarTexto } from './catalogo'
import { dietasIncompatiblesDe } from './etiquetas'
import { identificarIngrediente } from './lista'

const PALABRAS_ALERGENO: Partial<Record<Alergeno, string[]>> = {
  gluten: [
    'trigo',
    'harina',
    'pan',
    'pasta',
    'espagueti',
    'fideo',
    'cebada',
    'centeno',
    'avena',
    'galleta',
    'tortilla de trigo'
  ],
  lacteos: ['leche', 'queso', 'mantequilla', 'crema', 'yogur', 'nata', 'suero'],
  huevo: ['huevo', 'mayonesa', 'clara', 'yema'],
  pescado: [
    'pescado',
    'atun',
    'salmon',
    'tilapia',
    'merluza',
    'sardina',
    'bacalao',
    'anchoa',
    'trucha'
  ],
  crustaceos: ['camaron', 'langostino', 'langosta', 'cangrejo', 'gamba'],
  moluscos: ['calamar', 'pulpo', 'mejillon', 'almeja', 'ostra'],
  cacahuete: ['cacahuete', 'mani'],
  frutos_secos: [
    'nuez',
    'nueces',
    'almendra',
    'avellana',
    'pistacho',
    'anacardo',
    'maranon',
    'pecana'
  ],
  soja: ['soja', 'soya', 'tofu', 'tempeh', 'miso'],
  sesamo: ['sesamo', 'ajonjoli', 'tahini'],
  mostaza: ['mostaza'],
  apio: ['apio'],
  sulfitos: ['vino', 'vinagre'],
  altramuces: ['altramuz']
}
const CARNES = [
  'pollo',
  'carne',
  'res',
  'cerdo',
  'jamon',
  'tocino',
  'chorizo',
  'salchicha',
  'pavo',
  'cordero',
  'gelatina'
]
const DEL_MAR = [
  ...PALABRAS_ALERGENO.pescado!,
  ...PALABRAS_ALERGENO.crustaceos!,
  ...PALABRAS_ALERGENO.moluscos!
]
const PALABRAS_DIETA: Record<Dieta, string[]> = {
  vegetariana: [...CARNES, ...DEL_MAR],
  vegana: [
    ...CARNES,
    ...DEL_MAR,
    ...PALABRAS_ALERGENO.lacteos!,
    ...PALABRAS_ALERGENO.huevo!,
    'miel'
  ],
  sin_gluten: PALABRAS_ALERGENO.gluten!,
  sin_lactosa: PALABRAS_ALERGENO.lacteos!
}

const contiene = (nombre: string, palabras: readonly string[]): boolean =>
  palabras.some((p) => new RegExp(`\\b${p}(es|s)?\\b`).test(nombre))

/** Choca con lo registrado por la persona, aunque el ingrediente no esté en el catálogo. */
function choca(
  nombre: string,
  ingrediente: Ingrediente | null,
  preferencias: Pick<Preferencias, 'alergias' | 'restricciones'>
): boolean {
  if (ingrediente?.alergenos.some((a) => preferencias.alergias.includes(a))) return true
  if (ingrediente?.alergenosVerificados) {
    const incompatibles = dietasIncompatiblesDe(ingrediente)
    if (preferencias.restricciones.some((d) => incompatibles.has(d))) return true
  }
  const texto = normalizarTexto(nombre)
  return (
    preferencias.alergias.some((a) => contiene(texto, PALABRAS_ALERGENO[a] ?? [])) ||
    preferencias.restricciones.some((d) => contiene(texto, PALABRAS_DIETA[d]))
  )
}

const unicos = (lista: string[]): string[] => {
  const vistos = new Set<string>()
  return lista.filter((t) => {
    const clave = normalizarTexto(t)
    if (vistos.has(clave)) return false
    vistos.add(clave)
    return true
  })
}

/**
 * Convierte las ideas del modelo en ideas comprobadas. Descarta las repetidas, las que superan el
 * tiempo o el nivel, las que chocan con alergias o dieta, y las que no usan nada de la despensa.
 */
export function evaluarIdeas(
  ideas: readonly IdeaModelo[],
  datos: {
    catalogo: readonly Ingrediente[]
    preferencias: Preferencias
    excluir: readonly string[]
  }
): IdeaReceta[] {
  const { catalogo, preferencias } = datos
  const marcados = new Set(preferencias.ingredientes)
  const libres = new Set(preferencias.ingredientesSinIdentificar.map(normalizarTexto))
  const vistos = new Set(datos.excluir.map(normalizarTexto))
  const resultado: IdeaReceta[] = []

  for (const idea of ideas) {
    const clave = normalizarTexto(idea.titulo)
    if (vistos.has(clave)) continue
    // El título también cuenta: el modelo puede omitir un ingrediente que sí nombra ahí.
    if (choca(idea.titulo, null, preferencias)) continue
    if (preferencias.tiempoMaxMin !== null && idea.tiempoTotalMin > preferencias.tiempoMaxMin)
      continue
    if (
      preferencias.nivel !== null &&
      DIFICULTADES.indexOf(idea.dificultad) > DIFICULTADES.indexOf(preferencias.nivel)
    )
      continue

    const tienes: string[] = []
    const faltan: string[] = []
    const sinVerificar: string[] = []
    let descartar = false
    let usaDespensa = false
    for (const texto of idea.ingredientes) {
      const identificado = identificarIngrediente(catalogo, texto)
      // Varios candidatos: no se elige; si alguno choca se descarta, y si no, queda sin verificar.
      if (identificado.tipo === 'ambiguo') {
        if (identificado.candidatos.some((c) => choca(texto, c, preferencias))) descartar = true
        sinVerificar.push(texto)
        if (libres.has(normalizarTexto(texto))) tienes.push(texto)
        else faltan.push(texto)
        continue
      }
      const ingrediente = identificado.tipo === 'catalogo' ? identificado.ingrediente : null
      if (choca(texto, ingrediente, preferencias)) descartar = true
      const nombre = ingrediente?.nombre ?? texto
      if (!ingrediente?.alergenosVerificados) sinVerificar.push(nombre)
      if (ingrediente?.esBasicoDespensa) tienes.push(nombre)
      else if (ingrediente ? marcados.has(ingrediente.id) : libres.has(normalizarTexto(texto))) {
        tienes.push(nombre)
        usaDespensa = true
      } else faltan.push(nombre)
    }
    if (descartar || !usaDespensa) continue

    vistos.add(clave)
    resultado.push({
      ...idea,
      id: `idea_${clave.replace(/[^a-z0-9]+/g, '_')}`,
      tienes: unicos(tienes),
      faltan: unicos(faltan),
      sinVerificar: unicos(sinVerificar)
    })
  }
  return resultado
}

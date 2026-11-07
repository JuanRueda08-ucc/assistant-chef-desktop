// Validación de una receta generada por el modelo (docs/modelo-recetas.md, "Validación de
// recetas generadas"): esquema estricto, referencias, etiquetas derivadas y comprobaciones de
// alergias, dieta y seguridad alimentaria.

import { z } from 'zod'
import { esquemaIngrediente, esquemaReceta } from '@shared/esquemas/receta'
import { normalizarTexto } from '@shared/recetas/catalogo'
import { conEtiquetas, indexar } from '@shared/recetas/etiquetas'
import { identificarIngrediente } from '@shared/recetas/lista'
import { idIngredienteNuevo, problemasRecetaGenerada } from '@shared/recetas/receta-generada'
import { CATEGORIAS_INGREDIENTE, type Ingrediente, type RecetaGenerada } from '@shared/types/receta'
import type { PeticionReceta } from './proveedor'

/**
 * Campos que decide el servidor, nunca el modelo: identidad, origen, estado, etiquetas (las dietas y
 * alérgenos se derivan del catálogo) e imagen.
 */
const CAMPOS_DEL_SERVIDOR = new Set([
  'id',
  'slug',
  'origen',
  'estadoRevision',
  'dietas',
  'alergenos',
  'imagen',
  'ingredientesNuevos'
])

/** Del modelo solo se acepta cómo se llama: los alérgenos nunca los decide la IA. */
const esquemaNuevos = z
  .array(
    z.strictObject({
      id: z.string().trim().min(1).max(100),
      nombre: z.string().trim().min(1).max(80),
      categoria: z.enum(CATEGORIAS_INGREDIENTE)
    })
  )
  .max(15)
  .default([])

export type Validacion = ({ ok: true } & RecetaGenerada) | { ok: false; error: string }

/**
 * Un nombre exacto del catálogo usa ese ingrediente. Si no, es nuevo y sin verificar; si se parece a
 * alguno del catálogo, hereda sus alérgenos conocidos: es más seguro avisar de más.
 */
function resolverNuevo(
  nuevo: z.output<typeof esquemaNuevos>[number],
  catalogo: readonly Ingrediente[]
): { catalogoId: string } | { ingrediente: Ingrediente } {
  const nombre = normalizarTexto(nuevo.nombre)
  const exacto = catalogo.find((i) =>
    [i.id, i.nombre, ...i.sinonimos].some((n) => normalizarTexto(n) === nombre)
  )
  if (exacto) return { catalogoId: exacto.id }
  const parecido = identificarIngrediente(catalogo, nuevo.nombre)
  const parecidos =
    parecido.tipo === 'catalogo'
      ? [parecido.ingrediente]
      : parecido.tipo === 'ambiguo'
        ? parecido.candidatos
        : []
  return {
    ingrediente: esquemaIngrediente.parse({
      id: idIngredienteNuevo(nuevo.nombre),
      nombre: nuevo.nombre,
      categoria: nuevo.categoria,
      alergenos: [...new Set(parecidos.flatMap((i) => i.alergenos))],
      alergenosVerificados: false
    })
  }
}

export function validarRecetaGenerada(
  bruta: unknown,
  peticion: PeticionReceta,
  id: string
): Validacion {
  if (typeof bruta !== 'object' || bruta === null || Array.isArray(bruta)) {
    return { ok: false, error: 'la respuesta no es un objeto JSON con la receta' }
  }
  const nuevos = esquemaNuevos.safeParse(
    (bruta as { ingredientesNuevos?: unknown }).ingredientesNuevos
  )
  if (!nuevos.success) return { ok: false, error: z.prettifyError(nuevos.error) }

  // Ids que usó el modelo → ids reales.
  const ids = new Map<string, string>()
  const propios = new Map<string, Ingrediente>()
  for (const nuevo of nuevos.data) {
    const resuelto = resolverNuevo(nuevo, peticion.catalogo)
    if ('catalogoId' in resuelto) {
      ids.set(nuevo.id, resuelto.catalogoId)
    } else {
      ids.set(nuevo.id, resuelto.ingrediente.id)
      propios.set(resuelto.ingrediente.id, resuelto.ingrediente)
    }
  }

  const resto = Object.fromEntries(
    Object.entries(bruta).filter(([campo]) => !CAMPOS_DEL_SERVIDOR.has(campo))
  )
  const ingredientes = Array.isArray(resto.ingredientes)
    ? resto.ingredientes.map((ir: unknown) => {
        const original = (ir as { ingredienteId?: unknown } | null)?.ingredienteId
        const real = typeof original === 'string' ? ids.get(original) : undefined
        return real ? { ...(ir as object), ingredienteId: real } : ir
      })
    : resto.ingredientes
  const titulo = peticion.idea?.titulo ?? (typeof resto.titulo === 'string' ? resto.titulo : '')
  const resultado = esquemaReceta.safeParse({
    ...resto,
    ingredientes,
    titulo,
    id,
    slug: slugDe(titulo, id),
    origen: 'generada',
    estadoRevision: 'borrador'
  })
  if (!resultado.success) return { ok: false, error: z.prettifyError(resultado.error) }
  const receta = resultado.data

  const ingredientesNuevos = [...propios.values()].filter((i) =>
    receta.ingredientes.some((ir) => ir.ingredienteId === i.id)
  )
  const porId = indexar([...peticion.catalogo, ...ingredientesNuevos])
  const fuera = receta.ingredientes
    .filter((ir) => !porId.has(ir.ingredienteId))
    .map((ir) => ir.ingredienteId)
  if (fuera.length > 0) {
    return { ok: false, error: `ingredientes que no están en el catálogo: ${fuera.join(', ')}` }
  }

  const tecnicas = new Set(peticion.tecnicas.map((t) => t.id))
  const desconocidas = receta.pasos
    .map((p) => p.tecnicaId)
    .filter((t): t is string => t !== null && !tecnicas.has(t))
  if (desconocidas.length > 0) {
    return { ok: false, error: `técnicas que no existen: ${desconocidas.join(', ')}` }
  }

  const generada = { receta: conEtiquetas(receta, porId), ingredientesNuevos }
  const problemas = problemasRecetaGenerada(generada, peticion.preferencias, peticion.catalogo)
  if (problemas.length > 0) return { ok: false, error: problemas.join('; ') }
  return { ok: true, ...generada }
}

/** "Arroz con Pollo!" + gen_1a2b3c4d → "arroz-con-pollo-1a2b3c4d". */
export function slugDe(titulo: string, id: string): string {
  const base =
    normalizarTexto(titulo)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'receta'
  return `${base}-${id.replace(/^gen_/, '')}`
}

// Validación de una receta generada por el modelo (docs/modelo-recetas.md, "Validación de
// recetas generadas"). Las reglas de seguridad alimentaria y `ingredienteNuevo` llegan con la
// tarea 17; aquí: esquema estricto, referencias al catálogo y etiquetas derivadas.

import { z } from 'zod'
import { esquemaReceta } from '@shared/esquemas/receta'
import { normalizarTexto } from '@shared/recetas/catalogo'
import { comoMapa, conEtiquetas } from '@shared/recetas/etiquetas'
import type { Receta } from '@shared/types/receta'
import type { PeticionReceta } from './proveedor'

/**
 * Campos que decide el servidor, nunca el modelo: identidad, origen, estado y etiquetas (las
 * dietas y alérgenos se derivan del catálogo).
 */
const CAMPOS_DEL_SERVIDOR = new Set([
  'id',
  'slug',
  'origen',
  'estadoRevision',
  'dietas',
  'alergenos'
])

export type Validacion = { ok: true; receta: Receta } | { ok: false; error: string }

export function validarRecetaGenerada(
  bruta: unknown,
  peticion: PeticionReceta,
  id: string
): Validacion {
  if (typeof bruta !== 'object' || bruta === null || Array.isArray(bruta)) {
    return { ok: false, error: 'la respuesta no es un objeto JSON con la receta' }
  }
  const resto = Object.fromEntries(
    Object.entries(bruta).filter(([campo]) => !CAMPOS_DEL_SERVIDOR.has(campo))
  )
  const titulo = typeof resto.titulo === 'string' ? resto.titulo : ''
  const resultado = esquemaReceta.safeParse({
    ...resto,
    id,
    slug: slugDe(titulo, id),
    origen: 'generada',
    estadoRevision: 'borrador'
  })
  if (!resultado.success) return { ok: false, error: z.prettifyError(resultado.error) }
  const receta = resultado.data

  const porId = comoMapa(peticion.catalogo)
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

  return { ok: true, receta: conEtiquetas(receta, porId) }
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

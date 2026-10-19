// Una semilla es el conjunto de datos que se carga en SQLite al arrancar: catálogo, técnicas,
// recetas y sustituciones. Además del esquema de cada pieza, comprueba que las referencias
// entre ellas existan (lo que SQLite también exige con sus claves foráneas).

import { z } from 'zod'
import { esquemaIngrediente, esquemaReceta, esquemaSustitucion, esquemaTecnica } from './receta'

export const esquemaSemilla = z
  .strictObject({
    ingredientes: z.array(esquemaIngrediente),
    tecnicas: z.array(esquemaTecnica),
    recetas: z.array(esquemaReceta),
    sustituciones: z.array(esquemaSustitucion).default([])
  })
  .superRefine((semilla, ctx) => {
    const repetidos = (
      lista: { id: string }[],
      clave: 'ingredientes' | 'tecnicas' | 'recetas' | 'sustituciones'
    ): Set<string> => {
      const vistos = new Set<string>()
      lista.forEach((item, i) => {
        if (vistos.has(item.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [clave, i, 'id'],
            message: `id repetido: ${item.id}`
          })
        }
        vistos.add(item.id)
      })
      return vistos
    }

    const ingredientes = repetidos(semilla.ingredientes, 'ingredientes')
    const tecnicas = repetidos(semilla.tecnicas, 'tecnicas')
    const recetas = repetidos(semilla.recetas, 'recetas')
    repetidos(semilla.sustituciones, 'sustituciones')

    const slugs = new Set<string>()
    semilla.recetas.forEach((receta, r) => {
      if (slugs.has(receta.slug)) {
        ctx.addIssue({
          code: 'custom',
          path: ['recetas', r, 'slug'],
          message: `slug repetido: ${receta.slug}`
        })
      }
      slugs.add(receta.slug)

      receta.ingredientes.forEach((ir, i) => {
        if (!ingredientes.has(ir.ingredienteId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['recetas', r, 'ingredientes', i, 'ingredienteId'],
            message: `ingrediente fuera del catálogo: ${ir.ingredienteId}`
          })
        }
      })
      receta.pasos.forEach((paso, p) => {
        if (paso.tecnicaId !== null && !tecnicas.has(paso.tecnicaId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['recetas', r, 'pasos', p, 'tecnicaId'],
            message: `técnica inexistente: ${paso.tecnicaId}`
          })
        }
      })
    })

    semilla.sustituciones.forEach((s, i) => {
      for (const campo of ['ingredienteOrigenId', 'ingredienteDestinoId'] as const) {
        if (!ingredientes.has(s[campo])) {
          ctx.addIssue({
            code: 'custom',
            path: ['sustituciones', i, campo],
            message: `ingrediente fuera del catálogo: ${s[campo]}`
          })
        }
      }
      if (s.recetaId !== null && !recetas.has(s.recetaId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sustituciones', i, 'recetaId'],
          message: `receta inexistente: ${s.recetaId}`
        })
      }
    })
  })

export type Semilla = z.output<typeof esquemaSemilla>
/** Forma de los archivos JSON de db/seed/ antes de aplicar valores por defecto. */
export type SemillaEntrada = z.input<typeof esquemaSemilla>

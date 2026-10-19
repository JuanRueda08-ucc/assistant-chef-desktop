// Esquemas zod que espejan src/shared/types/receta.ts. Se usan para validar semillas y,
// más adelante, recetas generadas (tarea 17). Objetos estrictos: no se aceptan campos extra.

import { z } from 'zod'
import {
  ALERGENOS,
  CATEGORIAS_INGREDIENTE,
  CONTEXTOS_SUSTITUCION,
  DIETAS,
  DIFICULTADES,
  EQUIPOS,
  ESTADOS_REVISION,
  FUENTES_SUSTITUCION,
  ORIGENES,
  TIPOS_ESCALADO,
  UNIDADES,
  type Ingrediente,
  type IngredientePaso,
  type IngredienteReceta,
  type Paso,
  type Receta,
  type Sustitucion,
  type Tecnica,
  type TemporizadorPaso
} from '../types/receta'
import type { Afirmar, Igual } from './coincidencia'

/** Ids y slugs: minúsculas, dígitos, `_` y `-`. */
export const esquemaId = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'id no válido')
const texto = z.string().trim().min(1)
const textoOpcional = texto.nullable().default(null)

/** Límites de temporizador de docs/ia-chef.md: 10 s a 6 h. */
export const SEGUNDOS_TEMPORIZADOR_MIN = 10
export const SEGUNDOS_TEMPORIZADOR_MAX = 6 * 60 * 60

export const esquemaDieta = z.enum(DIETAS)
export const esquemaAlergeno = z.enum(ALERGENOS)
export const esquemaEquipo = z.enum(EQUIPOS)
export const esquemaDificultad = z.enum(DIFICULTADES)

export const esquemaIngrediente = z.strictObject({
  id: esquemaId,
  nombre: texto,
  sinonimos: z.array(texto).default([]),
  categoria: z.enum(CATEGORIAS_INGREDIENTE),
  esBasicoDespensa: z.boolean().default(false),
  alergenos: z.array(esquemaAlergeno).default([]),
  dietasIncompatibles: z.array(esquemaDieta).default([]),
  densidadGMl: z.number().positive().nullable().default(null),
  pesoUnidadG: z.number().positive().nullable().default(null)
})

export const esquemaTecnica = z.strictObject({
  id: esquemaId,
  nombre: texto,
  descripcion: texto,
  pasosCortos: z.array(texto).min(1),
  media: textoOpcional
})

export const esquemaIngredienteReceta = z
  .strictObject({
    id: esquemaId,
    ingredienteId: esquemaId,
    cantidad: z.number().positive().nullable(),
    unidad: z.enum(UNIDADES),
    escalado: z.enum(TIPOS_ESCALADO).default('lineal'),
    redondeo: z.number().positive().nullable().default(null),
    preparacion: textoOpcional,
    grupo: textoOpcional,
    opcional: z.boolean().default(false)
  })
  .superRefine((ir, ctx) => {
    const alGusto = ir.unidad === 'al_gusto'
    if (alGusto && ir.cantidad !== null) {
      ctx.addIssue({ code: 'custom', path: ['cantidad'], message: 'al_gusto no lleva cantidad' })
    }
    if (!alGusto && ir.cantidad === null) {
      ctx.addIssue({ code: 'custom', path: ['cantidad'], message: 'falta la cantidad' })
    }
    if (!alGusto && ir.redondeo === null) {
      ctx.addIssue({ code: 'custom', path: ['redondeo'], message: 'falta el redondeo' })
    }
  })

export const esquemaIngredientePaso = z.strictObject({
  ingredienteRecetaId: esquemaId,
  fraccion: z.number().gt(0).lte(1)
})

export const esquemaTemporizadorPaso = z.strictObject({
  etiqueta: texto,
  segundos: z.number().int().min(SEGUNDOS_TEMPORIZADOR_MIN).max(SEGUNDOS_TEMPORIZADOR_MAX)
})

export const esquemaPaso = z.strictObject({
  id: esquemaId,
  orden: z.number().int().positive(),
  texto: texto,
  textoVoz: textoOpcional,
  ingredientes: z.array(esquemaIngredientePaso).default([]),
  duracionSeg: z.number().int().positive().nullable().default(null),
  temporizador: esquemaTemporizadorPaso.nullable().default(null),
  senalHecho: textoOpcional,
  tecnicaId: esquemaId.nullable().default(null),
  requiereConfirmacion: z.boolean(),
  consejo: textoOpcional,
  seguridad: textoOpcional
})

export const esquemaReceta = z
  .strictObject({
    id: esquemaId,
    slug: esquemaId,
    titulo: texto,
    descripcion: texto,
    porcionesBase: z.number().int().positive(),
    tiempoTotalMin: z.number().int().positive(),
    tiempoActivoMin: z.number().int().positive(),
    dificultad: esquemaDificultad,
    origen: z.enum(ORIGENES),
    estadoRevision: z.enum(ESTADOS_REVISION),
    dietas: z.array(esquemaDieta).default([]),
    alergenos: z.array(esquemaAlergeno).default([]),
    equipo: z.array(esquemaEquipo).default([]),
    imagen: textoOpcional,
    ingredientes: z.array(esquemaIngredienteReceta).min(1),
    pasos: z.array(esquemaPaso).min(1)
  })
  .superRefine((receta, ctx) => {
    if (receta.tiempoActivoMin > receta.tiempoTotalMin) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiempoActivoMin'],
        message: 'el tiempo activo supera al total'
      })
    }

    const idsIngredientes = new Set<string>()
    receta.ingredientes.forEach((ir, i) => {
      if (idsIngredientes.has(ir.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['ingredientes', i, 'id'],
          message: `id repetido: ${ir.id}`
        })
      }
      idsIngredientes.add(ir.id)
    })

    const idsPasos = new Set<string>()
    receta.pasos.forEach((paso, i) => {
      if (paso.orden !== i + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['pasos', i, 'orden'],
          message: `los pasos deben estar ordenados desde 1 sin huecos (se esperaba ${i + 1})`
        })
      }
      if (idsPasos.has(paso.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pasos', i, 'id'],
          message: `id repetido: ${paso.id}`
        })
      }
      idsPasos.add(paso.id)

      const usados = new Set<string>()
      paso.ingredientes.forEach((ip, j) => {
        const ruta = ['pasos', i, 'ingredientes', j, 'ingredienteRecetaId']
        if (!idsIngredientes.has(ip.ingredienteRecetaId)) {
          ctx.addIssue({
            code: 'custom',
            path: ruta,
            message: `ingrediente de receta inexistente: ${ip.ingredienteRecetaId}`
          })
        }
        if (usados.has(ip.ingredienteRecetaId)) {
          ctx.addIssue({ code: 'custom', path: ruta, message: 'ingrediente repetido en el paso' })
        }
        usados.add(ip.ingredienteRecetaId)
      })
    })
  })

export const esquemaSustitucion = z
  .strictObject({
    id: esquemaId,
    ingredienteOrigenId: esquemaId,
    ingredienteDestinoId: esquemaId,
    ratio: z.number().positive(),
    recetaId: esquemaId.nullable().default(null),
    contexto: z.enum(CONTEXTOS_SUSTITUCION).default('cualquiera'),
    resuelve: z.array(z.union([esquemaDieta, esquemaAlergeno])).default([]),
    impacto: texto,
    fuente: z.enum(FUENTES_SUSTITUCION)
  })
  .refine((s) => s.ingredienteOrigenId !== s.ingredienteDestinoId, {
    path: ['ingredienteDestinoId'],
    message: 'un ingrediente no se sustituye por sí mismo'
  })

export type _ComprobarIngrediente = Afirmar<Igual<z.output<typeof esquemaIngrediente>, Ingrediente>>
export type _ComprobarTecnica = Afirmar<Igual<z.output<typeof esquemaTecnica>, Tecnica>>
export type _ComprobarIngredienteReceta = Afirmar<
  Igual<z.output<typeof esquemaIngredienteReceta>, IngredienteReceta>
>
export type _ComprobarIngredientePaso = Afirmar<
  Igual<z.output<typeof esquemaIngredientePaso>, IngredientePaso>
>
export type _ComprobarTemporizadorPaso = Afirmar<
  Igual<z.output<typeof esquemaTemporizadorPaso>, TemporizadorPaso>
>
export type _ComprobarPaso = Afirmar<Igual<z.output<typeof esquemaPaso>, Paso>>
export type _ComprobarReceta = Afirmar<Igual<z.output<typeof esquemaReceta>, Receta>>
export type _ComprobarSustitucion = Afirmar<Igual<z.output<typeof esquemaSustitucion>, Sustitucion>>

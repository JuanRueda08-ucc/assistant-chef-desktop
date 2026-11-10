// Uso diario de la cuenta (lo que queda de cada límite), para mostrarlo en la app. El backend lo
// devuelve en `POST /uso` sin gastar nada; los límites se cuentan por cuenta y día UTC (0017).

import { z } from 'zod'
import type { Afirmar, Igual } from '../esquemas/coincidencia'

/** Grupos de rutas que comparten un límite diario. */
export const GRUPOS_USO = ['voz', 'recetas', 'sustituciones', 'chat', 'imagenes'] as const
export type GrupoUso = (typeof GRUPOS_USO)[number]

export interface UsoGrupo {
  limite: number
  usadas: number
  restantes: number
}

export interface UsoDiario {
  grupos: Record<GrupoUso, UsoGrupo>
  /** Hora en que se reinician los contadores (medianoche UTC), en milisegundos. */
  reinicioEn: number
}

const esquemaUsoGrupo = z.strictObject({
  limite: z.number().int().nonnegative(),
  usadas: z.number().int().nonnegative(),
  restantes: z.number().int().nonnegative()
})

export const esquemaUsoDiario = z.strictObject({
  grupos: z.strictObject({
    voz: esquemaUsoGrupo,
    recetas: esquemaUsoGrupo,
    sustituciones: esquemaUsoGrupo,
    chat: esquemaUsoGrupo,
    imagenes: esquemaUsoGrupo
  }),
  reinicioEn: z.number().int().nonnegative()
})

/** Grupos que se muestran en la app, con su nombre; las imágenes esperan a la facturación. */
export const USO_VISIBLE: readonly { grupo: GrupoUso; nombre: string; unidad: string }[] = [
  { grupo: 'chat', nombre: 'Chat con el chef', unidad: 'mensajes' },
  { grupo: 'voz', nombre: 'Voz', unidad: 'usos' },
  { grupo: 'recetas', nombre: 'Ideas y recetas nuevas', unidad: 'pedidos' },
  { grupo: 'sustituciones', nombre: 'Sustituciones', unidad: 'consultas' }
]

/** A partir de cuántos restantes se avisa en el chat. */
export const AVISO_POCO_USO = 10

/** «Te quedan 3 mensajes del chef hoy.», o `null` si queda suficiente. */
export function avisoUsoChat(uso: UsoDiario | null): string | null {
  if (!uso) return null
  const { restantes } = uso.grupos.chat
  if (restantes > AVISO_POCO_USO) return null
  if (restantes === 0)
    return 'Ya usaste todos los mensajes del chef de hoy. Los botones siguen disponibles.'
  return `Te ${restantes === 1 ? 'queda 1 mensaje' : `quedan ${restantes} mensajes`} del chef hoy.`
}

/** «Se renuevan en 5 h» o «en 40 min», contando desde `ahora`. */
export function textoReinicio(reinicioEn: number, ahora: number): string {
  const minutos = Math.max(1, Math.ceil((reinicioEn - ahora) / 60_000))
  if (minutos < 60) return `Se renuevan en ${minutos} min`
  return `Se renuevan en ${Math.round(minutos / 60)} h`
}

export type _ComprobarUsoDiario = Afirmar<Igual<z.output<typeof esquemaUsoDiario>, UsoDiario>>

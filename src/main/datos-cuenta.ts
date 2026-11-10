// Datos de cada cuenta que no se guardan en el equipo (decisiones 0024 y 0025): chats con el chef
// y «Mis recetas». Con Supabase se leen y escriben en sus tablas con el JWT de la persona y la
// clave publicable; row level security deja a cada cuenta ver solo lo suyo. Sin Supabase
// (desarrollo, 0018) los chats viven en memoria y Mis recetas en el SQLite local, como antes.

import { z } from 'zod'
import { esquemaChatChef } from '@shared/esquemas/chats'
import { esquemaRecetaGenerada } from '@shared/esquemas/receta'
import { MAX_CHATS_LISTA, type ChatChef } from '@shared/types/chats'
import type { RecetaGenerada } from '@shared/types/receta'
import type { BaseDatos } from './db/conexion'
import { guardarMiReceta, leerMisRecetasGuardadas, quitarMiReceta } from './db/mis-recetas'

export const MENSAJE_SIN_NUBE =
  'No pude guardar en tu cuenta. Comprueba tu conexión e inténtalo de nuevo.'
export const MENSAJE_SIN_LEER = 'No pude traer tus datos de la cuenta. Comprueba tu conexión.'

export interface DatosCuenta {
  listarChats(usuarioId: string): Promise<ChatChef[]>
  guardarChat(usuarioId: string, chat: ChatChef): Promise<void>
  borrarChat(usuarioId: string, chatId: string): Promise<void>
  /** Recetas tal como se guardaron, las más recientes primero (sin recalcular etiquetas). */
  listarMisRecetas(usuarioId: string): Promise<RecetaGenerada[]>
  guardarMiReceta(usuarioId: string, generada: RecetaGenerada, ahora: number): Promise<void>
  quitarMiReceta(usuarioId: string, recetaId: string): Promise<void>
}

/** Desarrollo sin Supabase: chats en memoria y Mis recetas en el SQLite local. */
export function crearDatosLocales(db: BaseDatos): DatosCuenta {
  const chats = new Map<string, Map<string, ChatChef>>()
  const deCuenta = (u: string): Map<string, ChatChef> => {
    if (!chats.has(u)) chats.set(u, new Map())
    return chats.get(u)!
  }
  return {
    listarChats: async (u) =>
      [...deCuenta(u).values()]
        .sort((a, b) => b.actualizado - a.actualizado)
        .slice(0, MAX_CHATS_LISTA),
    guardarChat: async (u, chat) => {
      deCuenta(u).set(chat.id, esquemaChatChef.parse(chat))
    },
    borrarChat: async (u, id) => {
      deCuenta(u).delete(id)
    },
    listarMisRecetas: async (u) => leerMisRecetasGuardadas(db, u),
    guardarMiReceta: async (u, generada, ahora) => guardarMiReceta(db, u, generada, ahora),
    quitarMiReceta: async (u, id) => quitarMiReceta(db, u, id)
  }
}

export interface OpcionesNube {
  supabaseUrl: URL
  clavePublica: string
  /** JWT de la cuenta, renovado si hace falta; `null` sin sesión. */
  token: () => Promise<string | null>
  /** Aviso de que el JWT ya no vale (401). */
  caducada?: () => void
  solicitar?: typeof fetch
}

const esquemaFilaChat = z.object({
  id: z.string(),
  titulo: z.string(),
  titulo_de_ia: z.boolean(),
  turnos: z.unknown(),
  contexto: z.unknown(),
  actualizado: z.string()
})
const esquemaFilaReceta = z.object({ datos: z.unknown() })

/** Supabase (0025): tablas `chats` y `mis_recetas` por PostgREST, con el JWT de la cuenta. */
export function crearDatosNube(opciones: OpcionesNube): DatosCuenta {
  const solicitar = opciones.solicitar ?? fetch
  const base = opciones.supabaseUrl.href.replace(/\/$/, '')

  async function pedir(
    ruta: string,
    init: { method: string; body?: unknown; prefer?: string },
    mensaje: string
  ): Promise<unknown> {
    const token = await opciones.token()
    if (!token) throw new Error('Inicia sesión para continuar.')
    let r: Response
    try {
      r = await solicitar(`${base}/rest/v1/${ruta}`, {
        method: init.method,
        headers: {
          apikey: opciones.clavePublica,
          authorization: `Bearer ${token}`,
          ...(init.body !== undefined && { 'content-type': 'application/json' }),
          ...(init.prefer && { prefer: init.prefer })
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        redirect: 'error',
        signal: AbortSignal.timeout(15_000)
      })
    } catch {
      throw new Error(mensaje)
    }
    if (r.status === 401) {
      opciones.caducada?.()
      throw new Error('Tu sesión ha caducado. Vuelve a entrar en tu cuenta.')
    }
    if (!r.ok) throw new Error(mensaje)
    return r.status === 204 ? null : r.json().catch(() => null)
  }
  const idUrl = (id: string): string => encodeURIComponent(id)

  return {
    async listarChats() {
      const filas = z
        .array(esquemaFilaChat)
        .safeParse(
          await pedir(
            `chats?select=id,titulo,titulo_de_ia,turnos,contexto,actualizado&order=actualizado.desc&limit=${MAX_CHATS_LISTA}`,
            { method: 'GET' },
            MENSAJE_SIN_LEER
          )
        )
      if (!filas.success) throw new Error(MENSAJE_SIN_LEER)
      // Un chat que ya no cumple el esquema (por ejemplo, de una versión anterior) se omite.
      return filas.data.flatMap((f) => {
        const chat = esquemaChatChef.safeParse({
          id: f.id,
          titulo: f.titulo,
          tituloDeIA: f.titulo_de_ia,
          turnos: f.turnos,
          contexto: f.contexto,
          actualizado: Date.parse(f.actualizado)
        })
        return chat.success ? [chat.data] : []
      })
    },
    async guardarChat(_usuarioId, chat) {
      const valido = esquemaChatChef.parse(chat)
      await pedir(
        'chats?on_conflict=usuario_id,id',
        {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: {
            id: valido.id,
            titulo: valido.titulo,
            titulo_de_ia: valido.tituloDeIA,
            turnos: valido.turnos,
            contexto: valido.contexto,
            actualizado: new Date(valido.actualizado).toISOString()
          }
        },
        MENSAJE_SIN_NUBE
      )
    },
    async borrarChat(_usuarioId, id) {
      await pedir(`chats?id=eq.${idUrl(id)}`, { method: 'DELETE' }, MENSAJE_SIN_NUBE)
    },
    async listarMisRecetas() {
      const filas = z
        .array(esquemaFilaReceta)
        .safeParse(
          await pedir(
            'mis_recetas?select=datos&order=guardada_en.desc,id',
            { method: 'GET' },
            MENSAJE_SIN_LEER
          )
        )
      if (!filas.success) throw new Error(MENSAJE_SIN_LEER)
      return filas.data.flatMap((f) => {
        const r = esquemaRecetaGenerada.safeParse(f.datos)
        return r.success ? [r.data] : []
      })
    },
    async guardarMiReceta(_usuarioId, generada, ahora) {
      const valida = esquemaRecetaGenerada.parse(generada)
      // Guardar dos veces la misma receta no la repite ni cambia su fecha.
      await pedir(
        'mis_recetas?on_conflict=usuario_id,id',
        {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates,return=minimal',
          body: {
            id: valida.receta.id,
            datos: valida,
            guardada_en: new Date(ahora).toISOString()
          }
        },
        MENSAJE_SIN_NUBE
      )
    },
    async quitarMiReceta(_usuarioId, id) {
      await pedir(`mis_recetas?id=eq.${idUrl(id)}`, { method: 'DELETE' }, MENSAJE_SIN_NUBE)
    }
  }
}

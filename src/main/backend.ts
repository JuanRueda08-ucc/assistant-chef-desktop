import { esquemaRespuestaTitulo, type PeticionTitulo } from '@shared/ia/titulo'
import { esquemaUsoDiario, type UsoDiario } from '@shared/ia/uso'
import { esquemaRespuestaIdeas } from '@shared/esquemas/ideas'
import { esquemaRecetaGenerada } from '@shared/esquemas/receta'
import type { IdeaModelo, PeticionIdeas, RespuestaIdeas } from '@shared/types/ideas'
import type { Ingrediente, RecetaGenerada, Tecnica } from '@shared/types/receta'
import type { Preferencias } from '@shared/types/sesion'
import { esquemaTokenVoz } from '@shared/esquemas/voz'
import type { RespuestaTokenVoz } from '@shared/types/voz'
import type { AudioNarracion } from '@shared/types/voz'
import { esquemaRespuestaNarracion } from '@shared/esquemas/voz'
import { esquemaRespuestaChat, type PeticionChat, type RespuestaChat } from '@shared/ia/chat'
import { z } from 'zod'
import { ERRORES_PROVEEDOR, esquemaCodigoErrorProveedor } from '@shared/ia/errores'

/** Sesión de la cuenta (src/main/cuenta.ts): token para el backend y aviso si lo rechaza. */
export interface SesionBackend {
  /** JWT vigente (main lo renueva si está a punto de caducar), o `null` sin sesión. */
  token(): Promise<string | null>
  caducada(): void
}

export const MENSAJE_SESION_CADUCADA = 'Tu sesión ha caducado. Vuelve a entrar en tu cuenta.'

/** Lo que main pide al backend para escribir la receta de una idea. */
export interface PeticionRecetaGenerada {
  preferencias: Preferencias
  catalogo: Ingrediente[]
  tecnicas: Pick<Tecnica, 'id' | 'nombre'>[]
  idea: IdeaModelo
}

type Respuesta<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

/** HTTPS, o HTTP solo en localhost; sin credenciales, query ni fragmento. */
export function validarApiUrl(apiUrl: string): URL {
  const base = new URL(apiUrl)
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))
  ) {
    throw new Error(
      'CHEF_API_URL debe usar HTTPS (HTTP solo en localhost), sin credenciales ni query.'
    )
  }
  return base
}

/** Solo main hace HTTP al backend. Nunca acepta una URL del renderer. */
export function crearClienteBackend(
  apiUrl: string,
  instalacion: string,
  solicitar: typeof fetch = fetch,
  ahora: () => number = Date.now,
  sesion: SesionBackend = { token: async () => null, caducada: () => {} }
): {
  pedirTokenVoz: () => Promise<RespuestaTokenVoz>
  narrar: (texto: string) => Promise<AudioNarracion | null>
  conversar: (peticion: PeticionChat) => Promise<RespuestaChat>
  proponerRecetas: (peticion: PeticionIdeas) => Promise<Respuesta<RespuestaIdeas>>
  generarReceta: (peticion: PeticionRecetaGenerada) => Promise<Respuesta<RecetaGenerada>>
  transcribir: (audio: string) => Promise<Respuesta<{ texto: string }>>
  titularChat: (peticion: PeticionTitulo) => Promise<Respuesta<{ titulo: string | null }>>
  /** Lo que queda hoy de cada límite de la cuenta; no gasta nada. */
  uso: () => Promise<Respuesta<UsoDiario>>
  generarImagen: (peticion: {
    titulo: string
    descripcion: string
    ingredientes: string[]
  }) => Promise<Respuesta<{ imagen: { datos: string; mimeType: string } | null }>>
} {
  const base = validarApiUrl(apiUrl)
  const cabeceras = async (): Promise<Record<string, string>> => {
    const token = await sesion.token()
    return {
      'content-type': 'application/json',
      'x-instalacion': instalacion,
      ...(token && { authorization: `Bearer ${token}` })
    }
  }
  const url = new URL(`${base.pathname.replace(/\/$/, '')}/voz/token`, base.origin)
  const cache = new Map<string, AudioNarracion>()
  /** Ideas (búsqueda 25 s y memoria 8 + 15 s) y receta (dos intentos de hasta 25 + 40 s). */
  async function pedirDatos<T>(
    ruta: string,
    peticion: unknown,
    esperaMs: number,
    esquema: z.ZodType<T>,
    textos: { limite: string; fallo: string; invalida: string }
  ): Promise<Respuesta<T>> {
    let respuesta: Response
    try {
      respuesta = await solicitar(
        new URL(`${base.pathname.replace(/\/$/, '')}/${ruta}`, base.origin),
        {
          method: 'POST',
          headers: await cabeceras(),
          body: JSON.stringify(peticion),
          redirect: 'error',
          signal: AbortSignal.timeout(esperaMs)
        }
      )
    } catch (error) {
      const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
      return {
        ok: false,
        mensaje: timeout
          ? ERRORES_PROVEEDOR.proveedor_timeout
          : 'No pude conectar con el chef. Comprueba que el backend esté iniciado.'
      }
    }
    if (respuesta.status === 401) {
      sesion.caducada()
      return { ok: false, mensaje: MENSAJE_SESION_CADUCADA }
    }
    if (respuesta.status === 429) return { ok: false, mensaje: textos.limite }
    if (!respuesta.ok) {
      const error = z
        .object({ error: z.object({ codigo: esquemaCodigoErrorProveedor }) })
        .safeParse(await respuesta.json().catch(() => null))
      return {
        ok: false,
        mensaje: error.success ? ERRORES_PROVEEDOR[error.data.error.codigo] : textos.fallo
      }
    }
    const datos = esquema.safeParse(await respuesta.json().catch(() => null))
    return datos.success ? { ok: true, datos: datos.data } : { ok: false, mensaje: textos.invalida }
  }
  return {
    proponerRecetas: (peticion) =>
      pedirDatos('recetas/proponer', peticion, 60_000, esquemaRespuestaIdeas, {
        limite: 'Has llegado al límite de ideas de hoy.',
        fallo: 'El chef no pudo proponer ideas. Puedes intentarlo más tarde.',
        invalida: 'El chef devolvió ideas no válidas. Inténtalo de nuevo.'
      }),
    generarReceta: (peticion) =>
      pedirDatos('recetas/generar', peticion, 130_000, esquemaRecetaGenerada, {
        limite: 'Has llegado al límite de recetas de hoy.',
        fallo: 'El chef no logró escribir una receta segura con esta idea. Prueba con otra.',
        invalida: 'El chef devolvió una receta no válida. Inténtalo de nuevo.'
      }),
    generarImagen: (peticion) =>
      pedirDatos(
        'recetas/imagen',
        peticion,
        60_000,
        z.strictObject({
          imagen: z.strictObject({ datos: z.string(), mimeType: z.string() }).nullable()
        }),
        {
          limite: 'Has llegado al límite de imágenes de hoy.',
          fallo: 'No se pudo crear la imagen.',
          invalida: 'No se pudo crear la imagen.'
        }
      ),
    uso: () =>
      pedirDatos('uso', {}, 10_000, esquemaUsoDiario, {
        limite: 'No se pudo consultar tu uso de hoy.',
        fallo: 'No se pudo consultar tu uso de hoy.',
        invalida: 'No se pudo consultar tu uso de hoy.'
      }),
    titularChat: (peticion) =>
      pedirDatos('chat/titulo', peticion, 15_000, esquemaRespuestaTitulo, {
        limite: 'Has llegado al límite del chat de hoy.',
        fallo: 'No se pudo poner nombre al chat.',
        invalida: 'No se pudo poner nombre al chat.'
      }),
    transcribir: (audio) =>
      pedirDatos('voz/transcribir', { audio }, 30_000, z.strictObject({ texto: z.string() }), {
        limite: 'Has llegado al límite de voz de hoy. Puedes seguir escribiendo.',
        fallo: 'No pude entender el audio. Inténtalo de nuevo o escríbelo.',
        invalida: 'No pude entender el audio. Inténtalo de nuevo o escríbelo.'
      }),
    async conversar(peticion) {
      let respuesta: Response
      try {
        respuesta = await solicitar(
          new URL(`${base.pathname.replace(/\/$/, '')}/chat`, base.origin),
          {
            method: 'POST',
            headers: await cabeceras(),
            body: JSON.stringify(peticion),
            redirect: 'error',
            signal: AbortSignal.timeout(30_000)
          }
        )
      } catch (error) {
        const timeout =
          error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        // eslint-disable-next-line preserve-caught-error -- El transporte original puede contener URL/cabeceras privadas.
        throw new Error(
          timeout
            ? ERRORES_PROVEEDOR.proveedor_timeout
            : 'No pude conectar con el chef. Comprueba que el backend esté iniciado.'
        )
      }
      if (respuesta.status === 401) {
        sesion.caducada()
        throw new Error(MENSAJE_SESION_CADUCADA)
      }
      if (respuesta.status === 429)
        throw new Error(
          'Has llegado al límite de consultas de hoy. Los botones siguen disponibles.'
        )
      if (!respuesta.ok) {
        const error = z
          .object({ error: z.object({ codigo: esquemaCodigoErrorProveedor }) })
          .safeParse(await respuesta.json().catch(() => null))
        if (error.success) throw new Error(ERRORES_PROVEEDOR[error.data.error.codigo])
        throw new Error(
          'El servicio de IA no pudo responder. Puedes seguir con los botones e intentarlo más tarde.'
        )
      }
      const resultado = esquemaRespuestaChat.safeParse(await respuesta.json())
      if (!resultado.success) throw new Error('El chef devolvió una respuesta inválida.')
      return resultado.data
    },
    async narrar(texto) {
      if (cache.has(texto)) return cache.get(texto)!
      const respuesta = await solicitar(
        new URL(`${base.pathname.replace(/\/$/, '')}/voz/narrar`, base.origin),
        {
          method: 'POST',
          headers: await cabeceras(),
          body: JSON.stringify({ texto }),
          redirect: 'error',
          signal: AbortSignal.timeout(25_000)
        }
      )
      if (respuesta.status === 401) sesion.caducada()
      if (!respuesta.ok) {
        const error = z
          .object({ error: z.object({ codigo: z.string() }) })
          .safeParse(await respuesta.json().catch(() => null))
        throw new Error(
          error.success && error.data.error.codigo === 'proveedor_sin_cuota'
            ? 'La voz natural de Google llegó a su límite de uso gratuito. Sigo con la voz del sistema.'
            : respuesta.status === 429
              ? 'Llegaste al límite de voz natural de hoy. Sigo con la voz del sistema.'
              : 'La voz natural no respondió. Sigo con la voz del sistema.'
        )
      }
      const { audio } = esquemaRespuestaNarracion.parse(await respuesta.json())
      if (audio) {
        if (cache.size >= 12) cache.delete(cache.keys().next().value!)
        cache.set(texto, audio)
      }
      return audio
    },
    async pedirTokenVoz(): Promise<RespuestaTokenVoz> {
      let respuesta: Response
      try {
        respuesta = await solicitar(url, {
          method: 'POST',
          headers: await cabeceras(),
          body: '{}',
          redirect: 'error',
          signal: AbortSignal.timeout(10_000)
        })
      } catch {
        return {
          ok: false,
          error: {
            codigo: 'sin_conexion',
            mensaje:
              'No pude conectar con el servicio de voz. Las órdenes locales y los botones siguen disponibles.'
          }
        }
      }
      if (respuesta.status === 401) {
        sesion.caducada()
        return {
          ok: false,
          error: { codigo: 'sin_sesion', mensaje: MENSAJE_SESION_CADUCADA }
        }
      }
      if (respuesta.status === 429)
        return {
          ok: false,
          error: {
            codigo: 'limite_superado',
            mensaje: 'Has llegado al límite de voz. Puedes seguir con órdenes locales o botones.'
          }
        }
      if (!respuesta.ok)
        return {
          ok: false,
          error: {
            codigo: 'servicio_no_disponible',
            mensaje: 'El servicio de voz no está disponible. Inténtalo de nuevo.'
          }
        }
      try {
        const token = esquemaTokenVoz.safeParse(await respuesta.json())
        if (token.success && Date.parse(token.data.expiraEn) > ahora())
          return { ok: true, credencial: token.data }
      } catch {
        /* La respuesta se trata como inválida, sin propagar datos internos. */
      }
      return {
        ok: false,
        error: {
          codigo: 'respuesta_invalida',
          mensaje: 'El servicio devolvió una credencial de voz inválida o caducada.'
        }
      }
    }
  }
}

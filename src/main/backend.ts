import { esquemaTokenVoz } from '@shared/esquemas/voz'
import type { RespuestaTokenVoz } from '@shared/types/voz'
import type { AudioNarracion } from '@shared/types/voz'
import { esquemaRespuestaNarracion } from '@shared/esquemas/voz'
import { esquemaRespuestaChat, type PeticionChat, type RespuestaChat } from '@shared/ia/chat'
import { z } from 'zod'
import { ERRORES_PROVEEDOR, esquemaCodigoErrorProveedor } from '@shared/ia/errores'

/** Solo main hace HTTP al backend. Nunca acepta una URL del renderer. */
export function crearClienteBackend(
  apiUrl: string,
  instalacion: string,
  solicitar: typeof fetch = fetch,
  ahora: () => number = Date.now
): {
  pedirTokenVoz: () => Promise<RespuestaTokenVoz>
  narrar: (texto: string) => Promise<AudioNarracion | null>
  conversar: (peticion: PeticionChat) => Promise<RespuestaChat>
} {
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
  const url = new URL(`${base.pathname.replace(/\/$/, '')}/voz/token`, base.origin)
  const cache = new Map<string, AudioNarracion>()
  return {
    async conversar(peticion) {
      let respuesta: Response
      try {
        respuesta = await solicitar(
          new URL(`${base.pathname.replace(/\/$/, '')}/chat`, base.origin),
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-instalacion': instalacion },
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
          headers: { 'content-type': 'application/json', 'x-instalacion': instalacion },
          body: JSON.stringify({ texto }),
          redirect: 'error',
          signal: AbortSignal.timeout(25_000)
        }
      )
      if (!respuesta.ok) throw new Error('La voz natural no está disponible.')
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
          headers: { 'content-type': 'application/json', 'x-instalacion': instalacion },
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

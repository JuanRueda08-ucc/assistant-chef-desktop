// Backend mínimo (docs/ia-chef.md, "Backend mínimo"). Un manejador `Request → Response` de la API
// web estándar: funciona en Node (servidor-node.ts) y en cualquier plataforma serverless.

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Limitador, Grupo } from './limite'
import {
  esquemaInstalacion,
  esquemaPeticionReceta,
  esquemaPeticionSustitucion,
  esquemaPeticionVoz,
  esquemaTokenVoz
} from './peticiones'
import type { ProveedorIA } from './proveedor'
import { filtrarSugerencias } from './sugerencias'
import { validarRecetaGenerada } from './validar-receta'

export interface Dependencias {
  proveedor: ProveedorIA
  limitador: Limitador
  /** Reloj (epoch ms); inyectable para los tests. */
  ahora?: () => number
  /** Ids de lo generado (`gen_…`); inyectable para los tests. */
  nuevoId?: () => string
  /** Dónde se anotan los fallos del proveedor; por defecto `console.error`. */
  registrarError?: (mensaje: string, error: unknown) => void
}

export const CODIGOS_ERROR_API = [
  'ruta_desconocida',
  'metodo_no_permitido',
  'instalacion_invalida',
  'json_invalido',
  'peticion_invalida',
  'ingrediente_desconocido',
  'limite_superado',
  'proveedor_fallo',
  'receta_invalida'
] as const
export type CodigoErrorApi = (typeof CODIGOS_ERROR_API)[number]

class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: CodigoErrorApi,
    mensaje: string,
    readonly cabeceras: Record<string, string> = {}
  ) {
    super(mensaje)
  }
}

interface Ruta {
  grupo: Grupo
  esquema: z.ZodType
  manejar: (cuerpo: never, instalacion: string) => Promise<unknown>
}

const json = (estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cabeceras }
  })

export function crearApp(dep: Dependencias): (peticion: Request) => Promise<Response> {
  const ahora = dep.ahora ?? Date.now
  const nuevoId =
    dep.nuevoId ?? ((): string => `gen_${randomUUID().replace(/-/g, '').slice(0, 12)}`)
  const registrarError = dep.registrarError ?? ((m, e): void => console.error(m, e))

  /** Llama al proveedor; si falla, 502 sin detalles internos para el cliente. */
  async function delProveedor<T>(trabajo: () => Promise<T>): Promise<T> {
    try {
      return await trabajo()
    } catch (error) {
      registrarError(`El proveedor ${dep.proveedor.nombre} falló`, error)
      throw new ErrorApi(
        502,
        'proveedor_fallo',
        'El servicio de IA no respondió. Inténtalo de nuevo.'
      )
    }
  }

  const rutas: Record<string, Ruta> = {
    '/voz/token': {
      grupo: 'voz',
      esquema: esquemaPeticionVoz,
      manejar: async (_cuerpo: z.output<typeof esquemaPeticionVoz>, instalacion: string) => {
        const bruto = await delProveedor(() => dep.proveedor.crearTokenVoz(instalacion))
        const token = esquemaTokenVoz.safeParse(bruto)
        if (!token.success) {
          registrarError('Token de voz con formato inesperado', token.error)
          throw new ErrorApi(
            502,
            'proveedor_fallo',
            'El servicio de voz devolvió un token no válido.'
          )
        }
        return token.data
      }
    },

    '/recetas/generar': {
      grupo: 'recetas',
      esquema: esquemaPeticionReceta,
      manejar: async (cuerpo: z.output<typeof esquemaPeticionReceta>) => {
        const id = nuevoId()
        // Un intento y, si no pasa la validación, un reintento con el error.
        let error: string | null = null
        for (let intento = 0; intento < 2; intento++) {
          const bruta = await delProveedor(() => dep.proveedor.generarReceta(cuerpo, error))
          const validacion = validarRecetaGenerada(bruta, cuerpo, id)
          if (validacion.ok) return { receta: validacion.receta }
          error = validacion.error
        }
        throw new ErrorApi(
          422,
          'receta_invalida',
          `La receta generada no pasó la validación dos veces: ${error}`
        )
      }
    },

    '/sustituciones/sugerir': {
      grupo: 'sustituciones',
      esquema: esquemaPeticionSustitucion,
      manejar: async (cuerpo: z.output<typeof esquemaPeticionSustitucion>) => {
        if (!cuerpo.catalogo.some((i) => i.id === cuerpo.ingredienteId)) {
          throw new ErrorApi(
            400,
            'ingrediente_desconocido',
            `El ingrediente ${cuerpo.ingredienteId} no está en el catálogo enviado.`
          )
        }
        const bruta = await delProveedor(() => dep.proveedor.sugerirSustituciones(cuerpo))
        return { sustituciones: filtrarSugerencias(bruta, cuerpo, nuevoId) }
      }
    }
  }

  return async function manejar(peticion: Request): Promise<Response> {
    try {
      const ruta = rutas[new URL(peticion.url).pathname.replace(/\/+$/, '')]
      if (!ruta) throw new ErrorApi(404, 'ruta_desconocida', 'Esta ruta no existe.')
      if (peticion.method !== 'POST') {
        throw new ErrorApi(405, 'metodo_no_permitido', 'Usa POST.', { allow: 'POST' })
      }

      const instalacion = esquemaInstalacion.safeParse(peticion.headers.get('x-instalacion'))
      if (!instalacion.success) {
        throw new ErrorApi(
          400,
          'instalacion_invalida',
          'Falta la cabecera X-Instalacion o no tiene un formato válido.'
        )
      }

      let bruto: unknown
      try {
        const texto = await peticion.text()
        bruto = texto.trim() === '' ? {} : JSON.parse(texto)
      } catch {
        throw new ErrorApi(400, 'json_invalido', 'El cuerpo no es JSON válido.')
      }
      const cuerpo = ruta.esquema.safeParse(bruto)
      if (!cuerpo.success) {
        throw new ErrorApi(400, 'peticion_invalida', z.prettifyError(cuerpo.error))
      }

      // Se cuenta solo lo que llega bien formado, antes de gastar en el proveedor.
      const consumo = await dep.limitador.consumir(instalacion.data, ruta.grupo, ahora())
      if (!consumo.permitido) {
        throw new ErrorApi(
          429,
          'limite_superado',
          'Has llegado al límite de uso de hoy para esta función.',
          { 'retry-after': String(consumo.reintentarEnSeg) }
        )
      }

      const respuesta = await ruta.manejar(cuerpo.data as never, instalacion.data)
      return json(200, respuesta, { 'x-limite-restantes': String(consumo.restantes) })
    } catch (error) {
      if (error instanceof ErrorApi) {
        return json(
          error.estado,
          { error: { codigo: error.codigo, mensaje: error.message } },
          error.cabeceras
        )
      }
      registrarError('Error inesperado en el backend', error)
      return json(500, { error: { codigo: 'proveedor_fallo', mensaje: 'Error interno.' } })
    }
  }
}

// Contrato de las herramientas del chef (docs/ia-chef.md, "Herramientas").
//
// Una sola fuente: los esquemas zod validan los argumentos en `aplicarHerramienta` y de ellos se
// generan las definiciones JSON Schema que recibe el modelo. Los botones de la interfaz y las
// órdenes locales usan exactamente las mismas herramientas.

import { z } from 'zod'
import { SEGUNDOS_TEMPORIZADOR_MAX, SEGUNDOS_TEMPORIZADOR_MIN, esquemaId } from '../esquemas/receta'
import { PORCIONES_MAX, PORCIONES_MIN } from '../esquemas/sesion'
import type { AvisoEscalado } from '../recetas/escalado'
import type { OpcionSustitucion } from '../types/busqueda'
import type { Tecnica } from '../types/receta'
import type { EstadoAvatar, EstadoTemporizador, Fase, SesionCocina } from '../types/sesion'

/** Máximo de temporizadores activos (corriendo o pausados) a la vez. */
export const MAX_TEMPORIZADORES_ACTIVOS = 4
export const LONGITUD_MAX_ETIQUETA = 40

export const NOMBRES_HERRAMIENTAS = [
  'avanzar_paso',
  'retroceder_paso',
  'ir_a_paso',
  'iniciar_temporizador',
  'controlar_temporizador',
  'cambiar_porciones',
  'mostrar_tecnica',
  'sustituir_ingrediente',
  'terminar_receta'
] as const
export type NombreHerramienta = (typeof NOMBRES_HERRAMIENTAS)[number]

export const ACCIONES_TEMPORIZADOR = ['pausar', 'reanudar', 'cancelar', 'sumar'] as const
export type AccionTemporizador = (typeof ACCIONES_TEMPORIZADOR)[number]

const segundosTemporizador = z
  .number()
  .int()
  .min(SEGUNDOS_TEMPORIZADOR_MIN)
  .max(SEGUNDOS_TEMPORIZADOR_MAX)
const etiqueta = z.string().trim().min(1).max(LONGITUD_MAX_ETIQUETA)

/** Argumentos de cada herramienta. Objetos estrictos: el modelo no puede añadir campos. */
export const ARGUMENTOS = {
  avanzar_paso: z.strictObject({}),
  retroceder_paso: z.strictObject({}),
  ir_a_paso: z.strictObject({
    orden: z.number().int().min(1).describe('Número del paso, empezando en 1.')
  }),
  iniciar_temporizador: z.strictObject({
    segundos: segundosTemporizador.describe('Duración en segundos (de 10 s a 6 h).'),
    etiqueta: etiqueta.describe('Nombre corto para reconocerlo: "Arroz", "Pasta".'),
    pasoId: esquemaId.optional().describe('Paso al que pertenece, si aplica.')
  }),
  controlar_temporizador: z
    .strictObject({
      id: z.string().min(1).optional().describe('Id del temporizador.'),
      etiqueta: etiqueta.optional().describe('Nombre del temporizador, si no se sabe el id.'),
      accion: z.enum(ACCIONES_TEMPORIZADOR),
      segundos: z
        .number()
        .int()
        .min(1)
        .max(SEGUNDOS_TEMPORIZADOR_MAX)
        .optional()
        .describe('Segundos a sumar; solo con accion "sumar".')
    })
    .refine((a) => a.id !== undefined || a.etiqueta !== undefined, {
      message: 'indica el id o la etiqueta del temporizador'
    })
    .refine((a) => (a.accion === 'sumar') === (a.segundos !== undefined), {
      message: 'segundos va solo con la acción sumar, y sumar lo necesita'
    }),
  cambiar_porciones: z.strictObject({
    porciones: z.number().int().min(PORCIONES_MIN).max(PORCIONES_MAX)
  }),
  mostrar_tecnica: z.strictObject({
    tecnicaId: esquemaId.optional().describe('Por defecto, la técnica del paso actual.')
  }),
  sustituir_ingrediente: z.strictObject({
    ingredienteId: esquemaId.describe('Ingrediente de la receta que se quiere cambiar.'),
    sustitutoId: esquemaId
      .optional()
      .describe('Ingrediente por el que se cambia. Sin él, devuelve las opciones.')
  }),
  terminar_receta: z.strictObject({})
} as const satisfies Record<NombreHerramienta, z.ZodType>

export type ArgumentosHerramienta<N extends NombreHerramienta> = z.output<(typeof ARGUMENTOS)[N]>

const DESCRIPCIONES: Record<NombreHerramienta, string> = {
  avanzar_paso:
    'Pasa al siguiente paso. Si el paso actual requiere confirmación, solo funciona cuando el usuario ha dicho que terminó. No lo uses solo porque acabó un temporizador: pregunta antes.',
  retroceder_paso: 'Vuelve al paso anterior.',
  ir_a_paso: 'Salta a un paso concreto ("vuelve a lo del arroz").',
  iniciar_temporizador: `Crea un temporizador con nombre. Máximo ${MAX_TEMPORIZADORES_ACTIVOS} activos a la vez.`,
  controlar_temporizador:
    'Pausa, reanuda, cancela o suma tiempo a un temporizador, identificado por id o por etiqueta.',
  cambiar_porciones: `Recalcula las cantidades para otro número de porciones (${PORCIONES_MIN} a ${PORCIONES_MAX}). Conserva el paso actual.`,
  mostrar_tecnica: 'Muestra en pantalla cómo se hace una técnica (por defecto la del paso actual).',
  sustituir_ingrediente:
    'Sin sustitutoId, devuelve las sustituciones posibles para un ingrediente. Con sustitutoId, aplica la sustitución y recalcula la receta.',
  terminar_receta: 'Termina la receta. Solo en el último paso.'
}

/** Definición para el modelo, independiente del proveedor (el adaptador va en server/). */
export interface DefinicionHerramienta {
  nombre: NombreHerramienta
  descripcion: string
  /** JSON Schema (draft 2020-12) de los argumentos, sin la clave `$schema`. */
  parametros: Record<string, unknown>
}

export const DEFINICIONES_HERRAMIENTAS: DefinicionHerramienta[] = NOMBRES_HERRAMIENTAS.map(
  (nombre) => {
    const parametros: Record<string, unknown> = { ...z.toJSONSchema(ARGUMENTOS[nombre]) }
    delete parametros.$schema
    return { nombre, descripcion: DESCRIPCIONES[nombre], parametros }
  }
)

/**
 * Una llamada a herramienta, venga de un botón, de una orden local o del modelo.
 * `confirmado` lo pone la app (botón pulsado u orden "listo" reconocida en este turno), nunca el
 * modelo: por eso no forma parte de los argumentos.
 */
export interface LlamadaHerramienta {
  nombre: NombreHerramienta
  argumentos: unknown
  confirmado: boolean
}

export const esquemaLlamadaHerramienta = z.strictObject({
  nombre: z.enum(NOMBRES_HERRAMIENTAS),
  argumentos: z.unknown(),
  confirmado: z.boolean()
})

export const CODIGOS_ERROR = [
  'argumentos_invalidos',
  'fase_incorrecta',
  'falta_confirmacion',
  'ultimo_paso',
  'primer_paso',
  'paso_inexistente',
  'demasiados_temporizadores',
  'etiqueta_repetida',
  'temporizador_inexistente',
  'temporizador_ambiguo',
  'accion_no_valida',
  'sin_tecnica',
  'tecnica_inexistente',
  'ingrediente_no_en_receta',
  'sustitucion_no_disponible',
  'rompe_restricciones',
  'no_es_ultimo_paso'
] as const
export type CodigoError = (typeof CODIGOS_ERROR)[number]

/** Resumen del estado de la cocina que acompaña a cada resultado (para el modelo y la interfaz). */
export interface EstadoCocina {
  fase: Fase
  receta: string | null
  porciones: number
  pasoActual: number | null
  totalPasos: number
  temporizadores: {
    id: string
    etiqueta: string
    estado: EstadoTemporizador
    /** Calculado con el reloj en el momento del resultado. */
    restanteSeg: number
  }[]
}

/** Datos extra que devuelven algunas herramientas. */
export interface DatosResultado {
  /** `avanzar_paso`: el nuevo paso propone un temporizador (no se crea solo). */
  temporizadorSugerido?: { etiqueta: string; segundos: number; pasoId: string }
  /** `iniciar_temporizador` y `controlar_temporizador`: id del temporizador afectado. */
  temporizadorId?: string
  /** `cambiar_porciones`: aviso por factor extremo. */
  aviso?: AvisoEscalado
  /** `mostrar_tecnica`: la técnica a mostrar en el panel. */
  tecnica?: Tecnica
  /** `sustituir_ingrediente` sin `sustitutoId`. */
  opciones?: OpcionSustitucion[]
}

export type ResultadoHerramienta =
  | { ok: true; estado: EstadoCocina; datos?: DatosResultado; decir?: string }
  | { ok: false; error: { codigo: CodigoError; mensaje: string }; decir?: string }

export interface AplicacionHerramienta {
  /** La sesión nueva si `resultado.ok`; la misma sesión recibida si falló. */
  sesion: SesionCocina
  resultado: ResultadoHerramienta
  avatar: EstadoAvatar
}

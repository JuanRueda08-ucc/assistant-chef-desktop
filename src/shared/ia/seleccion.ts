import { z } from 'zod'
import { esquemaId } from '../esquemas/receta'
import { esquemaPreferencias } from '../esquemas/sesion'
import { buscarIngredientes, normalizarTexto } from '../recetas/catalogo'
import type { Ingrediente } from '../types/receta'
import type { Preferencias } from '../types/sesion'
import type { ResultadoBusqueda } from '../types/busqueda'

const camposPreferencias = esquemaPreferencias.omit({ ingredientes: true }).shape
// Los argumentos parciales pertenecen al protocolo de herramientas; Preferencias sigue completa.
export const ARGUMENTOS_SELECCION = {
  marcar_ingredientes: z.strictObject({
    ingredientes: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
    accion: z.enum(['anadir', 'quitar', 'reemplazar'])
  }),
  cambiar_preferencias: z
    .strictObject(camposPreferencias)
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Indica alguna preferencia.'),
  buscar_recetas: z.strictObject({}),
  ver_receta: z.strictObject({ recetaId: esquemaId }),
  elegir_receta: z.strictObject({ recetaId: esquemaId })
} as const
export type NombreSeleccion = keyof typeof ARGUMENTOS_SELECCION
const descripciones: Record<NombreSeleccion, string> = {
  marcar_ingredientes:
    'Añade, quita o reemplaza los ingredientes disponibles. Usa ids o nombres del catálogo; ante ambigüedad pregunta. Reemplazar solo si lo pide el usuario.',
  cambiar_preferencias:
    'Cambia solo las preferencias solicitadas. Las listas reemplazan su campo completo: conserva las restricciones y alergias previas salvo petición explícita. No inventes equipo disponible.',
  buscar_recetas:
    'Busca recetas con las preferencias actuales y abre Elegir. Los filtros y cantidades los calcula la app. Hazlo después de actualizar ingredientes/preferencias.',
  ver_receta: 'Muestra una de las recetas devueltas por buscar_recetas.',
  elegir_receta:
    'Empieza a cocinar una receta de los resultados actuales, solo cuando el usuario la elige.'
}
export const DEFINICIONES_SELECCION = (Object.keys(ARGUMENTOS_SELECCION) as NombreSeleccion[]).map(
  (nombre) => {
    const parametros: Record<string, unknown> = { ...z.toJSONSchema(ARGUMENTOS_SELECCION[nombre]) }
    delete parametros.$schema
    return { nombre, descripcion: descripciones[nombre], parametros }
  }
)
export interface EstadoSeleccion {
  preferencias: Preferencias
  busqueda: ResultadoBusqueda | null
  recetaVisibleId: string | null
  pantalla: 'preparar' | 'elegir'
}
export type AplicacionSeleccion = {
  ok: boolean
  estado: EstadoSeleccion
  iniciarRecetaId: string | null
  decir: string
}

/** Puro: valida todo antes de devolver un estado nuevo. Nunca cambia una SesionCocina. */
export function aplicarSeleccion(
  estado: EstadoSeleccion,
  nombre: string,
  argumentos: unknown,
  catalogo: Ingrediente[],
  busqueda: ResultadoBusqueda | null = null
): AplicacionSeleccion {
  const fallo = (decir: string): AplicacionSeleccion => ({
    ok: false,
    estado,
    iniciarRecetaId: null,
    decir
  })
  const exito = (
    nuevo: EstadoSeleccion,
    decir: string,
    iniciarRecetaId: string | null = null
  ): AplicacionSeleccion => ({ ok: true, estado: nuevo, iniciarRecetaId, decir })
  const invalidar = (preferencias: Preferencias): EstadoSeleccion => ({
    preferencias,
    busqueda: null,
    recetaVisibleId: null,
    pantalla: 'preparar'
  })
  if (!Object.hasOwn(ARGUMENTOS_SELECCION, nombre))
    return fallo('Esa herramienta no está disponible en esta pantalla.')
  if (nombre === 'marcar_ingredientes') {
    const a = ARGUMENTOS_SELECCION.marcar_ingredientes.safeParse(argumentos)
    if (!a.success) return fallo('Indica los ingredientes y si quieres añadirlos o quitarlos.')
    const ids: string[] = []
    for (const texto of a.data.ingredientes) {
      const exactos = catalogo.filter((i) =>
        [i.id, i.nombre, ...i.sinonimos].some((n) => normalizarTexto(n) === normalizarTexto(texto))
      )
      const candidatos = exactos.length ? exactos : buscarIngredientes(catalogo, texto)
      if (candidatos.length !== 1)
        return fallo(
          `No puedo identificar «${texto}» con certeza. Elígelo en el catálogo o especifica su nombre.`
        )
      ids.push(candidatos[0]!.id)
    }
    const anteriores = estado.preferencias.ingredientes
    const ingredientes =
      a.data.accion === 'quitar'
        ? anteriores.filter((id) => !ids.includes(id))
        : [...new Set([...(a.data.accion === 'anadir' ? anteriores : []), ...ids])]
    return exito(
      invalidar({ ...estado.preferencias, ingredientes }),
      'He actualizado tus ingredientes.'
    )
  }
  if (nombre === 'cambiar_preferencias') {
    const a = ARGUMENTOS_SELECCION.cambiar_preferencias.safeParse(argumentos)
    if (!a.success)
      return fallo('Esas preferencias no son válidas. Las porciones deben estar entre 1 y 20.')
    return exito(
      invalidar({ ...estado.preferencias, ...a.data }),
      'He actualizado tus preferencias.'
    )
  }
  if (nombre === 'buscar_recetas') {
    if (!ARGUMENTOS_SELECCION.buscar_recetas.safeParse(argumentos).success || !busqueda)
      return fallo('No pude completar la búsqueda.')
    return exito(
      {
        ...estado,
        busqueda,
        pantalla: 'elegir',
        recetaVisibleId: busqueda.resultados[0]?.receta.id ?? null
      },
      busqueda.resultados.length
        ? `Encontré ${busqueda.resultados.length} ${busqueda.resultados.length === 1 ? 'receta' : 'recetas'}. Puedes ver qué te falta.`
        : 'No hay recetas revisadas que cumplan estos filtros. Puedes ajustar tus preferencias.'
    )
  }
  const a = ARGUMENTOS_SELECCION.ver_receta.safeParse(argumentos)
  if (!a.success || !estado.busqueda?.resultados.some((r) => r.receta.id === a.data.recetaId))
    return fallo('Busca primero y elige una receta de los resultados actuales.')
  return exito(
    { ...estado, pantalla: 'elegir', recetaVisibleId: a.data.recetaId },
    nombre === 'elegir_receta' ? 'Vamos a cocinar.' : 'Aquí tienes la receta.',
    nombre === 'elegir_receta' ? a.data.recetaId : null
  )
}

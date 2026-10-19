// El único sitio donde cambia el estado de la cocina (docs/ia-chef.md, "Herramientas").
// Lo usan los botones, las órdenes locales y el modelo. Puro: no lee el reloj, no toca la base
// y nunca modifica la sesión recibida; si algo falla, devuelve la misma sesión.

import type { z } from 'zod'
import {
  ARGUMENTOS,
  MAX_TEMPORIZADORES_ACTIVOS,
  NOMBRES_HERRAMIENTAS,
  type AplicacionHerramienta,
  type CodigoError,
  type DatosResultado,
  type EstadoCocina,
  type LlamadaHerramienta
} from '../ia/herramientas'
import { SEGUNDOS_TEMPORIZADOR_MAX } from '../esquemas/receta'
import { opcionesDeSustitucion, destinoPermitido } from '../recetas/busqueda'
import { avisoEscalado } from '../recetas/escalado'
import { comoMapa, type Catalogo } from '../recetas/etiquetas'
import type { Paso, Receta, Sustitucion, Tecnica } from '../types/receta'
import type { EstadoAvatar, SesionCocina, Temporizador } from '../types/sesion'
import { MAX_EVENTOS, adaptarReceta } from './sesion'
import {
  actualizarTemporizadores,
  cancelar,
  crearTemporizador,
  estaActivo,
  formatearDuracion,
  pausar,
  reanudar,
  restanteSeg,
  siguienteIdTemporizador,
  sumar
} from './temporizadores'

/** Datos de solo lectura que necesitan las herramientas, cargados por quien llama. */
export interface ContextoCocina {
  /** Receta original de la sesión (sin escalar ni sustituir, con etiquetas derivadas). */
  receta: Receta
  catalogo: Catalogo
  sustituciones: readonly Sustitucion[]
  tecnicas: readonly Tecnica[]
}

type Cocinando = SesionCocina & { recetaAdaptada: Receta; pasoActual: number }

interface Exito {
  sesion: Cocinando | SesionCocina
  avatar: EstadoAvatar
  /** Para el historial de eventos. */
  descripcion: string
  datos?: DatosResultado
  decir?: string
}

interface Fallo {
  codigo: CodigoError
  mensaje: string
  decir?: string
}

const HABLAR: EstadoAvatar = { accion: 'hablar' }

/**
 * Aplica una herramienta a la sesión. `ahora` es epoch en ms (lo pasa quien llama, para que la
 * función sea determinista). Valida argumentos y precondiciones; si fallan, no hay efecto.
 */
export function aplicarHerramienta(
  sesion: SesionCocina,
  llamada: LlamadaHerramienta,
  ahora: number,
  contexto: ContextoCocina
): AplicacionHerramienta {
  const fallar = (f: Fallo): AplicacionHerramienta => ({
    sesion,
    resultado: {
      ok: false,
      error: { codigo: f.codigo, mensaje: f.mensaje },
      ...(f.decir !== undefined && { decir: f.decir })
    },
    avatar: HABLAR
  })

  if (!(NOMBRES_HERRAMIENTAS as readonly string[]).includes(llamada.nombre)) {
    return fallar({
      codigo: 'argumentos_invalidos',
      mensaje: `herramienta desconocida: ${llamada.nombre}`
    })
  }
  if (!estaCocinando(sesion)) {
    return fallar({
      codigo: 'fase_incorrecta',
      mensaje: `las herramientas solo funcionan en la fase cocinar (fase actual: ${sesion.fase})`
    })
  }
  if (contexto.receta.id !== sesion.recetaId) {
    throw new Error(
      `el contexto es de la receta ${contexto.receta.id}, la sesión de ${sesion.recetaId}`
    )
  }

  const base = actualizarTemporizadores(sesion, ahora) as Cocinando
  const salida = ejecutar(base, llamada, ahora, contexto)
  if ('codigo' in salida) return fallar(salida)

  const nueva: SesionCocina = {
    ...salida.sesion,
    eventos: [
      ...salida.sesion.eventos,
      { en: ahora, tipo: llamada.nombre, descripcion: salida.descripcion }
    ].slice(-MAX_EVENTOS),
    actualizadaEn: new Date(ahora).toISOString()
  }
  return {
    sesion: nueva,
    resultado: {
      ok: true,
      estado: resumirEstado(nueva, ahora),
      ...(salida.datos !== undefined && { datos: salida.datos }),
      ...(salida.decir !== undefined && { decir: salida.decir })
    },
    avatar: salida.avatar
  }
}

/** Resumen de la sesión que acompaña a cada resultado. */
export function resumirEstado(sesion: SesionCocina, ahora: number): EstadoCocina {
  return {
    fase: sesion.fase,
    receta: sesion.recetaAdaptada?.titulo ?? null,
    porciones: sesion.porciones,
    pasoActual: sesion.pasoActual,
    totalPasos: sesion.recetaAdaptada?.pasos.length ?? 0,
    temporizadores: sesion.temporizadores
      .filter((t) => t.estado !== 'cancelado')
      .map((t) => ({
        id: t.id,
        etiqueta: t.etiqueta,
        estado: t.estado,
        restanteSeg: restanteSeg(t, ahora)
      }))
  }
}

function estaCocinando(sesion: SesionCocina): sesion is Cocinando {
  return sesion.fase === 'cocinar' && sesion.recetaAdaptada !== null && sesion.pasoActual !== null
}

function leer<S extends z.ZodType>(esquema: S, argumentos: unknown): z.output<S> | Fallo {
  const resultado = esquema.safeParse(argumentos ?? {})
  if (resultado.success) return resultado.data
  return {
    codigo: 'argumentos_invalidos',
    mensaje: resultado.error.issues
      .map((i) => `${i.path.join('.') || 'argumentos'}: ${i.message}`)
      .join('; ')
  }
}

function esFallo(valor: unknown): valor is Fallo {
  return typeof valor === 'object' && valor !== null && 'codigo' in valor && 'mensaje' in valor
}

function ejecutar(
  s: Cocinando,
  llamada: LlamadaHerramienta,
  ahora: number,
  ctx: ContextoCocina
): Exito | Fallo {
  switch (llamada.nombre) {
    case 'avanzar_paso': {
      const a = leer(ARGUMENTOS.avanzar_paso, llamada.argumentos)
      return esFallo(a) ? a : avanzarPaso(s, llamada.confirmado)
    }
    case 'retroceder_paso': {
      const a = leer(ARGUMENTOS.retroceder_paso, llamada.argumentos)
      return esFallo(a) ? a : retrocederPaso(s)
    }
    case 'ir_a_paso': {
      const a = leer(ARGUMENTOS.ir_a_paso, llamada.argumentos)
      return esFallo(a) ? a : irAPaso(s, a.orden)
    }
    case 'iniciar_temporizador': {
      const a = leer(ARGUMENTOS.iniciar_temporizador, llamada.argumentos)
      return esFallo(a) ? a : iniciarTemporizador(s, a, ahora)
    }
    case 'controlar_temporizador': {
      const a = leer(ARGUMENTOS.controlar_temporizador, llamada.argumentos)
      return esFallo(a) ? a : controlarTemporizador(s, a, ahora)
    }
    case 'cambiar_porciones': {
      const a = leer(ARGUMENTOS.cambiar_porciones, llamada.argumentos)
      return esFallo(a) ? a : cambiarPorciones(s, a.porciones, ctx)
    }
    case 'mostrar_tecnica': {
      const a = leer(ARGUMENTOS.mostrar_tecnica, llamada.argumentos)
      return esFallo(a) ? a : mostrarTecnica(s, a.tecnicaId, ctx)
    }
    case 'sustituir_ingrediente': {
      const a = leer(ARGUMENTOS.sustituir_ingrediente, llamada.argumentos)
      return esFallo(a) ? a : sustituirIngrediente(s, a.ingredienteId, a.sustitutoId, ctx)
    }
    case 'terminar_receta': {
      const a = leer(ARGUMENTOS.terminar_receta, llamada.argumentos)
      return esFallo(a) ? a : terminarReceta(s)
    }
  }
}

// --- Pasos ---------------------------------------------------------------------------------

const pasoEn = (s: Cocinando, orden: number): Paso => {
  const paso = s.recetaAdaptada.pasos[orden - 1]
  if (!paso) throw new Error(`la receta adaptada no tiene el paso ${orden}`)
  return paso
}
const textoPaso = (paso: Paso): string => paso.textoVoz ?? paso.texto
const conHecho = (hechos: readonly string[], id: string): string[] =>
  hechos.includes(id) ? [...hechos] : [...hechos, id]

function avanzarPaso(s: Cocinando, confirmado: boolean): Exito | Fallo {
  const total = s.recetaAdaptada.pasos.length
  if (s.pasoActual >= total) {
    return {
      codigo: 'ultimo_paso',
      mensaje: 'ya es el último paso; usa terminar_receta',
      decir: 'Este es el último paso. Cuando termines, dime que has terminado.'
    }
  }
  const actual = pasoEn(s, s.pasoActual)
  if (actual.requiereConfirmacion && !confirmado) {
    return {
      codigo: 'falta_confirmacion',
      mensaje: `el paso ${actual.orden} requiere que el usuario confirme que terminó`,
      decir: actual.senalHecho
        ? `Avísame cuando esté listo: ${actual.senalHecho}.`
        : 'Avísame cuando termines este paso.'
    }
  }
  const siguiente = pasoEn(s, s.pasoActual + 1)
  const sugerido = siguiente.temporizador
  return {
    sesion: { ...s, pasoActual: siguiente.orden, pasosHechos: conHecho(s.pasosHechos, actual.id) },
    avatar: HABLAR,
    descripcion: `Paso ${siguiente.orden} de ${total}`,
    ...(sugerido && {
      datos: {
        temporizadorSugerido: {
          etiqueta: sugerido.etiqueta,
          segundos: sugerido.segundos,
          pasoId: siguiente.id
        }
      }
    }),
    decir: sugerido
      ? `${textoPaso(siguiente)} ¿Pongo un temporizador de ${formatearDuracion(sugerido.segundos)} para ${sugerido.etiqueta}?`
      : textoPaso(siguiente)
  }
}

function retrocederPaso(s: Cocinando): Exito | Fallo {
  if (s.pasoActual <= 1) {
    return {
      codigo: 'primer_paso',
      mensaje: 'ya es el primer paso',
      decir: 'Ya estamos en el primer paso.'
    }
  }
  const anterior = pasoEn(s, s.pasoActual - 1)
  return {
    sesion: { ...s, pasoActual: anterior.orden },
    avatar: HABLAR,
    descripcion: `Vuelve al paso ${anterior.orden}`,
    decir: textoPaso(anterior)
  }
}

function irAPaso(s: Cocinando, orden: number): Exito | Fallo {
  const total = s.recetaAdaptada.pasos.length
  if (orden > total) {
    return {
      codigo: 'paso_inexistente',
      mensaje: `la receta tiene ${total} pasos`,
      decir: `La receta tiene ${total} pasos.`
    }
  }
  const paso = pasoEn(s, orden)
  return {
    sesion: { ...s, pasoActual: orden },
    avatar: HABLAR,
    descripcion: `Salta al paso ${orden}`,
    decir: textoPaso(paso)
  }
}

function terminarReceta(s: Cocinando): Exito | Fallo {
  const total = s.recetaAdaptada.pasos.length
  if (s.pasoActual !== total) {
    return {
      codigo: 'no_es_ultimo_paso',
      mensaje: `solo se puede terminar en el último paso (${total}); paso actual: ${s.pasoActual}`,
      decir: `Aún quedan pasos: vamos por el ${s.pasoActual} de ${total}.`
    }
  }
  const ultimo = pasoEn(s, total)
  return {
    sesion: {
      ...s,
      fase: 'terminado',
      pasoActual: null,
      pasosHechos: conHecho(s.pasosHechos, ultimo.id)
    },
    avatar: { accion: 'celebrar', intensidad: 'completa' },
    descripcion: 'Receta terminada',
    decir: '¡Listo! Que aproveche.'
  }
}

// --- Temporizadores ------------------------------------------------------------------------

const mismaEtiqueta = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

function iniciarTemporizador(
  s: Cocinando,
  a: { segundos: number; etiqueta: string; pasoId?: string | undefined },
  ahora: number
): Exito | Fallo {
  const activos = s.temporizadores.filter(estaActivo)
  if (activos.length >= MAX_TEMPORIZADORES_ACTIVOS) {
    return {
      codigo: 'demasiados_temporizadores',
      mensaje: `ya hay ${MAX_TEMPORIZADORES_ACTIVOS} temporizadores activos`,
      decir: `Ya tienes ${MAX_TEMPORIZADORES_ACTIVOS} temporizadores en marcha. ¿Cancelo alguno?`
    }
  }
  if (activos.some((t) => mismaEtiqueta(t.etiqueta, a.etiqueta))) {
    return {
      codigo: 'etiqueta_repetida',
      mensaje: `ya hay un temporizador activo llamado "${a.etiqueta}"`,
      decir: `Ya hay un temporizador de ${a.etiqueta}. ¿Le sumo tiempo?`
    }
  }
  if (a.pasoId !== undefined && !s.recetaAdaptada.pasos.some((p) => p.id === a.pasoId)) {
    return { codigo: 'paso_inexistente', mensaje: `la receta no tiene el paso ${a.pasoId}` }
  }
  const id = siguienteIdTemporizador(s.temporizadores)
  return {
    sesion: {
      ...s,
      temporizadores: [
        ...s.temporizadores,
        crearTemporizador(id, a.etiqueta, a.segundos, a.pasoId ?? null, ahora)
      ]
    },
    avatar: { accion: 'senalar', objetivo: 'temporizadores' },
    descripcion: `Temporizador ${a.etiqueta} (${formatearDuracion(a.segundos)})`,
    datos: { temporizadorId: id },
    decir: `Temporizador de ${formatearDuracion(a.segundos)} para ${a.etiqueta} en marcha.`
  }
}

/** Por id, o por etiqueta entre los no cancelados (si hay varios, se prefieren los activos). */
function buscarTemporizador(
  temporizadores: readonly Temporizador[],
  a: { id?: string | undefined; etiqueta?: string | undefined }
): Temporizador | Fallo {
  const vivos = temporizadores.filter((t) => t.estado !== 'cancelado')
  if (a.id !== undefined) {
    const t = vivos.find((x) => x.id === a.id)
    return t ?? { codigo: 'temporizador_inexistente', mensaje: `no hay temporizador ${a.id}` }
  }
  const etiqueta = a.etiqueta ?? ''
  let candidatos = vivos.filter((t) => mismaEtiqueta(t.etiqueta, etiqueta))
  if (candidatos.length > 1) {
    // Varios con la misma etiqueta: si alguno está activo, es ese; si no, es ambiguo.
    const activos = candidatos.filter(estaActivo)
    if (activos.length > 0) candidatos = activos
  }
  const [unico] = candidatos
  if (candidatos.length === 1 && unico) return unico
  if (candidatos.length === 0) {
    return {
      codigo: 'temporizador_inexistente',
      mensaje: `no hay temporizador "${etiqueta}"`,
      decir: `No encuentro el temporizador de ${etiqueta}.`
    }
  }
  return {
    codigo: 'temporizador_ambiguo',
    mensaje: `hay varios temporizadores "${etiqueta}"; usa el id`
  }
}

function controlarTemporizador(
  s: Cocinando,
  a: z.output<typeof ARGUMENTOS.controlar_temporizador>,
  ahora: number
): Exito | Fallo {
  const encontrado = buscarTemporizador(s.temporizadores, a)
  if (esFallo(encontrado)) return encontrado
  const t = encontrado
  const noValida = (motivo: string): Fallo => ({
    codigo: 'accion_no_valida',
    mensaje: `no se puede ${a.accion} el temporizador ${t.id}: ${motivo}`
  })

  let cambiado: Temporizador
  let decir: string
  switch (a.accion) {
    case 'pausar':
      if (t.estado !== 'corriendo') return noValida(`está ${t.estado}`)
      cambiado = pausar(t, ahora)
      decir = `Pausé ${t.etiqueta}. Quedan ${formatearDuracion(cambiado.restanteSeg)}.`
      break
    case 'reanudar':
      if (t.estado !== 'pausado') return noValida(`está ${t.estado}`)
      cambiado = reanudar(t, ahora)
      decir = `Sigue ${t.etiqueta}: quedan ${formatearDuracion(cambiado.restanteSeg)}.`
      break
    case 'cancelar':
      cambiado = cancelar(t, ahora)
      decir = `Cancelé el temporizador de ${t.etiqueta}.`
      break
    case 'sumar': {
      const segundos = a.segundos ?? 0
      if (
        t.estado === 'terminado' &&
        s.temporizadores.filter(estaActivo).length >= MAX_TEMPORIZADORES_ACTIVOS
      ) {
        return {
          codigo: 'demasiados_temporizadores',
          mensaje: `ya hay ${MAX_TEMPORIZADORES_ACTIVOS} temporizadores activos`
        }
      }
      cambiado = sumar(t, segundos, ahora)
      if (cambiado.restanteSeg > SEGUNDOS_TEMPORIZADOR_MAX) return noValida('pasaría de 6 horas')
      decir = `Sumé ${formatearDuracion(segundos)} a ${t.etiqueta}: quedan ${formatearDuracion(cambiado.restanteSeg)}.`
      break
    }
  }
  return {
    sesion: { ...s, temporizadores: s.temporizadores.map((x) => (x.id === t.id ? cambiado : x)) },
    avatar: HABLAR,
    descripcion: `Temporizador ${t.etiqueta}: ${a.accion}`,
    datos: { temporizadorId: t.id },
    decir
  }
}

// --- Receta --------------------------------------------------------------------------------

function cambiarPorciones(s: Cocinando, porciones: number, ctx: ContextoCocina): Exito {
  const aviso = avisoEscalado(porciones / ctx.receta.porcionesBase)
  return {
    sesion: {
      ...s,
      porciones,
      recetaAdaptada: adaptarReceta(ctx.receta, s.sustituciones, porciones, ctx.catalogo)
    },
    avatar: { accion: 'senalar', objetivo: 'ingredientes' },
    descripcion: `Porciones: ${porciones}`,
    ...(aviso && { datos: { aviso } }),
    decir: `Listo, cantidades para ${porciones} ${porciones === 1 ? 'porción' : 'porciones'}.${aviso ? ` ${aviso.mensaje}` : ''}`
  }
}

function mostrarTecnica(
  s: Cocinando,
  tecnicaId: string | undefined,
  ctx: ContextoCocina
): Exito | Fallo {
  const id = tecnicaId ?? pasoEn(s, s.pasoActual).tecnicaId
  if (id === null) {
    return {
      codigo: 'sin_tecnica',
      mensaje: `el paso ${s.pasoActual} no tiene técnica asociada`,
      decir: 'Este paso no tiene una técnica especial.'
    }
  }
  const tecnica = ctx.tecnicas.find((t) => t.id === id)
  if (!tecnica) return { codigo: 'tecnica_inexistente', mensaje: `no existe la técnica ${id}` }
  return {
    sesion: s,
    avatar: { accion: 'senalar', objetivo: 'panel' },
    descripcion: `Técnica ${tecnica.nombre}`,
    datos: { tecnica: structuredClone(tecnica) },
    decir: `${tecnica.nombre}: ${tecnica.descripcion}`
  }
}

function sustituirIngrediente(
  s: Cocinando,
  ingredienteId: string,
  sustitutoId: string | undefined,
  ctx: ContextoCocina
): Exito | Fallo {
  const porId = comoMapa(ctx.catalogo)
  const nombre = (id: string): string => porId.get(id)?.nombre ?? id
  if (!s.recetaAdaptada.ingredientes.some((ir) => ir.ingredienteId === ingredienteId)) {
    return {
      codigo: 'ingrediente_no_en_receta',
      mensaje: `la receta no usa ${ingredienteId}`,
      decir: `Esta receta no lleva ${nombre(ingredienteId)}.`
    }
  }

  if (sustitutoId === undefined) {
    const opciones = opcionesDeSustitucion(
      ingredienteId,
      s.recetaAdaptada.id,
      s.preferencias,
      porId,
      ctx.sustituciones
    )
    return {
      sesion: s,
      avatar: HABLAR,
      descripcion: `Opciones para ${nombre(ingredienteId)}`,
      datos: { opciones },
      decir:
        opciones.length > 0
          ? `En lugar de ${nombre(ingredienteId)} puedes usar ${unirConO(opciones.map((o) => o.nombreDestino))}.`
          : `No tengo una sustitución revisada para ${nombre(ingredienteId)}.`
    }
  }

  const candidata = ctx.sustituciones
    .filter(
      (x) =>
        x.ingredienteOrigenId === ingredienteId &&
        x.ingredienteDestinoId === sustitutoId &&
        (x.recetaId === null || x.recetaId === s.recetaAdaptada.id)
    )
    .sort((a, b) => Number(b.recetaId !== null) - Number(a.recetaId !== null))[0]
  if (!candidata || !porId.has(sustitutoId)) {
    return {
      codigo: 'sustitucion_no_disponible',
      mensaje: `no hay una sustitución de ${ingredienteId} por ${sustitutoId}`,
      decir: `No tengo una sustitución revisada de ${nombre(ingredienteId)} por ${nombre(sustitutoId)}.`
    }
  }
  if (!destinoPermitido(porId.get(sustitutoId), s.preferencias)) {
    return {
      codigo: 'rompe_restricciones',
      mensaje: `${sustitutoId} no cumple las restricciones o alergias del usuario`,
      decir: `${nombre(sustitutoId)} no encaja con tus restricciones.`
    }
  }

  const sustituciones = [
    ...s.sustituciones,
    {
      ingredienteOrigenId: ingredienteId,
      ingredienteDestinoId: sustitutoId,
      ratio: candidata.ratio,
      sustitucionId: candidata.id
    }
  ]
  return {
    sesion: {
      ...s,
      sustituciones,
      recetaAdaptada: adaptarReceta(ctx.receta, sustituciones, s.porciones, ctx.catalogo)
    },
    avatar: HABLAR,
    descripcion: `${nombre(ingredienteId)} → ${nombre(sustitutoId)}`,
    decir: `Hecho: ${nombre(sustitutoId)} en lugar de ${nombre(ingredienteId)}. ${candidata.impacto}`
  }
}

function unirConO(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('')
  return `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}`
}

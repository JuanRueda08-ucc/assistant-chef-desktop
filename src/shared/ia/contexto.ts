import { formatearReloj, restanteSeg } from '../cocina/temporizadores'
import { cantidadesDelPaso } from '../recetas/escalado'
import { NOMBRE_ALERGENO, NOMBRE_DIETA } from '../textos'
import type { SesionCocina } from '../types/sesion'

// Los ids acompañan al texto para que el modelo pueda llamar herramientas sin adivinarlos.
const citar = (texto: string): string => JSON.stringify(texto)

/** Bloque de cada turno; usa la receta ya adaptada y nunca modifica la sesión. */
export function contextoCompacto(sesion: SesionCocina, ahora: number): string {
  const receta = sesion.recetaAdaptada
  const paso = receta?.pasos.find((p) => p.orden === sesion.pasoActual)
  const siguiente = receta?.pasos.find((p) => p.orden === (sesion.pasoActual ?? -1) + 1)
  const ingredientes =
    receta && paso
      ? cantidadesDelPaso(receta, paso)
          .map((i) =>
            i.unidad === 'al_gusto'
              ? `${i.ingredienteId} al gusto`
              : `${i.ingredienteId} ${i.cantidad} ${i.unidad}`
          )
          .join(', ')
      : ''
  const temporizadores = sesion.temporizadores
    .filter((t) => t.estado !== 'cancelado')
    .map((t) => {
      const restante = restanteSeg(t, ahora)
      const estado = t.estado === 'corriendo' && restante === 0 ? 'terminado' : t.estado
      return `[${t.id}: ${citar(t.etiqueta)} ${formatearReloj(restante)} restante, ${estado}]`
    })
    .join(', ')
  const restricciones = [
    ...sesion.preferencias.restricciones.map((d) => NOMBRE_DIETA[d]),
    ...sesion.preferencias.alergias.map((a) => `alergia: ${NOMBRE_ALERGENO[a]}`)
  ].join(', ')
  return [
    receta
      ? `receta: ${citar(receta.titulo)} (${receta.origen}, ${receta.estadoRevision}) · ${sesion.porciones} porciones · paso ${sesion.pasoActual ?? 'ninguno'} de ${receta.pasos.length} · fase: ${sesion.fase}`
      : `receta: ninguna · ${sesion.porciones} porciones · fase: ${sesion.fase}`,
    paso
      ? `paso_actual: ${citar(paso.textoVoz ?? paso.texto)} · ingredientes: ${ingredientes || 'ninguno'} · requiere_confirmacion: ${paso.requiereConfirmacion ? 'sí' : 'no'} · técnica: ${paso.tecnicaId ?? 'ninguna'}${paso.seguridad ? ` · seguridad: ${citar(paso.seguridad)}` : ''}`
      : 'paso_actual: ninguno',
    `siguiente: ${siguiente ? citar(siguiente.textoVoz ?? siguiente.texto) : 'ninguno'}`,
    `temporizadores: ${temporizadores || 'ninguno'}`,
    `sustituciones: ${sesion.sustituciones.map((s) => `${s.ingredienteOrigenId} → ${s.ingredienteDestinoId}`).join(', ') || 'ninguna'}`,
    `restricciones: ${restricciones || 'ninguna'}`
  ].join('\n')
}

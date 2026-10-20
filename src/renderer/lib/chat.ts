import {
  esquemaRespuestaChat,
  type ContenidoChat,
  type LlamadaChat,
  type RespuestaChat
} from '@shared/ia/chat'

export interface TurnoChat {
  mensajes: ContenidoChat[]
  texto: string
  simulado: boolean
}

/** Conserva firmas y pares llamada/respuesta. Nunca muestra una promesa de cambio antes de ejecutarlo. */
export async function ejecutarTurnoChat(
  anteriores: ContenidoChat[],
  texto: string,
  solicitar: (mensajes: ContenidoChat[]) => Promise<RespuestaChat>,
  aplicar: (llamada: LlamadaChat) => Promise<Record<string, unknown>>
): Promise<TurnoChat> {
  const mensajes: ContenidoChat[] = [...anteriores, { role: 'user', parts: [{ text: texto }] }]
  const realizadas = new Map<string, { firma: string; resultado: Record<string, unknown> }>()
  let acciones = 0
  for (let ronda = 0; ronda < 4; ronda++) {
    const respuesta = esquemaRespuestaChat.parse(await solicitar(mensajes))
    mensajes.push(respuesta.contenido)
    const llamadas = respuesta.contenido.parts.flatMap((p) =>
      p.functionCall ? [p.functionCall] : []
    )
    if (!llamadas.length) {
      const texto = respuesta.contenido.parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('')
        .trim()
      if (!texto) throw new Error('El chef no devolvió una respuesta. Inténtalo de nuevo.')
      return { mensajes, texto, simulado: respuesta.simulado }
    }
    const parts: ContenidoChat['parts'] = []
    for (const llamada of llamadas) {
      const firma = JSON.stringify([llamada.name, llamada.args])
      const clave = llamada.id ?? firma
      const previa = realizadas.get(clave)
      if (previa && previa.firma !== firma)
        throw new Error(
          'El chef reutilizó un identificador para otra acción. Revisa lo aplicado en pantalla.'
        )
      let resultado = previa?.resultado
      if (!resultado) {
        if (++acciones > 8 || ronda === 3)
          throw new Error(
            'El chef pidió demasiadas acciones. Revisa lo aplicado en pantalla y concreta tu petición.'
          )
        resultado = await aplicar(llamada)
        realizadas.set(clave, { firma, resultado })
      }
      parts.push({
        functionResponse: {
          name: llamada.name,
          ...(llamada.id ? { id: llamada.id } : {}),
          response: resultado
        }
      })
      // Elegir o terminar cambia de fase/herramientas disponibles. Comunicamos el éxito real
      // sin continuar un turno con el contrato de la pantalla anterior.
      if (resultado.finalizar === true && resultado.ok === true) {
        const texto =
          typeof resultado.decir === 'string'
            ? resultado.decir
            : 'Receta terminada. ¡Buen provecho!'
        mensajes.push({ role: 'user', parts }, { role: 'model', parts: [{ text: texto }] })
        return { mensajes, texto, simulado: respuesta.simulado }
      }
    }
    mensajes.push({ role: 'user', parts })
  }
  throw new Error('No se pudo completar la consulta.')
}

import { describe, expect, it, vi } from 'vitest'
import type { ContenidoChat, RespuestaChat } from '@shared/ia/chat'
import { ejecutarTurnoChat } from './chat'

const respuesta = (parts: ContenidoChat['parts']): RespuestaChat => ({
  contenido: { role: 'model', parts },
  simulado: false
})

describe('turnos del chef sin red', () => {
  it('comunica el fin de receta sin pedir un nuevo contexto de sesión activa', async () => {
    const solicitar = vi
      .fn()
      .mockResolvedValue(respuesta([{ functionCall: { name: 'terminar_receta', args: {} } }]))
    const aplicar = vi
      .fn()
      .mockResolvedValue({ ok: true, finalizar: true, decir: 'Receta terminada.' })
    const r = await ejecutarTurnoChat([], 'termina', solicitar, aplicar)
    expect(r.texto).toBe('Receta terminada.')
    expect(solicitar).toHaveBeenCalledOnce()
    expect(r.mensajes.at(-2)!.parts[0]!.functionResponse?.response.ok).toBe(true)
  })
  it('ejecuta herramientas antes de responder y conserva firmas y errores reales', async () => {
    const llamada = { name: 'avanzar_paso', args: {}, id: 'a' }
    const solicitar = vi
      .fn()
      .mockResolvedValueOnce(
        respuesta([{ thoughtSignature: 'firma-opaca', functionCall: llamada }])
      )
      .mockResolvedValueOnce(respuesta([{ text: 'Pulsa Listo para confirmar.' }]))
    const aplicar = vi.fn().mockResolvedValue({ ok: false, decir: 'Falta confirmación.' })
    const r = await ejecutarTurnoChat([], 'avanza', solicitar, aplicar)
    expect(aplicar).toHaveBeenCalledWith(llamada)
    expect(r.texto).toBe('Pulsa Listo para confirmar.')
    expect(r.mensajes[1]!.parts[0]!.thoughtSignature).toBe('firma-opaca')
    expect(r.mensajes[2]!.parts[0]!.functionResponse).toMatchObject({
      id: 'a',
      name: llamada.name,
      response: { ok: false }
    })
  })
  it('deduplica llamadas con y sin id', async () => {
    for (const id of ['a', undefined]) {
      const solicitud = respuesta([
        {
          functionCall: { name: 'cambiar_porciones', args: { porciones: 2 }, ...(id ? { id } : {}) }
        }
      ])
      const solicitar = vi
        .fn()
        .mockResolvedValueOnce(solicitud)
        .mockResolvedValueOnce(solicitud)
        .mockResolvedValueOnce(respuesta([{ text: 'Cantidades actualizadas.' }]))
      const aplicar = vi.fn().mockResolvedValue({ ok: true })
      await ejecutarTurnoChat([], 'para 2', solicitar, aplicar)
      expect(aplicar).toHaveBeenCalledOnce()
    }
  })
  it('acota bucles y no ejecuta una última ronda sin posibilidad de comunicar su resultado', async () => {
    let id = 0
    const solicitar = vi.fn(async () =>
      respuesta([{ functionCall: { name: 'mostrar_tecnica', args: {}, id: String(++id) } }])
    )
    const aplicar = vi.fn().mockResolvedValue({ ok: true })
    await expect(ejecutarTurnoChat([], 'técnica', solicitar, aplicar)).rejects.toThrow('demasiadas')
    expect(aplicar).toHaveBeenCalledTimes(3)
  })
  it('no reintenta un error de transporte ni oculta un fallo de aplicación', async () => {
    const aplicar = vi.fn().mockRejectedValue(new Error('La pantalla cambió.'))
    const solicitar = vi
      .fn()
      .mockResolvedValue(respuesta([{ functionCall: { name: 'buscar_recetas', args: {} } }]))
    await expect(ejecutarTurnoChat([], 'busca', solicitar, aplicar)).rejects.toThrow(
      'pantalla cambió'
    )
    expect(solicitar).toHaveBeenCalledOnce()
  })
})

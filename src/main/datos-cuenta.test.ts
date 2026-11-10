import { describe, expect, it, vi } from 'vitest'
import { arrozConPollo } from '@shared/recetas/fixtures.test-utils'
import type { ChatChef } from '@shared/types/chats'
import { abrirBase } from './db/conexion'
import { listarMisRecetas } from './db/mis-recetas'
import { cargarSemilla, leerSemilla } from './db/semillas'
import { crearDatosLocales, crearDatosNube, MENSAJE_SIN_NUBE } from './datos-cuenta'
import { datosNubeFalsos, supabaseFalso } from './datos-cuenta.test-utils'

const URL_SB = new URL('https://p.supabase.co')
const CHAT: ChatChef = {
  id: '6f1c2c1e-6a43-4f2a-9a33-0a1b2c3d4e5f',
  titulo: 'Tortilla de papa',
  tituloDeIA: true,
  turnos: [
    {
      pregunta: 'tengo papas',
      respuesta: 'Haz una tortilla.',
      cambios: { ingredientes: ['papa'], sinIdentificar: [], porciones: null },
      recetas: false
    }
  ],
  contexto: [[{ role: 'user', parts: [{ text: 'tengo papas' }] }]],
  actualizado: Date.UTC(2026, 10, 10, 12)
}

const nube = datosNubeFalsos

describe('chats y Mis recetas en la nube', () => {
  it('guarda, lista y borra chats con el JWT de la cuenta y la clave publicable', async () => {
    const sb = supabaseFalso()
    const datos = nube(sb)
    await datos.guardarChat('u1', CHAT)
    await datos.guardarChat('u1', { ...CHAT, titulo: 'Tortilla española' })
    expect(sb.tablas.chats).toHaveLength(1)
    expect(await datos.listarChats('u1')).toEqual([{ ...CHAT, titulo: 'Tortilla española' }])

    const [url, init] = sb.solicitar.mock.calls[0]!
    expect(String(url)).toBe('https://p.supabase.co/rest/v1/chats?on_conflict=usuario_id,id')
    expect(init?.headers).toMatchObject({
      apikey: 'sb_publishable_x',
      authorization: 'Bearer jwt-de-ana',
      prefer: 'resolution=merge-duplicates,return=minimal'
    })
    // La cuenta la pone Supabase (auth.uid()); la app nunca envía usuario_id.
    expect(JSON.parse(String(init?.body))).not.toHaveProperty('usuario_id')

    await datos.borrarChat('u1', CHAT.id)
    expect(await datos.listarChats('u1')).toEqual([])
  })

  it('omite chats que ya no cumplen el esquema y rechaza guardar uno inválido', async () => {
    const sb = supabaseFalso()
    sb.tablas.chats.push({
      id: 'no-es-uuid',
      titulo: 'Viejo',
      titulo_de_ia: false,
      turnos: [],
      contexto: [],
      actualizado: '2026-11-10T00:00:00Z'
    })
    const datos = nube(sb)
    expect(await datos.listarChats('u1')).toEqual([])
    await expect(datos.guardarChat('u1', { ...CHAT, titulo: '' })).rejects.toThrow()
    expect(sb.tablas.chats).toHaveLength(1)
  })

  it('guardar dos veces una receta no la repite ni cambia su fecha', async () => {
    const sb = supabaseFalso()
    const datos = nube(sb)
    const generada = { receta: { ...arrozConPollo(), id: 'gen_uno' }, ingredientesNuevos: [] }
    await datos.guardarMiReceta('u1', generada, Date.UTC(2026, 10, 1))
    await datos.guardarMiReceta('u1', generada, Date.UTC(2026, 10, 2))
    expect(sb.tablas.mis_recetas).toHaveLength(1)
    expect(sb.tablas.mis_recetas[0]!.guardada_en).toBe('2026-11-01T00:00:00.000Z')
    expect(await datos.listarMisRecetas('u1')).toEqual([generada])
    await datos.quitarMiReceta('u1', 'gen_uno')
    expect(await datos.listarMisRecetas('u1')).toEqual([])
  })

  it('sin red o con error dice que no pudo guardar; con 401 avisa de la sesión caducada', async () => {
    await expect(nube(supabaseFalso({ caido: true })).guardarChat('u1', CHAT)).rejects.toThrow(
      MENSAJE_SIN_NUBE
    )
    await expect(nube(supabaseFalso({ estado: 500 })).guardarChat('u1', CHAT)).rejects.toThrow(
      MENSAJE_SIN_NUBE
    )
    const caducada = vi.fn()
    await expect(nube(supabaseFalso({ estado: 401 }), caducada).listarChats('u1')).rejects.toThrow(
      /caducado/
    )
    expect(caducada).toHaveBeenCalled()
  })

  it('sin sesión no llama a Supabase', async () => {
    const sb = supabaseFalso()
    const datos = crearDatosNube({
      supabaseUrl: URL_SB,
      clavePublica: 'k',
      token: async () => null,
      solicitar: sb.solicitar
    })
    await expect(datos.listarChats('u1')).rejects.toThrow(/Inicia sesión/)
    expect(sb.solicitar).not.toHaveBeenCalled()
  })
})

describe('datos sin Supabase (desarrollo, 0018)', () => {
  it('guarda los chats en memoria por cuenta y Mis recetas en el SQLite local', async () => {
    const db = abrirBase(':memory:')
    try {
      cargarSemilla(db, leerSemilla())
      const datos = crearDatosLocales(db)
      await datos.guardarChat('u1', CHAT)
      expect(await datos.listarChats('u1')).toEqual([CHAT])
      expect(await datos.listarChats('u2')).toEqual([])
      const generada = { receta: { ...arrozConPollo(), id: 'gen_uno' }, ingredientesNuevos: [] }
      await datos.guardarMiReceta('u1', generada, 0)
      expect(listarMisRecetas(db, 'u1').map((g) => g.receta.id)).toEqual(['gen_uno'])
    } finally {
      db.close()
    }
  })
})

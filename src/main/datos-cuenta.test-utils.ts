// Supabase simulado para probar chats y Mis recetas en la nube (0025) sin red.

import { vi, type Mock } from 'vitest'
import { crearDatosNube, type DatosCuenta } from './datos-cuenta'

type Fila = Record<string, unknown>
export interface SupabaseFalso {
  solicitar: Mock<typeof fetch>
  tablas: { chats: Fila[]; mis_recetas: Fila[] } & Record<string, Fila[]>
}

/** Guarda filas por tabla como lo haría PostgREST y deja ver qué pidió la app. */
export function supabaseFalso(opciones: { caido?: boolean; estado?: number } = {}): SupabaseFalso {
  const tablas: SupabaseFalso['tablas'] = { chats: [], mis_recetas: [] }
  const solicitar = vi.fn<typeof fetch>(async (url, init) => {
    if (opciones.caido) throw new TypeError('fetch failed')
    if (opciones.estado) return new Response('{}', { status: opciones.estado })
    const u = new URL(String(url))
    const tabla = u.pathname.replace('/rest/v1/', '')
    const filas = tablas[tabla]!
    if (init?.method === 'GET') return new Response(JSON.stringify(filas))
    if (init?.method === 'POST') {
      const fila = JSON.parse(String(init.body)) as Fila
      const i = filas.findIndex((f) => f.id === fila.id)
      const ignorar = new Headers(init.headers).get('prefer')?.includes('ignore-duplicates')
      if (i < 0) filas.push(fila)
      else if (!ignorar) filas[i] = fila
      return new Response(null, { status: 201 })
    }
    if (init?.method === 'DELETE') {
      const id = u.searchParams.get('id')!.replace('eq.', '')
      tablas[tabla] = filas.filter((f) => f.id !== id)
      return new Response(null, { status: 204 })
    }
    return new Response('{}', { status: 400 })
  })
  return { solicitar, tablas }
}

export function datosNubeFalsos(sb: SupabaseFalso, caducada: () => void = vi.fn()): DatosCuenta {
  return crearDatosNube({
    supabaseUrl: new URL('https://p.supabase.co'),
    clavePublica: 'sb_publishable_x',
    token: async () => 'jwt-de-ana',
    caducada,
    solicitar: sb.solicitar
  })
}

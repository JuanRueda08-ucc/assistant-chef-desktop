// Contadores de uso diario en la base de Supabase (decisión 0017). En una Edge Function cada
// invocación puede empezar de cero, así que la memoria no sirve: la función SQL
// `consumir_cupo` (supabase/migrations) suma uno de forma atómica y devuelve el total.

import type { AlmacenUso } from './limite'

export class AlmacenSupabase implements AlmacenUso {
  constructor(
    private readonly supabaseUrl: string,
    /** Clave secreta del proyecto: solo en el servidor, nunca en la app. */
    private readonly claveSecreta: string,
    private readonly solicitar: typeof fetch = fetch
  ) {}

  async incrementar(clave: string, dia: string): Promise<number> {
    const r = await this.solicitar(
      `${this.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/consumir_cupo`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.cabeceras() },
        body: JSON.stringify({ p_clave: clave, p_dia: dia })
      }
    )
    if (!r.ok) throw new Error(`No se pudo contar el uso (HTTP ${r.status}).`)
    const usadas: unknown = await r.json()
    if (typeof usadas !== 'number') throw new Error('Respuesta inesperada al contar el uso.')
    return usadas
  }

  async leer(claves: readonly string[], dia: string): Promise<Record<string, number>> {
    if (claves.length === 0) return {}
    const url = new URL(`${this.supabaseUrl.replace(/\/$/, '')}/rest/v1/uso_diario`)
    url.searchParams.set('select', 'clave,usadas')
    url.searchParams.set('dia', `eq.${dia}`)
    // Las claves llevan «:», así que van entre comillas dobles dentro de `in.(…)`.
    url.searchParams.set('clave', `in.(${claves.map((c) => `"${c.replace(/"/g, '')}"`).join(',')})`)
    const r = await this.solicitar(url, { method: 'GET', headers: this.cabeceras() })
    if (!r.ok) throw new Error(`No se pudo leer el uso (HTTP ${r.status}).`)
    const filas: unknown = await r.json()
    if (!Array.isArray(filas)) throw new Error('Respuesta inesperada al leer el uso.')
    const uso: Record<string, number> = {}
    for (const fila of filas as { clave?: unknown; usadas?: unknown }[]) {
      if (typeof fila.clave === 'string' && typeof fila.usadas === 'number')
        uso[fila.clave] = fila.usadas
    }
    return uso
  }

  private cabeceras(): Record<string, string> {
    return {
      apikey: this.claveSecreta,
      // Las claves heredadas son JWT y van también como Bearer; las nuevas (sb_secret_) no.
      ...(!this.claveSecreta.startsWith('sb_secret_') && {
        authorization: `Bearer ${this.claveSecreta}`
      })
    }
  }
}

/**
 * Borra una cuenta de Supabase Auth con la clave secreta (0026). Sus chats y recetas se van con
 * ella (`on delete cascade`); los contadores de uso se borran antes, porque no tienen esa relación.
 */
export function crearBorrarCuenta(
  supabaseUrl: string,
  claveSecreta: string,
  solicitar: typeof fetch = fetch
): (usuarioId: string) => Promise<void> {
  const base = supabaseUrl.replace(/\/$/, '')
  const cabeceras: Record<string, string> = {
    apikey: claveSecreta,
    // Las claves heredadas son JWT y van también como Bearer; las nuevas (sb_secret_) no.
    ...(!claveSecreta.startsWith('sb_secret_') && { authorization: `Bearer ${claveSecreta}` })
  }
  return async (usuarioId) => {
    if (!/^[0-9a-f-]{36}$/i.test(usuarioId)) throw new Error('Id de cuenta no válido.')
    const uso = new URL(`${base}/rest/v1/uso_diario`)
    uso.searchParams.set('clave', `like.*:usuario:${usuarioId}`)
    const r1 = await solicitar(uso, { method: 'DELETE', headers: cabeceras })
    if (!r1.ok) throw new Error(`No se pudo borrar el uso (HTTP ${r1.status}).`)
    const r2 = await solicitar(`${base}/auth/v1/admin/users/${usuarioId}`, {
      method: 'DELETE',
      headers: cabeceras
    })
    // Si ya no existía, el resultado es el mismo: la cuenta no está.
    if (!r2.ok && r2.status !== 404)
      throw new Error(`No se pudo borrar la cuenta (HTTP ${r2.status}).`)
  }
}

/** La clave secreta que Supabase da a las Edge Functions (nueva o heredada). */
export function claveSecretaDesdeEntorno(env: Record<string, string | undefined>): string {
  try {
    const nuevas = JSON.parse(env.SUPABASE_SECRET_KEYS ?? '{}') as Record<string, string>
    const primera = Object.values(nuevas)[0]
    if (primera) return primera
  } catch {
    // Formato inesperado: se prueba la heredada.
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY
  throw new Error('La función no recibió la clave secreta del proyecto de Supabase.')
}

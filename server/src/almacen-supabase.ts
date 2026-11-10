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

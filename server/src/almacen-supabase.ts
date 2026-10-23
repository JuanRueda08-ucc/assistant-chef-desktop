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
        headers: {
          'content-type': 'application/json',
          apikey: this.claveSecreta,
          // Las claves heredadas son JWT y van también como Bearer; las nuevas (sb_secret_) no.
          ...(!this.claveSecreta.startsWith('sb_secret_') && {
            authorization: `Bearer ${this.claveSecreta}`
          })
        },
        body: JSON.stringify({ p_clave: clave, p_dia: dia })
      }
    )
    if (!r.ok) throw new Error(`No se pudo contar el uso (HTTP ${r.status}).`)
    const usadas: unknown = await r.json()
    if (typeof usadas !== 'number') throw new Error('Respuesta inesperada al contar el uso.')
    return usadas
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

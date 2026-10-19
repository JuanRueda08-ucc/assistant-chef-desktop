export interface TokenVoz {
  token: string
  /** ISO 8601: límite para abrir la conexión, no para terminar la conversación. */
  expiraEn: string
}

export const CODIGOS_ERROR_VOZ = [
  'fase_incorrecta',
  'sin_conexion',
  'limite_superado',
  'servicio_no_disponible',
  'respuesta_invalida'
] as const

export type RespuestaTokenVoz =
  | { ok: true; credencial: TokenVoz }
  | { ok: false; error: { codigo: (typeof CODIGOS_ERROR_VOZ)[number]; mensaje: string } }

export interface ResultadoVosk {
  texto: string
  confianza: number
}

export type ResultadoVozLocal = { ok: true } | { ok: false; mensaje: string }

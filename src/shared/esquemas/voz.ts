import { z } from 'zod'
import {
  CODIGOS_ERROR_VOZ,
  type RespuestaTokenVoz,
  type TokenVoz,
  type ResultadoVosk,
  type ResultadoVozLocal
} from '../types/voz'
import type { Afirmar, Igual } from './coincidencia'

export const esquemaPeticionTokenVoz = z.strictObject({})
export const esquemaTokenVoz = z.strictObject({
  token: z.string().min(1).max(8192),
  expiraEn: z.iso.datetime()
})
export const esquemaRespuestaTokenVoz = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), credencial: esquemaTokenVoz }),
  z.strictObject({
    ok: z.literal(false),
    error: z.strictObject({ codigo: z.enum(CODIGOS_ERROR_VOZ), mensaje: z.string() })
  })
])
export type _ComprobarTokenVoz = Afirmar<Igual<z.output<typeof esquemaTokenVoz>, TokenVoz>>
export type _ComprobarRespuestaTokenVoz = Afirmar<
  Igual<z.output<typeof esquemaRespuestaTokenVoz>, RespuestaTokenVoz>
>

export const esquemaResultadoVosk = z.strictObject({
  texto: z.string(),
  confianza: z.number().min(0).max(1)
})
export const esquemaResultadoVozLocal = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), mensaje: z.string() })
])
export type _ComprobarResultadoVosk = Afirmar<
  Igual<z.output<typeof esquemaResultadoVosk>, ResultadoVosk>
>
export type _ComprobarResultadoVozLocal = Afirmar<
  Igual<z.output<typeof esquemaResultadoVozLocal>, ResultadoVozLocal>
>

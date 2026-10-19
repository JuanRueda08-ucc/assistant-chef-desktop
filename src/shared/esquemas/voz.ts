import { z } from 'zod'
import { CODIGOS_ERROR_VOZ, type RespuestaTokenVoz, type TokenVoz } from '../types/voz'
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

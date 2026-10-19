import { z } from 'zod'
import {
  CODIGOS_ERROR_VOZ,
  type RespuestaTokenVoz,
  type TokenVoz,
  type ResultadoVosk,
  type ResultadoVozLocal
} from '../types/voz'
import type { AudioNarracion } from '../types/voz'
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

export const esquemaAudioNarracion = z.strictObject({
  datos: z
    .string()
    .min(4)
    .max(8_000_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mimeType: z.literal('audio/wav')
})
export const esquemaPeticionNarracion = z.strictObject({
  texto: z.string().trim().min(1).max(2000)
})
export const esquemaRespuestaNarracion = z.strictObject({ audio: esquemaAudioNarracion.nullable() })
export const esquemaLeerPaso = z.strictObject({
  sesionId: z.string().min(1),
  pasoId: z.string().min(1)
})
export type _ComprobarAudioNarracion = Afirmar<
  Igual<z.output<typeof esquemaAudioNarracion>, AudioNarracion>
>

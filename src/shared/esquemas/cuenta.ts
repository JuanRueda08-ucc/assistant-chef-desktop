// Esquemas zod que espejan src/shared/types/cuenta.ts. Main valida con ellos lo que llega del
// renderer y lo que responde el backend.

import { z } from 'zod'
import {
  CODIGOS_ERROR_CUENTA,
  type DatosCodigo,
  type DatosEntrar,
  type DatosRegistro,
  type DatosRestablecer,
  type EstadoCuenta,
  type ResultadoCuenta,
  type Usuario
} from '../types/cuenta'
import type { Afirmar, Igual } from './coincidencia'

/** Mismos límites que el backend (server/src/cuentas.ts). */
export const CONTRASENA_MIN = 8
export const CONTRASENA_MAX = 128
export const LONGITUD_CODIGO = 6

const email = z.email('Escribe un correo válido.').trim().toLowerCase().max(254)
const contrasena = z
  .string()
  .min(CONTRASENA_MIN, `La contraseña necesita al menos ${CONTRASENA_MIN} caracteres.`)
  .max(CONTRASENA_MAX)
const codigo = z
  .string()
  .trim()
  .regex(/^\d{6}$/, `El código tiene ${LONGITUD_CODIGO} cifras.`)

export const esquemaUsuario = z.strictObject({
  id: z.string().min(1).max(200),
  nombre: z.string().max(200),
  email: z.string().max(254)
})
export const esquemaEstadoCuenta = z.strictObject({
  usuario: esquemaUsuario.nullable(),
  sinConexion: z.boolean()
})
export const esquemaResultadoCuenta = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), estado: esquemaEstadoCuenta }),
  z.strictObject({
    ok: z.literal(false),
    error: z.strictObject({ codigo: z.enum(CODIGOS_ERROR_CUENTA), mensaje: z.string() })
  })
])

export const esquemaRegistro = z.strictObject({
  nombre: z.string().trim().min(1, 'Escribe tu nombre.').max(60),
  email,
  contrasena
})
// Al entrar no se exige el mínimo: si no coincide, el backend responde «credenciales».
export const esquemaEntrar = z.strictObject({
  email,
  contrasena: z.string().min(1, 'Escribe tu contraseña.').max(CONTRASENA_MAX)
})
export const esquemaCodigo = z.strictObject({ email, codigo })
export const esquemaEmail = z.strictObject({ email })
export const esquemaRestablecer = z.strictObject({ email, codigo, contrasena })

export type _ComprobarUsuario = Afirmar<Igual<z.output<typeof esquemaUsuario>, Usuario>>
export type _ComprobarEstadoCuenta = Afirmar<
  Igual<z.output<typeof esquemaEstadoCuenta>, EstadoCuenta>
>
export type _ComprobarResultadoCuenta = Afirmar<
  Igual<z.output<typeof esquemaResultadoCuenta>, ResultadoCuenta>
>
export type _ComprobarRegistro = Afirmar<Igual<z.output<typeof esquemaRegistro>, DatosRegistro>>
export type _ComprobarEntrar = Afirmar<Igual<z.output<typeof esquemaEntrar>, DatosEntrar>>
export type _ComprobarCodigo = Afirmar<Igual<z.output<typeof esquemaCodigo>, DatosCodigo>>
export type _ComprobarRestablecer = Afirmar<
  Igual<z.output<typeof esquemaRestablecer>, DatosRestablecer>
>

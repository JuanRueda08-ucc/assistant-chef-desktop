// Esquemas zod que espejan src/shared/types/cuenta.ts. Main valida con ellos lo que llega del
// renderer y lo que responde el backend.

import { z } from 'zod'
import {
  CODIGOS_ERROR_CUENTA,
  type DatosCodigo,
  type DatosEntrar,
  type DatosRegistro,
  type DatosRestablecer,
  type DatosBorrarCuenta,
  type DatosCambiarContrasena,
  type DatosCambiarNombre,
  type EstadoCuenta,
  type ResultadoCuenta,
  type Usuario
} from '../types/cuenta'
import { CONTRASENA_MAX, CONTRASENA_MIN, mensajeContrasena } from '../contrasena'
import type { Afirmar, Igual } from './coincidencia'

export { CONTRASENA_MAX, CONTRASENA_MIN }
/** Supabase genera códigos de 6 a 10 cifras según la configuración del proyecto. */
export const CODIGO_MIN = 6
export const CODIGO_MAX = 10

const email = z.email('Escribe un correo válido.').trim().toLowerCase().max(254)
/** Contraseña nueva: los mismos requisitos que el proyecto de Supabase, con lo que falta. */
const contrasena = z
  .string()
  .max(CONTRASENA_MAX)
  .superRefine((valor, ctx) => {
    const mensaje = mensajeContrasena(valor)
    if (mensaje) ctx.addIssue({ code: 'custom', message: mensaje })
  })
const codigo = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/, `Escribe el código del correo (${CODIGO_MIN} a ${CODIGO_MAX} cifras).`)

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
export const esquemaCambiarNombre = z.strictObject({
  nombre: z.string().trim().min(1, 'Escribe tu nombre.').max(60)
})
const contrasenaActual = z.string().min(1, 'Escribe tu contraseña actual.').max(CONTRASENA_MAX)
export const esquemaCambiarContrasena = z.strictObject({
  actual: contrasenaActual,
  nueva: contrasena
})
export const esquemaBorrarCuenta = z.strictObject({
  contrasena: contrasenaActual,
  confirmacion: z.literal('BORRAR', 'Escribe BORRAR para confirmar.')
})

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
export type _ComprobarCambiarNombre = Afirmar<
  Igual<z.output<typeof esquemaCambiarNombre>, DatosCambiarNombre>
>
export type _ComprobarCambiarContrasena = Afirmar<
  Igual<z.output<typeof esquemaCambiarContrasena>, DatosCambiarContrasena>
>
export type _ComprobarBorrarCuenta = Afirmar<
  Igual<z.output<typeof esquemaBorrarCuenta>, DatosBorrarCuenta>
>

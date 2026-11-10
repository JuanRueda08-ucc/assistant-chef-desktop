// Requisitos de la contraseña de una cuenta. Son los mismos que el proyecto de Supabase
// («Lowercase, uppercase letters, digits and symbols», mínimo 8): la app los comprueba antes de
// enviar para decir exactamente qué falta, en lugar del error genérico de contraseña débil.

export const CONTRASENA_MIN = 8
export const CONTRASENA_MAX = 128

/** Símbolos que Supabase Auth cuenta como tales. */
const SIMBOLOS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~'

export type RequisitoContrasena = 'largo' | 'minuscula' | 'mayuscula' | 'numero' | 'simbolo'

export const REQUISITOS_CONTRASENA: readonly {
  id: RequisitoContrasena
  texto: string
  cumple: (contrasena: string) => boolean
}[] = [
  {
    id: 'largo',
    texto: `al menos ${CONTRASENA_MIN} caracteres`,
    cumple: (c) => c.length >= CONTRASENA_MIN
  },
  { id: 'minuscula', texto: 'una letra minúscula (a-z)', cumple: (c) => /[a-z]/.test(c) },
  { id: 'mayuscula', texto: 'una letra mayúscula (A-Z)', cumple: (c) => /[A-Z]/.test(c) },
  { id: 'numero', texto: 'un número', cumple: (c) => /[0-9]/.test(c) },
  {
    id: 'simbolo',
    texto: 'un símbolo, como ! @ # $ % o *',
    cumple: (c) => [...c].some((letra) => SIMBOLOS.includes(letra))
  }
]

/** Lo que le falta a la contraseña, en el orden en que se muestra. */
export function faltasContrasena(contrasena: string): RequisitoContrasena[] {
  return REQUISITOS_CONTRASENA.filter((r) => !r.cumple(contrasena)).map((r) => r.id)
}

/** «A tu contraseña le falta un número y un símbolo…», o `null` si cumple todo. */
export function mensajeContrasena(contrasena: string): string | null {
  const faltas = REQUISITOS_CONTRASENA.filter((r) => !r.cumple(contrasena)).map((r) => r.texto)
  if (faltas.length === 0) return null
  const lista =
    faltas.length === 1 ? faltas[0] : `${faltas.slice(0, -1).join(', ')} y ${faltas.at(-1)}`
  return `A tu contraseña le falta: ${lista}.`
}

/** Mensaje si Supabase la rechaza de todos modos (por ejemplo, con otra configuración). */
export const MENSAJE_CONTRASENA_DEBIL =
  `La contraseña es demasiado débil. Usa al menos ${CONTRASENA_MIN} caracteres con ` +
  'minúsculas, mayúsculas, números y símbolos.'

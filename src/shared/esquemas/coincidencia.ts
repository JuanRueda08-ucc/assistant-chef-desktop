// Comprobación en tiempo de compilación de que un esquema zod produce exactamente un tipo de
// src/shared/types/. Si divergen, `npm run typecheck` falla.

export type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

export type Afirmar<T extends true> = T

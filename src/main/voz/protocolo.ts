import type { ResultadoVosk } from '@shared/types/voz'

export type PeticionWorker =
  | { id: number; accion: 'cerrar' }
  | { id: number; accion: 'reset' }
  | { id: number; accion: 'audio'; audio: Uint8Array }
export type RespuestaWorker = { id: number; resultado: ResultadoVosk | null; error: string | null }

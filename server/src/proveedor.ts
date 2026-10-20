// Contrato con el proveedor de IA y de voz. La app no conoce el proveedor: el backend elige uno
// (`crearProveedor`) y todo lo que devuelve se valida antes de responder.

import type { Ingrediente, Tecnica } from '@shared/types/receta'
import type { Preferencias } from '@shared/types/sesion'
import type { PeticionChat } from '@shared/ia/chat'

export interface PeticionReceta {
  preferencias: Preferencias
  /** Catálogo de la app: la receta solo puede usar estos ingredientes. */
  catalogo: Ingrediente[]
  /** Técnicas que puede referenciar un paso (`tecnicaId`). */
  tecnicas: Pick<Tecnica, 'id' | 'nombre'>[]
}

export interface PeticionSustitucion {
  ingredienteId: string
  recetaId: string | null
  tituloReceta: string | null
  preferencias: Pick<Preferencias, 'ingredientes' | 'restricciones' | 'alergias'>
  catalogo: Ingrediente[]
}

export type { TokenVoz } from '@shared/types/voz'
import type { TokenVoz } from '@shared/types/voz'
import type { AudioNarracion } from '@shared/types/voz'

export interface ProveedorIA {
  readonly nombre: string
  /** Token efímero para que el cliente abra la sesión de voz en tiempo real. */
  crearTokenVoz(instalacion: string): Promise<TokenVoz>
  narrar(texto: string): Promise<AudioNarracion | null>
  conversar(peticion: PeticionChat): Promise<unknown>
  /**
   * Receta en bruto (JSON del modelo). `errorAnterior` trae el motivo por el que se rechazó el
   * intento anterior, para que el modelo lo corrija en el reintento.
   */
  generarReceta(peticion: PeticionReceta, errorAnterior: string | null): Promise<unknown>
  /** Sugerencias en bruto: `{ ingredienteDestinoId, ratio, impacto, contexto? }[]`. */
  sugerirSustituciones(peticion: PeticionSustitucion): Promise<unknown>
}

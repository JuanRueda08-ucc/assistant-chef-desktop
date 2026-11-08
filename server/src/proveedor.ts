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
  /** La idea elegida; la receta la desarrolla. */
  idea: IdeaModelo | null
}

export interface PeticionSustitucion {
  ingredienteId: string
  recetaId: string | null
  tituloReceta: string | null
  preferencias: Pick<Preferencias, 'ingredientes' | 'restricciones' | 'alergias'>
  catalogo: Ingrediente[]
}

export type { PeticionIdeas } from '@shared/types/ideas'
export type { TokenVoz } from '@shared/types/voz'
import type { TokenVoz } from '@shared/types/voz'
import type { AudioNarracion } from '@shared/types/voz'
import type { IdeaModelo, PeticionIdeas } from '@shared/types/ideas'

export interface ProveedorIA {
  readonly nombre: string
  /** Token efímero para que el cliente abra la sesión de voz en tiempo real. */
  crearTokenVoz(instalacion: string): Promise<TokenVoz>
  narrar(texto: string): Promise<AudioNarracion | null>
  /** Imagen del plato en base64, o `null` si no hay (por ejemplo, sin cuota de imágenes). */
  generarImagen(peticion: {
    titulo: string
    descripcion: string
    ingredientes: string[]
  }): Promise<{ datos: string; mimeType: string } | null>
  /** Lo que se dijo en un WAV en base64, para el chat. Vacío si no se entiende. */
  transcribir(audio: string): Promise<string>
  conversar(peticion: PeticionChat): Promise<unknown>
  /**
   * Receta en bruto (JSON del modelo). `errorAnterior` trae el motivo por el que se rechazó el
   * intento anterior, para que el modelo lo corrija en el reintento.
   */
  generarReceta(peticion: PeticionReceta, errorAnterior: string | null): Promise<unknown>
  /** Ideas en bruto: `{ ideas, fuente, fuentes, sugerenciasBusqueda }`. app.ts las valida una a una. */
  proponerRecetas(peticion: PeticionIdeas): Promise<unknown>
  /** Sugerencias en bruto: `{ ingredienteDestinoId, ratio, impacto, contexto? }[]`. */
  sugerirSustituciones(peticion: PeticionSustitucion): Promise<unknown>
}

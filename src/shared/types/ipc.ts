// Contrato IPC entre renderer (vía preload) y main. Los nombres de canal se usan en ambos lados.

import type { AplicacionHerramienta, LlamadaHerramienta } from '../ia/herramientas'
import type { ResultadoBusqueda } from './busqueda'
import type { Ingrediente, Receta } from './receta'
import type { Preferencias, SesionCocina } from './sesion'
import type { AudioNarracion, RespuestaTokenVoz, ResultadoVosk, ResultadoVozLocal } from './voz'
import type { PeticionChatIpc, RespuestaChat } from '../ia/chat'

export const CANALES_IPC = {
  chefConversar: 'chef:conversar',
  catalogoIngredientes: 'catalogo:ingredientes',
  recetasListar: 'recetas:listar',
  recetasObtener: 'recetas:obtener',
  recetasBuscar: 'recetas:buscar',
  sesionRetomar: 'sesion:retomar',
  sesionIniciar: 'sesion:iniciar',
  sesionAplicar: 'sesion:aplicar',
  vozToken: 'voz:token',
  vozIniciar: 'voz:iniciar',
  vozReconocer: 'voz:reconocer',
  vozReset: 'voz:reset',
  vozDetener: 'voz:detener',
  vozRepetir: 'voz:repetir',
  vozNarrar: 'voz:narrar',
  vozCallar: 'voz:callar'
} as const

export interface DatosIniciarCocina {
  recetaId: string
  porciones: number
  preferencias: Preferencias
}

/** Lo necesario para listar recetas y mostrar sus etiquetas sin cargar ingredientes ni pasos. */
export type ResumenReceta = Pick<
  Receta,
  | 'id'
  | 'slug'
  | 'titulo'
  | 'descripcion'
  | 'porcionesBase'
  | 'tiempoTotalMin'
  | 'tiempoActivoMin'
  | 'dificultad'
  | 'origen'
  | 'estadoRevision'
  | 'dietas'
  | 'alergenos'
  | 'equipo'
  | 'imagen'
>

/** API que el preload expone como `window.api`. */
export interface ApiChef {
  chef: { conversar(datos: PeticionChatIpc): Promise<RespuestaChat> }
  voz: {
    /** Main añade X-Instalacion; el renderer no envía URLs ni identificadores. */
    token(datos: Record<string, never>): Promise<RespuestaTokenVoz>
    iniciar(datos: Record<string, never>): Promise<ResultadoVozLocal>
    reconocer(audio: ArrayBuffer): Promise<ResultadoVosk | null>
    reset(datos: Record<string, never>): Promise<void>
    detener(datos: Record<string, never>): Promise<void>
    repetir(datos: Record<string, never>): Promise<ResultadoVozLocal>
    narrar(datos: { sesionId: string; pasoId: string }): Promise<AudioNarracion | null>
    callar(datos: Record<string, never>): Promise<void>
  }
  catalogo: {
    /** Catálogo completo de ingredientes, ordenado por nombre. */
    ingredientes(): Promise<Ingrediente[]>
  }
  recetas: {
    listar(): Promise<ResumenReceta[]>
    obtener(id: string): Promise<Receta | null>
    buscar(preferencias: Preferencias): Promise<ResultadoBusqueda>
  }
  sesion: {
    /** La sesión que estaba cocinando al cerrar la app (temporizadores al día), o `null`. */
    retomar(): Promise<SesionCocina | null>
    /** Empieza a cocinar; descarta la sesión cocinando anterior, si había. */
    iniciar(datos: DatosIniciarCocina): Promise<SesionCocina>
    /** Aplica una herramienta (botón, orden local o modelo) y guarda si tuvo efecto. */
    aplicar(llamada: LlamadaHerramienta): Promise<AplicacionHerramienta>
  }
}

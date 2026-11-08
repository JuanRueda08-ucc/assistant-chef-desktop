// Contrato IPC entre renderer (vía preload) y main. Los nombres de canal se usan en ambos lados.

import type { AplicacionHerramienta, LlamadaHerramienta } from '../ia/herramientas'
import type { EvaluacionReceta, ResultadoBusqueda } from './busqueda'
import type { IdeaModelo, ResultadoIdeas, ResultadoRecetaGenerada } from './ideas'
import type { Ingrediente, Receta, RecetaGenerada } from './receta'
import type { Preferencias, SesionCocina } from './sesion'
import type { AudioNarracion, RespuestaTokenVoz, ResultadoVosk, ResultadoVozLocal } from './voz'
import type { PeticionChatIpc, RespuestaChat } from '../ia/chat'
import type {
  DatosCodigo,
  DatosEntrar,
  DatosRegistro,
  DatosRestablecer,
  EstadoCuenta,
  ResultadoCuenta
} from './cuenta'

export const CANALES_IPC = {
  cuentaEstado: 'cuenta:estado',
  cuentaRegistrar: 'cuenta:registrar',
  cuentaVerificar: 'cuenta:verificar',
  cuentaReenviar: 'cuenta:reenviar',
  cuentaEntrar: 'cuenta:entrar',
  cuentaSalir: 'cuenta:salir',
  cuentaRecuperar: 'cuenta:recuperar',
  cuentaRestablecer: 'cuenta:restablecer',
  chefConversar: 'chef:conversar',
  catalogoIngredientes: 'catalogo:ingredientes',
  recetasListar: 'recetas:listar',
  recetasObtener: 'recetas:obtener',
  recetasBuscar: 'recetas:buscar',
  recetasEvaluar: 'recetas:evaluar',
  recetasProponer: 'recetas:proponer',
  recetasGenerar: 'recetas:generar',
  recetasImagen: 'recetas:imagen',
  avisoTemporizador: 'aviso:temporizador',
  misRecetasListar: 'mis-recetas:listar',
  misRecetasGuardar: 'mis-recetas:guardar',
  misRecetasQuitar: 'mis-recetas:quitar',
  preferenciasLeer: 'preferencias:leer',
  preferenciasGuardar: 'preferencias:guardar',
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
  vozCallar: 'voz:callar',
  vozDictadoIniciar: 'voz:dictado-iniciar',
  vozDictadoTerminar: 'voz:dictado-terminar',
  vozTranscribir: 'voz:transcribir'
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
export type ResultadoTranscripcion = { ok: true; texto: string } | { ok: false; mensaje: string }

export interface ApiChef {
  /** Cuenta real (decisión 0016). Main guarda el token; aquí solo llegan usuario y resultados. */
  cuenta: {
    estado(): Promise<EstadoCuenta>
    registrar(datos: DatosRegistro): Promise<ResultadoCuenta>
    verificar(datos: DatosCodigo): Promise<ResultadoCuenta>
    reenviar(datos: { email: string }): Promise<ResultadoCuenta>
    entrar(datos: DatosEntrar): Promise<ResultadoCuenta>
    salir(): Promise<ResultadoCuenta>
    recuperar(datos: { email: string }): Promise<ResultadoCuenta>
    restablecer(datos: DatosRestablecer): Promise<ResultadoCuenta>
  }
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
    /** Botón «Hablar» del chat (0020): permite el micrófono solo hasta terminar. */
    dictadoIniciar(datos: Record<string, never>): Promise<void>
    dictadoTerminar(datos: Record<string, never>): Promise<void>
    /** Convierte en texto una frase de hasta ocho segundos. No se guarda. */
    transcribir(audio: ArrayBuffer): Promise<ResultadoTranscripcion>
  }
  catalogo: {
    /** Catálogo completo de ingredientes, ordenado por nombre. */
    ingredientes(): Promise<Ingrediente[]>
  }
  recetas: {
    listar(): Promise<ResumenReceta[]>
    obtener(id: string): Promise<Receta | null>
    buscar(preferencias: Preferencias): Promise<ResultadoBusqueda>
    /**
     * Una receta de la base frente a las preferencias, con las reglas de la búsqueda (tarea 45).
     * `null` si no existe.
     */
    evaluar(datos: {
      recetaId: string
      preferencias: Preferencias
    }): Promise<EvaluacionReceta | null>
    /** Ideas del chef con la IA, ya comprobadas en main contra catálogo, alergias y dieta. */
    proponer(datos: {
      preferencias: Preferencias
      excluir: string[]
      pedido: string | null
    }): Promise<ResultadoIdeas>
    /** Receta completa de una idea, ya comprobada. Queda lista para `sesion.iniciar`. */
    generar(datos: {
      idea: IdeaModelo
      preferencias: Preferencias
    }): Promise<ResultadoRecetaGenerada>
    /**
     * Imagen creada por IA para una receta recién escrita: data URL JPEG, o `null` si no hay (sin
     * facturación de Gemini no hay cuota de imágenes). Queda en la receta para cocinarla y guardarla.
     */
    imagen(datos: { recetaId: string }): Promise<string | null>
  }
  /** Notificación del sistema cuando termina un temporizador y la ventana no está a la vista. */
  avisos: {
    temporizador(datos: { etiqueta: string }): Promise<void>
  }
  /** Recetas de la IA que guardó la cuenta. Guardar y quitar devuelven la lista al día. */
  misRecetas: {
    listar(): Promise<RecetaGenerada[]>
    /** Guarda la receta de esa sesión de cocina de la cuenta. */
    guardar(datos: { sesionId: string }): Promise<RecetaGenerada[]>
    quitar(datos: { recetaId: string }): Promise<RecetaGenerada[]>
  }
  /** Despensa, preferencias y alergias guardadas de la cuenta (decisión 0019). */
  preferencias: {
    leer(): Promise<Preferencias | null>
    guardar(preferencias: Preferencias): Promise<void>
  }
  sesion: {
    /** La sesión de la cuenta que estaba cocinando (temporizadores al día), o `null`. */
    retomar(): Promise<SesionCocina | null>
    /** Empieza a cocinar; descarta la sesión cocinando anterior, si había. */
    iniciar(datos: DatosIniciarCocina): Promise<SesionCocina>
    /** Aplica una herramienta (botón, orden local o modelo) y guarda si tuvo efecto. */
    aplicar(llamada: LlamadaHerramienta): Promise<AplicacionHerramienta>
  }
}

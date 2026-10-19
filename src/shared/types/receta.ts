// Tipos del modelo de recetas. Deben coincidir con docs/modelo-recetas.md, db/schema.sql y
// src/shared/esquemas/. Si cambias uno, cambia los otros (ver AGENTS.md).
//
// Convención: los campos opcionales del documento son `T | null` (no `?:`), para que el JSON,
// SQLite y los esquemas zod usen la misma forma.

export const DIFICULTADES = ['facil', 'media', 'avanzada'] as const
export type Dificultad = (typeof DIFICULTADES)[number]

export const ORIGENES = ['revisada', 'generada'] as const
export type Origen = (typeof ORIGENES)[number]

export const ESTADOS_REVISION = ['borrador', 'revisada', 'retirada'] as const
export type EstadoRevision = (typeof ESTADOS_REVISION)[number]

/** Unidades canónicas. `pizca` y `al_gusto` no escalan; `al_gusto` no lleva cantidad. */
export const UNIDADES = ['g', 'ml', 'unidad', 'pizca', 'al_gusto'] as const
export type Unidad = (typeof UNIDADES)[number]

/** `suave` = factor^0.75 acotado entre la mitad y el doble; `fijo` no escala. */
export const TIPOS_ESCALADO = ['lineal', 'suave', 'fijo'] as const
export type TipoEscalado = (typeof TIPOS_ESCALADO)[number]

export const DIETAS = ['vegetariana', 'vegana', 'sin_gluten', 'sin_lactosa'] as const
export type Dieta = (typeof DIETAS)[number]

/** Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011). */
export const ALERGENOS = [
  'gluten',
  'crustaceos',
  'huevo',
  'pescado',
  'cacahuete',
  'soja',
  'lacteos',
  'frutos_secos',
  'apio',
  'mostaza',
  'sesamo',
  'sulfitos',
  'altramuces',
  'moluscos'
] as const
export type Alergeno = (typeof ALERGENOS)[number]

export const EQUIPOS = [
  'horno',
  'sarten',
  'olla',
  'olla_presion',
  'licuadora',
  'batidora',
  'microondas',
  'freidora_aire',
  'plancha'
] as const
export type Equipo = (typeof EQUIPOS)[number]

export const CATEGORIAS_INGREDIENTE = [
  'verduras',
  'frutas',
  'proteinas',
  'lacteos',
  'cereales',
  'legumbres',
  'especias',
  'despensa'
] as const
export type CategoriaIngrediente = (typeof CATEGORIAS_INGREDIENTE)[number]

export const CONTEXTOS_SUSTITUCION = ['horneado', 'salteado', 'cualquiera'] as const
export type ContextoSustitucion = (typeof CONTEXTOS_SUSTITUCION)[number]

export const FUENTES_SUSTITUCION = ['revisada', 'generada'] as const
export type FuenteSustitucion = (typeof FUENTES_SUSTITUCION)[number]

/** Entrada del catálogo de ingredientes (tabla `ingredientes`). */
export interface Ingrediente {
  id: string
  nombre: string
  /** Para búsqueda y reconocimiento por voz. */
  sinonimos: string[]
  categoria: CategoriaIngrediente
  /** Sal, aceite, agua: se asume que el usuario lo tiene. */
  esBasicoDespensa: boolean
  alergenos: Alergeno[]
  /** Por ejemplo, la carne es incompatible con `vegetariana`. */
  dietasIncompatibles: Dieta[]
  /** Para convertir taza ↔ gramos. */
  densidadGMl: number | null
  /** Un huevo ≈ 50 g. */
  pesoUnidadG: number | null
}

/** Técnica de cocina que muestra la herramienta `mostrar_tecnica`. */
export interface Tecnica {
  id: string
  nombre: string
  descripcion: string
  pasosCortos: string[]
  /** Vídeo o animación. */
  media: string | null
}

export interface IngredienteReceta {
  /** Id local dentro de la receta (`ir_1`); lo usan los pasos. */
  id: string
  /** Referencia al catálogo. */
  ingredienteId: string
  /** En la unidad canónica; `null` solo si `unidad` es `al_gusto`. */
  cantidad: number | null
  unidad: Unidad
  escalado: TipoEscalado
  /** Paso mínimo al mostrar (1 para huevos, 0.5 para limones, 5 para gramos). `null` con `al_gusto`. */
  redondeo: number | null
  /** "picada fina", "a temperatura ambiente". */
  preparacion: string | null
  /** "Para la salsa". */
  grupo: string | null
  /** No cuenta en "qué falta". */
  opcional: boolean
}

export interface IngredientePaso {
  ingredienteRecetaId: string
  /** Parte del ingrediente que se usa en este paso: 0 < fraccion ≤ 1 (1 = todo). */
  fraccion: number
}

export interface TemporizadorPaso {
  etiqueta: string
  segundos: number
}

export interface Paso {
  id: string
  /** Empieza en 1 y es consecutivo dentro de la receta. */
  orden: number
  /** Lo que se lee en pantalla: una acción principal. */
  texto: string
  /** Versión hablada si difiere (sin abreviaturas ni cifras ambiguas). */
  textoVoz: string | null
  /** La cantidad del paso se deriva de `fraccion`, no se escribe. */
  ingredientes: IngredientePaso[]
  /** Duración estimada; `null` si es inmediato. */
  duracionSeg: number | null
  temporizador: TemporizadorPaso | null
  /** "hasta que la cebolla esté transparente". */
  senalHecho: string | null
  tecnicaId: string | null
  /** El chef no avanza sin un "listo" del usuario. */
  requiereConfirmacion: boolean
  /** Frase corta para el globo del chef. */
  consejo: string | null
  /** Aviso de seguridad (temperatura interna, aceite caliente). */
  seguridad: string | null
}

export interface Receta {
  id: string
  /** Estable para URLs internas y semillas. */
  slug: string
  titulo: string
  descripcion: string
  /** Porciones para las que están escritas las cantidades. */
  porcionesBase: number
  tiempoTotalMin: number
  /** Manos ocupadas. */
  tiempoActivoMin: number
  dificultad: Dificultad
  origen: Origen
  /** Solo `revisada` aparece en la búsqueda. */
  estadoRevision: EstadoRevision
  /** Derivadas del catálogo (tarea 6); nunca escritas a mano. */
  dietas: Dieta[]
  /** Derivados del catálogo (tarea 6); nunca escritos a mano. */
  alergenos: Alergeno[]
  equipo: Equipo[]
  /** Foto real licenciada; `null` mientras no exista. */
  imagen: string | null
  ingredientes: IngredienteReceta[]
  /** Ordenados por `orden`. */
  pasos: Paso[]
}

/** Tabla `sustituciones`. */
export interface Sustitucion {
  id: string
  ingredienteOrigenId: string
  ingredienteDestinoId: string
  /** 1 g de origen → `ratio` g de destino (mantequilla → aceite: 0.8). */
  ratio: number
  /** `null` = válida en general. */
  recetaId: string | null
  contexto: ContextoSustitucion
  /** Dietas o alérgenos que la sustitución permite evitar. */
  resuelve: (Dieta | Alergeno)[]
  /** Impacto en sabor o textura, en una frase. */
  impacto: string
  fuente: FuenteSustitucion
}

// Datos de prueba para los tests de src/shared/cocina/: arroz con pollo de la semilla, catálogo
// con ingredientes extra, sustituciones y técnicas.

import { z } from 'zod'
import tecnicasSemilla from '../../../db/seed/tecnicas.json'
import { esquemaSesionCocina } from '../esquemas/sesion'
import { esquemaSustitucion, esquemaTecnica } from '../esquemas/receta'
import { conEtiquetas } from '../recetas/etiquetas'
import { arrozConPollo, catalogo, ingrediente } from '../recetas/fixtures.test-utils'
import type { NombreHerramienta } from '../ia/herramientas'
import type { Preferencias, SesionCocina } from '../types/sesion'
import { aplicarHerramienta, type ContextoCocina } from './aplicar'
import { crearSesionCocina } from './sesion'

export const T0 = 1_760_000_000_000
/** `T0` más `s` segundos. */
export const en = (s: number): number => T0 + s * 1000

export const catalogoCocina = [
  ...catalogo,
  ingrediente({ id: 'caldo_verduras', nombre: 'Caldo de verduras' }),
  ingrediente({ id: 'mantequilla', nombre: 'Mantequilla', alergenos: ['lacteos'] }),
  ingrediente({
    id: 'tofu_firme',
    nombre: 'Tofu firme',
    categoria: 'proteinas',
    alergenos: ['soja']
  })
]

export const sustitucionesCocina = z.array(esquemaSustitucion).parse([
  {
    id: 'caldo_verduras',
    ingredienteOrigenId: 'caldo_pollo',
    ingredienteDestinoId: 'caldo_verduras',
    ratio: 1,
    impacto: 'Sabor más suave.',
    fuente: 'revisada'
  },
  {
    id: 'aceite_mantequilla',
    ingredienteOrigenId: 'aceite_oliva',
    ingredienteDestinoId: 'mantequilla',
    ratio: 0.8,
    impacto: 'Más cremoso.',
    fuente: 'revisada'
  },
  {
    id: 'pollo_tofu',
    ingredienteOrigenId: 'pollo_muslo',
    ingredienteDestinoId: 'tofu_firme',
    ratio: 0.75,
    recetaId: 'arroz_con_pollo',
    impacto: 'Textura más blanda; dóralo bien.',
    fuente: 'revisada'
  }
])

export function contexto(): ContextoCocina {
  return {
    receta: conEtiquetas(arrozConPollo(), catalogoCocina),
    catalogo: catalogoCocina,
    sustituciones: sustitucionesCocina,
    tecnicas: z.array(esquemaTecnica).parse(tecnicasSemilla)
  }
}

export function preferencias(campos: Partial<Preferencias> = {}): Preferencias {
  return {
    ingredientes: ['pollo_muslo', 'arroz_blanco'],
    porciones: 4,
    restricciones: [],
    alergias: [],
    tiempoMaxMin: null,
    nivel: null,
    equipo: [],
    ...campos
  }
}

/** Sesión cocinando el arroz con pollo (4 porciones) en el paso 1, creada en `T0`. */
export function sesionNueva(campos: Partial<Preferencias> = {}): SesionCocina {
  return crearSesionCocina({
    id: 'sesion_1',
    preferencias: preferencias(campos),
    receta: contexto().receta,
    porciones: 4,
    catalogo: catalogoCocina,
    ahora: T0
  })
}

/** Aplica y comprueba que la sesión resultante siga cumpliendo el esquema. */
export function aplicar(
  sesion: SesionCocina,
  nombre: NombreHerramienta,
  argumentos: unknown = {},
  opciones: { confirmado?: boolean; ahora?: number; ctx?: ContextoCocina } = {}
): ReturnType<typeof aplicarHerramienta> {
  const r = aplicarHerramienta(
    sesion,
    { nombre, argumentos, confirmado: opciones.confirmado ?? false },
    opciones.ahora ?? T0,
    opciones.ctx ?? contexto()
  )
  esquemaSesionCocina.parse(r.sesion)
  return r
}

/** Congela en profundidad, para comprobar que nada se modifica. */
export function congelar<T>(valor: T): T {
  if (typeof valor === 'object' && valor !== null) {
    Object.values(valor).forEach(congelar)
    Object.freeze(valor)
  }
  return valor
}

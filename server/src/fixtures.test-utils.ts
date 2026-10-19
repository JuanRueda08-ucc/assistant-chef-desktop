// Datos de prueba del backend: catálogo y técnicas de la semilla y el arroz con pollo como
// "respuesta del modelo".

import { z } from 'zod'
import ingredientesSemilla from '../../db/seed/ingredientes.json'
import tecnicasSemilla from '../../db/seed/tecnicas.json'
import arrozConPollo from '../../db/seed/recetas/arroz-con-pollo.json'
import { esquemaIngrediente } from '@shared/esquemas/receta'
import type { Ingrediente } from '@shared/types/receta'
import { crearApp, type Dependencias } from './app'
import { AlmacenMemoria, LIMITES_POR_DEFECTO, Limitador, type Grupo } from './limite'
import { ProveedorFalso, type OpcionesProveedorFalso } from './proveedores/falso'

export const T0 = Date.UTC(2026, 9, 18, 12, 0, 0)
export const INSTALACION = 'instalacion-de-prueba-1'

export const ingrediente = (datos: Partial<Ingrediente> & Pick<Ingrediente, 'id'>): Ingrediente =>
  esquemaIngrediente.parse({ nombre: datos.id, categoria: 'despensa', ...datos })

export const catalogo: Ingrediente[] = [
  ...z.array(esquemaIngrediente).parse(ingredientesSemilla),
  ingrediente({
    id: 'mantequilla',
    nombre: 'Mantequilla',
    categoria: 'lacteos',
    alergenos: ['lacteos']
  }),
  ingrediente({ id: 'margarina', nombre: 'Margarina vegetal', categoria: 'despensa' }),
  ingrediente({ id: 'aceite_girasol', nombre: 'Aceite de girasol', categoria: 'despensa' }),
  ingrediente({ id: 'ghee', nombre: 'Ghee', categoria: 'lacteos', alergenos: ['lacteos'] }),
  ingrediente({ id: 'aceite_coco', nombre: 'Aceite de coco', categoria: 'despensa' }),
  ingrediente({
    id: 'tofu_firme',
    nombre: 'Tofu firme',
    categoria: 'proteinas',
    alergenos: ['soja']
  })
]

export const tecnicas = tecnicasSemilla.map((t) => ({ id: t.id, nombre: t.nombre }))

/** El arroz con pollo de la semilla, tal como lo devolvería el modelo (copia editable). */
export const recetaModelo = (): Record<string, unknown> => structuredClone(arrozConPollo)

export const cuerpoReceta = (): Record<string, unknown> => ({
  preferencias: {
    ingredientes: ['pollo_muslo', 'arroz_blanco', 'cebolla'],
    porciones: 4,
    restricciones: [],
    alergias: [],
    tiempoMaxMin: null,
    nivel: null,
    equipo: []
  },
  catalogo,
  tecnicas
})

export const cuerpoSustitucion = (
  preferencias: Record<string, unknown> = {}
): Record<string, unknown> => ({
  ingredienteId: 'aceite_oliva',
  recetaId: 'arroz_con_pollo',
  preferencias: { ingredientes: [], restricciones: [], alergias: [], ...preferencias },
  catalogo
})

export interface Banco {
  manejar: (peticion: Request) => Promise<Response>
  proveedor: ProveedorFalso
  errores: string[]
  reloj: { ahora: number }
}

/** App con proveedor falso, límites a medida y reloj controlable. */
export function banco(
  opciones: OpcionesProveedorFalso = {},
  limites: Partial<Record<Grupo, number>> = {}
): Banco {
  const proveedor = new ProveedorFalso({ ahora: () => reloj.ahora, ...opciones })
  const reloj = { ahora: T0 }
  const errores: string[] = []
  let n = 0
  const dep: Dependencias = {
    proveedor,
    limitador: new Limitador(new AlmacenMemoria(), { ...LIMITES_POR_DEFECTO, ...limites }),
    ahora: () => reloj.ahora,
    nuevoId: () => `gen_${String(++n).padStart(4, '0')}`,
    registrarError: (mensaje) => errores.push(mensaje)
  }
  return { manejar: crearApp(dep), proveedor, errores, reloj }
}

export function post(
  ruta: string,
  cuerpo: unknown = {},
  cabeceras: Record<string, string> = { 'x-instalacion': INSTALACION }
): Request {
  return new Request(`http://localhost${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cabeceras },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cuerpos JSON en los tests, se comprueban campo a campo
export async function leer(respuesta: Response): Promise<{ estado: number; cuerpo: any }> {
  return { estado: respuesta.status, cuerpo: await respuesta.json() }
}

// Proveedor falso: respuestas deterministas, sin red. Lo usan los tests y el desarrollo local
// (`PROVEEDOR_IA=falso`) mientras no haya un proveedor real elegido.

import type { PeticionReceta, PeticionSustitucion, ProveedorIA, TokenVoz } from '../proveedor'

export interface OpcionesProveedorFalso {
  /** Respuestas de `generarReceta`, en orden; al agotarse se genera una receta sencilla. */
  recetas?: unknown[]
  /** Respuesta fija de `sugerirSustituciones`; por defecto, ingredientes de la misma categoría. */
  sugerencias?: unknown
  /** Si es verdadero, todas las llamadas fallan como si el proveedor no respondiera. */
  falla?: boolean
  /** Reloj para la caducidad del token. */
  ahora?: () => number
}

export class ProveedorFalso implements ProveedorIA {
  readonly nombre = 'falso'
  readonly llamadasReceta: { peticion: PeticionReceta; errorAnterior: string | null }[] = []
  readonly llamadasSustitucion: PeticionSustitucion[] = []
  private tokens = 0
  async narrar(): Promise<null> {
    this.fallarSiToca()
    return null
  }
  private readonly recetas: unknown[]

  constructor(private readonly opciones: OpcionesProveedorFalso = {}) {
    this.recetas = [...(opciones.recetas ?? [])]
  }

  async crearTokenVoz(instalacion: string): Promise<TokenVoz> {
    this.fallarSiToca()
    this.tokens += 1
    const ahora = this.opciones.ahora?.() ?? Date.now()
    return {
      token: `falso_${instalacion}_${this.tokens}`,
      expiraEn: new Date(ahora + 60_000).toISOString()
    }
  }

  async generarReceta(peticion: PeticionReceta, errorAnterior: string | null): Promise<unknown> {
    this.fallarSiToca()
    this.llamadasReceta.push({ peticion, errorAnterior })
    if (this.recetas.length > 0) return this.recetas.shift()
    return recetaSencilla(peticion)
  }

  async sugerirSustituciones(peticion: PeticionSustitucion): Promise<unknown> {
    this.fallarSiToca()
    this.llamadasSustitucion.push(peticion)
    if (this.opciones.sugerencias !== undefined) return this.opciones.sugerencias
    const origen = peticion.catalogo.find((i) => i.id === peticion.ingredienteId)
    return peticion.catalogo
      .filter((i) => i.id !== peticion.ingredienteId && i.categoria === origen?.categoria)
      .slice(0, 5)
      .map((i) => ({
        ingredienteDestinoId: i.id,
        ratio: 1,
        impacto: 'Sabor parecido; ajusta al gusto.'
      }))
  }

  private fallarSiToca(): void {
    if (this.opciones.falla) throw new Error('el proveedor falso está configurado para fallar')
  }
}

/** Receta válida de tres pasos con hasta tres ingredientes que el usuario tiene. */
function recetaSencilla(peticion: PeticionReceta): unknown {
  const disponibles = new Set(peticion.preferencias.ingredientes)
  const elegidos = peticion.catalogo
    .filter((i) => !i.esBasicoDespensa && disponibles.has(i.id))
    .slice(0, 3)
  const usados = elegidos.length > 0 ? elegidos : peticion.catalogo.slice(0, 1)
  const ingredientes = usados.map((i, n) => ({
    id: `ir_${n + 1}`,
    ingredienteId: i.id,
    cantidad: 100,
    unidad: 'g',
    redondeo: 10
  }))
  const nombres = usados.map((i) => i.nombre.toLocaleLowerCase('es')).join(', ')
  return {
    titulo: `Salteado rápido de ${nombres}`,
    descripcion: 'Receta generada de prueba por el proveedor falso.',
    porcionesBase: peticion.preferencias.porciones,
    tiempoTotalMin: 20,
    tiempoActivoMin: 15,
    dificultad: 'facil',
    equipo: ['sarten'],
    ingredientes,
    pasos: [
      {
        id: 'p1',
        orden: 1,
        texto: 'Corta todos los ingredientes en trozos pequeños.',
        ingredientes: ingredientes.map((i) => ({ ingredienteRecetaId: i.id, fraccion: 1 })),
        requiereConfirmacion: true
      },
      {
        id: 'p2',
        orden: 2,
        texto: 'Saltéalos 8 minutos a fuego medio-alto.',
        duracionSeg: 480,
        temporizador: { etiqueta: 'Salteado', segundos: 480 },
        requiereConfirmacion: true
      },
      { id: 'p3', orden: 3, texto: 'Sirve caliente.', requiereConfirmacion: false }
    ]
  }
}

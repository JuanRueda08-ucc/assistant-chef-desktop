// Proveedor falso: respuestas deterministas, sin red. Lo usan los tests y el desarrollo local
// (`PROVEEDOR_IA=falso`) mientras no haya un proveedor real elegido.

import type { PeticionReceta, PeticionSustitucion, ProveedorIA, TokenVoz } from '../proveedor'
import type { ContenidoChat, PeticionChat } from '@shared/ia/chat'
import { normalizarTexto } from '@shared/recetas/catalogo'
import { z } from 'zod'

const contextoDemo = z.object({
  catalogo: z.array(
    z.object({ id: z.string(), nombre: z.string(), sinonimos: z.array(z.string()) })
  ),
  recetas: z.array(z.object({ id: z.string(), titulo: z.string() }))
})

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
  /** Unas frases de demostración, sin fingir comprensión general ni acceder a la red. */
  async conversar(peticion: PeticionChat): Promise<ContenidoChat> {
    this.fallarSiToca()
    const decir = (text: string): ContenidoChat => ({ role: 'model', parts: [{ text }] })
    const ultimo = peticion.mensajes.at(-1)!
    const respuestas = ultimo.parts.flatMap((p) =>
      p.functionResponse ? [p.functionResponse.response] : []
    )
    if (respuestas.length)
      return decir(
        respuestas
          .map((r) => (typeof r.decir === 'string' ? r.decir : 'Operación completada.'))
          .join(' ')
      )
    const texto = normalizarTexto(ultimo.parts.map((p) => p.text ?? '').join(' '))
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (peticion.pantalla === 'cocinar') {
      const porciones = texto.match(/(?:somos|para|porciones)\s+(\d+)/)?.[1]
      if (porciones)
        return {
          role: 'model',
          parts: [
            { functionCall: { name: 'cambiar_porciones', args: { porciones: Number(porciones) } } }
          ]
        }
      if (texto.includes('tecnica'))
        return { role: 'model', parts: [{ functionCall: { name: 'mostrar_tecnica', args: {} } }] }
      return decir(
        'En modo de prueba puedo mostrar la técnica o cambiar porciones («para 2»). Usa los botones para avanzar; configura Gemini para consultas culinarias abiertas.'
      )
    }
    let contexto: z.output<typeof contextoDemo>
    try {
      contexto = contextoDemo.parse(JSON.parse(peticion.contexto))
    } catch {
      return decir('Modo de prueba: dime qué ingredientes tienes para cocinar.')
    }
    const parts: ContenidoChat['parts'] = []
    if (/\b(tengo|anade|agrega|quita)\b/.test(texto)) {
      const ingredientes = contexto.catalogo
        .filter((i) =>
          [i.id.replace(/_/g, ' '), i.nombre, ...i.sinonimos].some((n) =>
            ` ${texto} `.includes(` ${normalizarTexto(n)} `)
          )
        )
        .map((i) => i.id)
      if (ingredientes.length)
        parts.push({
          functionCall: {
            name: 'marcar_ingredientes',
            args: { ingredientes, accion: texto.includes('quita') ? 'quitar' : 'anadir' }
          }
        })
    }
    const porciones = texto.match(/(?:somos|para)\s+(\d+)/)?.[1]
    if (porciones)
      parts.push({
        functionCall: { name: 'cambiar_preferencias', args: { porciones: Number(porciones) } }
      })
    if (/\b(busca|buscar|recetas|cocinar)\b/.test(texto) && !texto.includes('elige'))
      parts.push({ functionCall: { name: 'buscar_recetas', args: {} } })
    if (/\b(elige|cocina esta|empezar)\b/.test(texto) && contexto.recetas[0])
      parts.push({
        functionCall: { name: 'elegir_receta', args: { recetaId: contexto.recetas[0].id } }
      })
    return parts.length
      ? { role: 'model', parts }
      : decir(
          'Soy tu ayudante de cocina. Modo de prueba: escribe «tengo pollo y arroz», «somos 2» o «busca recetas». Para preguntas abiertas configura Gemini en el backend.'
        )
  }
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

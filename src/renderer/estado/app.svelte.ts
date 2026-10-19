// Estado de la interfaz: en qué pantalla estamos, el catálogo, las preferencias del usuario, la
// última búsqueda y la sesión de cocina. Todo lo que cambia la cocina pasa por main (IPC); aquí
// solo se guarda lo que la interfaz necesita mostrar.

import type { NombreHerramienta, ResultadoHerramienta } from '@shared/ia/herramientas'
import type { ResultadoBusqueda } from '@shared/types/busqueda'
import type { Ingrediente } from '@shared/types/receta'
import type { EstadoAvatar, Preferencias, SesionCocina } from '@shared/types/sesion'

export type Pantalla = 'preparar' | 'elegir' | 'cocinar'

export const PREFERENCIAS_INICIALES: Preferencias = {
  ingredientes: [],
  porciones: 4,
  restricciones: [],
  alergias: [],
  tiempoMaxMin: null,
  nivel: null,
  equipo: []
}

/** Tras hablar o señalar, el chef vuelve a esperar pasado este tiempo. */
const MS_HASTA_ESPERAR = 6000
const ESPERAR: EstadoAvatar = { accion: 'esperar' }

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

class EstadoApp {
  pantalla = $state<Pantalla>('preparar')
  catalogo = $state<Ingrediente[]>([])
  preferencias = $state<Preferencias>(structuredClone(PREFERENCIAS_INICIALES))
  busqueda = $state<ResultadoBusqueda | null>(null)
  // raw: la sesión llega entera de main en cada cambio y se pasa a funciones de shared que copian.
  sesion = $state.raw<SesionCocina | null>(null)
  /** Lo que hace el chef ahora (lo devuelve cada herramienta). */
  avatar = $state.raw<EstadoAvatar>(ESPERAR)
  /** Lo que dice el chef en su globo; `null` = el consejo del paso. */
  globo = $state<string | null>(null)
  ocupado = $state(false)
  error = $state<string | null>(null)

  /** Carga el catálogo y, si se cerró la app cocinando, vuelve a Cocinar. */
  async arrancar(): Promise<void> {
    await this.tarea(async () => {
      this.catalogo = await window.api.catalogo.ingredientes()
      const sesion = await window.api.sesion.retomar()
      if (sesion) {
        this.sesion = sesion
        this.pantalla = 'cocinar'
      }
    })
  }

  /** Busca recetas con las preferencias actuales y pasa a Elegir. */
  async buscar(): Promise<void> {
    await this.tarea(async () => {
      // Los proxies de $state no se pueden enviar por IPC: se manda una copia plana.
      this.busqueda = await window.api.recetas.buscar($state.snapshot(this.preferencias))
      this.pantalla = 'elegir'
    })
  }

  /** Empieza a cocinar la receta elegida (descarta la sesión anterior, si la había). */
  async cocinar(recetaId: string): Promise<void> {
    await this.tarea(async () => {
      const preferencias = $state.snapshot(this.preferencias)
      this.sesion = await window.api.sesion.iniciar({
        recetaId,
        porciones: preferencias.porciones,
        preferencias
      })
      this.pantalla = 'cocinar'
    })
  }

  /**
   * Aplica una herramienta del chef a la sesión (botones de Cocinar; la voz usará lo mismo).
   * Un botón pulsado cuenta como confirmación del usuario.
   */
  async aplicar(
    nombre: NombreHerramienta,
    argumentos: Record<string, unknown> = {},
    confirmado = true
  ): Promise<ResultadoHerramienta | null> {
    let resultado: ResultadoHerramienta | null = null
    await this.tarea(async () => {
      const aplicacion = await window.api.sesion.aplicar({ nombre, argumentos, confirmado })
      this.sesion = aplicacion.sesion
      this.globo = aplicacion.resultado.decir ?? null
      this.mostrarAvatar(aplicacion.avatar)
      resultado = aplicacion.resultado
    })
    return resultado
  }

  /** «Repetir» es local: el chef vuelve a decir el paso sin pasar por main ni por el modelo. */
  decir(texto: string): void {
    this.globo = texto
    this.mostrarAvatar({ accion: 'hablar' })
  }

  /** Tras terminar una receta, vuelve a Preparar conservando las preferencias. */
  cocinarOtra(): void {
    this.sesion = null
    this.busqueda = null
    this.globo = null
    this.mostrarAvatar(ESPERAR)
    this.pantalla = 'preparar'
  }

  private temporizadorAvatar: ReturnType<typeof setTimeout> | undefined

  private mostrarAvatar(estado: EstadoAvatar): void {
    clearTimeout(this.temporizadorAvatar)
    this.avatar = estado
    // La celebración final se queda; lo demás vuelve a esperar al rato.
    if (
      estado.accion !== 'esperar' &&
      !(estado.accion === 'celebrar' && estado.intensidad === 'completa')
    ) {
      this.temporizadorAvatar = setTimeout(() => (this.avatar = ESPERAR), MS_HASTA_ESPERAR)
    }
  }

  /** Se puede ir a una pantalla si ya hay datos para ella. */
  puedeIrA(pantalla: Pantalla): boolean {
    if (pantalla === 'elegir') return this.busqueda !== null
    if (pantalla === 'cocinar') return this.sesion !== null && this.sesion.fase === 'cocinar'
    return true
  }

  irA(pantalla: Pantalla): void {
    if (this.puedeIrA(pantalla)) this.pantalla = pantalla
  }

  private async tarea(trabajo: () => Promise<void>): Promise<void> {
    this.ocupado = true
    this.error = null
    try {
      await trabajo()
    } catch (e) {
      this.error = mensaje(e)
    } finally {
      this.ocupado = false
    }
  }
}

export const app = new EstadoApp()

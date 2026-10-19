// Estado de la interfaz: en qué pantalla estamos, el catálogo, las preferencias del usuario, la
// última búsqueda y la sesión de cocina. Todo lo que cambia la cocina pasa por main (IPC); aquí
// solo se guarda lo que la interfaz necesita mostrar.

import type { ResultadoBusqueda } from '@shared/types/busqueda'
import type { Ingrediente } from '@shared/types/receta'
import type { Preferencias, SesionCocina } from '@shared/types/sesion'

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

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

class EstadoApp {
  pantalla = $state<Pantalla>('preparar')
  catalogo = $state<Ingrediente[]>([])
  preferencias = $state<Preferencias>(structuredClone(PREFERENCIAS_INICIALES))
  busqueda = $state<ResultadoBusqueda | null>(null)
  sesion = $state<SesionCocina | null>(null)
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

// Estado de la interfaz: en qué pantalla estamos, el catálogo, las preferencias del usuario, la
// última búsqueda y la sesión de cocina. Todo lo que cambia la cocina pasa por main (IPC); aquí
// solo se guarda lo que la interfaz necesita mostrar.

import {
  ARGUMENTOS,
  NOMBRES_HERRAMIENTAS,
  type NombreHerramienta,
  type ResultadoHerramienta
} from '@shared/ia/herramientas'
import { aplicarSeleccion, ARGUMENTOS_SELECCION, type NombreSeleccion } from '@shared/ia/seleccion'
import type { ContenidoChat } from '@shared/ia/chat'
import { ejecutarTurnoChat } from '../lib/chat'
import { interpretarOrden } from '@shared/ia/ordenes'
import {
  hayIngredientesSeleccionados,
  MENSAJE_SIN_INGREDIENTES
} from '@shared/recetas/disponibilidad'
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
  /** Al abrir la app con una receta en curso: se muestra Retomar antes de entrar a Cocinar. */
  retomando = $state(false)
  /** Panel lateral del chat, abierto desde la cabecera. */
  chatAbierto = $state(false)
  catalogo = $state<Ingrediente[]>([])
  preferencias = $state<Preferencias>(structuredClone(PREFERENCIAS_INICIALES))
  busqueda = $state<ResultadoBusqueda | null>(null)
  recetaVisibleId = $state<string | null>(null)
  // raw: la sesión llega entera de main en cada cambio y se pasa a funciones de shared que copian.
  sesion = $state.raw<SesionCocina | null>(null)
  /** Lo que hace el chef ahora (lo devuelve cada herramienta). */
  avatar = $state.raw<EstadoAvatar>(ESPERAR)
  /** Lo que dice el chef en su globo; `null` = el consejo del paso. */
  globo = $state<string | null>(null)
  ocupado = $state(false)
  error = $state<string | null>(null)
  chatOcupado = $state(false)
  chatError = $state<string | null>(null)
  chatSimulado = $state(false)
  conversacion = $state<{ pregunta: string; respuesta: string }[]>([])
  resultadoChef = $state.raw<{
    nombre: string
    argumentos: unknown
    resultado: ResultadoHerramienta
  } | null>(null)
  private turnos: ContenidoChat[][] = []
  private pantallaConversacion: Pantalla | null = null

  /** Una respuesta tardía nunca actúa sobre preferencias o pasos que cambió el usuario. */
  private huella(): string {
    return JSON.stringify([
      this.pantalla,
      this.preferencias,
      this.recetaVisibleId,
      this.sesion?.id,
      this.sesion?.actualizadaEn
    ])
  }

  async enviarChat(texto: string): Promise<void> {
    texto = texto.trim()
    if (!texto || texto.length > 2000 || this.chatOcupado || this.ocupado) return
    this.chatOcupado = true
    this.chatError = null
    const pantallaTurno = this.pantalla
    if (this.pantallaConversacion !== pantallaTurno) this.turnos = []
    this.pantallaConversacion = pantallaTurno
    let huella = this.huella()
    const vigente = (): void => {
      if (huella !== this.huella() || this.ocupado)
        throw new Error(
          'La pantalla cambió durante la consulta. Vuelve a enviar tu petición con el estado actual.'
        )
    }
    try {
      // La confirmación de una orden corta exacta pertenece a la app, nunca al modelo.
      const orden = this.pantalla === 'cocinar' ? interpretarOrden(texto) : null
      if (orden && 'nombre' in orden) {
        const r = await this.aplicar(orden.nombre, orden.argumentos, orden.confirmado)
        this.conversacion.push({
          pregunta: texto,
          respuesta: r?.decir ?? 'Revisa el paso en pantalla.'
        })
        return
      }
      const anteriores = this.turnos.flat()
      const turno = await ejecutarTurnoChat(
        anteriores,
        texto,
        async (mensajes) => {
          vigente()
          const respuesta = await window.api.chef.conversar({
            pantalla: this.pantalla,
            preferencias: $state.snapshot(this.preferencias),
            mensajes
          })
          vigente()
          return respuesta
        },
        async (llamada) => {
          vigente()
          let resultado: Record<string, unknown>
          if (this.pantalla === 'cocinar') {
            const nombre = llamada.name as NombreHerramienta
            if (
              !NOMBRES_HERRAMIENTAS.includes(nombre) ||
              !ARGUMENTOS[nombre].safeParse(llamada.args).success
            )
              return { ok: false, decir: 'Esa herramienta o sus argumentos no están permitidos.' }
            const r = await this.aplicar(nombre, llamada.args, false)
            if (!r) throw new Error(this.error ?? 'No pude aplicar la herramienta.')
            this.resultadoChef = { nombre, argumentos: llamada.args, resultado: r }
            resultado = { ...r, finalizar: r.ok && r.estado.fase === 'terminado' }
          } else {
            const nombre = llamada.name as NombreSeleccion
            if (
              !Object.hasOwn(ARGUMENTOS_SELECCION, nombre) ||
              !ARGUMENTOS_SELECCION[nombre].safeParse(llamada.args).success
            )
              return { ok: false, decir: 'Esa herramienta o sus argumentos no están permitidos.' }
            const busqueda =
              nombre === 'buscar_recetas'
                ? await window.api.recetas.buscar($state.snapshot(this.preferencias))
                : null
            vigente()
            const r = aplicarSeleccion(
              {
                pantalla: this.pantalla,
                preferencias: $state.snapshot(this.preferencias),
                busqueda: $state.snapshot(this.busqueda),
                recetaVisibleId: this.recetaVisibleId
              },
              nombre,
              llamada.args,
              $state.snapshot(this.catalogo),
              busqueda
            )
            if (r.ok) {
              this.preferencias = r.estado.preferencias
              this.busqueda = r.estado.busqueda
              this.recetaVisibleId = r.estado.recetaVisibleId
              this.pantalla = r.estado.pantalla
              if (r.iniciarRecetaId) {
                await this.cocinar(r.iniciarRecetaId)
                if (this.error) throw new Error(this.error)
              }
            }
            resultado = { ok: r.ok, decir: r.decir, finalizar: r.ok && r.iniciarRecetaId !== null }
          }
          huella = this.huella()
          return resultado
        }
      )
      this.turnos =
        this.pantalla === pantallaTurno
          ? [...this.turnos, turno.mensajes.slice(anteriores.length)].slice(-2)
          : []
      this.chatSimulado = turno.simulado
      this.conversacion = [...this.conversacion, { pregunta: texto, respuesta: turno.texto }].slice(
        -12
      )
      this.decir(turno.texto)
    } catch (e) {
      this.chatError = mensaje(e)
      // Un fallo puede haber aplicado herramientas; no se reintenta el turno automáticamente.
      this.turnos = []
    } finally {
      this.chatOcupado = false
    }
  }

  /** Carga el catálogo y, si se cerró la app cocinando, vuelve a Cocinar. */
  async arrancar(): Promise<void> {
    await this.tarea(async () => {
      this.catalogo = await window.api.catalogo.ingredientes()
      const sesion = await window.api.sesion.retomar()
      if (sesion) {
        this.sesion = sesion
        this.pantalla = 'cocinar'
        this.retomando = true
      }
    })
  }

  /** Desde Retomar: entra a Cocinar con la receta en curso. */
  continuarReceta(): void {
    this.retomando = false
    this.globo = null
  }

  /** Desde Retomar: va a Preparar sin descartar la receta en curso (se descarta al empezar otra). */
  prepararOtra(): void {
    this.retomando = false
    this.irA('preparar')
  }

  /** Busca recetas con las preferencias actuales y pasa a Elegir. */
  async buscar(): Promise<void> {
    if (!hayIngredientesSeleccionados(this.preferencias.ingredientes, this.catalogo)) {
      this.busqueda = null
      this.recetaVisibleId = null
      this.pantalla = 'preparar'
      this.decir(MENSAJE_SIN_INGREDIENTES)
      return
    }
    await this.tarea(async () => {
      // Los proxies de $state no se pueden enviar por IPC: se manda una copia plana.
      this.busqueda = await window.api.recetas.buscar($state.snapshot(this.preferencias))
      this.recetaVisibleId = this.busqueda.resultados[0]?.receta.id ?? null
      this.globo = null
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
      this.retomando = false
      this.globo = null
      this.resultadoChef = null
    })
  }

  /**
   * Aplica una herramienta del chef a la sesión (botones de Cocinar; la voz usará lo mismo).
   * Un botón pulsado cuenta como confirmación del usuario.
   */
  async aplicar(
    nombre: NombreHerramienta,
    argumentos: unknown = {},
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

  /** Muestra lo que dice el chef; la narración del paso se gestiona en ControlVoz. */
  decir(texto: string): void {
    this.globo = texto
    this.mostrarAvatar({ accion: 'hablar' })
  }

  /** Tras terminar una receta, vuelve a Preparar conservando las preferencias. */
  cocinarOtra(): void {
    this.sesion = null
    this.busqueda = null
    this.recetaVisibleId = null
    this.turnos = []
    this.conversacion = []
    this.resultadoChef = null
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
    if (pantalla === 'elegir')
      return (
        this.busqueda !== null &&
        hayIngredientesSeleccionados(this.preferencias.ingredientes, this.catalogo)
      )
    if (pantalla === 'cocinar') return this.sesion !== null && this.sesion.fase === 'cocinar'
    return true
  }

  irA(pantalla: Pantalla): void {
    if (this.puedeIrA(pantalla)) {
      this.retomando = false
      if (pantalla !== this.pantalla) this.resultadoChef = null
      if (pantalla === 'preparar') {
        this.busqueda = null
        this.recetaVisibleId = null
      }
      this.pantalla = pantalla
    }
  }

  private async tarea(trabajo: () => Promise<void>): Promise<void> {
    if (this.ocupado) return
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

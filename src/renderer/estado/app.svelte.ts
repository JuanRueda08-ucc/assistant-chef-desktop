// Estado de la interfaz: en qué pantalla estamos, el catálogo, las preferencias del usuario, la
// última búsqueda y la sesión de cocina. Todo lo que cambia la cocina pasa por main (IPC); aquí
// solo se guarda lo que la interfaz necesita mostrar.

import {
  ARGUMENTOS,
  NOMBRES_HERRAMIENTAS,
  type NombreHerramienta,
  type ResultadoHerramienta
} from '@shared/ia/herramientas'
import {
  aplicarSeleccion,
  ARGUMENTOS_SELECCION,
  decidirIngredientesDelChat,
  encontrarIdea,
  HERRAMIENTAS_IDEAS,
  type NombreSeleccion
} from '@shared/ia/seleccion'
import { resumenRecetaGenerada } from '@shared/recetas/receta-generada'
import type { ContenidoChat } from '@shared/ia/chat'
import { ejecutarTurnoChat } from '../lib/chat'
import { notaPreferencias } from '@shared/ia/nota-preferencias'
import { interpretarOrden } from '@shared/ia/ordenes'
import { unirLista } from '@shared/recetas/lista'
import {
  hayIngredientesSeleccionados,
  MENSAJE_SIN_INGREDIENTES
} from '@shared/recetas/disponibilidad'
import type { ResultadoBusqueda } from '@shared/types/busqueda'
import type { EstadoCuenta } from '@shared/types/cuenta'
import type { FuenteIdea, FuenteWeb, IdeaReceta } from '@shared/types/ideas'
import type { Ingrediente, RecetaGenerada } from '@shared/types/receta'
import type { EstadoAvatar, Preferencias, SesionCocina } from '@shared/types/sesion'

export type Pantalla = 'preparar' | 'elegir' | 'cocinar'

export const PREFERENCIAS_INICIALES: Preferencias = {
  ingredientes: [],
  ingredientesSinIdentificar: [],
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

/** Texto para el usuario, sin el prefijo que Electron añade a los errores de ipcRenderer.invoke. */
const mensaje = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(
    /^Error invoking remote method '[^']*': (?:\w*Error: )?/,
    ''
  )

class EstadoApp {
  /** `null` mientras main comprueba la sesión guardada; sin usuario se muestra Acceso (0016). */
  cuenta = $state.raw<EstadoCuenta | null>(null)
  pantalla = $state<Pantalla>('preparar')
  /** Al abrir la app con una receta en curso: se muestra Retomar antes de entrar a Cocinar. */
  retomando = $state(false)
  /** Menú lateral con Mi cuenta y Mis recetas (0022). */
  menuAbierto = $state(false)
  /** Panel lateral del chat, abierto desde la cabecera. */
  chatAbierto = $state(false)
  catalogo = $state<Ingrediente[]>([])
  preferencias = $state<Preferencias>(structuredClone(PREFERENCIAS_INICIALES))
  /** Hasta leer lo guardado no se guarda nada, para no pisar la despensa con la vacía. */
  preferenciasCargadas = $state(false)
  busqueda = $state<ResultadoBusqueda | null>(null)
  /** Ideas del chef con la IA (tarea 39), junto a las recetas guardadas en Elegir. */
  ideas = $state.raw<{
    lista: IdeaReceta[]
    fuente: FuenteIdea
    fuentes: FuenteWeb[]
    sugerenciasBusqueda: string | null
  } | null>(null)
  ideasCargando = $state(false)
  ideasError = $state<string | null>(null)
  ideaVisibleId = $state<string | null>(null)
  /** Elegir muestra las tarjetas o, al pulsar una, su detalle (rediseño 43). */
  elegirDetalle = $state(false)
  /** Recetas completas ya escritas, por id de idea, para no gastar otra petición al volver a ella. */
  recetasDeIdeas = $state.raw<Record<string, RecetaGenerada>>({})
  ideaGenerandoId = $state<string | null>(null)
  recetaIdeaError = $state<string | null>(null)
  /** Recetas de la IA que guardó la cuenta (tarea 41). */
  misRecetas = $state.raw<RecetaGenerada[]>([])
  verMisRecetas = $state(false)
  /** El catálogo más los ingredientes propios de las recetas guardadas, para mostrar sus nombres. */
  catalogoCompleto = $derived([
    ...this.catalogo,
    ...this.misRecetas.flatMap((g) => g.ingredientesNuevos)
  ])
  /** Títulos ya mostrados, para que «dame otras» no los repita. */
  private ideasVistas: string[] = []
  private pedidoIdeas = 0
  private pedidoRecetaIdea = 0
  recetaVisibleId = $state<string | null>(null)
  /** Ingredientes dichos al chef, a la espera de que la persona decida si reemplazan su selección. */
  confirmacionIngredientes = $state.raw<{
    nombres: string[]
    ingredientes: string[]
    luego: { ideas: boolean; pedido: string | null } | null
  } | null>(null)
  /** Duda sobre un ingrediente en este turno: la dice la app y no se busca hasta aclararla. */
  private aclaracionTurno: string | null = null
  /** Con qué ingredientes y filtros se hizo la búsqueda; si no cambian, se conserva al ir y volver. */
  private criteriosBusqueda: string | null = null
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
    this.confirmacionIngredientes = null
    this.aclaracionTurno = null
    const pantallaTurno = this.pantalla
    if (this.pantallaConversacion !== pantallaTurno) this.turnos = []
    this.pantallaConversacion = pantallaTurno
    let huella = this.huella()
    const saludAntes = $state.snapshot({
      alergias: this.preferencias.alergias,
      restricciones: this.preferencias.restricciones
    })
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
            mensajes,
            ideas: (this.ideas?.lista ?? []).map((i) => ({
              titulo: i.titulo,
              faltan: i.faltan,
              recetaEscrita: !!this.recetasDeIdeas[i.id]
            }))
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
            if (
              this.aclaracionTurno &&
              (nombre === 'buscar_recetas' || nombre === 'proponer_ideas')
            )
              return { ok: false, decir: this.aclaracionTurno }
            const pendiente = this.confirmacionIngredientes
            if (pendiente && (nombre === 'buscar_recetas' || nombre === 'proponer_ideas')) {
              // Primero decide la persona; al hacerlo, se busca con lo que elija.
              this.confirmacionIngredientes = {
                ...pendiente,
                luego: {
                  ideas: nombre === 'proponer_ideas',
                  pedido:
                    ARGUMENTOS_SELECCION.proponer_ideas.safeParse(llamada.args).data?.pedido ?? null
                }
              }
              return { ok: false, decir: 'La persona debe elegir primero en los botones.' }
            }
            let argumentos: unknown = llamada.args
            if (nombre === 'marcar_ingredientes') {
              const a = ARGUMENTOS_SELECCION.marcar_ingredientes.parse(llamada.args)
              if (a.accion !== 'quitar') {
                const decision = decidirIngredientesDelChat(
                  texto,
                  this.preferencias,
                  a.ingredientes,
                  this.catalogo
                )
                if (decision.accion === 'aclarar') {
                  this.aclaracionTurno = decision.pregunta
                  return { ok: false, decir: decision.pregunta }
                }
                if (a.accion === 'anadir' && decision.accion === 'preguntar') {
                  this.confirmacionIngredientes = {
                    nombres: [...(pendiente?.nombres ?? []), ...decision.nombres],
                    ingredientes: [...(pendiente?.ingredientes ?? []), ...a.ingredientes],
                    luego: pendiente?.luego ?? null
                  }
                  return { ok: true, decir: 'La app le pregunta a la persona qué hacer con ellos.' }
                }
                if (a.accion === 'anadir') argumentos = { ...a, accion: decision.accion }
              }
            }
            if ((HERRAMIENTAS_IDEAS as readonly string[]).includes(nombre)) {
              const r = await this.herramientaIdea(nombre, llamada.args)
              huella = this.huella()
              return r
            }
            // Una receta guardada no siempre sale en los resultados de hoy.
            const guardadaId = ARGUMENTOS_SELECCION.elegir_receta.safeParse(llamada.args).data
              ?.recetaId
            if (
              nombre === 'elegir_receta' &&
              this.misRecetas.some((g) => g.receta.id === guardadaId)
            ) {
              await this.cocinar(guardadaId!)
              if (this.error) throw new Error(this.error)
              huella = this.huella()
              return { ok: true, decir: 'Vamos a cocinar.', finalizar: true }
            }
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
              argumentos,
              $state.snapshot(this.catalogo),
              busqueda
            )
            if (r.ok) {
              const mismaBusqueda =
                nombre === 'buscar_recetas' && this.criteriosBusqueda === this.criterios()
              const nuevaBusqueda = nombre === 'buscar_recetas' || r.estado.busqueda === null
              if (nuevaBusqueda && !mismaBusqueda) this.limpiarIdeas()
              if (nombre === 'buscar_recetas') this.criteriosBusqueda = this.criterios()
              this.preferencias = r.estado.preferencias
              this.busqueda = r.estado.busqueda
              this.recetaVisibleId = r.estado.recetaVisibleId
              this.pantalla = r.estado.pantalla
              if (nombre === 'ver_receta') {
                this.ideaVisibleId = null
                this.elegirDetalle = true
              }
              if (nombre === 'buscar_recetas' && !mismaBusqueda && this.busqueda?.ofrecerGenerada)
                void this.proponerIdeas()
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
      // Lo guardado de verdad se añade desde el estado, no desde lo que diga el modelo (0019).
      const nota = notaPreferencias(texto, saludAntes, this.preferencias)
      // La pregunta la hace la app: el modelo podría decir que ya los añadió o que ya buscó.
      const respuesta =
        this.aclaracionTurno ??
        this.preguntaIngredientes() ??
        (nota ? `${turno.texto} ${nota}`.trim() : turno.texto)
      this.conversacion = [...this.conversacion, { pregunta: texto, respuesta }].slice(-12)
      this.decir(respuesta)
    } catch (e) {
      this.chatError = mensaje(e)
      // Un fallo puede haber aplicado herramientas; no se reintenta el turno automáticamente.
      this.turnos = []
      void this.comprobarCuenta()
    } finally {
      this.chatOcupado = false
    }
  }

  private preguntaIngredientes(): string | null {
    const pendiente = this.confirmacionIngredientes
    if (!pendiente) return null
    const nombres = unirLista(pendiente.nombres.map((n) => n.toLocaleLowerCase('es')))
    return `Ya tienes ingredientes seleccionados. ¿Reemplazo tu selección por ${nombres}, o los añado a ella?`
  }

  /** Respuesta a «¿reemplazo o añado?». Después sigue con la búsqueda que se había pedido. */
  async resolverIngredientes(accion: 'reemplazar' | 'anadir'): Promise<void> {
    const pendiente = this.confirmacionIngredientes
    if (!pendiente || this.chatOcupado) return
    this.confirmacionIngredientes = null
    const r = aplicarSeleccion(
      {
        pantalla: this.pantalla === 'elegir' ? 'elegir' : 'preparar',
        preferencias: $state.snapshot(this.preferencias),
        busqueda: $state.snapshot(this.busqueda),
        recetaVisibleId: this.recetaVisibleId
      },
      'marcar_ingredientes',
      { ingredientes: pendiente.ingredientes, accion },
      $state.snapshot(this.catalogo)
    )
    const pregunta =
      accion === 'reemplazar' ? 'Reemplazar mi selección' : 'Añadirlos a mi selección'
    if (!r.ok) {
      this.conversacion = [...this.conversacion, { pregunta, respuesta: r.decir }].slice(-12)
      return
    }
    this.limpiarIdeas()
    this.preferencias = r.estado.preferencias
    this.busqueda = r.estado.busqueda
    this.recetaVisibleId = r.estado.recetaVisibleId
    this.pantalla = r.estado.pantalla
    this.turnos = []
    let respuesta = r.decir
    if (pendiente.luego) {
      this.chatOcupado = true
      this.chatError = null
      try {
        if (pendiente.luego.ideas) {
          const ideas = await this.herramientaIdea('proponer_ideas', {
            ...(pendiente.luego.pedido ? { pedido: pendiente.luego.pedido } : {})
          })
          const lista = (ideas.ideas as { titulo: string }[] | undefined) ?? []
          respuesta = lista.length
            ? `Con esos ingredientes te propongo: ${unirLista(lista.map((i) => i.titulo))}.`
            : String(ideas.decir)
        } else {
          await this.buscar()
          const n = this.busqueda?.resultados.length ?? 0
          respuesta = n
            ? `Listo. Encontré ${n} ${n === 1 ? 'receta' : 'recetas'}; primero las que usan más de lo que tienes.`
            : 'Listo. No encontré recetas guardadas con eso; voy a pedirle ideas al chef.'
        }
      } finally {
        this.chatOcupado = false
      }
    }
    this.conversacion = [...this.conversacion, { pregunta, respuesta }].slice(-12)
    this.decir(respuesta)
  }

  /** Lo que determina los resultados. Las porciones no: la receta se escala sin buscar de nuevo. */
  private criterios(): string {
    return JSON.stringify({ ...$state.snapshot(this.preferencias), porciones: 0 })
  }

  /** Carga el catálogo y, si se cerró la app cocinando, vuelve a Cocinar. */
  /** Al abrir la app: primero la cuenta; sin sesión se queda en Acceso. */
  async arrancar(): Promise<void> {
    this.cuenta = await window.api.cuenta.estado()
    if (this.cuenta.usuario) await this.cargar()
  }

  /** Tras entrar o verificar el correo, con la sesión ya guardada en main. */
  async alEntrar(estado: EstadoCuenta): Promise<void> {
    this.cuenta = estado
    await this.cargar()
  }

  /** Cierra la sesión y olvida todo lo de la cuenta anterior que hay en la interfaz. */
  async salir(): Promise<void> {
    this.preferenciasCargadas = false
    this.cuenta = (await window.api.cuenta.salir()).ok
      ? { usuario: null, sinConexion: false }
      : await window.api.cuenta.estado()
    this.preferencias = structuredClone(PREFERENCIAS_INICIALES)
    this.misRecetas = []
    this.verMisRecetas = false
    this.cocinarOtra()
    this.retomando = false
    this.chatAbierto = false
    this.error = null
    this.chatError = null
  }

  /** Tras un fallo del backend, comprueba si la sesión caducó (main la habrá cerrado). */
  async comprobarCuenta(): Promise<void> {
    const estado = await window.api.cuenta.estado()
    if (!estado.usuario) await this.salir()
  }

  private async cargar(): Promise<void> {
    await this.tarea(async () => {
      this.catalogo = await window.api.catalogo.ingredientes()
      const guardadas = await window.api.preferencias.leer()
      if (guardadas) {
        // Un ingrediente retirado del catálogo no debe quedar marcado sin poder verse ni quitarse.
        const existen = new Set(this.catalogo.map((i) => i.id))
        this.preferencias = {
          ...guardadas,
          ingredientes: guardadas.ingredientes.filter((id) => existen.has(id))
        }
      }
      this.preferenciasCargadas = true
      this.misRecetas = await window.api.misRecetas.listar()
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

  private limpiarIdeas(): void {
    this.pedidoIdeas++
    this.ideas = null
    this.ideasCargando = false
    this.ideasError = null
    this.ideaVisibleId = null
    this.ideasVistas = []
    this.pedidoRecetaIdea++
    this.recetasDeIdeas = {}
    this.ideaGenerandoId = null
    this.recetaIdeaError = null
  }

  /** La imagen llega aparte: la receta ya se puede leer y cocinar mientras tanto. */
  private async pedirImagen(ideaId: string, recetaId: string): Promise<void> {
    const imagen = await window.api.recetas.imagen({ recetaId }).catch(() => null)
    const actual = this.recetasDeIdeas[ideaId]
    if (!imagen || actual?.receta.id !== recetaId) return
    this.recetasDeIdeas = {
      ...this.recetasDeIdeas,
      [ideaId]: { ...actual, receta: { ...actual.receta, imagen } }
    }
  }

  /** Escribe la receta completa de una idea (tarea 40). Solo una a la vez. */
  async generarRecetaDeIdea(idea: IdeaReceta): Promise<void> {
    if (this.ideaGenerandoId || this.recetasDeIdeas[idea.id]) return
    const pedido = ++this.pedidoRecetaIdea
    this.ideaGenerandoId = idea.id
    this.recetaIdeaError = null
    try {
      const { titulo, descripcion, ingredientes, tiempoTotalMin, dificultad } = idea
      const r = await window.api.recetas.generar({
        idea: { titulo, descripcion, ingredientes, tiempoTotalMin, dificultad },
        preferencias: $state.snapshot(this.preferencias)
      })
      if (pedido !== this.pedidoRecetaIdea) return
      if (r.ok) {
        const { receta, ingredientesNuevos } = r
        this.recetasDeIdeas = {
          ...this.recetasDeIdeas,
          [idea.id]: { receta, ingredientesNuevos }
        }
        void this.pedirImagen(idea.id, receta.id)
      } else {
        this.recetaIdeaError = r.mensaje
      }
    } catch (e) {
      if (pedido === this.pedidoRecetaIdea) {
        this.recetaIdeaError = mensaje(e)
        void this.comprobarCuenta()
      }
    } finally {
      if (pedido === this.pedidoRecetaIdea) this.ideaGenerandoId = null
    }
  }

  /** Lo que el chef pide por chat sobre las ideas. Lo que afirme sale de lo calculado aquí. */
  private async herramientaIdea(
    nombre: NombreSeleccion,
    argumentos: unknown
  ): Promise<Record<string, unknown>> {
    const fallo = (decir: string): Record<string, unknown> => ({ ok: false, decir })
    if (nombre === 'proponer_ideas') {
      const { pedido } = ARGUMENTOS_SELECCION.proponer_ideas.parse(argumentos)
      const prefs = this.preferencias
      if (
        !hayIngredientesSeleccionados(prefs.ingredientes, this.catalogo) &&
        prefs.ingredientesSinIdentificar.length === 0
      )
        return fallo(MENSAJE_SIN_INGREDIENTES)
      if (this.pantalla !== 'elegir' || !this.busqueda) await this.buscar(false)
      await this.proponerIdeas(pedido ?? null)
      if (this.ideasError) return fallo(this.ideasError)
      const lista = this.ideas?.lista ?? []
      this.ideaVisibleId = lista[0]?.id ?? null
      this.elegirDetalle = false
      return {
        ok: true,
        decir: `Propuse ${lista.length} ${lista.length === 1 ? 'idea' : 'ideas'}.`,
        origen: this.ideas?.fuente === 'internet' ? 'buscó en internet' : 'sin buscar en internet',
        ideas: lista.map((i) => ({
          titulo: i.titulo,
          tiempoMin: i.tiempoTotalMin,
          faltan: i.faltan,
          alergenosSinVerificar: i.sinVerificar
        }))
      }
    }
    const { titulo } = ARGUMENTOS_SELECCION.escribir_receta.parse(argumentos)
    const idea = encontrarIdea(this.ideas?.lista ?? [], titulo)
    if (!idea) return fallo('No tengo clara cuál de las ideas es. Pregunta cuál quiere.')
    this.ideaVisibleId = idea.id
    this.recetaVisibleId = null
    this.pantalla = 'elegir'
    this.elegirDetalle = true
    if (nombre === 'cocinar_idea') {
      const generada = this.recetasDeIdeas[idea.id]
      if (!generada) return fallo('Primero hay que escribir la receta con escribir_receta.')
      await this.cocinar(generada.receta.id)
      if (this.error) throw new Error(this.error)
      return { ok: true, decir: 'Vamos a cocinar.', finalizar: true }
    }
    if (this.ideas?.fuente === 'internet')
      return fallo('Las recetas de ideas encontradas en internet aún no están disponibles.')
    await this.generarRecetaDeIdea(idea)
    const generada = this.recetasDeIdeas[idea.id]
    if (!generada) return fallo(this.recetaIdeaError ?? 'No pude escribir la receta.')
    // `finalizar`: el turno termina con este texto del código, no con lo que resuma el modelo.
    return {
      ok: true,
      finalizar: true,
      decir: resumenRecetaGenerada(generada, this.preferencias, this.catalogo)
    }
  }

  /**
   * Pide ideas a la IA. Si cambia la búsqueda mientras tanto, la respuesta se descarta. Con recetas
   * guardadas que no encajan, la primera idea queda seleccionada.
   */
  async proponerIdeas(pedidoPersona: string | null = null): Promise<void> {
    if (this.ideasCargando) return
    const pedido = ++this.pedidoIdeas
    this.ideasCargando = true
    this.ideasError = null
    try {
      const guardadas = (this.busqueda?.resultados ?? []).map((r) => r.receta.titulo)
      const r = await window.api.recetas.proponer({
        preferencias: $state.snapshot(this.preferencias),
        excluir: [...guardadas, ...this.ideasVistas].slice(-100),
        pedido: pedidoPersona
      })
      if (pedido !== this.pedidoIdeas) return
      if (!r.ok) {
        this.ideasError = r.mensaje
      } else if (r.ideas.length === 0) {
        this.ideasError =
          'No encontré ideas que encajen con tu despensa, tus alergias y tu dieta. Prueba a añadir ingredientes o a pedir otras.'
      } else {
        this.ideasVistas.push(...r.ideas.map((i) => i.titulo))
        this.ideas = {
          lista: r.ideas,
          fuente: r.fuente,
          fuentes: r.fuentes,
          sugerenciasBusqueda: r.sugerenciasBusqueda
        }
        if (this.ideaVisibleId || this.busqueda?.ofrecerGenerada)
          this.ideaVisibleId = r.ideas[0]!.id
      }
    } catch (e) {
      if (pedido === this.pedidoIdeas) {
        this.ideasError = mensaje(e)
        void this.comprobarCuenta()
      }
    } finally {
      if (pedido === this.pedidoIdeas) this.ideasCargando = false
    }
  }

  /** Busca recetas con las preferencias actuales y pasa a Elegir. */
  async buscar(conIdeas = true): Promise<void> {
    // Sin cambios no se repite: se conservan los resultados, las ideas y las recetas ya escritas.
    if (this.busqueda && this.criteriosBusqueda === this.criterios()) {
      this.globo = null
      this.pantalla = 'elegir'
      return
    }
    this.limpiarIdeas()
    this.elegirDetalle = false
    // Solo con ingredientes fuera del catálogo no hay recetas guardadas, pero la IA sí puede ayudar.
    if (
      !hayIngredientesSeleccionados(this.preferencias.ingredientes, this.catalogo) &&
      this.preferencias.ingredientesSinIdentificar.length > 0
    ) {
      this.busqueda = { resultados: [], descartadas: [], ofrecerGenerada: true }
      this.criteriosBusqueda = this.criterios()
      this.recetaVisibleId = null
      this.globo = null
      this.pantalla = 'elegir'
      if (conIdeas) void this.proponerIdeas()
      return
    }
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
      this.criteriosBusqueda = this.criterios()
      this.recetaVisibleId = this.busqueda.resultados[0]?.receta.id ?? null
      this.globo = null
      this.pantalla = 'elegir'
    })
    if (conIdeas && this.pantalla === 'elegir' && this.busqueda?.ofrecerGenerada)
      void this.proponerIdeas()
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
      this.verMisRecetas = false
      this.retomando = false
      this.globo = null
      this.resultadoChef = null
    })
  }

  abrirMisRecetas(): void {
    this.error = null
    this.chatAbierto = false
    this.verMisRecetas = true
  }

  cerrarMisRecetas(): void {
    this.error = null
    this.verMisRecetas = false
  }

  /** Guarda la receta de la IA que se acaba de cocinar. */
  async guardarEnMisRecetas(): Promise<void> {
    const sesionId = this.sesion?.id
    if (!sesionId) return
    await this.tarea(async () => {
      this.misRecetas = await window.api.misRecetas.guardar({ sesionId })
    })
  }

  async quitarDeMisRecetas(recetaId: string): Promise<void> {
    await this.tarea(async () => {
      this.misRecetas = await window.api.misRecetas.quitar({ recetaId })
      if (this.busqueda)
        this.busqueda = {
          ...this.busqueda,
          resultados: this.busqueda.resultados.filter((r) => r.receta.id !== recetaId)
        }
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
  /** El chef lee el paso en voz alta: habla sin cambiar lo que dice su globo. */
  chefHabla(): void {
    this.mostrarAvatar({ accion: 'hablar' })
  }

  decir(texto: string): void {
    this.globo = texto
    this.mostrarAvatar({ accion: 'hablar' })
  }

  /** Tras terminar una receta, vuelve a Preparar conservando las preferencias. */
  cocinarOtra(): void {
    this.confirmacionIngredientes = null
    this.limpiarIdeas()
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
      return this.busqueda !== null && this.criteriosBusqueda === this.criterios()
    if (pantalla === 'cocinar') return this.sesion !== null && this.sesion.fase === 'cocinar'
    return true
  }

  irA(pantalla: Pantalla): void {
    if (this.puedeIrA(pantalla)) {
      this.verMisRecetas = false
      this.retomando = false
      if (pantalla !== this.pantalla) this.resultadoChef = null
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
      void this.comprobarCuenta()
    } finally {
      this.ocupado = false
    }
  }
}

export const app = new EstadoApp()

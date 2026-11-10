// Límite de uso por instalación y por día (UTC), para que la clave del proveedor no se use sin
// control. El almacén es intercambiable: en memoria vale para un solo proceso; en serverless con
// varias instancias habrá que usar uno compartido (KV, Redis…) que implemente `AlmacenUso`.

import { GRUPOS_USO, type GrupoUso, type UsoDiario } from '@shared/ia/uso'

export const GRUPOS = GRUPOS_USO
export type Grupo = GrupoUso

/** Peticiones por instalación y día. Se pueden cambiar con `LIMITE_VOZ`, `LIMITE_RECETAS`… */
export const LIMITES_POR_DEFECTO: Record<Grupo, number> = {
  voz: 40,
  chat: 120,
  recetas: 20,
  sustituciones: 60,
  imagenes: 20
}

export interface AlmacenUso {
  /** Suma uno al contador de la clave y devuelve el valor nuevo. */
  incrementar(clave: string, dia: string): Promise<number>
  /** Valores de esas claves en el día, sin cambiarlos; las que no existen no aparecen. */
  leer(claves: readonly string[], dia: string): Promise<Record<string, number>>
}

/** Contadores en memoria; al cambiar de día se descartan los del anterior. */
export class AlmacenMemoria implements AlmacenUso {
  private dia = ''
  private readonly contadores = new Map<string, number>()

  async incrementar(clave: string, dia: string): Promise<number> {
    if (dia !== this.dia) {
      this.contadores.clear()
      this.dia = dia
    }
    const valor = (this.contadores.get(clave) ?? 0) + 1
    this.contadores.set(clave, valor)
    return valor
  }

  async leer(claves: readonly string[], dia: string): Promise<Record<string, number>> {
    if (dia !== this.dia) return {}
    return Object.fromEntries(
      claves.flatMap((c) => (this.contadores.has(c) ? [[c, this.contadores.get(c)!]] : []))
    )
  }
}

export interface Consumo {
  permitido: boolean
  restantes: number
  /** Segundos hasta que se reinicia el contador (medianoche UTC). */
  reintentarEnSeg: number
}

export class Limitador {
  constructor(
    private readonly almacen: AlmacenUso,
    private readonly limites: Record<Grupo, number> = LIMITES_POR_DEFECTO
  ) {}

  async consumir(instalacion: string, grupo: Grupo, ahora: number): Promise<Consumo> {
    const usadas = await this.almacen.incrementar(`${grupo}:${instalacion}`, diaUtc(ahora))
    const limite = this.limites[grupo]
    return {
      permitido: usadas <= limite,
      restantes: Math.max(0, limite - usadas),
      reintentarEnSeg: Math.ceil((medianocheUtc(ahora) - ahora) / 1000)
    }
  }

  /** Lo usado y lo que queda hoy en cada grupo, sin gastar nada. */
  async uso(instalacion: string, ahora: number): Promise<UsoDiario> {
    const clave = (g: Grupo): string => `${g}:${instalacion}`
    const contados = await this.almacen.leer(GRUPOS.map(clave), diaUtc(ahora))
    const grupos = Object.fromEntries(
      GRUPOS.map((g) => {
        const limite = this.limites[g]
        const usadas = contados[clave(g)] ?? 0
        return [g, { limite, usadas, restantes: Math.max(0, limite - usadas) }]
      })
    ) as UsoDiario['grupos']
    return { grupos, reinicioEn: medianocheUtc(ahora) }
  }
}

const diaUtc = (ahora: number): string => new Date(ahora).toISOString().slice(0, 10)

function medianocheUtc(ahora: number): number {
  const fecha = new Date(ahora)
  return Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() + 1)
}

/** Límites desde el entorno; un valor ausente o no válido usa el de por defecto. */
export function limitesDesdeEntorno(
  entorno: Record<string, string | undefined>
): Record<Grupo, number> {
  const leer = (grupo: Grupo): number => {
    const valor = Number(entorno[`LIMITE_${grupo.toUpperCase()}`])
    return Number.isInteger(valor) && valor > 0 ? valor : LIMITES_POR_DEFECTO[grupo]
  }
  return {
    voz: leer('voz'),
    recetas: leer('recetas'),
    sustituciones: leer('sustituciones'),
    chat: leer('chat'),
    imagenes: leer('imagenes')
  }
}

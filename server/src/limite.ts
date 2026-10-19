// Límite de uso por instalación y por día (UTC), para que la clave del proveedor no se use sin
// control. El almacén es intercambiable: en memoria vale para un solo proceso; en serverless con
// varias instancias habrá que usar uno compartido (KV, Redis…) que implemente `AlmacenUso`.

export const GRUPOS = ['voz', 'recetas', 'sustituciones'] as const
export type Grupo = (typeof GRUPOS)[number]

/** Peticiones por instalación y día. Se pueden cambiar con `LIMITE_VOZ`, `LIMITE_RECETAS`… */
export const LIMITES_POR_DEFECTO: Record<Grupo, number> = {
  voz: 40,
  recetas: 20,
  sustituciones: 60
}

export interface AlmacenUso {
  /** Suma uno al contador de la clave y devuelve el valor nuevo. */
  incrementar(clave: string, dia: string): Promise<number>
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
    const fecha = new Date(ahora)
    const dia = fecha.toISOString().slice(0, 10)
    const usadas = await this.almacen.incrementar(`${grupo}:${instalacion}`, dia)
    const limite = this.limites[grupo]
    const medianoche = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() + 1)
    return {
      permitido: usadas <= limite,
      restantes: Math.max(0, limite - usadas),
      reintentarEnSeg: Math.ceil((medianoche - ahora) / 1000)
    }
  }
}

/** Límites desde el entorno; un valor ausente o no válido usa el de por defecto. */
export function limitesDesdeEntorno(
  entorno: Record<string, string | undefined>
): Record<Grupo, number> {
  const leer = (grupo: Grupo): number => {
    const valor = Number(entorno[`LIMITE_${grupo.toUpperCase()}`])
    return Number.isInteger(valor) && valor > 0 ? valor : LIMITES_POR_DEFECTO[grupo]
  }
  return { voz: leer('voz'), recetas: leer('recetas'), sustituciones: leer('sustituciones') }
}

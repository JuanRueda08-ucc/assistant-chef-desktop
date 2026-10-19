import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { restanteSeg } from '@shared/cocina/temporizadores'
import type { Preferencias } from '@shared/types/sesion'
import { aplicarEnCocina, iniciarCocina, retomarCocina } from './cocina'
import { abrirBase, type BaseDatos } from './db/conexion'
import { cargarSemilla, leerSemilla } from './db/semillas'
import { obtenerSesion } from './db/sesiones'

const T0 = 1_760_000_000_000
const en = (s: number): number => T0 + s * 1000

const preferencias: Preferencias = {
  ingredientes: ['pollo_muslo', 'arroz_blanco'],
  porciones: 4,
  restricciones: [],
  alergias: [],
  tiempoMaxMin: null,
  nivel: null,
  equipo: []
}
const datos = { recetaId: 'arroz_con_pollo', porciones: 4, preferencias }

let carpeta: string
let ruta: string
let db: BaseDatos

/** Abre la base del archivo temporal y carga la semilla, como hace la app al arrancar. */
const arrancar = (): BaseDatos => {
  const base = abrirBase(ruta)
  cargarSemilla(base, leerSemilla())
  return base
}

const contarSesiones = (): number =>
  (db.prepare('SELECT count(*) AS n FROM sesiones').get() as { n: number }).n

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'chef-'))
  ruta = join(carpeta, 'chef.sqlite')
  db = arrancar()
})

afterEach(() => {
  db.close()
  rmSync(carpeta, { recursive: true, force: true })
})

describe('sesión de cocina en la base', () => {
  it('iniciar crea y guarda la sesión', () => {
    const sesion = iniciarCocina(db, datos, T0, 's1')
    expect(sesion).toMatchObject({ id: 's1', fase: 'cocinar', pasoActual: 1, porciones: 4 })
    expect(obtenerSesion(db, 's1')).toEqual(sesion)
    expect(retomarCocina(db, T0)).toEqual(sesion)
  })

  it('al iniciar otra receta descarta la sesión cocinando anterior', () => {
    iniciarCocina(db, datos, T0, 's1')
    iniciarCocina(db, { ...datos, porciones: 2 }, en(10), 's2')
    expect(contarSesiones()).toBe(1)
    expect(retomarCocina(db, en(10))?.id).toBe('s2')
  })

  it('falla si la receta no existe', () => {
    expect(() => iniciarCocina(db, { ...datos, recetaId: 'no_existe' }, T0)).toThrow(/no_existe/)
  })

  it('guarda después de cada herramienta que tiene efecto', () => {
    iniciarCocina(db, datos, T0, 's1')
    const r = aplicarEnCocina(
      db,
      { nombre: 'avanzar_paso', argumentos: {}, confirmado: true },
      en(30)
    )
    expect(r.resultado.ok).toBe(true)
    expect(obtenerSesion(db, 's1')).toMatchObject({ pasoActual: 2, pasosHechos: ['p1'] })
  })

  it('no guarda nada si la herramienta falla', () => {
    const inicial = iniciarCocina(db, datos, T0, 's1')
    const r = aplicarEnCocina(
      db,
      { nombre: 'avanzar_paso', argumentos: {}, confirmado: false },
      en(30)
    )
    expect(r.resultado.ok).toBe(false)
    expect(obtenerSesion(db, 's1')).toEqual(inicial)
  })

  it('falla si no hay sesión cocinando', () => {
    expect(() =>
      aplicarEnCocina(db, { nombre: 'avanzar_paso', argumentos: {}, confirmado: true }, T0)
    ).toThrow(/no hay ninguna sesión/)
  })

  it('al terminar la receta ya no hay nada que retomar', () => {
    iniciarCocina(db, datos, T0, 's1')
    aplicarEnCocina(db, { nombre: 'ir_a_paso', argumentos: { orden: 9 }, confirmado: false }, T0)
    aplicarEnCocina(db, { nombre: 'terminar_receta', argumentos: {}, confirmado: false }, en(5))
    expect(retomarCocina(db, en(10))).toBeNull()
    expect(obtenerSesion(db, 's1')?.fase).toBe('terminado')
  })
})

describe('sobrevive a cerrar y abrir la app', () => {
  it('retoma el paso, las porciones y los temporizadores con el reloj', () => {
    iniciarCocina(db, datos, T0, 's1')
    aplicarEnCocina(db, { nombre: 'ir_a_paso', argumentos: { orden: 8 }, confirmado: false }, T0)
    aplicarEnCocina(
      db,
      { nombre: 'cambiar_porciones', argumentos: { porciones: 6 }, confirmado: false },
      T0
    )
    aplicarEnCocina(
      db,
      {
        nombre: 'iniciar_temporizador',
        argumentos: { segundos: 1080, etiqueta: 'Arroz' },
        confirmado: false
      },
      T0
    )
    db.close()

    // La app vuelve a abrirse 5 minutos después.
    db = arrancar()
    const retomada = retomarCocina(db, en(300))
    expect(retomada).toMatchObject({ id: 's1', pasoActual: 8, porciones: 6 })
    const arroz = retomada!.temporizadores[0]!
    expect(arroz.estado).toBe('corriendo')
    expect(restanteSeg(arroz, en(300))).toBe(780)

    // Y se puede seguir cocinando.
    const r = aplicarEnCocina(
      db,
      {
        nombre: 'controlar_temporizador',
        argumentos: { etiqueta: 'Arroz', accion: 'pausar' },
        confirmado: false
      },
      en(300)
    )
    expect(r.sesion.temporizadores[0]).toMatchObject({ estado: 'pausado', restanteSeg: 780 })
  })

  it('un temporizador que acabó con la app cerrada aparece terminado y se guarda así', () => {
    iniciarCocina(db, datos, T0, 's1')
    aplicarEnCocina(
      db,
      {
        nombre: 'iniciar_temporizador',
        argumentos: { segundos: 60, etiqueta: 'Huevo' },
        confirmado: false
      },
      T0
    )
    db.close()

    db = arrancar()
    expect(retomarCocina(db, en(120))?.temporizadores[0]).toMatchObject({
      estado: 'terminado',
      restanteSeg: 0
    })
    expect(obtenerSesion(db, 's1')?.temporizadores[0]?.estado).toBe('terminado')
  })

  it('un temporizador pausado sigue pausado con el mismo restante', () => {
    iniciarCocina(db, datos, T0, 's1')
    aplicarEnCocina(
      db,
      {
        nombre: 'iniciar_temporizador',
        argumentos: { segundos: 600, etiqueta: 'Pasta' },
        confirmado: false
      },
      T0
    )
    aplicarEnCocina(
      db,
      {
        nombre: 'controlar_temporizador',
        argumentos: { id: 't1', accion: 'pausar' },
        confirmado: false
      },
      en(100)
    )
    db.close()

    db = arrancar()
    expect(retomarCocina(db, en(5000))?.temporizadores[0]).toMatchObject({
      estado: 'pausado',
      restanteSeg: 500
    })
  })
})

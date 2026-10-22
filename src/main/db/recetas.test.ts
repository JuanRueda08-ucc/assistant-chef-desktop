import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esquemaReceta } from '@shared/esquemas/receta'
import arrozConPollo from '../../../db/seed/recetas/arroz-con-pollo.json'
import { abrirBase, type BaseDatos } from './conexion'
import type { Preferencias } from '@shared/types/sesion'
import { buscarEnBase } from './busqueda'
import { listarIngredientes, listarSustituciones } from './catalogo'
import { listarRecetas, listarRecetasCompletas, obtenerReceta } from './recetas'
import { cargarSemilla, leerSemilla } from './semillas'

let db: BaseDatos

beforeEach(() => {
  db = abrirBase(':memory:')
  cargarSemilla(db, leerSemilla())
})

afterEach(() => {
  db.close()
})

const contar = (tabla: string): number =>
  (db.prepare(`SELECT count(*) AS n FROM ${tabla}`).get() as { n: number }).n

describe('base de datos', () => {
  it('crea todas las tablas del esquema', () => {
    const tablas = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
        name: string
      }[]
    ).map((t) => t.name)
    expect(tablas).toEqual([
      'ingredientes',
      'paso_ingredientes',
      'pasos',
      'receta_ingredientes',
      'recetas',
      'sesiones',
      'sustituciones',
      'tecnicas'
    ])
  })

  it('carga la semilla validada', () => {
    const semilla = leerSemilla()
    expect(contar('ingredientes')).toBe(semilla.ingredientes.length)
    expect(contar('tecnicas')).toBe(semilla.tecnicas.length)
    expect(contar('recetas')).toBe(semilla.recetas.length)
    expect(contar('pasos')).toBe(9)
  })

  it('cargar la semilla dos veces no duplica nada', () => {
    cargarSemilla(db, leerSemilla())
    expect(contar('recetas')).toBe(1)
    expect(contar('receta_ingredientes')).toBe(13)
    expect(contar('paso_ingredientes')).toBe(18)
  })

  it('aplica las claves foráneas', () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO receta_ingredientes (receta_id, id, posicion, ingrediente_id, cantidad, unidad, redondeo) VALUES ('arroz_con_pollo', 'ir_x', 99, 'unicornio', 1, 'g', 1)"
        )
        .run()
    ).toThrow(/FOREIGN KEY/)
  })

  it('aplica los CHECK de las enumeraciones y de al_gusto', () => {
    expect(() =>
      db.prepare("UPDATE recetas SET dificultad = 'experta' WHERE id = 'arroz_con_pollo'").run()
    ).toThrow(/CHECK/)
    expect(() =>
      db
        .prepare(
          "UPDATE receta_ingredientes SET cantidad = 2 WHERE receta_id = 'arroz_con_pollo' AND id = 'ir_11'"
        )
        .run()
    ).toThrow(/CHECK/)
  })

  it('permite solo una sesión cocinando a la vez', () => {
    const insertar = db.prepare(
      "INSERT INTO sesiones (id, fase, datos, actualizada_en) VALUES (?, 'cocinar', '{}', '2026-10-18T12:00:00Z')"
    )
    insertar.run('s1')
    expect(() => insertar.run('s2')).toThrow(/UNIQUE/)
  })
})

describe('repositorio de recetas', () => {
  it('lista el resumen de las recetas', () => {
    expect(listarRecetas(db)).toEqual([
      {
        id: 'arroz_con_pollo',
        slug: 'arroz-con-pollo',
        titulo: 'Arroz con pollo',
        descripcion: arrozConPollo.descripcion,
        porcionesBase: 4,
        tiempoTotalMin: 55,
        tiempoActivoMin: 25,
        dificultad: 'facil',
        origen: 'revisada',
        estadoRevision: 'borrador',
        dietas: ['sin_gluten', 'sin_lactosa'],
        alergenos: ['apio'],
        equipo: ['olla'],
        imagen: null
      }
    ])
  })

  it('devuelve la receta completa igual que la semilla, con las etiquetas derivadas', () => {
    const receta = obtenerReceta(db, 'arroz_con_pollo')
    expect(receta).toEqual({
      ...esquemaReceta.parse(arrozConPollo),
      dietas: ['sin_gluten', 'sin_lactosa'],
      alergenos: ['apio']
    })
  })

  it('devuelve null si la receta no existe', () => {
    expect(obtenerReceta(db, 'no_existe')).toBeNull()
  })

  it('lista las recetas completas', () => {
    expect(listarRecetasCompletas(db).map((r) => [r.id, r.pasos.length])).toEqual([
      ['arroz_con_pollo', 9]
    ])
  })
})

describe('catálogo y búsqueda en la base', () => {
  const preferencias: Preferencias = {
    ingredientes: ['pollo_muslo', 'arroz_blanco'],
    ingredientesSinIdentificar: [],
    porciones: 4,
    restricciones: [],
    alergias: [],
    tiempoMaxMin: null,
    nivel: null,
    equipo: []
  }

  it('lee el catálogo y las sustituciones', () => {
    const ingredientes = listarIngredientes(db)
    expect(ingredientes).toHaveLength(leerSemilla().ingredientes.length)
    expect(ingredientes.find((i) => i.id === 'aceite_oliva')).toMatchObject({
      esBasicoDespensa: true,
      densidadGMl: 0.92,
      sinonimos: ['aceite']
    })
    expect(listarSustituciones(db)).toEqual([])
  })

  it('sin ingredientes seleccionados no devuelve recetas aunque estén revisadas', () => {
    db.prepare("UPDATE recetas SET estado_revision = 'revisada'").run()
    for (const ingredientes of [[], ['sal', 'aceite_oliva'], ['no_existe']])
      expect(buscarEnBase(db, { ...preferencias, ingredientes })).toEqual({
        resultados: [],
        descartadas: [],
        ofrecerGenerada: false
      })
    expect(buscarEnBase(db, preferencias).resultados).toHaveLength(1)
  })

  it('la receta en borrador queda descartada y se ofrece una generada', () => {
    expect(buscarEnBase(db, preferencias)).toEqual({
      resultados: [],
      descartadas: [{ recetaId: 'arroz_con_pollo', motivos: ['no_revisada'] }],
      ofrecerGenerada: true
    })
  })

  it('busca sobre los datos de la base, sustituciones incluidas', () => {
    db.prepare("UPDATE recetas SET estado_revision = 'revisada' WHERE id = 'arroz_con_pollo'").run()
    db.prepare(
      `INSERT INTO sustituciones (id, ingrediente_origen_id, ingrediente_destino_id, ratio, impacto, fuente)
       VALUES ('caldo_aceite', 'caldo_pollo', 'aceite_oliva', 1, 'Prueba.', 'revisada')`
    ).run()
    const { resultados } = buscarEnBase(db, preferencias)
    expect(resultados.map((r) => r.receta.id)).toEqual(['arroz_con_pollo'])
    expect(resultados[0]?.cobertura).toBe(0.416667)
    expect(
      resultados[0]?.faltantes.find((f) => f.ingredienteId === 'caldo_pollo')?.sustituciones
    ).toHaveLength(1)
  })
})

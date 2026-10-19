import { z } from 'zod'
import { esquemaSemilla, type Semilla } from '@shared/esquemas/semilla'
import type { BaseDatos } from './conexion'

// Las semillas se empaquetan en el bundle de main (Vite resuelve los JSON al compilar), así que
// no dependen de rutas en disco ni en desarrollo ni en la app instalada.
const ingredientes = import.meta.glob<unknown>('../../../db/seed/ingredientes.json', {
  eager: true,
  import: 'default'
})
const tecnicas = import.meta.glob<unknown>('../../../db/seed/tecnicas.json', {
  eager: true,
  import: 'default'
})
const sustituciones = import.meta.glob<unknown>('../../../db/seed/sustituciones.json', {
  eager: true,
  import: 'default'
})
const recetas = import.meta.glob<unknown>('../../../db/seed/recetas/*.json', {
  eager: true,
  import: 'default'
})

/** Lee los JSON de db/seed/ y los valida. Lanza un error legible si algo no cumple el esquema. */
export function leerSemilla(): Semilla {
  const entrada = {
    ingredientes: Object.values(ingredientes)[0] ?? [],
    tecnicas: Object.values(tecnicas)[0] ?? [],
    sustituciones: Object.values(sustituciones)[0] ?? [],
    recetas: Object.values(recetas)
  }
  const resultado = esquemaSemilla.safeParse(entrada)
  if (!resultado.success) {
    throw new Error(`Semilla no válida (db/seed/):\n${z.prettifyError(resultado.error)}`)
  }
  return resultado.data
}

const json = (valor: unknown): string => JSON.stringify(valor)
const bool = (valor: boolean): number => (valor ? 1 : 0)

/**
 * Carga la semilla en una transacción. Ingredientes, técnicas y sustituciones se actualizan por id;
 * cada receta de la semilla se reemplaza entera (sus ingredientes y pasos se borran en cascada).
 * Las recetas que no están en la semilla (por ejemplo, las generadas) no se tocan.
 */
export function cargarSemilla(db: BaseDatos, semilla: Semilla): void {
  const upsertIngrediente = db.prepare(`
    INSERT INTO ingredientes (id, nombre, sinonimos, categoria, es_basico_despensa, alergenos,
      dietas_incompatibles, densidad_g_ml, peso_unidad_g)
    VALUES (@id, @nombre, @sinonimos, @categoria, @esBasicoDespensa, @alergenos,
      @dietasIncompatibles, @densidadGMl, @pesoUnidadG)
    ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, sinonimos = excluded.sinonimos,
      categoria = excluded.categoria, es_basico_despensa = excluded.es_basico_despensa,
      alergenos = excluded.alergenos, dietas_incompatibles = excluded.dietas_incompatibles,
      densidad_g_ml = excluded.densidad_g_ml, peso_unidad_g = excluded.peso_unidad_g`)

  const upsertTecnica = db.prepare(`
    INSERT INTO tecnicas (id, nombre, descripcion, pasos_cortos, media)
    VALUES (@id, @nombre, @descripcion, @pasosCortos, @media)
    ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, descripcion = excluded.descripcion,
      pasos_cortos = excluded.pasos_cortos, media = excluded.media`)

  const borrarReceta = db.prepare('DELETE FROM recetas WHERE id = ?')
  const insertarReceta = db.prepare(`
    INSERT INTO recetas (id, slug, titulo, descripcion, porciones_base, tiempo_total_min,
      tiempo_activo_min, dificultad, origen, estado_revision, dietas, alergenos, equipo, imagen)
    VALUES (@id, @slug, @titulo, @descripcion, @porcionesBase, @tiempoTotalMin, @tiempoActivoMin,
      @dificultad, @origen, @estadoRevision, @dietas, @alergenos, @equipo, @imagen)`)
  const insertarIngredienteReceta = db.prepare(`
    INSERT INTO receta_ingredientes (receta_id, id, posicion, ingrediente_id, cantidad, unidad,
      escalado, redondeo, preparacion, grupo, opcional)
    VALUES (@recetaId, @id, @posicion, @ingredienteId, @cantidad, @unidad, @escalado, @redondeo,
      @preparacion, @grupo, @opcional)`)
  const insertarPaso = db.prepare(`
    INSERT INTO pasos (receta_id, id, orden, texto, texto_voz, duracion_seg, temporizador_etiqueta,
      temporizador_segundos, senal_hecho, tecnica_id, requiere_confirmacion, consejo, seguridad)
    VALUES (@recetaId, @id, @orden, @texto, @textoVoz, @duracionSeg, @temporizadorEtiqueta,
      @temporizadorSegundos, @senalHecho, @tecnicaId, @requiereConfirmacion, @consejo, @seguridad)`)
  const insertarIngredientePaso = db.prepare(`
    INSERT INTO paso_ingredientes (receta_id, paso_id, ingrediente_receta_id, posicion, fraccion)
    VALUES (@recetaId, @pasoId, @ingredienteRecetaId, @posicion, @fraccion)`)

  const upsertSustitucion = db.prepare(`
    INSERT INTO sustituciones (id, ingrediente_origen_id, ingrediente_destino_id, ratio, receta_id,
      contexto, resuelve, impacto, fuente)
    VALUES (@id, @ingredienteOrigenId, @ingredienteDestinoId, @ratio, @recetaId, @contexto,
      @resuelve, @impacto, @fuente)
    ON CONFLICT (id) DO UPDATE SET ingrediente_origen_id = excluded.ingrediente_origen_id,
      ingrediente_destino_id = excluded.ingrediente_destino_id, ratio = excluded.ratio,
      receta_id = excluded.receta_id, contexto = excluded.contexto, resuelve = excluded.resuelve,
      impacto = excluded.impacto, fuente = excluded.fuente`)

  db.transaction(() => {
    for (const ing of semilla.ingredientes) {
      upsertIngrediente.run({
        ...ing,
        sinonimos: json(ing.sinonimos),
        esBasicoDespensa: bool(ing.esBasicoDespensa),
        alergenos: json(ing.alergenos),
        dietasIncompatibles: json(ing.dietasIncompatibles)
      })
    }

    for (const tec of semilla.tecnicas) {
      upsertTecnica.run({ ...tec, pasosCortos: json(tec.pasosCortos) })
    }

    for (const receta of semilla.recetas) {
      borrarReceta.run(receta.id)
      const { ingredientes: lista, pasos, ...cabecera } = receta
      insertarReceta.run({
        ...cabecera,
        dietas: json(cabecera.dietas),
        alergenos: json(cabecera.alergenos),
        equipo: json(cabecera.equipo)
      })

      lista.forEach((ir, i) => {
        insertarIngredienteReceta.run({
          ...ir,
          recetaId: receta.id,
          posicion: i + 1,
          opcional: bool(ir.opcional)
        })
      })

      for (const paso of pasos) {
        const { ingredientes: usados, temporizador, ...resto } = paso
        insertarPaso.run({
          ...resto,
          recetaId: receta.id,
          temporizadorEtiqueta: temporizador?.etiqueta ?? null,
          temporizadorSegundos: temporizador?.segundos ?? null,
          requiereConfirmacion: bool(paso.requiereConfirmacion)
        })
        usados.forEach((ip, i) => {
          insertarIngredientePaso.run({
            ...ip,
            recetaId: receta.id,
            pasoId: paso.id,
            posicion: i + 1
          })
        })
      }
    }

    for (const sus of semilla.sustituciones) {
      upsertSustitucion.run({ ...sus, resuelve: json(sus.resuelve) })
    }
  })()
}

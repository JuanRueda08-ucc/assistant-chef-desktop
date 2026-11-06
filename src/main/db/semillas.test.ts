import { describe, expect, it } from 'vitest'
import ingredientes from '../../../db/seed/ingredientes.json'
import tecnicas from '../../../db/seed/tecnicas.json'
import arrozConPollo from '../../../db/seed/recetas/arroz-con-pollo.json'
import { leerSemilla, prepararSemilla } from './semillas'

// Comprobaciones de contenido que el esquema no cubre, para todas las recetas de la semilla.
describe('contenido de las recetas', () => {
  const { recetas } = leerSemilla()
  const CRUDOS = ['pollo_muslo', 'pechuga_pollo', 'carne_molida', 'filete_pescado']

  it.each(recetas.map((r) => [r.id, r] as const))('%s es coherente', (_id, receta) => {
    const usados = new Set(
      receta.pasos.flatMap((p) => p.ingredientes.map((i) => i.ingredienteRecetaId))
    )
    // Todo ingrediente se usa en algún paso.
    expect(receta.ingredientes.map((i) => i.id).filter((id) => !usados.has(id))).toEqual([])
    // Los tiempos de los pasos caben en el tiempo total y cada temporizador en su paso.
    const segundos = receta.pasos.reduce((n, p) => n + (p.duracionSeg ?? 0), 0)
    expect(segundos).toBeLessThanOrEqual(receta.tiempoTotalMin * 60)
    for (const paso of receta.pasos) {
      if (paso.temporizador)
        expect(paso.temporizador.segundos).toBeLessThanOrEqual(paso.duracionSeg ?? 0)
      // Con cifras en pantalla, la voz lleva su propia versión.
      if (/\d/.test(paso.texto)) expect(paso.textoVoz, paso.id).toBeTruthy()
    }
    // Carne, pollo o pescado crudos: algún paso indica la temperatura interna segura.
    if (receta.ingredientes.some((i) => CRUDOS.includes(i.ingredienteId)))
      expect(receta.pasos.some((p) => p.seguridad?.includes('°C'))).toBe(true)
  })
})

describe('leerSemilla', () => {
  it('deriva dietas y alérgenos de cada receta desde el catálogo', () => {
    const receta = leerSemilla().recetas.find((r) => r.id === 'arroz_con_pollo')
    expect(receta?.dietas).toEqual(['sin_gluten', 'sin_lactosa'])
    expect(receta?.alergenos).toEqual(['apio'])
  })

  it('rechaza recetas con dietas o alérgenos escritos a mano', () => {
    expect(() =>
      prepararSemilla({
        ingredientes,
        tecnicas,
        sustituciones: [],
        recetas: [{ ...arrozConPollo, dietas: ['vegana'] }]
      })
    ).toThrow(/se derivan del catálogo.*arroz_con_pollo/)
  })

  it('da un error legible si la semilla no cumple el esquema', () => {
    expect(() =>
      prepararSemilla({
        ingredientes,
        tecnicas,
        sustituciones: [],
        recetas: [{ ...arrozConPollo, porcionesBase: 0 }]
      })
    ).toThrow(/Semilla no válida[\s\S]*porcionesBase/)
  })
})

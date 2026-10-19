import { describe, expect, it } from 'vitest'
import ingredientes from '../../../db/seed/ingredientes.json'
import tecnicas from '../../../db/seed/tecnicas.json'
import arrozConPollo from '../../../db/seed/recetas/arroz-con-pollo.json'
import { leerSemilla, prepararSemilla } from './semillas'

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

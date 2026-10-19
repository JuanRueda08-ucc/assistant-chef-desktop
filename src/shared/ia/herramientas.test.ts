import { describe, expect, it } from 'vitest'
import { ARGUMENTOS, DEFINICIONES_HERRAMIENTAS, NOMBRES_HERRAMIENTAS } from './herramientas'

const parametros = (
  nombre: string
): Record<string, unknown> & { properties: Record<string, Record<string, unknown>> } => {
  const def = DEFINICIONES_HERRAMIENTAS.find((d) => d.nombre === nombre)
  if (!def) throw new Error(nombre)
  return def.parametros as ReturnType<typeof parametros>
}

describe('definiciones de herramientas', () => {
  it('define las 9 herramientas de docs/ia-chef.md', () => {
    expect(DEFINICIONES_HERRAMIENTAS.map((d) => d.nombre)).toEqual([
      'avanzar_paso',
      'retroceder_paso',
      'ir_a_paso',
      'iniciar_temporizador',
      'controlar_temporizador',
      'cambiar_porciones',
      'mostrar_tecnica',
      'sustituir_ingrediente',
      'terminar_receta'
    ])
    expect(Object.keys(ARGUMENTOS)).toEqual([...NOMBRES_HERRAMIENTAS])
  })

  it('cada definición es un objeto JSON Schema estricto con descripción', () => {
    for (const def of DEFINICIONES_HERRAMIENTAS) {
      expect(def.descripcion.length).toBeGreaterThan(10)
      expect(def.parametros).toMatchObject({ type: 'object', additionalProperties: false })
      expect(def.parametros).not.toHaveProperty('$schema')
    }
  })

  it('las herramientas sin parámetros no aceptan ninguno', () => {
    for (const nombre of ['avanzar_paso', 'retroceder_paso', 'terminar_receta']) {
      expect(parametros(nombre).properties).toEqual({})
    }
  })

  it('incluye los límites de la tabla', () => {
    const temporizador = parametros('iniciar_temporizador')
    expect(temporizador.required).toEqual(['segundos', 'etiqueta'])
    expect(temporizador.properties.segundos).toMatchObject({
      type: 'integer',
      minimum: 10,
      maximum: 21600
    })
    expect(parametros('cambiar_porciones').properties.porciones).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 20
    })
    expect(parametros('ir_a_paso').properties.orden).toMatchObject({ type: 'integer', minimum: 1 })
    expect(parametros('controlar_temporizador').properties.accion).toMatchObject({
      enum: ['pausar', 'reanudar', 'cancelar', 'sumar']
    })
    expect(parametros('controlar_temporizador').required).toEqual(['accion'])
    expect(parametros('sustituir_ingrediente').required).toEqual(['ingredienteId'])
    expect(parametros('mostrar_tecnica').required ?? []).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { aplicar, congelar, sesionNueva, T0 } from '../cocina/fixtures.test-utils'
import { contextoCompacto } from './contexto'

describe('contextoCompacto', () => {
  it('incluye solo el paso actual y el siguiente, con confirmación y cantidades adaptadas', () => {
    let sesion = aplicar(sesionNueva(), 'cambiar_porciones', { porciones: 8 }).sesion
    sesion = aplicar(sesion, 'ir_a_paso', { orden: 3 }).sesion
    const receta = sesion.recetaAdaptada!
    receta.pasos[2]!.textoVoz = 'Sofríe con cuidado'
    receta.pasos[2]!.seguridad = 'Aceite caliente'
    const texto = contextoCompacto(congelar(sesion), T0)
    expect(texto).toContain('8 porciones · paso 3 de 9')
    expect(texto).toContain('paso_actual: "Sofríe con cuidado"')
    expect(texto).toContain('requiere_confirmacion: sí')
    expect(texto).toContain('seguridad: "Aceite caliente"')
    expect(texto).toContain('pollo_muslo 1600 g')
    expect(texto).toContain(
      `siguiente: ${JSON.stringify(receta.pasos[3]!.textoVoz ?? receta.pasos[3]!.texto)}`
    )
    expect(texto).not.toContain(receta.pasos[8]!.texto)
  })
  it('calcula el restante sin mutar y excluye los cancelados', () => {
    const sesion = aplicar(sesionNueva(), 'iniciar_temporizador', {
      segundos: 60,
      etiqueta: 'Arroz'
    }).sesion
    sesion.temporizadores.push({
      ...sesion.temporizadores[0]!,
      id: 't2',
      etiqueta: 'Cancelado',
      estado: 'cancelado'
    })
    expect(contextoCompacto(congelar(sesion), T0 + 20_000)).toContain(
      '[t1: "Arroz" 0:40 restante, corriendo]'
    )
    expect(contextoCompacto(sesion, T0 + 60_000)).toContain('0:00 restante, terminado')
    expect(contextoCompacto(sesion, T0)).not.toContain('Cancelado')
    expect(sesion.temporizadores[0]!.estado).toBe('corriendo')
  })
  it('incluye sustituciones, restricciones y alergias', () => {
    const sesion = sesionNueva()
    sesion.sustituciones = [
      {
        ingredienteOrigenId: 'mantequilla',
        ingredienteDestinoId: 'aceite_oliva',
        ratio: 0.8,
        sustitucionId: null
      }
    ]
    sesion.preferencias.restricciones = ['sin_lactosa']
    sesion.preferencias.alergias = ['frutos_secos']
    expect(contextoCompacto(sesion, T0)).toContain('mantequilla → aceite_oliva')
    expect(contextoCompacto(sesion, T0)).toContain('Sin lactosa, alergia: Frutos secos')
  })
  it('admite sesión sin receta y terminada sin inventar pasos', () => {
    const sesion = { ...sesionNueva(), fase: 'terminado' as const, pasoActual: null }
    expect(contextoCompacto(sesion, T0)).toContain('paso_actual: ninguno\nsiguiente: ninguno')
    expect(contextoCompacto({ ...sesion, recetaAdaptada: null }, T0)).toContain('receta: ninguna')
  })
})

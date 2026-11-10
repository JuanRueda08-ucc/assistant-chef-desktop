import { describe, expect, it } from 'vitest'
import {
  banco,
  cuerpoReceta,
  cuerpoSustitucion,
  INSTALACION,
  leer,
  post,
  recetaModelo,
  T0,
  TOKEN
} from './fixtures.test-utils'

describe('rutas y errores comunes', () => {
  it('404 para una ruta que no existe', async () => {
    const { manejar } = banco()
    expect(await leer(await manejar(post('/nada')))).toMatchObject({
      estado: 404,
      cuerpo: { error: { codigo: 'ruta_desconocida' } }
    })
  })

  it('405 si no es POST', async () => {
    const { manejar } = banco()
    const r = await manejar(new Request('http://localhost/voz/token'))
    expect(r.status).toBe(405)
    expect(r.headers.get('allow')).toBe('POST')
  })

  it('400 sin cabecera de instalación o con una no válida', async () => {
    const { manejar } = banco()
    const casos: Record<string, string>[] = [
      {},
      { 'x-instalacion': 'corta' },
      { 'x-instalacion': 'con espacios raros' }
    ]
    for (const cabeceras of casos) {
      expect(
        (await leer(await manejar(post('/voz/token', {}, cabeceras)))).cuerpo.error.codigo
      ).toBe('instalacion_invalida')
    }
  })

  it('400 si el cuerpo no es JSON o no cumple el esquema', async () => {
    const { manejar } = banco()
    expect(
      (await leer(await manejar(post('/recetas/generar', '{no es json')))).cuerpo.error.codigo
    ).toBe('json_invalido')
    const r = await leer(await manejar(post('/recetas/generar', { catalogo: [] })))
    expect(r.estado).toBe(400)
    expect(r.cuerpo.error.codigo).toBe('peticion_invalida')
    expect(r.cuerpo.error.mensaje).toMatch(/preferencias/)
  })

  it('acepta la ruta con barra final', async () => {
    const { manejar } = banco()
    expect((await manejar(post('/voz/token/'))).status).toBe(200)
  })
})

describe('POST /voz/token', () => {
  it('devuelve un token efímero y cuántas peticiones quedan', async () => {
    const { manejar } = banco()
    const r = await manejar(post('/voz/token'))
    expect(await r.json()).toEqual({
      token: `falso_${INSTALACION}_1`,
      expiraEn: new Date(T0 + 60_000).toISOString()
    })
    expect(r.headers.get('x-limite-restantes')).toBe('39')
  })

  it('502 si el proveedor falla, sin detalles internos', async () => {
    const { manejar, errores } = banco({ falla: true })
    const r = await leer(await manejar(post('/voz/token')))
    expect(r).toMatchObject({ estado: 502, cuerpo: { error: { codigo: 'proveedor_fallo' } } })
    expect(r.cuerpo.error.mensaje).not.toMatch(/falso/)
    expect(errores).toHaveLength(1)
  })
})

describe('POST /recetas/imagen', () => {
  it('sin imagen del proveedor responde null y cuenta en su propio límite', async () => {
    const { manejar } = banco()
    const r = await manejar(
      post('/recetas/imagen', { titulo: 'Sopa', descripcion: 'Caliente.', ingredientes: ['papa'] })
    )
    expect(await r.json()).toEqual({ imagen: null })
    expect(r.headers.get('x-limite-restantes')).toBe('19')
  })
})

describe('POST /voz/transcribir', () => {
  it('devuelve el texto y rechaza lo que no es base64', async () => {
    const { manejar } = banco()
    const r = await leer(await manejar(post('/voz/transcribir', { audio: 'UklGRg==' })))
    expect(r).toMatchObject({ estado: 200, cuerpo: { texto: 'dame ideas' } })
    const mal = await leer(await manejar(post('/voz/transcribir', { audio: 'no es base64!' })))
    expect(mal.estado).toBe(400)
  })
})

describe('POST /recetas/generar', () => {
  it('valida la receta del modelo, le pone identidad y deriva las etiquetas', async () => {
    const modelo = { ...recetaModelo(), dietas: ['vegana'], alergenos: [], id: 'id_del_modelo' }
    const { manejar } = banco({ recetas: [modelo] })
    const r = await leer(await manejar(post('/recetas/generar', cuerpoReceta())))
    expect(r.estado).toBe(200)
    expect(r.cuerpo.receta).toMatchObject({
      id: 'gen_0001',
      slug: 'arroz-con-pollo-0001',
      origen: 'generada',
      estadoRevision: 'borrador',
      dietas: ['sin_gluten', 'sin_lactosa'],
      alergenos: ['apio'],
      titulo: 'Arroz con pollo'
    })
    expect(r.cuerpo.receta.pasos).toHaveLength(9)
  })

  it('marca como sin verificar lo que está fuera del catálogo y usa el del catálogo si coincide', async () => {
    const modelo = recetaModelo()
    const ingredientes = modelo.ingredientes as { ingredienteId: string }[]
    ingredientes[0]!.ingredienteId = 'yuca'
    ingredientes[1]!.ingredienteId = 'mi_cebolla'
    const { manejar } = banco({
      recetas: [
        {
          ...modelo,
          ingredientesNuevos: [
            { id: 'yuca', nombre: 'Yuca', categoria: 'verduras' },
            { id: 'mi_cebolla', nombre: 'Cebolla', categoria: 'verduras' }
          ]
        }
      ]
    })
    const r = await leer(await manejar(post('/recetas/generar', cuerpoReceta())))
    expect(r.estado).toBe(200)
    expect(r.cuerpo.ingredientesNuevos).toMatchObject([
      { id: 'nuevo_yuca', nombre: 'Yuca', alergenos: [], alergenosVerificados: false }
    ])
    expect(r.cuerpo.receta.ingredientes[0].ingredienteId).toBe('nuevo_yuca')
    expect(r.cuerpo.receta.ingredientes[1].ingredienteId).toBe('cebolla')
    expect(r.cuerpo.receta.dietas).toEqual([])
  })

  it('un ingrediente nuevo no puede declarar alérgenos ni imagen', async () => {
    const { manejar } = banco({
      recetas: [
        {
          ...recetaModelo(),
          imagen: 'https://ejemplo.invalid/foto.png',
          ingredientesNuevos: [{ id: 'x', nombre: 'Salsa', categoria: 'despensa', alergenos: [] }]
        },
        { ...recetaModelo(), imagen: 'https://ejemplo.invalid/foto.png' }
      ]
    })
    const r = await leer(await manejar(post('/recetas/generar', cuerpoReceta())))
    expect(r.estado).toBe(200)
    expect(r.cuerpo.receta.imagen).toBeNull()
  })

  it('reintenta si la receta choca con una alergia y usa el título de la idea', async () => {
    const cuerpo = cuerpoReceta() as { preferencias: { alergias: string[] } }
    cuerpo.preferencias.alergias = ['apio']
    const { manejar, proveedor } = banco({ recetas: [recetaModelo(), recetaModelo()] })
    const r = await leer(await manejar(post('/recetas/generar', cuerpo)))
    expect(r.estado).toBe(422)
    expect(proveedor.llamadasReceta[1]?.errorAnterior).toMatch(/choca/)

    const { manejar: conIdea } = banco({ recetas: [recetaModelo()] })
    const idea = {
      titulo: 'Arroz de la casa',
      descripcion: 'x',
      ingredientes: ['arroz'],
      tiempoTotalMin: 30,
      dificultad: 'facil'
    }
    const r2 = await leer(await conIdea(post('/recetas/generar', { ...cuerpoReceta(), idea })))
    expect(r2.cuerpo.receta.titulo).toBe('Arroz de la casa')
  })

  it('reintenta una vez con el error y acepta el segundo intento', async () => {
    const invalida = { ...recetaModelo(), pasos: [] }
    const { manejar, proveedor } = banco({ recetas: [invalida, recetaModelo()] })
    const r = await leer(await manejar(post('/recetas/generar', cuerpoReceta())))
    expect(r.estado).toBe(200)
    expect(proveedor.llamadasReceta.map((l) => l.errorAnterior === null)).toEqual([true, false])
    expect(proveedor.llamadasReceta[1]?.errorAnterior).toMatch(/pasos/)
  })

  it('rechaza con 422 si falla dos veces', async () => {
    const { manejar, proveedor } = banco({
      recetas: ['no es una receta', { titulo: 'Incompleta' }]
    })
    const r = await leer(await manejar(post('/recetas/generar', cuerpoReceta())))
    expect(r).toMatchObject({ estado: 422, cuerpo: { error: { codigo: 'receta_invalida' } } })
    expect(proveedor.llamadasReceta).toHaveLength(2)
  })

  it('no acepta ingredientes fuera del catálogo ni técnicas inexistentes', async () => {
    const conIngrediente = recetaModelo()
    ;(conIngrediente.ingredientes as { ingredienteId: string }[])[0]!.ingredienteId = 'unicornio'
    const conTecnica = recetaModelo()
    ;(conTecnica.pasos as { tecnicaId?: string }[])[0]!.tecnicaId = 'flambear'
    const { manejar, proveedor } = banco({ recetas: [conIngrediente, conTecnica] })
    const r = await leer(await manejar(post('/recetas/generar', cuerpoReceta())))
    expect(r.estado).toBe(422)
    expect(proveedor.llamadasReceta[1]?.errorAnterior).toMatch(/unicornio/)
    expect(r.cuerpo.error.mensaje).toMatch(/flambear/)
  })

  it('rechaza campos que no son del esquema', async () => {
    const { manejar } = banco({
      recetas: [
        { ...recetaModelo(), calorias: 600 },
        { ...recetaModelo(), calorias: 600 }
      ]
    })
    expect((await manejar(post('/recetas/generar', cuerpoReceta()))).status).toBe(422)
  })

  it('el proveedor falso genera por defecto una receta válida', async () => {
    const { manejar } = banco()
    const r = await leer(await manejar(post('/recetas/generar', cuerpoReceta())))
    expect(r.estado).toBe(200)
    // Los ingredientes que el usuario tiene, en el orden del catálogo.
    expect(r.cuerpo.receta.titulo).toBe('Salteado rápido de muslo de pollo, arroz blanco, cebolla')
    expect(r.cuerpo.receta.dietas).toEqual(['sin_gluten', 'sin_lactosa'])
  })
})

describe('POST /sustituciones/sugerir', () => {
  const sugerencia = (ingredienteDestinoId: string, impacto = 'Cambia algo el sabor.'): object => ({
    ingredienteDestinoId,
    ratio: 0.8,
    impacto
  })

  it('devuelve como mucho 3 válidas, en orden, como sustituciones generadas', async () => {
    const { manejar } = banco({
      sugerencias: [
        sugerencia('unicornio'), // fuera del catálogo
        sugerencia('aceite_oliva'), // el mismo ingrediente
        { ingredienteDestinoId: 'margarina' }, // sin ratio ni impacto
        sugerencia('mantequilla'),
        sugerencia('mantequilla'), // repetida
        sugerencia('aceite_girasol'),
        sugerencia('ghee'),
        sugerencia('aceite_coco') // sobra: ya hay 3
      ]
    })
    const r = await leer(await manejar(post('/sustituciones/sugerir', cuerpoSustitucion())))
    expect(r.estado).toBe(200)
    expect(
      r.cuerpo.sustituciones.map((s: { ingredienteDestinoId: string }) => s.ingredienteDestinoId)
    ).toEqual(['mantequilla', 'aceite_girasol', 'ghee'])
    expect(r.cuerpo.sustituciones[0]).toEqual({
      id: 'gen_0001',
      ingredienteOrigenId: 'aceite_oliva',
      ingredienteDestinoId: 'mantequilla',
      ratio: 0.8,
      recetaId: 'arroz_con_pollo',
      contexto: 'cualquiera',
      resuelve: [],
      impacto: 'Cambia algo el sabor.',
      fuente: 'generada'
    })
  })

  it('filtra por las restricciones y alergias del usuario', async () => {
    const sugerencias = [
      sugerencia('mantequilla'),
      sugerencia('ghee'),
      sugerencia('aceite_girasol')
    ]
    const { manejar } = banco({ sugerencias })
    const r = await leer(
      await manejar(
        post('/sustituciones/sugerir', cuerpoSustitucion({ restricciones: ['sin_lactosa'] }))
      )
    )
    expect(
      r.cuerpo.sustituciones.map((s: { ingredienteDestinoId: string }) => s.ingredienteDestinoId)
    ).toEqual(['aceite_girasol'])
  })

  it('calcula qué dietas y alérgenos resuelve el cambio', async () => {
    const { manejar } = banco({ sugerencias: [sugerencia('tofu_firme')] })
    const r = await leer(
      await manejar(
        post('/sustituciones/sugerir', { ...cuerpoSustitucion(), ingredienteId: 'pollo_muslo' })
      )
    )
    expect(r.cuerpo.sustituciones[0].resuelve).toEqual(['vegetariana', 'vegana'])
  })

  it('una respuesta que no es una lista da cero sugerencias', async () => {
    const { manejar } = banco({ sugerencias: { texto: 'prueba con mantequilla' } })
    expect(
      (await leer(await manejar(post('/sustituciones/sugerir', cuerpoSustitucion())))).cuerpo
    ).toEqual({
      sustituciones: []
    })
  })

  it('400 si el ingrediente no está en el catálogo enviado', async () => {
    const { manejar } = banco()
    const r = await leer(
      await manejar(
        post('/sustituciones/sugerir', { ...cuerpoSustitucion(), ingredienteId: 'unicornio' })
      )
    )
    expect(r).toMatchObject({
      estado: 400,
      cuerpo: { error: { codigo: 'ingrediente_desconocido' } }
    })
  })
})

describe('POST /recetas/proponer', () => {
  const cuerpo = {
    ingredientes: ['Tomate', 'Yuca'],
    porciones: 2,
    restricciones: [],
    alergias: [],
    tiempoMaxMin: null,
    nivel: null,
    equipo: [],
    excluir: []
  }
  const buena = {
    titulo: 'Guiso',
    descripcion: 'Un guiso.',
    ingredientes: ['tomate'],
    tiempoTotalMin: 20,
    dificultad: 'facil'
  }

  it('devuelve ideas del proveedor y respeta las ya vistas', async () => {
    const { manejar } = banco()
    const r = await leer(await manejar(post('/recetas/proponer', cuerpo)))
    expect(r.estado).toBe(200)
    expect(r.cuerpo.fuente).toBe('memoria')
    expect(r.cuerpo.ideas.length).toBeGreaterThan(0)
    const primera = r.cuerpo.ideas[0].titulo
    const otra = await leer(
      await manejar(post('/recetas/proponer', { ...cuerpo, excluir: [primera] }))
    )
    expect(otra.cuerpo.ideas.map((i: { titulo: string }) => i.titulo)).not.toContain(primera)
  })

  it('conserva lo válido, limita el número y descarta fuentes que no son https', async () => {
    const { manejar } = banco({
      ideas: {
        ideas: [{ titulo: 'Rota' }, buena, buena, buena, buena, buena],
        fuente: 'internet',
        fuentes: [
          { titulo: 'Mala', url: 'javascript:alert(1)' },
          { titulo: 'Buena', url: 'https://a.example/x' }
        ],
        sugerenciasBusqueda: '<div></div>'
      }
    })
    const r = await leer(await manejar(post('/recetas/proponer', cuerpo)))
    expect(r.cuerpo.ideas).toHaveLength(4)
    expect(r.cuerpo.fuentes).toEqual([{ titulo: 'Buena', url: 'https://a.example/x' }])
  })

  it('502 si no queda ninguna idea válida, y 400 si la petición no lo es', async () => {
    const { manejar } = banco({ ideas: { ideas: [{ titulo: 'Rota' }], fuente: 'memoria' } })
    expect((await manejar(post('/recetas/proponer', cuerpo))).status).toBe(502)
    expect((await manejar(post('/recetas/proponer', { ...cuerpo, ingredientes: [] }))).status).toBe(
      400
    )
  })
})

describe('límite de uso por instalación', () => {
  it('429 al pasar el límite del día, con Retry-After hasta medianoche UTC', async () => {
    const { manejar } = banco({}, { voz: 2 })
    expect((await manejar(post('/voz/token'))).status).toBe(200)
    expect((await manejar(post('/voz/token'))).status).toBe(200)
    const r = await manejar(post('/voz/token'))
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBe(String(12 * 3600))
    expect((await r.json()).error.codigo).toBe('limite_superado')
  })

  it('cada cuenta y cada función tienen su propio contador, aunque cambie la instalación', async () => {
    const { manejar } = banco({}, { voz: 1, sustituciones: 1 })
    expect((await manejar(post('/voz/token'))).status).toBe(200)
    expect((await manejar(post('/voz/token'))).status).toBe(429)
    expect(
      (
        await manejar(
          post(
            '/voz/token',
            {},
            { 'x-instalacion': 'otra-instalacion-2', authorization: `Bearer ${TOKEN}` }
          )
        )
      ).status
    ).toBe(429)
    expect((await manejar(post('/sustituciones/sugerir', cuerpoSustitucion()))).status).toBe(200)
  })

  it('sin sesión válida responde 401 sin gastar cupo ni llamar al proveedor', async () => {
    const { manejar } = banco({}, { voz: 1 })
    for (const authorization of [undefined, 'Bearer otro-token']) {
      const r = await leer(
        await manejar(
          post(
            '/voz/token',
            {},
            { 'x-instalacion': INSTALACION, ...(authorization && { authorization }) }
          )
        )
      )
      expect(r.estado).toBe(401)
      expect(r.cuerpo.error.codigo).toBe('no_autenticado')
    }
    expect((await manejar(post('/voz/token'))).status).toBe(200)
  })

  it('se reinicia al día siguiente', async () => {
    const { manejar, reloj } = banco({}, { voz: 1 })
    await manejar(post('/voz/token'))
    expect((await manejar(post('/voz/token'))).status).toBe(429)
    reloj.ahora = T0 + 12 * 3600 * 1000
    expect((await manejar(post('/voz/token'))).status).toBe(200)
  })

  it('las peticiones mal formadas no gastan cupo', async () => {
    const { manejar } = banco({}, { recetas: 1 })
    await manejar(post('/recetas/generar', { malo: true }))
    expect((await manejar(post('/recetas/generar', cuerpoReceta()))).status).toBe(200)
  })
})

describe('POST /chat/titulo', () => {
  it('devuelve un título limpio y rechaza una pregunta vacía', async () => {
    const { manejar } = banco()
    const r = await leer(
      await manejar(
        post('/chat/titulo', { pregunta: '«tengo pollo y arroz».', respuesta: 'Bien.' })
      )
    )
    expect(r).toMatchObject({ estado: 200, cuerpo: { titulo: 'Tengo pollo y arroz' } })
    const mal = await leer(await manejar(post('/chat/titulo', { pregunta: ' ', respuesta: '' })))
    expect(mal.estado).toBe(400)
  })
})

describe('POST /uso', () => {
  it('dice lo que queda de cada límite sin gastar nada, y exige sesión', async () => {
    const { manejar } = banco({}, { chat: 5 })
    await manejar(post('/chat/titulo', { pregunta: 'tengo pollo', respuesta: 'Bien.' }))
    await manejar(post('/chat/titulo', { pregunta: 'tengo arroz', respuesta: 'Bien.' }))
    const r = await leer(await manejar(post('/uso')))
    expect(r.estado).toBe(200)
    expect(r.cuerpo).toMatchObject({
      grupos: {
        chat: { limite: 5, usadas: 2, restantes: 3 },
        voz: { limite: 40, usadas: 0, restantes: 40 }
      },
      reinicioEn: Date.UTC(
        new Date(T0).getUTCFullYear(),
        new Date(T0).getUTCMonth(),
        new Date(T0).getUTCDate() + 1
      )
    })
    // Consultarlo no gasta: sigue igual.
    const otra = await leer(await manejar(post('/uso')))
    expect(otra.cuerpo).toMatchObject({ grupos: { chat: { usadas: 2 } } })
    const sinSesion = await manejar(post('/uso', {}, { 'x-instalacion': INSTALACION }))
    expect(sinSesion.status).toBe(401)
  })
})

const manejarCon = (
  borrarCuenta?: (usuarioId: string) => Promise<void>
): ((peticion: Request) => Promise<Response>) =>
  banco({}, {}, borrarCuenta ? { borrarCuenta } : {}).manejar

describe('POST /cuenta/borrar', () => {
  it('sin borrador responde que no está disponible; con él borra la cuenta de quien llama', async () => {
    const sinNube = await manejarCon()(post('/cuenta/borrar'))
    expect(sinNube.status).toBe(501)
    const borradas: string[] = []
    const r = await manejarCon(async (id) => {
      borradas.push(id)
    })(post('/cuenta/borrar'))
    expect(await r.json()).toEqual({ borrada: true })
    expect(borradas).toHaveLength(1)
    const falla = await manejarCon(async () => {
      throw new Error('HTTP 500')
    })(post('/cuenta/borrar'))
    expect(falla.status).toBe(502)
    expect((await falla.json()).error.codigo).toBe('cuenta_no_borrada')
    const sinSesion = await manejarCon(async () => {})(
      post('/cuenta/borrar', {}, { 'x-instalacion': INSTALACION })
    )
    expect(sinSesion.status).toBe(401)
  })
})

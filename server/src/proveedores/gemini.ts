import { z } from 'zod'
import { esquemaReceta } from '@shared/esquemas/receta'
import { MODELO_GEMINI_LIVE, VERSION_GEMINI } from '@shared/ia/gemini'
import type { PeticionReceta, PeticionSustitucion, ProveedorIA, TokenVoz } from '../proveedor'

const ORIGEN = `https://generativelanguage.googleapis.com/${VERSION_GEMINI}`
const esquemaTokenGoogle = z.object({ name: z.string().regex(/^auth_tokens\//) })
const esquemaGeneracion = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }))
        })
      })
    )
    .min(1)
})

interface OpcionesGemini {
  fetch?: typeof fetch
  ahora?: () => number
}

/** REST, sin SDK ni clave en la app. Fetch y reloj inyectados para tests sin red. */
export class ProveedorGemini implements ProveedorIA {
  readonly nombre = 'gemini'
  private readonly solicitar: typeof fetch
  private readonly ahora: () => number

  constructor(
    private readonly clave: string,
    opciones: OpcionesGemini = {}
  ) {
    if (!clave.trim())
      throw new Error('Configura PROVEEDOR_IA_API_KEY en el backend para usar Gemini.')
    this.solicitar = opciones.fetch ?? fetch
    this.ahora = opciones.ahora ?? Date.now
  }

  async crearTokenVoz(instalacion: string): Promise<TokenVoz> {
    // El backend limita por instalación; no enviamos ese identificador a Google.
    void instalacion
    const ahora = this.ahora()
    const expiraEn = new Date(ahora + 60_000).toISOString()
    const bruto = await this.post('auth_tokens', {
      uses: 1,
      expireTime: new Date(ahora + 30 * 60_000).toISOString(),
      newSessionExpireTime: expiraEn,
      liveConnectConstraints: {
        model: `models/${MODELO_GEMINI_LIVE}`,
        config: { responseModalities: ['AUDIO'] }
      }
    })
    const token = esquemaTokenGoogle.safeParse(bruto)
    if (!token.success) throw new Error('Gemini devolvió un token con formato inesperado.')
    // expiraEn indica el límite para ABRIR la conexión, no la duración de la conversación.
    return { token: token.data.name, expiraEn }
  }

  async generarReceta(peticion: PeticionReceta, errorAnterior: string | null): Promise<unknown> {
    return this.generarJson(
      [
        'Genera una receta de cocina como objeto JSON según este esquema. Solo usa ingredientes del catálogo y técnicas indicadas.',
        'Incluye avisos de seguridad y confirmación en pasos con calor o cuchillos. No escribas dietas ni alérgenos: los deriva la app.',
        `Esquema: ${JSON.stringify(z.toJSONSchema(esquemaReceta, { unrepresentable: 'any' }))}`,
        `Petición: ${JSON.stringify(peticion)}`,
        errorAnterior ? `Corrige este error del intento anterior: ${errorAnterior}` : ''
      ].join('\n')
    )
  }

  async sugerirSustituciones(peticion: PeticionSustitucion): Promise<unknown> {
    return this.generarJson(
      [
        'Devuelve solo un array JSON de hasta tres sustituciones culinarias del catálogo que respeten restricciones y alergias.',
        'Cada objeto: {ingredienteDestinoId, ratio (número positivo), impacto (una frase), contexto (horneado, salteado o cualquiera)}.',
        'Si no hay una opción segura devuelve [].',
        JSON.stringify(peticion)
      ].join('\n')
    )
  }

  private async generarJson(prompt: string): Promise<unknown> {
    const bruto = await this.post('models/gemini-3.8-flash:generateContent', {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
    const respuesta = esquemaGeneracion.safeParse(bruto)
    if (!respuesta.success) throw new Error('Gemini no devolvió contenido JSON.')
    const texto = respuesta.data.candidates[0]!.content.parts.filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
    try {
      return JSON.parse(texto) as unknown
    } catch {
      throw new Error('Gemini devolvió contenido que no es JSON válido.')
    }
  }

  private async post(ruta: string, cuerpo: unknown): Promise<unknown> {
    let respuesta: Response
    try {
      respuesta = await this.solicitar(`${ORIGEN}/${ruta}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.clave },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(20_000)
      })
    } catch {
      // No propagamos errores de transporte: podrían contener cabeceras con la clave.
      throw new Error('No se pudo conectar con Gemini a tiempo.')
    }
    if (!respuesta.ok) throw new Error(`Gemini rechazó la petición (HTTP ${respuesta.status}).`)
    try {
      return await respuesta.json()
    } catch {
      throw new Error('Gemini devolvió una respuesta ilegible.')
    }
  }
}

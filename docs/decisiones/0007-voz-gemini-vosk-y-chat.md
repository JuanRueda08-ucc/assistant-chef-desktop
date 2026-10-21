# 0007 · Gemini Live para desarrollar, Vosk local y chat de texto con el chef

**Fecha:** 2026-10-19

**Reemplazo parcial (2026-10-21):** [0013](0013-separar-consultas-y-ordenes-de-voz.md) separa las preguntas de la gramática local y vuelve a órdenes locales al terminar cada respuesta, con aprobación del autor. La siguiente consulta requiere «Chef» o el botón; no se abre automáticamente tras una pregunta del modelo. Se conservan Gemini, Vosk y el chat con herramientas.

**Contexto:** el Prompt 9 (voz) necesitaba elegir un proveedor de voz en tiempo real y un motor local para la palabra de activación y las órdenes cortas (la Web Speech API está descartada, 0001). El autor tiene una clave de OpenAI, pero prefiere no pagar mientras desarrolla. Además, pidió que la IA también se pueda usar escribiendo, no solo hablando, y en todas las pantallas.

Comparación hecha el 2026-10-19 (precios por 1 M de tokens de audio, entrada / salida):
- OpenAI `gpt-realtime-2.1`: 32 $ / 64 $. Versión mini: 10 $ / 20 $.
- Gemini Live (`gemini-3.8-live`): 3 $ / 12 $. El plan gratuito existe, pero Google usa los datos para mejorar sus productos y los límites son bajos y no están publicados para la Live API.
- Qwen Omni Realtime: 4,5 $ / 17,7 $; no está confirmado que soporte bien el español ni las herramientas.
- DeepSeek y Kimi solo ofrecen texto, sin voz en tiempo real.
- Cadena gratuita (Vosk o Whisper + modelo de texto gratis + Piper o Kokoro): es posible, pero más lenta y con una voz menos natural.

**Decisión:**
- **Voz en tiempo real durante el desarrollo: Gemini Live con el plan gratuito.** Se integra como un adaptador más de `ProveedorIA` (`server/src/proveedores/gemini.ts`), con `PROVEEDOR_IA=gemini` y la clave de Google AI Studio en `PROVEEDOR_IA_API_KEY`.
  - El backend emite el token temporal (ephemeral token de la Live API) en `POST /voz/token`. El cliente abre la sesión directamente con Google.
  - El modelo recibe `DEFINICIONES_HERRAMIENTAS` y el contexto compacto de la sesión.
  - Las llamadas a herramientas las ejecuta la app con `window.api.sesion.aplicar`, como los botones.
- **Antes de tener usuarios reales** se revisa: Gemini de pago (lo más barato) u OpenAI Realtime mini, medido en la tarea 20. El adaptador de OpenAI se puede añadir sin tocar la app (0006).
- **Motor local: Vosk** (código abierto, sin red, modelo pequeño de español de unos 50 MB), limitado a una gramática cerrada: «chef», «siguiente», «atrás», «repite», «pausa», «listo», «para el temporizador»…
  - Resuelve las órdenes cortas sin IA y solo despierta al modelo cuando se dice «Chef».
  - Picovoice queda como alternativa si Vosk falla con el ruido real de una cocina (su plan gratuito solo cubre 3 usuarios activos al mes).
- **Chat de texto con el chef en las tres pantallas** (opción 2 del autor). Escribir al chef usa las mismas herramientas que la voz y los botones; el chef sigue sin ser un chatbot que solo charla.
  - **Cocinar:** las 9 herramientas actuales.
  - **Preparar y Elegir:** herramientas nuevas para que el chef actúe sobre las preferencias y la búsqueda, por ejemplo «quiero algo con pollo, sin horno y en 30 minutos». Propuesta inicial, por concretar al implementarlas:
    - `marcar_ingredientes`: añadir o quitar ingredientes por id o nombre del catálogo.
    - `cambiar_preferencias`: porciones, tiempo, nivel, restricciones, alergias y equipo.
    - `buscar_recetas`.
    - `ver_receta`: mover el carrusel a una receta.
    - `elegir_receta`: empezar a cocinar.
  - Estas herramientas cambian el estado de la interfaz (preferencias, búsqueda), no `SesionCocina`. Necesitan su propio reductor puro, con tests, en `src/shared/` y siguiendo el mismo patrón que `aplicarHerramienta`.
  - El texto va a Gemini por el backend (ruta nueva, por ejemplo `POST /chat`, con un modelo de texto con herramientas) o por la misma sesión Live, que acepta texto. Se decide al implementarlo. La clave nunca va al cliente.
  - La respuesta aparece en el globo del chef. En Cocinar, además, se puede decir en voz alta.

**Consecuencias:**
- Desarrollar cuesta 0 $, pero el audio de las pruebas lo usa Google. No se deben probar conversaciones con datos personales.
- Los límites gratuitos pueden cortar las pruebas: el backend ya devuelve 429 con su propio límite y habrá que mostrar un mensaje claro.
- Aparece un segundo conjunto de herramientas (Preparar y Elegir) que hay que diseñar y probar.
- El roadmap gana tareas nuevas para el chat (21 a 23).
- Vosk exige empaquetar un modelo de unos 50 MB y un binario nativo en Electron, que hay que validar en Windows, macOS y Linux.

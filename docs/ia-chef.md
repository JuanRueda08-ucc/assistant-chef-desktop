# IA del chef: herramientas, estado y voz

El chef **no es un chat**. Es un LLM que escucha, habla y actúa sobre la cocina solo a través de herramientas. El estado vive en la app; el modelo lo recibe resumido en cada turno y lo cambia solo llamando herramientas.

Contrato en código: `src/shared/ia/herramientas.ts` (definiciones JSON Schema para el modelo) y `src/shared/types/sesion.ts` (estado).

## Quién decide qué

| Lo hace la app (código) | Lo hace el LLM |
|---|---|
| Escalar cantidades, convertir unidades | Entender lo que pide el usuario |
| Filtrar y puntuar recetas | Elegir qué herramienta usar |
| Temporizadores, paso actual, persistencia | Hablar: explicar, animar, responder dudas |
| Órdenes cortas: "siguiente", "atrás", "repite", "pausa" (sin LLM) | Proponer sustituciones que no están en la tabla |
| Validar cada llamada a herramienta | Generar recetas cuando no hay coincidencia |
| Estado del avatar | |

## Contexto que recibe el modelo en cada turno

Un bloque compacto generado desde `SesionCocina` (no la receta entera):

Implementado en `src/shared/ia/contexto.ts`: `contextoCompacto(sesion, ahora)`. Incluye ids de ingredientes y temporizadores para las herramientas, origen y revisión, fase, advertencia de seguridad del paso y alergias. Las cantidades salen de la receta adaptada y el restante se calcula con el reloj; no muta la sesión. Sin catálogo usa los ids de ingrediente como nombres.

```
receta: "Arroz con pollo" (revisada) · 4 porciones · paso 3 de 9
paso_actual: "Sofríe la cebolla 5 minutos" · ingredientes: cebolla 150 g · requiere_confirmacion: sí · técnica: sofreir
siguiente: "Añade el arroz y nácar 2 min"
temporizadores: [Arroz 12:40 restante, corriendo]
sustituciones: mantequilla → aceite de oliva
restricciones: sin lactosa
```

## Herramientas

Todas devuelven `{ ok: true, estado, decir? }` o `{ ok: false, error, decir? }`. `decir` es una sugerencia breve para que el chef lo verbalice. Ningún efecto ocurre si la validación falla.

| Herramienta | Parámetros | Precondiciones | Efecto | Avatar |
|---|---|---|---|---|
| `avanzar_paso` | — | no es el último paso; si `requiereConfirmacion`, el usuario confirmó en este turno | `pasoActual + 1`; marca el anterior como hecho; ofrece temporizador del nuevo paso | `hablar` |
| `retroceder_paso` | — | no es el primero | `pasoActual - 1` | `hablar` |
| `ir_a_paso` | `orden` | existe | salta al paso (propuesta nueva, para "vuelve a lo del arroz") | `hablar` |
| `iniciar_temporizador` | `segundos`, `etiqueta`, `pasoId?` | `10 ≤ segundos ≤ 6 h`; máx. 4 activos | crea temporizador con nombre | `señalar` (temporizadores) |
| `controlar_temporizador` | `id` o `etiqueta`, `accion`: pausar \| reanudar \| cancelar \| sumar, `segundos?` | existe | cambia el temporizador (propuesta nueva) | `hablar` |
| `cambiar_porciones` | `porciones` (1–20) | — | recalcula cantidades; conserva paso; avisa si factor extremo | `señalar` (ingredientes) |
| `mostrar_tecnica` | `tecnicaId?` (por defecto la del paso) | existe | abre el panel de técnica | `señalar` (panel) |
| `sustituir_ingrediente` | `ingredienteId`, `sustitutoId?` | ingrediente en la receta; sustituto no rompe restricciones | sin `sustitutoId` devuelve opciones; con él, aplica en la sesión y recalcula | `hablar` |
| `terminar_receta` | — | último paso | estado `terminado`; pantalla final | `celebrar` (completa) |

"Repetir" vuelve a leer `textoVoz ?? texto` del paso, sin que el modelo reescriba su contenido.

Actualizado por decisión 0009: el texto sigue saliendo del paso (`textoVoz ?? texto`), sin que el modelo lo reescriba. Se narra automáticamente al entrar/cambiar de paso y al pulsar Repetir, usando Gemini TTS con lector del sistema de respaldo. Main pide `/voz/narrar` y valida el audio WAV; el proveedor falso devuelve `audio: null`. `voz:narrar` valida sesión/paso contra SQLite; `voz:callar` detiene el lector sin cerrar el micrófono. Caché de hasta doce audios en memoria y descarte de respuestas tardías. El control «Voz del chef» permite silenciar la narración. Ver [generación de voz de Google](https://ai.google.dev/gemini-api/docs/speech-generation), verificada el 2026-10-19.

### En el código

- **Contrato** (`src/shared/ia/herramientas.ts`):
  - `ARGUMENTOS` tiene un esquema zod estricto por herramienta. De ellos salen las `DEFINICIONES_HERRAMIENTAS` en JSON Schema que recibe el modelo (`nombre`, `descripcion`, `parametros`), así que no hay dos definiciones que mantener.
  - `controlar_temporizador` exige `id` o `etiqueta`, y `segundos` va solo con `sumar`.
  - `etiqueta` admite como mucho 40 caracteres.
- **Llamada:** `{ nombre, argumentos, confirmado }`. `confirmado` lo pone la app (botón pulsado u orden "listo" en este turno), nunca el modelo; por eso no está en los argumentos.
- **Resultado:**
  - Si funciona: `{ ok: true, estado, datos?, decir? }`. `estado` es un `EstadoCocina` resumido: fase, receta, porciones, paso actual y total, y temporizadores no cancelados con su restante en ese momento.
  - `datos` lleva lo propio de cada herramienta: `temporizadorSugerido`, `temporizadorId`, `aviso`, `tecnica` u `opciones`.
  - Si falla: `{ ok: false, error: { codigo, mensaje }, decir? }`, con los códigos de `CODIGOS_ERROR`.
- **Reductor:** `aplicarHerramienta(sesion, llamada, ahora, contexto)` en `src/shared/cocina/aplicar.ts`.
  - El cuarto parámetro, `contexto`, no estaba en el diseño original. Lleva la receta original, el catálogo, las sustituciones y las técnicas: hace falta para reescalar y sustituir desde la original.
  - Es puro: la hora la pasa quien llama y nunca modifica lo que recibe. Si falla, devuelve la misma sesión con avatar `hablar`.
  - En cada éxito añade un evento (máximo 50) y actualiza `actualizadaEn`.
  - Antes de aplicar la herramienta, marca como terminados los temporizadores que llegaron a cero.
- **Reglas que concretan la tabla:**
  - `avanzar_paso` exige `confirmado` si el paso actual tiene `requiereConfirmacion`. Ofrece el temporizador del nuevo paso en `datos` y en `decir`, pero no lo crea.
  - `iniciar_temporizador`: "activos" son los que están corriendo o pausados. No admite repetir la etiqueta de un activo (sin distinguir mayúsculas). Los ids son `t1`, `t2`…
  - `controlar_temporizador` busca por etiqueta entre los no cancelados y, si hay varios, prefiere el activo. Si sigue habiendo varios, devuelve `temporizador_ambiguo`.
  - `sumar` a un temporizador terminado lo vuelve a poner en marcha, y el total no puede pasar de 6 h. `cancelar` también sirve para descartar uno terminado.
  - `cambiar_porciones` reconstruye la receta desde la original: primero las sustituciones y después el escalado.
  - `mostrar_tecnica` no cambia el estado; devuelve la técnica en `datos`.
  - `sustituir_ingrediente`:
    - Sin `sustitutoId`, devuelve las opciones de la tabla que respetan las restricciones y alergias del usuario (específicas de la receta primero), aunque el usuario no tenga el ingrediente.
    - Con `sustitutoId`, exige una fila de la tabla para ese par. Las que proponga el modelo tendrán que añadirse a la tabla con `fuente: generada` (tarea 14).
  - `terminar_receta` deja `fase: terminado` y `pasoActual: null`.
- **Main** (`src/main/cocina.ts`):
  - `sesion:iniciar` crea la sesión, escalada y en el paso 1. Descarta la sesión `cocinar` anterior, si había, y no permite recetas `retiradas`.
  - `sesion:aplicar` guarda la sesión solo si `ok`.
  - `sesion:retomar` devuelve la sesión que estaba cocinando, con los temporizadores puestos al día con el reloj, y la guarda si alguno terminó mientras la app estaba cerrada.

Reglas para el modelo (van en el prompt de sistema, `docs/prompts/` cuando exista):
- Nunca afirmes un cambio que no hiciste con una herramienta.
- No avances solo cuando acaba un temporizador: pregunta.
- Respuestas habladas cortas (1–2 frases); la pantalla lleva el detalle.
- Si no entiendes con confianza, pregunta con opciones cerradas.

## Estado de sesión

`SesionCocina` (ver tipos): `id`, `fase` (`preparar` | `elegir` | `cocinar` | `terminado`), `preferencias` (ingredientes del usuario, porciones, restricciones, tiempo, nivel, equipo), `recetaId`, `recetaAdaptada` (copia ya escalada y con sustituciones, lo que se muestra), `porciones`, `sustituciones[]`, `pasoActual`, `pasosHechos[]`, `temporizadores[]`, `eventos[]` (historial corto para depurar y para el contexto), `actualizadaEn`.

- Se guarda en SQLite (`sesiones`, columna JSON) en cada cambio: si la app se cierra, se puede retomar.
- Los temporizadores guardan `iniciadoEn` y `restanteSeg` al pausar; el tiempo restante se calcula con el reloj, no con un contador, para sobrevivir a reinicios.
- Solo existe una sesión `cocinar` activa a la vez (índice único parcial en `sesiones`).
- En código: `pasoActual` es el `orden` del paso (desde 1) y `null` fuera de `cocinar`; `pasosHechos` guarda ids de paso; `iniciadoEn` y `eventos[].en` son epoch en ms; `actualizadaEn` es ISO 8601.
- `EstadoAvatar` es una unión discriminada por `accion`: `{ accion: 'hablar' }`, `{ accion: 'senalar', objetivo: 'temporizadores' | 'ingredientes' | 'panel' }`, `{ accion: 'esperar' }`, `{ accion: 'celebrar', intensidad: 'breve' | 'completa' }`.

## Proveedor, motor local y chat (decisión 0007)

- **Voz en tiempo real:** Gemini Live con el plan gratuito durante el desarrollo, como adaptador `gemini` de `ProveedorIA` (`PROVEEDOR_IA=gemini`, clave de Google AI Studio en `PROVEEDOR_IA_API_KEY`). Antes de tener usuarios reales se revisa entre Gemini de pago y OpenAI Realtime mini. En el plan gratuito Google usa los datos: no se prueba con datos personales.
- **Motor local:** Vosk con una gramática cerrada para «chef» y las órdenes cortas. Solo despierta al modelo cuando se dice «Chef».
- **Chat de texto:** en Preparar, Elegir y Cocinar. Usa las mismas herramientas que la voz y los botones; la respuesta aparece en el globo del chef. En Cocinar valen las 9 herramientas de abajo. En Preparar y Elegir hacen falta herramientas nuevas sobre las preferencias y la búsqueda (`marcar_ingredientes`, `cambiar_preferencias`, `buscar_recetas`, `ver_receta`, `elegir_receta`; nombres por concretar), con su propio reductor puro en `src/shared/`.

## Voz

- Opción A del stack: modelo de voz en tiempo real por API con tool calling. El backend entrega un token efímero; el audio va directo del cliente al proveedor.
- Antes del modelo, un reconocedor local de órdenes cortas resuelve "siguiente / atrás / repite / pausa / para el temporizador" para no pagar ni esperar.
- Palabra de activación "Chef" y escucha abierta 8 s después de que el chef pregunte. Baja confianza → botones de confirmación en pantalla.
- El micrófono solo está activo en la fase `cocinar`.

### Integración en Electron (tareas 15–16)

- **Recursos:** `npm run voz:preparar` descarga el modelo `vosk-model-small-es-0.42` y el binario oficial del sistema, con SHA-256 fijados en `tools/recursos-voz.mjs`. Reutiliza `.cache-voz/`; prepara `resources/voz/`, que no se versiona. Se puede pasar `win32-x64`, `darwin-x64`, `darwin-arm64`, `linux-x64` o `linux-arm64`. Los scripts de instaladores preparan los recursos; electron-builder copia modelo, bibliotecas y licencia fuera del ASAR. Windows ARM64 informa que falta un binario, sin cambiar de motor.
- **Reconocimiento:** API C de Vosk con Koffi en `src/main/voz/nativo.ts`, ejecutada por `vosk-worker.ts` fuera del hilo de la interfaz. `FRASES_ORDENES`, variantes con «chef» y `[unk]` forman la gramática cerrada. Solo se usan resultados finales; confianza mínima 0,8 calculada con la palabra menos segura. Menor confianza exige botón; la confirmación se descarta si cambió la sesión.
- **Captura:** `src/renderer/voz/audio.ts` usa `getUserMedia` solo audio y AudioWorklet (sin Web Speech), PCM16 LE mono a 16 kHz en fragmentos de 100 ms. Los canales `voz:iniciar/reconocer/reset/detener` validan `{}` o PCM (ArrayBuffer par, de 1 a 6400 bytes); main exige cocinar y asocia la captura al emisor IPC. Solo se admite una petición de audio en vuelo; no hay cola ilimitada. La ventana solo concede permiso de audio, nunca cámara.
- **Activación y privacidad:** empieza apagado. «Activar micrófono» en Cocinar inicia Vosk. «Chef» o «Hablar al chef» abren ocho segundos de consulta; también se abren después de una pregunta del modelo, cuando acaba la reproducción. Hasta ocho segundos de PCM se conservan en memoria para resolver primero la orden local; únicamente una consulta abierta se envía a Google al acabar la frase. No se escribe audio a disco. Se añade la latencia de fin de frase de Vosk (medir en la tarea 20). Mientras el chef habla no se decodifica el retorno del altavoz como una orden.
- **Sesión Live:** `src/renderer/voz/gemini-live.ts` conecta por WebSocket `v1beta/BidiGenerateContentConstrained` con `access_token` efímero. Espera `setupComplete`, envía instrucciones públicas, las nueve definiciones con `parametersJsonSchema` y el contexto fresco antes de cada turno. Delimita actividad manualmente, recibe PCM de salida a 24 kHz, actualiza el globo con la transcripción e interrumpe la reproducción cuando lo indica Google. No transmite audio en espera local; cierra tras 60 s de inactividad.
- **Herramientas:** zod valida nombre/argumentos antes del IPC y main valida de nuevo. Se ejecutan en serie y una sola vez por id; las canceladas pendientes se omiten. Se envían resultados de éxito/error y contexto actualizado al modelo. `confirmado` es siempre falso para el modelo, incluso si lo incluye en la llamada; no se toma de su transcripción. «Listo»/«siguiente» locales y botones son los únicos que confirman. Técnica/opciones de sustitución abren sus paneles.
- **Repetición sin red:** `voz:repetir({})` lee el paso desde SQLite y usa la voz del sistema (SAPI de Windows, `say` en macOS, `espeak-ng` en Linux si está instalado). El texto viaja por stdin, sin interpolarlo en comandos. No pasa por Gemini ni Web Speech; si falta lector, el globo muestra el paso y se avisa.
- **Cierre y fallos:** `ControlVoz` aborta captura y cierra tracks, socket, reproducción y worker al apagar/salir/terminar. Maneja también un permiso de micrófono que se resuelve después de salir. El worker libera el modelo C antes de salir. Permiso denegado, recursos ausentes, proveedor falso, backend caído, 429 y errores de socket dejan disponibles los botones; un fallo remoto conserva Vosk.
- **Pruebas:** `npm test` simula el proveedor, WebSocket, captura y reloj, sin llamadas a Google. Después de compilar, `npm run voz:verificar` carga el worker real en Electron y procesa silencio sin red. Para WAV PCM16 mono 16 kHz que diga «siguiente»: `npm run voz:verificar -- resources/voz ruta/al/audio.wav`. Probado en Windows; quedan conversación real con Gemini y ejecución nativa macOS/Linux. Ver decisión 0008.

Fuentes de implementación: [API C de Vosk](https://github.com/alphacep/vosk-api/blob/master/src/vosk_api.h), [modelos españoles](https://alphacephei.com/vosk/models), [Koffi](https://koffi.dev/), [referencia Live](https://ai.google.dev/api/live). No se cambió la decisión 0007.

### Órdenes puras

`src/shared/ia/ordenes.ts` comparte `FRASES_ORDENES` con la gramática local. `interpretarOrden(texto)` devuelve una `LlamadaHerramienta` para siguiente/listo/atrás, una acción local para chef/repite y una intención de temporizador para pausa/reanuda/para el temporizador; devuelve `null` ante frases desconocidas. Admite «Chef» delante y normaliza acentos, espacios y puntuación. Solo «listo» y «siguiente» completos ponen `confirmado: true`.

`resolverTemporizador(accion, temporizadores, ahora)` convierte la intención en una llamada validable solo si existe un único candidato compatible. Si no lo hay o hay varios, la interfaz debe mostrar los botones de temporizadores. Repetir vuelve a leer `textoVoz ?? texto`; no hay herramienta ni petición al modelo.

## Backend mínimo (`server/`)

Función serverless (Node + TypeScript). Guarda la clave de la API y limita el uso por instalación.

| Endpoint | Uso |
|---|---|
| `POST /voz/token` | token efímero para la sesión de voz en tiempo real |
| `POST /recetas/generar` | genera una receta con el esquema y la valida antes de devolverla |
| `POST /sustituciones/sugerir` | opciones cuando la tabla no tiene ninguna |

El proveedor de IA queda detrás de una interfaz (`ProveedorIA`) para poder cambiarlo sin tocar la app.

### En el código (`server/src/`)

- **Manejador:** `crearApp({ proveedor, limitador })` en `app.ts` devuelve un manejador `Request → Response` (API web estándar). `servidor-node.ts` lo sirve con Node; en una plataforma serverless se exporta tal cual. Ver decisión 0006.
- **Proveedor:** `ProveedorIA` (`proveedor.ts`) tiene `crearTokenVoz`, `narrar`, `conversar`, `generarReceta(peticion, errorAnterior)` y `sugerirSustituciones`. Devuelve JSON en bruto, que el backend valida siempre.
  - `crearProveedor` (`proveedores/index.ts`) elige según `PROVEEDOR_IA`: `falso` (por defecto, respuestas deterministas sin red) o `gemini` (exige `PROVEEDOR_IA_API_KEY` solo en el backend).
  - `gemini.ts` usa REST `v1beta/auth_tokens`: un uso, un minuto para abrir la conexión y treinta minutos de vigencia, restringido a audio y `gemini-3.8-live`. `expiraEn` es el límite para abrir la conexión. Recetas y sustituciones usan JSON de `gemini-3.8-flash`, con la validación existente en el backend. Timeout de 20 s; los errores no incluyen clave ni cuerpos de Google. Fetch y reloj se simulan en tests sin red.
  - Referencias verificadas el 2026-10-19: [tokens efímeros](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [WebSocket](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket) y [modelos](https://ai.google.dev/gemini-api/docs/models).
  - Para añadir uno real, crea un adaptador en `proveedores/`, lee la clave de `PROVEEDOR_IA_API_KEY` y regístralo ahí.
- **Peticiones** (todas `POST` con cabecera `X-Instalacion`; esquemas en `peticiones.ts`):

  | Ruta | Cuerpo | Respuesta 200 |
  |---|---|---|
  | `/voz/token` | `{}` | `{ token, expiraEn }` |
  | `/voz/narrar` | `{ texto }` (máx. 2000 caracteres) | `{ audio: { datos, mimeType: 'audio/wav' } \| null }` |
  | `/chat` | `{ pantalla, contexto, mensajes }` | `{ contenido: { role: 'model', parts }, simulado }` |
  | `/recetas/generar` | `{ preferencias, catalogo, tecnicas? }` | `{ receta }` |
  | `/sustituciones/sugerir` | `{ ingredienteId, recetaId?, tituloReceta?, preferencias: { ingredientes?, restricciones?, alergias? }, catalogo }` | `{ sustituciones }` |

  El catálogo lo manda la app (es la fuente de verdad y puede crecer); el backend no tiene base de datos.
- **Generar receta** (`validar-receta.ts`):
  - El servidor pone `id` (`gen_…`), `slug`, `origen: generada` y `estadoRevision: borrador`. Ignora `dietas` y `alergenos` del modelo y los deriva del catálogo.
  - Valida con `esquemaReceta` (estricto) y exige que los ingredientes estén en el catálogo y que las técnicas existan.
  - Si falla, hace un reintento pasándole el error al modelo. Si vuelve a fallar, responde 422 `receta_invalida`.
  - La seguridad alimentaria y `ingredienteNuevo` llegan en la tarea 17.
- **Sugerir sustituciones** (`sugerencias.ts`): de lo que devuelve el modelo se queda con lo válido, como mucho 3, en su orden.
  - Descarta lo que no está en el catálogo, el propio ingrediente, las repetidas y lo que rompe restricciones o alergias (`destinoPermitido`).
  - El resultado son `Sustitucion` con `fuente: generada`. `resuelve` lo calcula el código.
  - Para aplicarlas en la sesión hay que añadirlas a la tabla `sustituciones` (decisión 0004).
- **Errores:** `{ error: { codigo, mensaje } }`. 404 `ruta_desconocida`, 405 `metodo_no_permitido`, 400 `instalacion_invalida` / `json_invalido` / `peticion_invalida` / `ingrediente_desconocido`, 413 (cuerpo de más de 2 MB), 429 `limite_superado` (con `Retry-After`), 502 `proveedor_fallo` (sin detalles internos) y 422 `receta_invalida`.
- **Límite de uso** (`limite.ts`): por instalación, función y día UTC. Por defecto 40 peticiones de voz (tokens y narraciones comparten contador), 20 recetas, 60 sugerencias y 120 peticiones de chat, configurables con `LIMITE_VOZ`, `LIMITE_RECETAS`, `LIMITE_SUSTITUCIONES` y `LIMITE_CHAT`. Cada vuelta de herramientas del chat consume una petición.
  - Solo cuentan las peticiones bien formadas. Cada respuesta lleva `X-Limite-Restantes`.
  - El almacén es en memoria, válido para un solo proceso. En serverless con varias instancias hará falta uno compartido que implemente `AlmacenUso`.
- **App de escritorio:** `src/main/instalacion.ts` genera un UUID una vez en `userData/instalacion-id`, con creación exclusiva y lectura en los siguientes arranques. Un archivo corrupto se informa; no se reemplaza silenciosamente.
  - `src/main/backend.ts` pide `POST /voz/token` con `X-Instalacion` desde main. Lee `CHEF_API_URL` (valor incorporado de `.env` al compilar, sobrescribible por entorno al ejecutar); sin CORS en renderer, sin redirecciones y con timeout de 10 s. Solo permite HTTP en loopback; el resto usa HTTPS.
  - Canal `voz:token` / `window.api.voz.token({})`, registrado en contrato, handler y preload. Valida `{}` con zod y requiere una sesión cocinando en SQLite. Devuelve `{ ok: true, credencial: { token, expiraEn } }` o `{ ok: false, error: { codigo, mensaje } }` para fase, desconexión, límite, servicio o respuesta inválida/caducada. No propaga errores internos.
- **Pendiente:**
  - Las llamadas de generación de recetas se integran en la tarea 17.
  - No hay autenticación más allá del id de instalación.

## Chat e interpretación de ingredientes (21–23, decisión 0010)

`ChatChef.svelte` ofrece una entrada común en Preparar, Elegir y Cocinar. La respuesta aparece en el globo y en un historial plegable de hasta doce intercambios. El micrófono sigue siendo exclusivo de Cocinar y nunca se activa por escribir. La conversación solo vive en memoria, con dos turnos completos de contexto para el proveedor; se desactiva la entrada al terminar una receta hasta cocinar otra.

`window.api.chef.conversar({ pantalla, preferencias, mensajes })` → `chef:conversar` (zod en main) → `POST /chat`. Main construye el contexto: sesión de SQLite con `contextoCompacto` en Cocinar; preferencias validadas, catálogo y resultados recalculados en Preparar/Elegir. El catálogo de chat se acota a 300 entradas y los resultados a diez; se indica si el catálogo es parcial. La búsqueda manual sigue siendo local; las frases como «tengo pollo y arroz, somos dos» se interpretan por el agente y se convierten en ingredientes marcados y preferencias usando herramientas.

| Herramienta de selección | Validación y efecto |
|---|---|
| `marcar_ingredientes` | `{ ingredientes: string[], accion: anadir \| quitar \| reemplazar }`. Id, nombre o sinónimo inequívoco del catálogo. Falla todo el lote ante desconocidos o ambigüedad. |
| `cambiar_preferencias` | Campos parciales de preferencias, sin ingredientes. Porciones 1–20; listas cerradas. Conserva los campos omitidos. |
| `buscar_recetas` | `{}`. Búsqueda en código con preferencias actuales; abre Elegir. |
| `ver_receta` | `{ recetaId }` de los resultados vigentes; mueve el carrusel. |
| `elegir_receta` | `{ recetaId }` de los resultados vigentes; inicia con `sesion.iniciar`. |

Cambiar ingredientes/preferencias invalida resultados previos. `aplicarSeleccion` es puro y no modifica `SesionCocina`. En Cocinar el modelo recibe las nueve herramientas de cocina, nunca las de selección. Cada llamada se valida y ejecuta con `sesion.aplicar(... confirmado: false)`. Las órdenes cortas exactas escritas («listo», «siguiente», «atrás») se resuelven localmente; solo las dos primeras confirman desde la app.

El bucle conserva partes y firmas del proveedor, entrega resultados reales y deduplica acciones. Máximo cuatro respuestas/ocho acciones. Descarta respuestas si el usuario cambia pantalla, receta, paso o preferencias mientras espera; los fallos no reintentan acciones aplicadas. Técnica y sustituciones abren sus paneles. Elegir/terminar comunica el resultado real sin otra petición del turno anterior; el contexto conversacional se reinicia al cambiar de pantalla para no arrastrar contratos de herramientas de otra fase. El historial visible se conserva.

`INSTRUCCIONES_CHEF` especializa Gemini en cocina y rechaza temas ajenos, intentos de cambiar de rol o revelar instrucciones/secretos. Esas instrucciones se fijan en servidor para chat/generación y se comparten con Live. No se entrenan pesos; la calidad del seguimiento de instrucciones necesita pruebas reales. Las herramientas disponibles solo pueden actuar sobre cocina/selección.

### Configurar y probar Gemini

1. Copiar `.env.example` a `.env` si no existe, sin sobrescribir una configuración previa.
2. Poner `PROVEEDOR_IA=gemini` y configurar `PROVEEDOR_IA_API_KEY` localmente. Nunca pegarla en chats ni versionarla.
3. Arrancar/reiniciar `npm run server:dev`. La app usa `CHEF_API_URL` (por defecto localhost:8787); si cambias la URL, reinicia `npm run dev` o recompila.
4. En Preparar probar «tengo pollo y arroz, somos dos». En Cocinar, probar porciones y técnica, y verificar que una petición del modelo no evita la confirmación del paso. Para conversación Live activar el micrófono y decir «Chef». La narración de pasos y Live usan Sulafat; si falla TTS, se usa el lector instalado.

Con `PROVEEDOR_IA=falso` no hay red: admite las demostraciones «tengo pollo y arroz», «somos 2», «busca recetas», «elige esta receta» y, en Cocinar, «para 3»/«técnica». El historial indica «Modo de prueba»; no simula un modelo general. La semilla sigue en borrador y no aparece en búsquedas: no confundir la falta de recetas revisadas con un fallo del chat. La generación integrada es la tarea 17.

Tests del reductor, esquemas, bucle, proveedor, ruta y canal IPC usan transporte simulado. Referencias verificadas: [generateContent](https://ai.google.dev/api/generate-content), [herramientas](https://ai.google.dev/gemini-api/docs/function-calling) y [voz Live](https://ai.google.dev/gemini-api/docs/live-api/capabilities).

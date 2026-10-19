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

"Repetir" es local: vuelve a leer `textoVoz` del paso sin pasar por el modelo.

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
- **Proveedor:** `ProveedorIA` (`proveedor.ts`) tiene tres métodos: `crearTokenVoz`, `generarReceta(peticion, errorAnterior)` y `sugerirSustituciones`. Devuelve JSON en bruto, que el backend valida siempre.
  - `crearProveedor` (`proveedores/index.ts`) elige según `PROVEEDOR_IA`: `falso` (por defecto, respuestas deterministas sin red) o `gemini` (exige `PROVEEDOR_IA_API_KEY` solo en el backend).
  - `gemini.ts` usa REST `v1beta/auth_tokens`: un uso, un minuto para abrir la conexión y treinta minutos de vigencia, restringido a audio y `gemini-3.8-live`. `expiraEn` es el límite para abrir la conexión. Recetas y sustituciones usan JSON de `gemini-3.8-flash`, con la validación existente en el backend. Timeout de 20 s; los errores no incluyen clave ni cuerpos de Google. Fetch y reloj se simulan en tests sin red.
  - Referencias verificadas el 2026-10-19: [tokens efímeros](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [WebSocket](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket) y [modelos](https://ai.google.dev/gemini-api/docs/models).
  - Para añadir uno real, crea un adaptador en `proveedores/`, lee la clave de `PROVEEDOR_IA_API_KEY` y regístralo ahí.
- **Peticiones** (todas `POST` con cabecera `X-Instalacion`; esquemas en `peticiones.ts`):

  | Ruta | Cuerpo | Respuesta 200 |
  |---|---|---|
  | `/voz/token` | `{}` | `{ token, expiraEn }` |
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
- **Límite de uso** (`limite.ts`): por instalación, función y día UTC. Por defecto 40 tokens de voz, 20 recetas y 60 sugerencias, configurables con `LIMITE_VOZ`, `LIMITE_RECETAS` y `LIMITE_SUSTITUCIONES`.
  - Solo cuentan las peticiones bien formadas. Cada respuesta lleva `X-Limite-Restantes`.
  - El almacén es en memoria, válido para un solo proceso. En serverless con varias instancias hará falta uno compartido que implemente `AlmacenUso`.
- **Pendiente:**
  - La app aún no genera ni guarda el id de instalación ni llama al backend (tareas 16 y 17). Las llamadas deben salir de main, que no tiene CORS y lee `CHEF_API_URL`.
  - No hay autenticación más allá del id de instalación.

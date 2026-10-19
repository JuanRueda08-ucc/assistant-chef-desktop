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

## Voz

- Opción A del stack: modelo de voz en tiempo real por API con tool calling. El backend entrega un token efímero; el audio va directo del cliente al proveedor.
- Antes del modelo, un reconocedor local de órdenes cortas resuelve "siguiente / atrás / repite / pausa / para el temporizador" para no pagar ni esperar.
- Palabra de activación "Chef" y escucha abierta 8 s después de que el chef pregunte. Baja confianza → botones de confirmación en pantalla.
- El micrófono solo está activo en la fase `cocinar`.

## Backend mínimo (`server/`)

Función serverless (Node + TypeScript). Guarda la clave de la API y limita el uso por instalación.

| Endpoint | Uso |
|---|---|
| `POST /voz/token` | token efímero para la sesión de voz en tiempo real |
| `POST /recetas/generar` | genera una receta con el esquema y la valida antes de devolverla |
| `POST /sustituciones/sugerir` | opciones cuando la tabla no tiene ninguna |

El proveedor de IA queda detrás de una interfaz (`ProveedorIA`) para poder cambiarlo sin tocar la app.

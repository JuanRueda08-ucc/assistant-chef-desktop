# AGENTS.md

Instrucciones para cualquier agente de código (Codex, Claude Code u otro) que trabaje en este repositorio. **Este archivo es la fuente canónica**; `CLAUDE.md` lo importa. Si cambias una regla, cámbiala aquí.

## Qué es

Chef digital de escritorio (Windows, macOS, Linux): un asistente culinario visual con un avatar que guía la receta paso a paso con voz, temporizadores y control por voz. Tres momentos: **Preparar** (ingredientes y preferencias), **Elegir** (recetas con panel "qué falta"), **Cocinar** (paso a paso con el chef). El chef no es un chatbot: se le puede hablar o escribir en las tres pantallas, pero siempre actúa con herramientas sobre un estado que vive en la app (decisión 0007).

## Antes de empezar una tarea

1. Lee `docs/estado.md`: qué está hecho, qué está a medias y cuál es la siguiente tarea.
2. Lee el documento de `docs/` del área que vas a tocar (índice en `docs/README.md`).
3. Si la tarea contradice una decisión de `docs/decisiones/`, para y pregunta en vez de cambiarla en silencio.

## Al terminar una tarea

1. Actualiza `docs/estado.md` (qué hiciste, qué queda, siguiente paso). Es lo que lee el próximo agente.
2. Marca la casilla en `docs/roadmap.md`.
3. Si tomaste una decisión de arquitectura, añade un archivo en `docs/decisiones/` (formato en `docs/decisiones/README.md`).
4. Commits pequeños en inglés con [Conventional Commits](https://www.conventionalcommits.org/): `tipo(ámbito opcional): descripción` en imperativo, por ejemplo `feat: add portion scaling` o `fix(timers): keep remaining time after restart`. Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `style`, `perf`.

## Stack (decidido, ver docs/decisiones/0001-stack.md)

- Electron + Svelte 5 + TypeScript + Vite (electron-vite). **Sin SvelteKit, sin Tauri, sin Python.**
- SQLite local (better-sqlite3) en el proceso principal; el renderer accede solo por IPC tipado vía `preload`.
- IA por API con tool calling, detrás de un backend mínimo en `server/` (la clave de la API nunca va en el cliente).
- Voz: modelo de voz en tiempo real por API (en desarrollo, **Gemini Live con el plan gratuito**); órdenes cortas y palabra «Chef» resueltas en local con **Vosk**. **No usar Web Speech API.** Ver decisión 0007.
- Chat de texto con el chef en Preparar, Elegir y Cocinar, con las mismas herramientas que la voz (decisión 0007).
- Avatar: Rive 2D detrás de la interfaz `EstadoAvatar` (`hablar`, `senalar`, `esperar`, `celebrar`) para poder cambiar a 3D sin tocar el resto.

## Estructura

```
src/main/        proceso principal de Electron: ventana, SQLite, IPC
  db/            conexión SQLite, carga de semillas, repositorios (recetas, catalogo, busqueda)
  ipc.ts         handlers de los canales IPC
  cocina.ts      sesión de cocina: iniciar, retomar y aplicar herramientas guardando en SQLite
  instalacion.ts UUID persistente en userData/instalacion-id
  backend.ts     cliente HTTP del backend (CHEF_API_URL), token de voz con errores tipados
  voz/           Vosk por API C/Koffi en worker; lector del sistema para repetir sin IA
                 Narración automática Gemini TTS por backend, con lector local de respaldo (0009)
src/preload/     puente seguro (contextBridge) con API tipada
src/renderer/    interfaz Svelte 5 (App.svelte elige la pantalla según el estado)
  estado/        app.svelte.ts: estado de la interfaz con runas (pantalla, catálogo, preferencias…)
  componentes/   piezas del diseño Mostaza: Boton, Chip, Globo, ChefBlob, Avatar, Panel, Icono, Momentos
  lib/           lógica pura de la interfaz con tests (cómo se muestra un ingrediente)
  pantallas/     Preparar, Elegir y Cocinar (con la pantalla final)
  voz/           captura AudioWorklet, PCM, ControlVoz y WebSocket Gemini Live
  assets/chef/   poses del chef en PNG
  styles/        tokens.css (único sitio con colores, tipografías y radios)
src/shared/      tipos y lógica pura compartida (sin dependencias de Electron ni DOM)
  textos.ts      nombres para mostrar de dietas, alérgenos, equipo, categorías y dificultad
  types/         receta.ts, sesion.ts, busqueda.ts, ipc.ts (canales y contrato de window.api)
                 voz.ts (credencial efímera y errores de voz; esquemas/voz.ts)
  esquemas/      esquemas zod que espejan types/ (receta, sesion, semilla)
  recetas/       lógica pura: escalado, unidades caseras, etiquetas, sustituciones, búsqueda, catálogo
  cocina/        reductor aplicarHerramienta, temporizadores por reloj, crear y adaptar la sesión
  ia/            herramientas.ts (contrato de herramientas del chef: argumentos zod y JSON Schema)
                 ordenes.ts, contexto.ts, vosk.ts y configuración pública gemini.ts
server/src/      backend: app.ts (manejador Request → Response), rutas, proveedor (ProveedorIA),
                 proveedores/ (falso, gemini), limite.ts, servidor-node.ts y principal.ts (arranque local)
db/              schema.sql y semillas JSON (db/seed/, ver db/seed/README.md)
tools/           preparar-voz.mjs, recursos-voz.mjs (URLs/hashes), verificar-voz.cjs y licencia Vosk
resources/voz/   modelo/bibliotecas descargados (ignorados en Git; extraResources en el paquete)
docs/            documentación (empieza por docs/README.md)
```

## Datos e IPC

- **Tipos, esquemas y SQL van juntos.** Cada interfaz de `src/shared/types/` tiene su esquema zod en `src/shared/esquemas/`, con una comprobación de tipos (`_ComprobarX`) que hace fallar `npm run typecheck` si divergen. `src/main/db/schema.test.ts` comprueba que los `CHECK` de `db/schema.sql` usan las mismas listas que las constantes (`UNIDADES`, `FASES`…).
- **Opcionales como `null`**, no `?:`: el JSON, SQLite y zod usan la misma forma. En los JSON de semilla se pueden omitir; zod pone el valor por defecto.
- **Base:** `chef.sqlite` en `app.getPath('userData')`. `db/schema.sql` es idempotente y se ejecuta en cada arranque; las semillas se validan y se cargan también en cada arranque (se empaquetan en el bundle de main con `import.meta.glob`).
- **Añadir un canal IPC:** 1) nombre en `CANALES_IPC` y firma en `ApiChef` (`src/shared/types/ipc.ts`); 2) handler en `src/main/ipc.ts` que valida los argumentos con zod; 3) función en `src/preload/index.ts`. Nunca expongas `ipcRenderer` en bruto.
- **Cambiar la cocina:** siempre con `window.api.sesion.aplicar({ nombre, argumentos, confirmado })`, tanto desde botones como desde voz. `confirmado` lo pone la app (botón pulsado o "listo" reconocido), nunca el modelo. Main pone la hora, aplica `aplicarHerramienta` y guarda la sesión solo si `resultado.ok`. Al abrir la app, `window.api.sesion.retomar()` devuelve la sesión que estaba cocinando.
- **Svelte 5 e IPC:** los objetos `$state` son proxies que no se pueden enviar por IPC ni copiar con `structuredClone`. Envía `$state.snapshot(valor)` y guarda los datos que pasarás a funciones de `src/shared/` que copian (por ejemplo `escalarReceta`) con `$state.raw`.

## Reglas del dominio

- **Lo calculable se calcula en código** (escalado, unidades, filtros, temporizadores). El LLM elige herramientas y habla; no hace aritmética.
- El estado de la cocina (`SesionCocina`) solo cambia a través de las funciones de herramientas, validadas antes de aplicarse. El chef nunca afirma un cambio que no hizo.
- Recetas revisadas y generadas comparten esquema. Las generadas se validan (esquema + seguridad alimentaria) y se etiquetan "Receta generada" en la interfaz.
- Dietas y alérgenos de una receta se derivan del catálogo de ingredientes, nunca se escriben a mano ni se aceptan del modelo.
- `db/schema.sql`, `src/shared/types/` y `docs/modelo-recetas.md` deben coincidir: si cambias uno, cambia los tres.

## Convenciones de código

- TypeScript estricto. Nada de `any` sin comentario que lo justifique.
- Nombres del dominio en español (`receta`, `paso`, `porciones`); términos técnicos estándar en inglés cuando no hay equivalente claro (`store`, `handler`).
- `src/shared/` es puro y testeable: sin Electron, sin DOM, sin red.
- Tests con Vitest junto al archivo (`escalado.test.ts`). La lógica de `src/shared/` lleva test. Los datos de prueba compartidos van en `*.test-utils.ts` (por ejemplo `src/shared/recetas/fixtures.test-utils.ts`, que usa la semilla real).
- Seguridad de Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Secretos solo en `.env` (ver `.env.example`); nunca en el repositorio.

## Comandos

Requiere Node 22 o superior y npm.

| Comando | Qué hace |
|---|---|
| `npm install` | instala dependencias y descarga el binario de Electron |
| `npm run dev` | abre la app en desarrollo con recarga en caliente (F12 abre DevTools) |
| `npm test` | ejecuta los tests de Vitest una vez (`npm run test:watch` para modo vigilancia) |
| `npm run lint` | ESLint sobre todo el repositorio |
| `npm run format` / `npm run format:check` | aplica o comprueba Prettier (los `.md` se excluyen) |
| `npm run typecheck` | `tsc` para main/preload/shared, para `server/` (`tsconfig.server.json`) y `svelte-check` para el renderer |
| `npm run build` | typecheck + compilación a `out/` |
| `npm run build:win` / `build:mac` / `build:linux` | instaladores con electron-builder (tarea 19) |
| `npm run server:dev` | backend local con recarga (`server/src/principal.ts`, puerto `SERVIDOR_PUERTO`, por defecto 8787) |
| `npm run server:start` | backend local sin recarga |
| `npm run voz:preparar` | descarga y verifica el modelo español y la biblioteca Vosk del sistema actual; reutiliza `.cache-voz/` sin red |
| `npm run voz:preparar -- darwin-arm64` | prepara otra plataforma: win32-x64, darwin-x64/arm64 o linux-x64/arm64 |
| `npm run voz:verificar` | tras compilar, carga modelo y gramática en el worker real de Electron y procesa PCM (sin red) |

Antes del primer uso de voz, ejecuta `npm run voz:preparar`. Los scripts `build:unpack`, `build:win`, `build:mac` y `build:linux` preparan los recursos antes de empaquetar. Windows ARM64 no tiene un binario Vosk fijado; se informa sin sustituir el motor. Repetición local: voz instalada del sistema en Windows/macOS y `espeak-ng` en Linux; si falta, se mantiene el texto y se muestra un aviso.

**Ciclo de voz:** solo Cocinar puede abrir el micrófono y empieza apagado. `ControlVoz` se desmonta al salir y cierra tracks/socket/worker. Las órdenes cortas se ejecutan antes de enviar audio; el modelo solo recibe consultas tras «Chef» o en la ventana de ocho segundos después de una pregunta. Las llamadas del modelo nunca confirman; no copies `confirmado` de sus argumentos/transcripciones. `voz:iniciar/reconocer/reset/detener/repetir` también siguen contrato + zod + preload. PCM por IPC: máximo 6400 bytes, longitud par. No uses Web Speech ni cambies Vosk sin consultar (0007).

Alias de importación: `@shared/*` apunta a `src/shared/*` en main, preload, renderer, server y tests.

**Backend en local:** copia `.env.example` a `.env` (o no crees ninguno: los valores por defecto sirven) y ejecuta `npm run server:dev`. Con `PROVEEDOR_IA=falso` responde sin red y sin clave. Ejemplo:

```bash
curl -X POST http://localhost:8787/voz/token -H "x-instalacion: prueba-local-0001"
```

Todas las rutas son `POST`, necesitan la cabecera `X-Instalacion` (8 a 64 caracteres `A-Z a-z 0-9 -`) y responden JSON. Detalle de rutas, errores y límites en `docs/ia-chef.md`, "Backend mínimo".

**App → backend:** main usa `CHEF_API_URL` (por defecto `http://localhost:8787`), incorporada desde `.env` al desarrollar/compilar y sobrescribible en el entorno al arrancar. Solo esa URL pública entra en el bundle de main; la clave de Google no se incorpora. HTTP se admite solo en localhost; fuera se exige HTTPS. `window.api.voz.token({})` funciona solo con una sesión cocinando y devuelve un resultado tipado, sin exponer id de instalación ni URLs al renderer.

## Diseño visual

Dirección elegida: **A «Mostaza»**, especificada en `docs/diseno.md` (colores, tipografía, componentes y contrastes), con maqueta de referencia en `docs/diseno/maquetas.html`. Reglas:
- Usa solo las variables de `src/renderer/styles/tokens.css`; no escribas colores, tipografías ni radios sueltos. Si falta un token, añádelo allí y documéntalo en `docs/diseno.md`.
- El trazo de tinta grueso (`--trazo`) marca lo activo y lo principal; el amarillo nunca es texto ni la única señal de selección.
- Las tipografías se incluyen con `@fontsource-variable/*`; nada se carga de internet.
- Las imágenes del chef están en `src/renderer/assets/chef/`.

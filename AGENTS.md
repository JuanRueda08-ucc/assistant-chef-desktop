# AGENTS.md

Instrucciones para cualquier agente de código (Codex, Claude Code u otro) que trabaje en este repositorio. **Este archivo es la fuente canónica**; `CLAUDE.md` lo importa. Si cambias una regla, cámbiala aquí.

## Qué es

Chef digital de escritorio (Windows, macOS, Linux): un asistente culinario visual con un avatar que guía la receta paso a paso con voz, temporizadores y control por voz. Tres momentos: **Preparar** (ingredientes y preferencias), **Elegir** (recetas con panel "qué falta"), **Cocinar** (paso a paso con el chef). No es un chat: el chef actúa con herramientas sobre un estado que vive en la app.

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
- Voz: modelo de voz en tiempo real por API; órdenes cortas resueltas en local. **No usar Web Speech API.**
- Avatar: Rive 2D detrás de la interfaz `EstadoAvatar` (`hablar`, `senalar`, `esperar`, `celebrar`) para poder cambiar a 3D sin tocar el resto.

## Estructura

```
src/main/        proceso principal de Electron: ventana, SQLite, IPC
src/preload/     puente seguro (contextBridge) con API tipada
src/renderer/    interfaz Svelte (pantallas Preparar, Elegir, Cocinar)
src/shared/      tipos y lógica pura compartida (sin dependencias de Electron ni DOM)
  types/         receta.ts, sesion.ts
  ia/            herramientas.ts (contrato de herramientas del chef)
server/          backend serverless: token de voz, generar receta, sugerir sustitución
db/              schema.sql y semillas JSON
docs/            documentación (empieza por docs/README.md)
```

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
- Tests con Vitest junto al archivo (`escalado.test.ts`). La lógica de `src/shared/` lleva test.
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
| `npm run typecheck` | `tsc` para main/preload/shared y `svelte-check` para el renderer |
| `npm run build` | typecheck + compilación a `out/` |
| `npm run build:win` / `build:mac` / `build:linux` | instaladores con electron-builder (tarea 19) |

Alias de importación: `@shared/*` apunta a `src/shared/*` en main, preload, renderer y tests.

## Diseño visual

El diseño visual está en iteración aparte; no inventes estilos finales. Usa variables CSS en `src/renderer/styles/tokens.css` para que el diseño se pueda aplicar después. Dirección actual: fondo crema, mostaza y tinta; avatar monolínea basado en el dibujo del autor (ver `docs/diseno.md`).

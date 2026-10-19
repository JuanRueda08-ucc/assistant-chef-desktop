# Estado del proyecto

Bitácora para continuar entre sesiones y entre agentes (Claude Code, Codex). Actualízala al terminar cada tarea: lo más reciente arriba.

## Siguiente tarea

Roadmap, tarea 7 (Prompt 4 del paquete): `buscarRecetas(preferencias, recetas, catalogo, sustituciones)` en `src/shared/` con filtros duros, puntuación por cobertura, panel "qué falta" e indicador de receta generada, expuesta por IPC `recetas:buscar` (seguir los pasos de "Añadir un canal IPC" de `AGENTS.md`). Para filtrar por restricciones usar `receta.dietas` y `receta.alergenos` (ya derivados) y, para la sustitución posible, `dietasIncompatiblesDe` de `src/shared/recetas/etiquetas.ts`.

## Registro

### 2026-10-18 · Cantidades, unidades y etiquetas (tareas 4, 5 y 6)
- Hecho: en `src/shared/recetas/`:
  - `escalarReceta` (lineal, suave acotado, fijo, pizca y al_gusto sin escalar, redondeo sin llegar a 0, aviso por factor extremo, tiempos sin escalar) y `cantidadesDelPaso`.
  - `aUnidadCasera` y `formatearMedida`.
  - `derivarEtiquetas`, `conEtiquetas` y `dietasIncompatiblesDe`.
  - `aplicarSustitucion` y `redondear`.
  - Las reglas concretas están en `docs/modelo-recetas.md`, sección "Funciones".
- La carga de semillas (`prepararSemilla` en `src/main/db/semillas.ts`) deriva ahora `dietas` y `alergenos`, y rechaza recetas que los traigan escritos a mano. El arroz con pollo queda `sin_gluten`, `sin_lactosa` y con alérgeno `apio`.
- Diferencia con el Prompt 3: `aplicarSustitucion` recibe un tercer parámetro `catalogo`, necesario para recalcular etiquetas.
- Tests: 101 en Vitest. Pasan `typecheck`, `lint`, `format:check` y `build`. Comprobado en la app que `recetas:obtener` devuelve las etiquetas derivadas.
- Pendiente o a tener en cuenta:
  - Las cantidades por paso se redondean por separado y pueden no sumar exactamente el total.
  - La sustitución no valida `contexto` ni las restricciones del usuario; eso va en la búsqueda (tarea 7) y en `sustituir_ingrediente` (tarea 8).

### 2026-10-18 · Tipos, esquemas y base de datos (tareas 2 y 3)
- Hecho:
  - Tipos en `src/shared/types/` (`receta.ts`, `sesion.ts` con `EstadoAvatar`, `ipc.ts` con `CANALES_IPC`, `ApiChef` y `ResumenReceta`).
  - Esquemas zod en `src/shared/esquemas/` (receta, sesión y semilla con referencias cruzadas), con comprobación en compilación de que coinciden con los tipos.
  - `db/schema.sql` con las 8 tablas, `CHECK` y claves foráneas.
  - Semilla `db/seed/` con el arroz con pollo (4 porciones, `borrador`), 13 ingredientes y 4 técnicas.
  - En main: `abrirBase`, `leerSemilla`, `cargarSemilla` y el repositorio de recetas, más los handlers IPC `recetas:listar` y `recetas:obtener`.
  - `App.svelte` muestra provisionalmente la lista de recetas, como prueba de que el IPC funciona.
- Decisiones: ver `docs/decisiones/0003-datos-y-semillas.md` (opcionales como `null`, listas cerradas, semillas empaquetadas y cargadas en cada arranque). También se activó `noImplicitAny: true`, que la configuración base de electron-toolkit desactivaba.
- Tests: 36 en Vitest (esquemas y reglas, semilla válida, sincronía de `schema.sql` con los tipos y base en memoria con FK, CHECK, idempotencia y repositorio). Pasan `typecheck`, `lint`, `format:check` y `build`.
- Comprobado en la app (`npm run dev` con depuración remota): el renderer lista y obtiene la receta por `window.api`, un id inválido se rechaza, y el renderer no tiene acceso a `require` ni a `ipcRenderer`.
- Pendiente o a tener en cuenta:
  - `dietas` y `alergenos` quedan vacíos hasta la tarea 6.
  - No hay migraciones (usar `PRAGMA user_version` antes de publicar).
  - `sustituciones.json` no existe todavía (es opcional).
  - La lista de `App.svelte` es temporal: las tareas 10 y 11 la reemplazan.
  - `ingredienteNuevo` para recetas generadas se define en la tarea 17.

### 2026-10-18 · Proyecto base (tarea 1)
- Hecho: proyecto electron-vite (Electron 44, Svelte 5, TypeScript estricto, Vite 8) a partir de la plantilla `svelte-ts`, sin el contenido de demostración. Vitest, ESLint y Prettier configurados; comandos documentados en `AGENTS.md`.
- Seguridad: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. El preload solo expone `window.api` (tipo `ApiChef` en `src/preload/api.ts`, vacío por ahora); no se expone `ipcRenderer` en bruto.
- Estructura: el renderer está plano en `src/renderer/` (`index.html`, `main.ts`, `App.svelte`, `styles/tokens.css`). `src/shared/types`, `src/shared/ia`, `server/` y `db/` existen con `.gitkeep`. Alias `@shared/*`.
- `tokens.css` tiene valores provisionales de crema, mostaza y tinta; `App.svelte` es una ventana vacía.
- `.env.example` con `PROVEEDOR_IA`, `PROVEEDOR_IA_API_KEY` y `CHEF_API_URL`. `.gitattributes` fuerza LF. `plan/` está en `.gitignore`.
- Vitest usa `passWithNoTests` mientras no haya lógica en `src/shared/`; conviene quitarlo cuando lleguen los primeros tests (tarea 3 o 4).
- Comprobado: `npm test`, `npm run lint`, `npm run format:check` y `npm run build` pasan; `npm run dev` arranca Electron y el servidor del renderer.
- Pendiente: `electron-builder.yml` conserva valores de la plantilla (publicación a `example.com`, objetivo snap); se revisa en la tarea 19. `npm audit` muestra 8 avisos moderados en dependencias de desarrollo.

### 2026-10-18 · Documentación base
- Hecho: AGENTS.md, CLAUDE.md y docs/ con producto, arquitectura, modelo de recetas, IA del chef, diseño, decisiones y roadmap.
- Sin hacer: no hay código ni package.json todavía.
- Pendiente fuera del código: fotos reales de platos con licencia; originales en alta resolución del dibujo del chef; elegir proveedor de IA y de voz.

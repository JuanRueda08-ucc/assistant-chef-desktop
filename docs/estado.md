# Estado del proyecto

Bitácora para continuar entre sesiones y entre agentes (Claude Code, Codex). Actualízala al terminar cada tarea: lo más reciente arriba.

## Siguiente tarea

Roadmap, tareas 15 y 16 (Prompt 9 del paquete): órdenes cortas locales y sesión de voz en tiempo real (ver `docs/ia-chef.md`, "Voz" y "Contexto que recibe el modelo").

**Decisiones ya tomadas (ver `docs/decisiones/0007-voz-gemini-vosk-y-chat.md`):**
- **Voz en tiempo real:** Gemini Live con el plan gratuito. Hay que crear el adaptador `server/src/proveedores/gemini.ts`, que implementa `ProveedorIA` y se registra en `proveedores/index.ts` con `PROVEEDOR_IA=gemini`. `crearTokenVoz` usa los ephemeral tokens de la Live API.
- **Motor local:** Vosk, con una gramática cerrada («chef», «siguiente», «atrás», «repite», «pausa», «listo», «para el temporizador»…). Hay que validar el binario nativo y el modelo de español (unos 50 MB) empaquetados en Electron.
- **Chat de texto en las tres pantallas** (tareas nuevas 21 a 23 del roadmap). Orden recomendado: primero voz (15 y 16), luego chat en Cocinar (21), luego herramientas de Preparar y Elegir (22) y su chat (23).
- **El autor pondrá la clave de Google AI Studio en `.env`.** Nunca se pide por chat ni se sube al repositorio. Sin clave, todo debe seguir funcionando con `PROVEEDOR_IA=falso`.

Primeros pasos, en `src/shared/`, con tests:
- `interpretarOrden(texto)`: texto reconocido → `LlamadaHerramienta` ("siguiente", "atrás", "repite", "pausa", "para el temporizador"…). «Repite» es local y no usa herramienta. `confirmado` es verdadero cuando el usuario dice «listo» o «siguiente».
- `contextoCompacto(sesion, ahora)`: el bloque de texto que recibe el modelo en cada turno, tal como lo describe `docs/ia-chef.md`.

Otras notas:
- Las llamadas al backend deben salir de main (sin CORS, con `CHEF_API_URL`) y llevar un id de instalación que main genere una vez y guarde en la carpeta de datos del usuario.
- El micrófono solo puede estar activo en la fase `cocinar`.
- El avatar ya tiene la pose `escuchando` (`poseDe(estado, true)`).
- Para probar la app sin tocar la semilla (la receta de ejemplo sigue en `borrador`): Cocinar se prueba iniciando la sesión con `window.api.sesion.iniciar({ recetaId: 'arroz_con_pollo', … })` desde las DevTools y recargando.

## Registro

### 2026-10-19 · Decisiones de voz, motor local y chat (sin código)
- Decisión 0007:
  - Gemini Live con el plan gratuito para desarrollar. Antes de tener usuarios se revisa entre Gemini de pago y OpenAI Realtime mini.
  - Vosk como motor local.
  - Chat de texto con el chef en Preparar, Elegir y Cocinar (el autor eligió las tres pantallas).
- Actualizados `AGENTS.md` (qué es la app, stack), `docs/ia-chef.md` (nueva sección "Proveedor, motor local y chat") y `docs/roadmap.md` (tareas 15 y 16 concretadas; tareas 21 a 23 nuevas para el chat).
- El autor seguirá con Codex: esta entrada y "Siguiente tarea" son el punto de partida.

### 2026-10-18 · Backend mínimo (tarea 14)
- Hecho: backend en `server/src/`:
  - `app.ts`: manejador `Request → Response` con las tres rutas, errores JSON y límite de uso.
  - `proveedor.ts` (`ProveedorIA`), `proveedores/falso.ts` y `proveedores/index.ts`.
  - `peticiones.ts` (esquemas zod), `validar-receta.ts`, `sugerencias.ts` y `limite.ts`.
  - `servidor-node.ts` y `principal.ts`, con los scripts `npm run server:dev` y `server:start`.
  - `tsconfig.server.json`, incluido en `npm run typecheck`. `.env.example` ampliado.
- Decisión 0006 (forma del backend). Detalle de rutas, errores y límites en `docs/ia-chef.md`, "Backend mínimo"; comandos en `AGENTS.md`.
- Diferencias con el Prompt 8:
  - El catálogo y las técnicas los manda la app en cada petición.
  - Las recetas generadas salen con `estadoRevision: borrador` y un id `gen_…`.
  - No hay proveedor real porque no está elegido.
- Tests: 260 en Vitest (24 del backend), incluida una prueba por HTTP real. Pasan `typecheck`, `lint`, `format:check` y `build`.
- Comprobado con `npm run server:start` y `curl`: las tres rutas responden con el proveedor falso, y una petición sin `X-Instalacion` se rechaza.
- Pendiente:
  - Elegir un proveedor real y escribir su adaptador.
  - Un almacén de límites compartido y una autenticación mejor antes de publicar.
  - Reglas de seguridad alimentaria e `ingredienteNuevo` para las recetas generadas (tarea 17).
  - La app todavía no llama al backend.

### 2026-10-18 · Pantalla Cocinar y componente Avatar (tareas 12 y 13)
- Hecho:
  - Pantalla `Cocinar` (`src/renderer/pantallas/Cocinar.svelte`) con paso, chef, temporizadores, barra de botones grandes, paneles bajo demanda (técnica, temporizadores e ingredientes con porciones y sustituciones) y pantalla final. Sustituye a la provisional.
  - Componentes `Avatar` (con `poseDe` en `avatar.ts`) y `Panel`. Lógica pura de la interfaz en `src/renderer/lib/medidas.ts`.
  - Estado de la app: `aplicar`, `decir` (Repetir), `cocinarOtra`; el avatar vuelve a esperar a los 6 s.
  - `formatearReloj` en shared.
  - Poses `chef_estatico` y `chef_hablando` reescaladas a la escala del resto.
- Comportamiento detallado en `docs/diseno.md`, "En la app".
- Tests: 236 en Vitest. Pasan `typecheck`, `lint`, `format:check` y `build`.
- Comprobado en la app por CDP, con capturas, solo con botones. Sin errores en la consola. Recorrido:
  - Paso 1, técnica, avanzar hasta el 3 y poner el temporizador sugerido.
  - Panel de temporizadores y pausa.
  - Paso 5: cambio a 5 porciones, con las cantidades recalculadas sin perder el paso.
  - Hasta el 9, atrás, terminar y pantalla final con celebración.
- Pendiente:
  - Las sustituciones del panel de ingredientes solo ofrecen las de la tabla, y la semilla aún no tiene `sustituciones.json`.
  - Sin sonido al acabar un temporizador (llegará con la voz).
  - Revisar Cocinar con el plugin Design.

### 2026-10-18 · Pantallas Preparar y Elegir (tareas 10 y 11)
- Hecho:
  - Pantallas `Preparar` y `Elegir` con el diseño «Mostaza», componentes base en `src/renderer/componentes/` y estado de la interfaz en `src/renderer/estado/app.svelte.ts`. `App.svelte` elige la pantalla y, al abrir la app, retoma la sesión si se estaba cocinando.
  - Pantalla provisional de Cocinar que confirma que la sesión empezó (hasta la tarea 12).
  - Canal IPC `catalogo:ingredientes`.
  - En shared: `src/shared/textos.ts` (nombres para mostrar) y `src/shared/recetas/catalogo.ts` (`normalizarTexto`, `buscarIngredientes`, `agruparPorCategoria`).
  - `ResultadoReceta` incluye `ingredientesObligatorios`.
  - Ventana mínima de 1100 × 720. ESLint analiza también `*.svelte.ts`.
- El comportamiento de cada pantalla está en `docs/diseno.md`, "En la app".
- Tests: 224 en Vitest. Pasan `typecheck`, `lint`, `format:check` y `build`.
- Comprobado en la app con capturas por CDP, con la receta marcada temporalmente como `revisada` y luego revertida: marcar ingredientes con la búsqueda, filtrar sin gluten, ver la receta con cápsulas, etiquetas y "qué te falta" con cantidades escaladas, y empezar a cocinar. Sin errores en la consola.
- Error corregido por el camino: los `$state` de Svelte son proxies que `structuredClone` no copia; la receta de Elegir se guarda con `$state.raw` (regla añadida a `AGENTS.md`).
- Pendiente:
  - Decidir si la receta de ejemplo pasa a `revisada`.
  - Fotos de platos.
  - Revisar las pantallas con el plugin Design (crítica y accesibilidad).

### 2026-10-18 · Dirección visual «Mostaza»
- Hecho:
  - Se compararon tres direcciones en maquetas de las tres pantallas, a partir de dos referencias del autor (app de recetas amarilla y paleta azul pizarra); el autor eligió la A «Mostaza».
  - Especificación en `docs/diseno.md`, decisión en `docs/decisiones/0005-direccion-visual.md` y maqueta en `docs/diseno/maquetas.html`.
  - `src/renderer/styles/tokens.css` reescrito con los tokens finales.
  - Bricolage Grotesque y Figtree incluidas con `@fontsource-variable/*` e importadas en `src/renderer/main.ts`.
  - Regla de diseño de `AGENTS.md` actualizada.
- Chef: 11 poses PNG en `src/renderer/assets/chef/` (aportadas por el autor; se les añadió la extensión `.png`). `chef_estatico` y `chef_hablando` están a menor escala que el resto: hay que normalizarlas antes de la tarea 13.
- Contrastes comprobados (detalle en `docs/diseno.md`). El texto secundario se oscureció a `#5f5e5a` y los controles sin seleccionar llevan el borde `#8c887f` (3:1).
- Pendiente:
  - Revisar las pantallas, una vez construidas, con el plugin Design de Anthropic (instalado en la cuenta; sus skills estarán disponibles en una sesión nueva).
  - Fotos licenciadas de los platos.

### 2026-10-18 · Estado de cocina y herramientas del chef (tareas 8 y 9)
- Hecho:
  - Contrato de las 9 herramientas en `src/shared/ia/herramientas.ts`: argumentos zod, JSON Schema generado, llamada, resultado y códigos de error.
  - Reductor `aplicarHerramienta` en `src/shared/cocina/aplicar.ts`, con temporizadores por reloj (`temporizadores.ts`) y `crearSesionCocina` / `adaptarReceta` (`sesion.ts`).
  - En main: `src/main/cocina.ts` (iniciar, retomar y aplicar guardando), `src/main/db/sesiones.ts`, `listarTecnicas`, y los canales IPC `sesion:retomar`, `sesion:iniciar` y `sesion:aplicar` en el preload.
  - Nuevas funciones exportadas en `busqueda.ts`: `opcionesDeSustitucion` y `destinoPermitido`; en `escalado.ts`: `avisoEscalado`.
- Decisiones: ver `docs/decisiones/0004-herramientas-y-sesion.md` y la sección "En el código" de `docs/ia-chef.md`. Diferencias con el Prompt 5:
  - El reductor recibe un cuarto parámetro, `contexto`.
  - `confirmado` va en la llamada y no en los argumentos del modelo.
  - Los resultados incluyen `datos`.
- Tests: 217 en Vitest, con éxito y precondición fallida de cada herramienta, confirmación obligatoria, inmutabilidad (objetos congelados) y una receta cocinada de principio a fin. La persistencia se prueba con un archivo SQLite real cerrado y reabierto, con temporizadores corriendo, terminados y pausados. Pasan `typecheck`, `lint`, `format:check` y `build`.
- Comprobado en la app (`npm run dev` dos veces seguidas):
  - Iniciar la sesión, el rechazo sin confirmación, avanzar confirmando y crear un temporizador.
  - Al reabrir, se retoma el paso 2 con el temporizador corriendo según el reloj.
  - Una herramienta desconocida se rechaza.
  - En tu base local de desarrollo queda una sesión cocinando de esa prueba; el próximo `sesion:iniciar` la reemplaza.
- Pendiente o a tener en cuenta:
  - El contexto compacto para el modelo (bloque de texto de `docs/ia-chef.md`) se hace en la tarea 16.
  - Las sustituciones del modelo tendrán que guardarse en la tabla (tarea 14).
  - Al iniciar otra receta, la sesión anterior se borra.

### 2026-10-18 · Búsqueda y "qué falta" (tarea 7)
- Hecho:
  - `buscarRecetas` en `src/shared/recetas/busqueda.ts` con filtros duros, puntuación, panel "qué falta" con sustituciones posibles, opcionales informados, descartadas con motivos y `ofrecerGenerada`. Tipos en `src/shared/types/busqueda.ts`.
  - `resumirReceta` en shared.
  - En main: repositorios `listarIngredientes`, `listarSustituciones` y `listarRecetasCompletas`, `buscarEnBase`, y el canal IPC `recetas:buscar`, que valida las preferencias con `esquemaPreferencias`.
  - `ResumenReceta` incluye ahora `dietas`, `alergenos` y `equipo`, para las etiquetas de Elegir.
- Decisiones (detalle en `docs/modelo-recetas.md`, "Búsqueda"):
  - Se añadió el filtro por `nivel`, que no estaba en el Prompt 4.
  - Si el usuario no indica equipo, no se filtra por equipo.
  - Una receta que solo cumpliría las restricciones tras una sustitución se descarta igualmente.
  - Constantes: `PENALIZACION_FALTANTE` 0,1, `BONUS_SUSTITUCION` 0,05 y `UMBRAL_COBERTURA` 0,6.
- Tests: 128 en Vitest. Pasan `typecheck`, `lint`, `format:check` y `build`. Comprobado en la app: `window.api.recetas.buscar` responde y rechaza preferencias inválidas.
- Pendiente o a tener en cuenta:
  - La única receta de la semilla está en `borrador`, así que en la app la búsqueda la descarta (`no_revisada`) y ofrece una generada; habrá recetas revisadas con la tarea 18.
  - No hay `sustituciones.json` en la semilla.
  - El `contexto` de las sustituciones no se usa todavía.

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

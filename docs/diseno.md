# Diseño

**Aclaración del autor, 2026-10-20:** conservar el diseño Mostaza y organizar mejor las pantallas existentes: agrupación, alineación, jerarquía y localización de controles. No se repetirán maquetas del flujo completo ni se buscará otro estilo. Los ajustes están en `replanteamiento-v1.md` (decisiones 0011–0012) y aplicados como se describe en «Organización por pantalla» (2026-10-22, tareas 27 y 30) y aprobados por el autor. Los formularios de login/registro siguen pendientes.

## Flujo
Tres momentos: **Preparar** (buscar ingredientes, tu lista y resumen de preferencias), **Elegir** (lista para comparar recetas y vista previa con todos los ingredientes), **Cocinar** (paso con sus ingredientes, chef con su globo y la voz agrupada, barra inferior con Atrás / Repetir / Listo, siguiente; listas en paneles bajo demanda). Al abrir la app con una receta a medias aparece **Retomar** antes de Cocinar. La pantalla final va dentro de Cocinar. El chef solo habla (con voz) en modo cocina; en Preparar aparece en busto con un globo de texto.

## Organización por pantalla (tareas 27 y 30, 2026-10-22)

Sobre los mismos componentes y tokens; sin nuevas maquetas.

- **Cabecera común:** marca, momentos y, a la derecha, «Escribir al chef». El chat (`ChatChef`) es un panel lateral que se abre y cierra desde ese botón o con Escape; ya no ocupa una franja fija abajo. No se ofrece en Retomar ni en la pantalla final.
- **Retomar** (`pantallas/Retomar.svelte`): tarjeta con la receta, porciones, «Ibas por el paso X de Y» con su texto, temporizadores en marcha y dos acciones: «Continuar receta» (principal) y «Preparar otra receta». Recuerda que el micrófono sigue apagado. El estado vive en `app.retomando`.
- **Preparar:** saludo compacto (busto 76 px). A la izquierda buscador, categorías e ingredientes. A la derecha «Tu lista» con contador y botón para quitar cada ingrediente, la nota de básicos asumidos (0014), «Somos» con el contador de porciones, el resumen de preferencias (Tiempo, Recetas, Comemos, Alergias, Tengo) y «Cambiar preferencias», que abre el formulario completo en un `Panel`. Abajo, el botón principal «Buscar recetas con N ingredientes».
- **Elegir:** a la izquierda la lista para comparar (nombre, tiempo, nivel y «Faltan N» o «Tienes todo»; flechas arriba/abajo cambian de receta) y «Cambiar ingredientes». A la derecha la vista previa: plato, título, descripción, píldoras de tiempo/porciones/nivel/equipo, etiquetas de dieta y alérgenos, cobertura («N de M disponibles (X tuyos + Y básicos)») y todos los ingredientes escalados con su estado: Lo tienes, Básico, Falta (con sustituciones) u Opcional. «Cocinar esta receta» queda fijo al pie. Sin cápsulas grandes ni avatar.
- **Cocinar:** cabecera con título, «Paso N de M» y la barra de pasos; a la derecha «Ingredientes (N porciones)», los temporizadores en marcha y «Temporizadores», todos con texto. «Ver cómo se hace» y el temporizador sugerido van dentro de la tarjeta del paso. Columna derecha (300 px): globo, avatar de 110 px y una caja «Voz» con micrófono, voz del chef y estado. Barra inferior: Atrás y Repetir de 180 px y «Listo, siguiente» grande a la derecha. A 1186×763 ni el paso ni la columna del chef necesitan desplazamiento.

## Dirección visual: A «Mostaza» (elegida el 2026-10-18)

Decisión en `docs/decisiones/0005-direccion-visual.md`. Maqueta de referencia: `docs/diseno/maquetas.html` (abre la dirección A; las B y C fueron las alternativas descartadas). Para verla con las imágenes del chef hay que servirla por HTTP desde la raíz del repositorio, por ejemplo con `python -m http.server 4310`, y abrir `http://localhost:4310/docs/diseno/maquetas.html`.

**Idea:** una app de recetas luminosa (blanco roto, tarjetas blancas, amarillo girasol), con el trazo negro del chef como firma. Lo activo y lo principal (botón principal, opción seleccionada, globo del chef, momento actual) llevan el mismo contorno grueso de tinta que el dibujo, así la interfaz y el personaje parecen hechos por la misma mano. Fotos reales de comida y datos claros; en Cocinar todo se lee a distancia.

Los tokens están en `src/renderer/styles/tokens.css`; los componentes usan solo esas variables.

### Color

| Token | Valor | Uso |
|---|---|---|
| `--color-fondo` | `#f6f5f1` | fondo de las pantallas |
| `--color-superficie` | `#ffffff` | tarjetas, paneles, globo |
| `--color-tinta` | `#1d1d1b` | texto y trazo (el negro del chef) |
| `--color-tinta-suave` | `#5f5e5a` | texto secundario |
| `--color-acento` | `#ffc83d` | botón principal, selección, cápsulas de datos |
| `--color-acento-suave` | `#fff3cc` | fondo de lo seleccionado |
| `--color-blob` | `#ffd970` | círculo detrás del chef |
| `--color-panel-suave` | `#f1efe8` | etiquetas, números de los momentos |
| `--color-borde-control` | `#8c887f` | borde de controles sin seleccionar |
| `--color-separador` | `#e8e6df` | bordes decorativos (nunca de controles) |
| `--color-exito` | `#2f9e5b` | micrófono escuchando, temporizador listo |

Contrastes (WCAG): tinta sobre fondo 15,5:1; tinta suave sobre fondo 5,9:1; tinta sobre amarillo 10,9:1; borde de control sobre fondo 3,2:1. El amarillo sobre el fondo da 1,4:1, así que **nunca es texto ni la única señal**: lo seleccionado lleva además el trazo de tinta y una marca de verificación.

### Tipografía

- Títulos y números grandes: **Bricolage Grotesque** (variable, con tamaño óptico), peso 700–800.
- Texto: **Figtree** (variable), peso 500 por defecto y 700 para resaltar.
- Se incluyen en la app con `@fontsource-variable/*` (licencia OFL), sin cargar nada de internet; la CSP no lo permitiría.
- Escala: 13 / 15 / 17 / 22 / 30 px; el texto del paso en Cocinar va a 36 px y su número a 64 px, legibles a unos 2 m.
- Sin mayúsculas sostenidas en etiquetas, sin resaltar una sola palabra de un título.

### Forma y espacio

- Trazo de 2,5 px para lo activo o principal; borde de 1,5 px para lo demás.
- Radios: 32 px (paneles y tarjetas grandes), 24 px (botones de Cocinar), 16 px (fichas de ingrediente), píldora para botones y chips.
- Espaciado en múltiplos de 4: 4, 8, 12, 16, 24, 32.
- Controles de al menos 44 px; botones de Cocinar de 76 px de alto.
- Sin sombras en los componentes; la jerarquía se da con trazo, color y tamaño.

### Componentes

| Componente | Cómo es |
|---|---|
| Botón principal | píldora amarilla con trazo de tinta, texto en negrita; uno por pantalla |
| Chip | píldora con borde de control; seleccionado: amarillo con trazo de tinta |
| Categoría | círculo de 56 px con icono de línea; seleccionada: amarilla con trazo |
| Ficha de ingrediente | tarjeta blanca de radio 16 con icono y nombre; seleccionada: fondo amarillo suave, trazo y marca ✓ en un círculo de tinta |
| Globo del chef | blanco con trazo de tinta y cola; el texto del chef siempre va aquí |
| Blob | círculo amarillo detrás del chef (busto en Preparar y Elegir, cuerpo entero en Cocinar) |
| Cápsulas de datos | píldoras verticales amarillas con el icono en un círculo blanco y el dato grande debajo (tiempo, porciones, nivel, equipo) |
| Etiqueta | píldora pequeña gris; los alérgenos van con borde discontinuo |
| Temporizador | píldora con anillo de progreso amarillo y tiempo en números tabulares; terminado: borde amarillo y «¡Listo!» |
| Barra de Cocinar | cuatro botones grandes (Atrás, Repetir, Ver técnica y el principal «Listo, siguiente», más ancho y amarillo) |
| Iconos | de línea, trazo 2 px, extremos redondeados, como el dibujo del chef |

### Chef

Poses en `src/renderer/assets/chef/` (PNG 1254 × 1254 con transparencia): `chef_busto`, `chef_estatico`, `chef_hablando`, `chef_escuchando`, `chef_esperando`, `chef_derecha`, `chef_izquierda`, `chef_arriba`, `chef_abajo`, `celebracion_leve`, `chef_celebracion_final`. `chef_estatico` y `chef_hablando` se reescalaron para que el chef mida lo mismo que en el resto y apoye los pies a la misma altura (los originales están en el commit 664de3c). Correspondencia prevista con `EstadoAvatar`: hablar → hablando; esperar → esperando; señalar → derecha, izquierda, arriba o abajo según dónde esté el objetivo en pantalla; celebrar breve → celebración leve; celebrar completa → celebración final; escuchando, cuando el micrófono escucha. El avatar pasará a Rive más adelante con el mismo dibujo.

### En la app

Componentes en `src/renderer/componentes/` (`Boton`, `Chip`, `Globo`, `ChefBlob`, `Icono`, `Momentos`) y pantallas en `src/renderer/pantallas/`. Detalles de comportamiento ya implementados:

- **Preparar:**
  - Las 8 categorías del catálogo, cada una con un contador de los ingredientes marcados en ella.
  - La búsqueda ignora tildes y busca también en los sinónimos (`buscarIngredientes`).
  - Los básicos de despensa no se marcan: se nombran debajo de la rejilla.
  - Sin ingredientes marcados, «Ver recetas» está desactivado y se muestra «Selecciona al menos un ingrediente para ver recetas». Los básicos asumidos no habilitan la búsqueda.
  - Volver a Preparar invalida los resultados anteriores; es necesario buscar de nuevo con la selección actual antes de entrar a Elegir.
  - En el panel: porciones de 1 a 20, tiempo (30 min / 1 hora / sin prisa) y "Recetas" (fáciles / fáciles y medias / todas, que es el filtro de `nivel`).
  - Alergias y equipo muestran las opciones frecuentes, con "Ver todas" o "Ver todo" para el resto. Si no se marca equipo, no se filtra por equipo.
- **Elegir:**
  - Carrusel de una tarjeta, con flechas, puntos y las teclas ← y →.
  - En las cápsulas, las porciones son las del usuario.
  - "Qué te falta" muestra la cantidad ya escalada en medida casera, con la exacta entre paréntesis ("3 ¼ tazas (750 ml)"), y las sustituciones posibles.
  - La cobertura se presenta como ingredientes disponibles, con el desglose «seleccionados por ti + básicos de despensa» y los nombres de los básicos asumidos. No se confunden con los ingredientes marcados en Preparar.
  - Las recetas descartadas por restricciones, tiempo o equipo se cuentan en el subtítulo; las no revisadas no se mencionan.
  - Si no hay resultados, el chef lo dice y ofrece cambiar ingredientes.
- **Cocinar:**
  - **Cabecera:** título; botón de porciones, que abre el panel de ingredientes; barra de pasos clicable (`ir_a_paso`); temporizadores con anillo y reloj; botón para el panel de temporizadores.
  - **Tarjeta del paso:** número grande, texto a 36 px, señal de hecho, aviso de seguridad, botón del temporizador sugerido (solo si no hay uno activo con esa etiqueta) e ingredientes del paso. Cada ingrediente lleva el nombre arriba y, debajo, la medida casera con la exacta y la preparación (`src/renderer/lib/medidas.ts`).
  - **Chef:** el globo muestra lo que devolvió la última herramienta (`decir`) o, al cambiar de paso, el consejo del paso.
  - **Voz:** entre el globo y el avatar, botón explícito de micrófono (apagado inicialmente), control independiente «Voz del chef», «Hablar al chef» y estado de escucha/procesamiento/voz. Los controles preceden al avatar para ser accesibles en ventanas bajas. El avatar escucha durante la ventana abierta. Si Vosk duda, aparecen «Sí, ejecutar» y «No»; si falla el servicio, el aviso conserva botones y órdenes locales. La columna del chef tiene scroll propio para mensajes largos; no invade la cabecera ni la barra. Al entrar o cambiar de paso lee automáticamente; Repetir comparte Gemini TTS/Sulafat con respaldo del lector local (0009).
  - **Barra:** Atrás, Repetir, Ver técnica (desactivado si el paso no tiene) y «Listo, siguiente», que en el último paso pasa a «Terminar receta».
  - **Atajos:** ← y → mientras no haya un panel abierto.
  - **Paneles bajo demanda** (sobre la tarjeta, se cierran con Escape): técnica con sus pasos; temporizadores para pausar, seguir, sumar un minuto, cancelar o crear uno nuevo; ingredientes, con porciones y sustituciones revisadas por ingrediente.
  - Todo pasa por `window.api.sesion.aplicar`, con `confirmado: true` porque es un botón.
  - **Pantalla final:** chef celebrando, resumen y «Cocinar otra receta».
- **Avatar:**
  - Recibe un `EstadoAvatar`. `poseDe` (`src/renderer/componentes/avatar.ts`) elige la pose: señala arriba a los temporizadores y a la izquierda a los ingredientes y al panel.
  - Tras hablar o señalar vuelve a «esperando» a los 6 s; la celebración final se queda.
  - Las poses se apilan para cambiar sin parpadeo. Rive sustituirá el interior del componente sin cambiar su interfaz.
- **Ventana:** mínima de 1100 × 720.
- **Escribir al chef:** franja inferior común en las tres pantallas, con etiqueta visible, campo de texto y Enviar secundario; Enter envía. Respuesta en globo y conversación plegable sobre la franja (doce intercambios, scroll propio). Indica modo de prueba tras una respuesta del proveedor falso. Muestra consulta pendiente y errores recuperables; no abre micrófono. Se desactiva al terminar hasta cocinar otra. El contenido central ocupa el espacio restante sin desplazar las acciones principales fuera de la ventana.

### Pendiente

- Fotos reales de los platos con licencia; mientras tanto, plato ilustrado con el aviso «Foto pendiente».
- Revisar las pantallas construidas con el plugin Design (crítica y accesibilidad).

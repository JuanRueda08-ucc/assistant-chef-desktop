# 0023 · Pantalla de conversación con el chef

**Fecha:** 2026-11-08

**Contexto:** el autor pidió una pantalla aparte para conversar con el chef, como un chat a pantalla completa, que se abra desde «Hablar con el chef» en Inicio y desde el menú. Hasta ahora ese botón abría Preparar con el panel lateral, y le resultaba raro. Eligió la opción A «Chat centrado» de la maqueta (`plan/diseno/conversacion-chef.html`). El panel «Pregúntale al chef» se queda en Preparar, Elegir y Cocinar.

**Decisión:**
- **Pantalla superpuesta** (`pantallas/Conversacion.svelte`, `app.enConversacion`), como Inicio o Mis recetas: debajo sigue Preparar o Elegir, y las herramientas actúan sobre ese estado. Al abrirla desde Cocinar se pasa a Elegir o Preparar sin descartar la receta en curso, que sigue en el menú.
- **El mismo turno de chat** (`app.enviarChat`), con las mismas herramientas, comprobaciones y reglas que el panel. No hay herramientas nuevas ni cambios en el servidor.
- **Los elementos salen del estado, no del modelo** (`lib/conversacion.ts`). Cada turno guarda lo que añadió a la despensa, comparando antes y después, y si buscó recetas o pidió ideas. Las etiquetas se pueden quitar, y «Deshacer» quita lo que añadió ese turno. Las tarjetas de la última búsqueda se dibujan desde `app.busqueda` y `app.ideas`, que llegan aparte.
- **Si la despensa o las preferencias cambian después de buscar**, las tarjetas se sustituyen por «Buscar de nuevo», igual que Elegir deja de valer. Tras añadir ingredientes sin buscar, la app ofrece «Buscar recetas con esto», que hace ella misma, sin pasar por el modelo.
- **Ver una receta** lleva a su detalle en Elegir. Si lo pide el chef, con `ver_receta` o `escribir_receta`, se abre además el panel lateral con su respuesta. **Elegir para cocinar** («cocinémosla») va a Cocinar.
- **La conversación vive en memoria** y es la misma en el panel y en la pantalla. Se conserva al ir a Elegir y volver, hasta pulsar «Nueva conversación» o cerrar la app. En la pantalla, el historial que se manda al modelo no se reinicia al pasar de Preparar a Elegir.
- **«Hablar» (0020)** se comparte con el panel en `voz/hablar-chat.svelte.ts`: una frase de hasta ocho segundos.

**Consecuencias:** «Hablar con el chef» de Inicio ya no abre Preparar. El menú suma «Hablar con el chef». Las frases sugeridas se envían como si se escribieran.

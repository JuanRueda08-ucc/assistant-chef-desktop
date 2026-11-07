# 0019 · El chef propone recetas desde una despensa guardada

**Fecha:** 2026-11-06

**Contexto:** el autor no quiere limitar la app a recetas precargadas. Propone reunir ingredientes en una despensa, y que el chef ofrezca recetas guardadas y, si ninguna encaja, busque en internet. Detalle en `plan-chef-recetas.md`.

**Decisión:**
- **Despensa:** ingredientes, preferencias y alergias se guardan por cuenta en `chef.sqlite`.
- **Orden de propuesta:** recetas guardadas (por código), después Gemini con Google Search y, si falla o no hay saldo, Gemini sin búsqueda, indicándolo en pantalla. Primero ideas cortas; la receta completa solo para la elegida.
- **Proveedor:** se mantiene Gemini. Es el único de los revisados con búsquedas gratis y ya está integrado en chat, narración y voz. La búsqueda requiere facturación (5 USD en prepago, sin recarga automática) y se conecta sin rehacer el flujo cuando haya saldo.
- **Alérgenos:** los ingredientes fuera del catálogo quedan como «alérgenos sin verificar». Su receta no declara dietas ni «sin X» y avisa a quien tenga alergias. La IA no decide alérgenos, como exige la regla de dominio.
- **Colección:** las recetas generadas que el usuario guarde se añaden a su colección. No se entrena ningún modelo.

**Actualización (2026-11-07):** las ideas las comprueba `recetas/ideas.ts` en main: el código calcula lo que tienes y lo que falta, y descarta lo que choque con alergias, dieta, tiempo o nivel. Son filtros por palabras y catálogo, no una garantía, así que la interfaz siempre avisa. Las condiciones de Google limitan modificar y guardar resultados con búsqueda: ver `plan-chef-recetas.md`.

**Consecuencias:** las recetas generadas dejan de ser el último recurso oculto y pasan a ser parte central del flujo. La tarea 17 se sustituye por las tareas 38 a 42. Sube la dependencia de Gemini: hay que contemplar saturación, tiempos de espera y costos. La búsqueda queda sin probar hasta activar la facturación.

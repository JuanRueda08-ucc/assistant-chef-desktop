# 0015 · Lista libre de ingredientes con elementos sin identificar

**Fecha:** 2026-10-22

**Contexto:** la tarea 28 pide añadir varios ingredientes a la vez, por el buscador o por chat, sin perder lo que no está en el catálogo (`replanteamiento-v1.md`, «Ingredientes libres»). Hasta ahora `marcar_ingredientes` rechazaba todo el lote si un nombre era desconocido o ambiguo, y el buscador solo filtraba el catálogo.

**Decisión:**
- `Preferencias` gana `ingredientesSinIdentificar: string[]` (texto del usuario, máximo 50, por defecto `[]` para las sesiones ya guardadas). Viaja con las preferencias, por lo que el chef lo ve en su contexto, pero **no cuenta** para buscar recetas, recuentos ni etiquetas: no se inventan dietas ni alérgenos para algo desconocido.
- La lógica vive en `src/shared/recetas/lista.ts`: `separarIngredientes` (comas, punto y coma, saltos de línea, «y»/«e»), `identificarIngrediente` (exacto por id/nombre/sinónimo y, si no, por contenido; nunca elige entre varios), `resolverIngredientes` (reconocidos, básicos, ambiguos y desconocidos) y los textos para el usuario.
- **Buscador de Preparar:** Intro (o «Añadir») añade todo lo escrito. Lo reconocido entra en la lista; lo desconocido queda «sin identificar» con borde discontinuo; lo ambiguo muestra los candidatos para elegir o «Ninguno». Pulsar un elemento sin identificar lo devuelve al buscador para probar otro nombre.
- **Chat:** `marcar_ingredientes` aplica lo que reconoce, guarda lo desconocido y pregunta por lo ambiguo en su respuesta. Solo falla si no hay nada que aplicar. Quitar también funciona con los sin identificar. `cambiar_preferencias` no toca ninguna de las dos listas.

**Consecuencias:** el catálogo de la semilla sigue siendo pequeño; ampliarlo (con dietas y alérgenos revisados) es trabajo aparte. La tarea 17 (recetas generadas) podrá usar `ingredientesSinIdentificar` como pista, pero deberá identificar cada ingrediente en el catálogo antes de validar una receta.

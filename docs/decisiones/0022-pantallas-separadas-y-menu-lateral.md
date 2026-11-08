# 0022 · Pantallas separadas y menú lateral en lugar de los momentos numerados

**Fecha:** 2026-11-08

**Contexto:** la cabecera mostraba «1 Preparar · 2 Elegir · 3 Cocinar», y desde cualquier pantalla se podía saltar a otra. El autor dijo que así parecían una sola pantalla y que prefiere que cada una sea distinta, con un menú lateral para lo que no es el paso a paso: por ahora Mi cuenta y Mis recetas.

**Decisión:**
- **Sin momentos en la cabecera:** se quita `Momentos.svelte`. Cada pantalla tiene su propia salida: Elegir, «Cambiar ingredientes»; Cocinar, «Salir», que vuelve a Preparar y deja la receta guardada; Mis recetas, «Volver».
- **Menú lateral** (`MenuLateral.svelte`, `app.menuAbierto`), abierto con el botón de tres rayas junto a la marca. Contiene «Seguir cocinando» si hay una receta a medias y no se está en Cocinar, «Mis recetas» y «Mi cuenta». Mi cuenta muestra el nombre, el correo y «Cerrar sesión» con una cuenta real, o un aviso en el modo sin cuenta (0018). Se cierra con la X, con Escape o pulsando fuera.
- **Cabecera:** menú y marca a la izquierda, y «Pregúntale al chef» a la derecha (no en Cocinar).

**Consecuencias:** reemplaza la cabecera común de 0012 y el punto de 0021 sobre las pestañas subrayadas. Volver a una receta a medias se hace desde el menú o desde Retomar al abrir la app. El login (0017) mostrará su nombre en Mi cuenta.

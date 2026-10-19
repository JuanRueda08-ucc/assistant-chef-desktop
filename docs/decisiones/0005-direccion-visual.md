# 0005 · Dirección visual «Mostaza»

**Fecha:** 2026-10-18

**Contexto:** el diseño estaba pendiente ("crema, mostaza y tinta", componentes neutros). Las propuestas de una herramienta de diseño automática no encajaron con la estética buscada. El autor aportó dos referencias (una app de recetas amarilla y blanca, y una paleta azul pizarra) y el set de poses del chef: dibujo de línea negra gruesa con relleno blanco.

**Decisión:** se compararon tres direcciones en maquetas de las tres pantallas (A «Mostaza», B «Pizarra», C «Pizarra y mostaza»; `docs/diseno/maquetas.html`) y el autor eligió la **A**. Fondo blanco roto, tarjetas blancas, amarillo girasol como acento, tinta negra; Bricolage Grotesque y Figtree incluidas en la app; el trazo grueso del chef como firma de lo activo y lo principal. La especificación completa está en `docs/diseno.md` y los valores en `src/renderer/styles/tokens.css`. Sustituye a la dirección provisional de crema, mostaza y tinta.

**Consecuencias:** las pantallas se construyen ya con el diseño final, no con componentes neutros. El amarillo tiene poco contraste con el fondo, así que la selección siempre lleva el trazo y una marca. Faltan las fotos licenciadas de los platos y normalizar la escala de las poses del chef.

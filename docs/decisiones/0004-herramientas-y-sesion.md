# 0004 · Contrato de herramientas y sesión de cocina

**Fecha:** 2026-10-18

**Contexto:** las herramientas del chef (0002) las van a llamar los botones, las órdenes locales y el modelo. Había que decidir dónde se definen, cómo se valida la confirmación del usuario, qué datos necesita el reductor y cómo se guarda y se retoma la sesión.

**Decisión:**
- Los argumentos de cada herramienta se definen una sola vez con zod en `src/shared/ia/herramientas.ts`; el JSON Schema para el modelo se genera de ellos con `z.toJSONSchema`.
- La confirmación del usuario (`confirmado`) es un campo de la llamada que pone la app, no un argumento del modelo, para que el modelo no pueda saltarse un paso con fuego o cuchillo.
- El reductor recibe un cuarto parámetro, `contexto` (receta original, catálogo, sustituciones y técnicas): `aplicarHerramienta(sesion, llamada, ahora, contexto)`. Así reescala y sustituye siempre desde la receta original, sin acumular redondeos, y sigue siendo puro.
- Los resultados llevan `estado` (resumen de la cocina), `datos` opcionales por herramienta y códigos de error cerrados.
- Main guarda la sesión completa en `sesiones` después de cada herramienta que funciona. Al iniciar otra receta se borra la sesión que estaba cocinando. Al abrir la app se retoma la sesión `cocinar` con los temporizadores puestos al día con el reloj.

**Consecuencias:** botones, voz y modelo comparten las mismas reglas y los mismos tests. Quien llama al reductor tiene que cargar el contexto (main lo hace desde SQLite en cada llamada; es barato con pocas recetas). Una sesión abandonada al empezar otra receta se pierde. Las sustituciones propuestas por el modelo tendrán que guardarse en la tabla antes de poder aplicarse.

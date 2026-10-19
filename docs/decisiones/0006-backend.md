# 0006 · Forma del backend mínimo

**Fecha:** 2026-10-18

**Contexto:** el backend (`server/`) guarda la clave del proveedor de IA, emite tokens de voz, genera recetas y sugiere sustituciones (0001, `docs/ia-chef.md`). Todavía no está elegido ni el proveedor de IA y voz ni dónde se alojará el backend.

**Decisión:**
- **Manejador portátil:** el backend es un manejador `Request → Response` de la API web estándar (`crearApp`). En local lo sirve el servidor HTTP de Node (`npm run server:dev`); en una plataforma serverless se exporta tal cual.
- **Proveedor intercambiable:** el proveedor va detrás de `ProveedorIA`. Mientras no haya uno elegido existe un proveedor `falso`, determinista y sin red, que usan los tests y el desarrollo. Todo lo que devuelve el proveedor se valida con zod antes de responder.
- **Catálogo enviado por la app:** la app manda en cada petición el catálogo (y las técnicas), porque es la fuente de verdad; el backend no tiene base de datos.
- **Lo que decide el servidor:** identidad, origen y estado de las recetas generadas. Las dietas, los alérgenos y lo que resuelve una sustitución los calcula el código, nunca el modelo.
- **Límite de uso:** por instalación (cabecera `X-Instalacion`), función y día UTC, con un almacén intercambiable (en memoria por ahora).

**Consecuencias:** cambiar de proveedor o de plataforma no toca la app ni la validación. Las peticiones son algo más grandes por llevar el catálogo. El límite en memoria no se comparte entre instancias serverless: antes de publicar hay que conectar un almacén compartido y pensar una autenticación mejor que el id de instalación.

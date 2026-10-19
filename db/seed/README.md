# Semillas

Datos que la app valida (zod, `src/shared/esquemas/semilla.ts`) y carga en SQLite en cada arranque.

| Archivo | Contenido |
|---|---|
| `ingredientes.json` | catálogo de ingredientes (`Ingrediente[]`) |
| `tecnicas.json` | técnicas (`Tecnica[]`) |
| `sustituciones.json` | sustituciones revisadas (`Sustitucion[]`); opcional |
| `recetas/*.json` | una receta por archivo (`Receta`) |

Los campos opcionales se pueden omitir: el esquema pone `null`, `[]` o el valor por defecto. `dietas` y `alergenos` de las recetas **no se escriben**: se derivan del catálogo (tarea 6 del roadmap).

Para añadir una receta: crea `recetas/<slug>.json`, usa ingredientes y técnicas que existan en el catálogo (o añádelos) y ejecuta `npm test`, que valida todas las semillas.

## Fuentes y licencias

| Receta | Fuente | Licencia | Foto |
|---|---|---|---|
| `arroz-con-pollo` | escrita para este proyecto (ejemplo, `estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |

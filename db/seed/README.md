# Semillas

Datos que la app valida (zod, `src/shared/esquemas/semilla.ts`) y carga en SQLite en cada arranque.

| Archivo | Contenido |
|---|---|
| `ingredientes.json` | catálogo de ingredientes (`Ingrediente[]`) |
| `tecnicas.json` | técnicas (`Tecnica[]`) |
| `sustituciones.json` | sustituciones revisadas (`Sustitucion[]`); opcional |
| `recetas/*.json` | una receta por archivo (`Receta`) |

Los campos opcionales se pueden omitir: el esquema pone `null`, `[]` o el valor por defecto. `dietas` y `alergenos` de las recetas **no se escriben**: se derivan del catálogo (tarea 6 del roadmap).

Las recetas nuevas entran como `borrador` y pasan a `revisada` solo cuando el autor las aprueba (decisión 0018). En desarrollo se ven en Elegir con la etiqueta «Sin revisar»; la app empaquetada solo muestra las revisadas. `src/main/db/semillas.test.ts` comprueba que cada ingrediente se use, que los tiempos cuadren, que las cifras tengan versión de voz y que carne, pollo y pescado crudos indiquen la temperatura interna.

Para añadir una receta: crea `recetas/<slug>.json`, usa ingredientes y técnicas que existan en el catálogo (o añádelos) y ejecuta `npm test`, que valida todas las semillas.

## Fuentes y licencias

| Receta | Fuente | Licencia | Foto |
|---|---|---|---|
| `arroz-con-pollo` | escrita para este proyecto (ejemplo, `estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `arepas-queso` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `arroz-verduras` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `carne-molida-guisada` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `crema-zanahoria` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `ensalada-atun` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `garbanzos-espinaca` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `huevos-pericos` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `lentejas-guisadas` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `panqueques` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `pasta-atun` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `pasta-tomate` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `pescado-limon` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `pollo-horno-papas` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `pollo-plancha-ensalada` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `quesadillas-queso` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `sopa-pollo` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |
| `tortilla-papa` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | sin foto (`imagen: null`) |

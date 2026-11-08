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
| `arroz-con-pollo` | escrita para este proyecto (ejemplo, `estadoRevision: borrador`) | propia del proyecto | foto de Andres Alaniz en Pexels (`recetas/arroz_con_pollo.jpg`) |
| `arepas-queso` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Christian Bolaños en Pexels (`recetas/arepas_queso.jpg`) |
| `arroz-verduras` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Speak Media Uganda en Pexels (`recetas/arroz_verduras.jpg`) |
| `carne-molida-guisada` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Laura Oliveira en Pexels (`recetas/carne_molida_guisada.jpg`) |
| `crema-zanahoria` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Natalie Goodwin en Pexels (`recetas/crema_zanahoria.jpg`) |
| `ensalada-atun` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Piriyonel Piri en Pexels (`recetas/ensalada_atun.jpg`) |
| `garbanzos-espinaca` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Iva Tomic en Pexels (`recetas/garbanzos_espinaca.jpg`) |
| `huevos-pericos` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Markus Winkler en Pexels (`recetas/huevos_pericos.jpg`) |
| `lentejas-guisadas` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Vural Yavas en Pexels (`recetas/lentejas_guisadas.jpg`) |
| `panqueques` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de ClickerHappy en Pexels (`recetas/panqueques.jpg`) |
| `pasta-atun` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Eiliv Aceron en Pexels (`recetas/pasta_atun.jpg`) |
| `pasta-tomate` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Willians Huerta en Pexels (`recetas/pasta_tomate.jpg`) |
| `pescado-limon` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Busenur Demirkan en Pexels (`recetas/pescado_limon.jpg`) |
| `pollo-horno-papas` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Vincent Rivaud en Pexels (`recetas/pollo_horno_papas.jpg`) |
| `pollo-plancha-ensalada` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Piriyonel Piri en Pexels (`recetas/pollo_plancha_ensalada.jpg`) |
| `quesadillas-queso` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de The Castlebar en Pexels (`recetas/quesadillas_queso.jpg`) |
| `sopa-pollo` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de Muhammad Khawar Nazir en Pexels (`recetas/sopa_pollo.jpg`) |
| `tortilla-papa` | escrita para este proyecto (`estadoRevision: borrador`) | propia del proyecto | foto de MikeGz en Pexels (`recetas/tortilla_papa.jpg`) |

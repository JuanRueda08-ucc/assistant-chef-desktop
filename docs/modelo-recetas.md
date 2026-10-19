# Modelo de recetas

Fuente de verdad de los datos: `db/schema.sql` (tablas) y `src/shared/types/receta.ts` (tipos). Si cambias uno, cambia el otro y este documento.

## En el código

- Tipos: `src/shared/types/receta.ts`. Esquemas zod equivalentes: `src/shared/esquemas/receta.ts` (objetos estrictos, sin campos extra).
- Los campos opcionales son `T | null`; en los JSON de `db/seed/` se pueden omitir y zod pone `null`, `[]` o el valor por defecto (`escalado: lineal`, `opcional: false`).
- Columnas en snake_case (`porciones_base`); las listas se guardan como JSON en TEXT.
- Listas cerradas (constantes en `receta.ts`, los `CHECK` de `schema.sql` las repiten y un test lo comprueba):
  - `dietas`: `vegetariana`, `vegana`, `sin_gluten`, `sin_lactosa`.
  - `alergenos`: los 14 del Reglamento UE 1169/2011 (`gluten`, `crustaceos`, `huevo`, `pescado`, `cacahuete`, `soja`, `lacteos`, `frutos_secos`, `apio`, `mostaza`, `sesamo`, `sulfitos`, `altramuces`, `moluscos`).
  - `equipo`: `horno`, `sarten`, `olla`, `olla_presion`, `licuadora`, `batidora`, `microondas`, `freidora_aire`, `plancha`.
  - `categoria` de ingrediente: `verduras`, `frutas`, `proteinas`, `lacteos`, `cereales`, `legumbres`, `especias`, `despensa`.
- Reglas que valida el esquema además de los tipos: `al_gusto` va sin `cantidad` y todo lo demás con `cantidad` y `redondeo`; `pizca` lleva cantidad (número de pizcas) pero no escala; los pasos están ordenados desde 1 sin huecos; cada paso solo usa ingredientes de la receta y no los repite; `0 < fraccion ≤ 1` (un mismo ingrediente puede aparecer en varios pasos, por ejemplo picar y luego sofreír); temporizador de paso entre 10 s y 6 h; `tiempoActivoMin ≤ tiempoTotalMin`.
- La semilla (`src/shared/esquemas/semilla.ts`) comprueba además que ingredientes, técnicas y recetas referenciadas existan y que no haya ids ni slugs repetidos. Al cargarla, main deriva `dietas` y `alergenos` de cada receta; si un JSON de receta trae esos campos, la carga falla.

### Funciones (`src/shared/recetas/`)

| Función | Archivo | Qué hace |
|---|---|---|
| `escalarReceta(receta, porciones)` | `escalado.ts` | copia escalada (`porcionesBase` pasa a ser `porciones`), `factor` y `aviso` (`factor_alto` / `factor_bajo`) |
| `cantidadesDelPaso(receta, paso)` | `escalado.ts` | cantidades del paso a partir de `fraccion` |
| `aUnidadCasera(cantidad, unidad, ingrediente)` / `formatearMedida(medida)` | `unidades.ts` | medida casera y su texto ("1 ½ tazas") |
| `derivarEtiquetas(receta, catalogo)` / `conEtiquetas` | `etiquetas.ts` | dietas compatibles y alérgenos |
| `aplicarSustitucion(receta, sustitucion, catalogo)` | `sustituciones.ts` | copia con el ingrediente cambiado, ratio aplicado y etiquetas recalculadas |
| `redondear(valor, paso)` | `redondeo.ts` | múltiplo más cercano de `paso`, nunca menos que `paso` |
| `buscarRecetas(preferencias, recetas, catalogo, sustituciones)` | `busqueda.ts` | resultados ordenados con panel "qué falta", descartadas con motivos y `ofrecerGenerada` (tipos en `src/shared/types/busqueda.ts`) |
| `resumirReceta(receta)` | `resumen.ts` | `ResumenReceta` (cabecera, etiquetas y equipo, sin ingredientes ni pasos) |

Ninguna modifica la receta que recibe. Detalles que no están en las secciones de abajo:

- **Escalado:** `porciones` es un entero de 1 a 20. Con factor 1 las cantidades quedan tal como se escribieron (no se vuelven a redondear). Escala siempre desde la receta original, nunca sobre una ya escalada. Con sustituciones, primero `aplicarSustitucion` sobre la original y después `escalarReceta`.
- **Cantidades por paso:** se redondean por separado, así que la suma de pasos puede diferir del total en un redondeo (sal 13 g en dos mitades → 7 g + 7 g).
- **Unidades caseras** (cucharadita 5 ml, cucharada 15 ml, taza 240 ml):
  - `g` con `pesoUnidadG` → piezas de ½ en ½, si sale al menos media pieza.
  - Si no, `g` con `densidadGMl` → volumen; `g` sin datos → g, o kg desde 1000 g.
  - Volumen: menos de 15 ml en cucharaditas (de ¼ en ¼), menos de 60 ml en cucharadas (de ½ en ½), menos de 1000 ml en tazas (de ¼ en ¼) y desde ahí en litros.
  - `unidad`, `pizca` y `al_gusto` se muestran tal cual.
- **Etiquetas:** cuentan también los ingredientes opcionales. Además de `dietasIncompatibles` del catálogo, se deduce:
  - `gluten` → no `sin_gluten`; `lacteos` → no `sin_lactosa`.
  - `pescado`, `crustaceos` o `moluscos` → no `vegetariana`.
  - `huevo`, `lacteos` o no vegetariano → no `vegana`.
  - Un ingrediente fuera del catálogo es un error.
- **Sustitución:** recibe además el catálogo (para recalcular etiquetas). Mantiene el id del ingrediente de receta (los pasos siguen apuntando a él), la unidad, `al_gusto` y `pizca`. Falla si la sustitución es de otra receta, si la receta no usa el ingrediente de origen o si el destino no está en el catálogo. No comprueba `contexto` ni las restricciones del usuario: eso es parte de la búsqueda de sustituciones (tareas 7 y 8).
- **Búsqueda:**
  - **Filtros duros**, en este orden de motivos: `no_revisada`, `restriccion` (la receta debe tener en sus `dietas` derivadas todas las del usuario), `alergia`, `equipo` (todo el de la receta debe estar en el del usuario; si el usuario no indica equipo no se filtra), `tiempo` (`tiempoTotalMin ≤ tiempoMaxMin`) y `nivel` (`dificultad ≤ nivel`, con `facil < media < avanzada`). El filtro por `nivel` no estaba en la lista original: se añadió porque el usuario lo indica en Preparar. Una receta que solo cumpliría las restricciones tras una sustitución se descarta igualmente.
  - **Puntuación:** `cobertura − 0,1 × faltantes + 0,05 × faltantes con sustitución` (`PENALIZACION_FALTANTE`, `BONUS_SUSTITUCION`). Cada ingrediente cuenta una vez, y es obligatorio si alguna de sus apariciones lo es. A igual puntuación ordena por menos faltantes, luego menos tiempo total y luego título.
  - **Sustitución posible:** de la receta o general, con un destino que el usuario tiene (o básico de despensa), que está en el catálogo y que no choca con sus restricciones ni alergias. Primero las específicas de la receta. El `contexto` no se comprueba todavía.
  - **`ofrecerGenerada`:** `true` si ninguna receta llega a `coberturaConSustituciones ≥ 0,6` (`UMBRAL_COBERTURA`), incluido el caso de no tener ningún resultado.

## Principios

1. **Lo calculable se calcula en código.** Escalar cantidades, convertir unidades, filtrar por restricciones y llevar el tiempo son funciones deterministas. El LLM no hace aritmética de cocina.
2. **Una sola forma de receta.** Las recetas revisadas y las generadas usan el mismo esquema; solo cambia `origen`. Toda receta generada se valida contra el esquema antes de mostrarse.
3. **Unidades canónicas métricas.** Se guarda en `g`, `ml` o `unidad` (más `pizca` y `al_gusto`, que no escalan). La interfaz convierte a unidades caseras (cucharada, taza) solo al mostrar.
4. **El paso es la unidad de la cocina.** Todo lo que el chef dice o muestra en modo cocina sale del paso actual.

## Receta

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `slug` | texto | `slug` estable para URLs internas y semillas |
| `titulo`, `descripcion` | texto | descripción de una o dos frases |
| `porcionesBase` | entero | porciones para las que están escritas las cantidades |
| `tiempoTotalMin`, `tiempoActivoMin` | entero | activo = manos ocupadas |
| `dificultad` | `facil` \| `media` \| `avanzada` | |
| `origen` | `revisada` \| `generada` | las generadas se etiquetan en la interfaz |
| `estadoRevision` | `borrador` \| `revisada` \| `retirada` | solo `revisada` aparece en la búsqueda |
| `dietas` | lista | `vegetariana`, `vegana`, `sin_gluten`, `sin_lactosa`… (se recalculan desde ingredientes, ver abajo) |
| `alergenos` | lista | derivados de los ingredientes; nunca escritos a mano |
| `equipo` | lista | `horno`, `sarten`, `olla`, `licuadora`… |
| `imagen` | ruta | foto real licenciada; `null` mientras no exista |
| `ingredientes` | `IngredienteReceta[]` | |
| `pasos` | `Paso[]` | ordenados |

### IngredienteReceta

| Campo | Notas |
|---|---|
| `id` | id local dentro de la receta (`ir_1`), lo usan los pasos |
| `ingredienteId` | referencia al catálogo |
| `cantidad`, `unidad` | canónicas; `null` si `unidad` es `al_gusto` |
| `escalado` | `lineal` (por defecto), `suave` (sal, especias, levadura: factor^0,75) o `fijo` (una hoja de laurel) |
| `redondeo` | paso mínimo al mostrar: `1` para huevos, `0.5` para limones, `5` para gramos… |
| `preparacion` | "picada fina", "a temperatura ambiente" |
| `grupo` | "Para la salsa"; opcional |
| `opcional` | no cuenta en "qué falta" |

### Paso

| Campo | Notas |
|---|---|
| `id`, `orden` | |
| `texto` | lo que se lee en pantalla, una acción principal |
| `textoVoz` | versión hablada si difiere (sin abreviaturas, sin cifras ambiguas); opcional |
| `ingredientes` | `{ ingredienteRecetaId, fraccion }[]`: qué parte de cada ingrediente se usa en este paso (1 = todo). La cantidad del paso se deriva, no se escribe |
| `duracionSeg` | duración estimada; `null` si es inmediato |
| `temporizador` | `{ etiqueta, segundos }` si el paso propone uno ("Arroz", 1080) |
| `senalHecho` | cómo saber que está listo: "hasta que la cebolla esté transparente" |
| `tecnicaId` | referencia a `tecnicas` para "Ver técnica" |
| `requiereConfirmacion` | el chef no avanza sin un "listo" del usuario (por defecto `true` si hay fuego o cuchillo) |
| `consejo` | frase corta para el globo del chef |
| `seguridad` | aviso opcional (temperatura interna, aceite caliente) |

## Catálogo de ingredientes

`ingredientes`: `id`, `nombre`, `sinonimos` (para búsqueda y voz), `categoria` (verduras, proteínas, lácteos, despensa…), `esBasicoDespensa` (sal, aceite, agua: se asume disponible), `alergenos`, `dietasIncompatibles` (la carne es incompatible con `vegetariana`), `densidadGMl` (para convertir taza↔gramos; opcional), `pesoUnidadG` (un huevo ≈ 50 g; opcional).

Las dietas y alérgenos de una receta se **derivan** del catálogo con una función; así una sustitución actualiza las etiquetas sin trabajo manual.

## Técnicas

`tecnicas`: `id`, `nombre` ("Picar en brunoise"), `descripcion`, `pasosCortos[]`, `media` (vídeo o animación, opcional). Las muestra la herramienta `mostrar_tecnica`.

## Adaptar cantidades (porciones)

```
factor = porcionesNuevas / porcionesBase
lineal: cantidad * factor
suave:  cantidad * factor^0.75   (no baja de la mitad ni sube del doble del original)
fijo:   cantidad
al_gusto / pizca: sin número
después: redondear al `redondeo` del ingrediente y convertir a unidad casera al mostrar
```

- Los tiempos de cocción **no** escalan; si `factor > 2` o `< 0.5` la app avisa ("puede que necesites una olla más grande o cocinar en tandas").
- Las cantidades de cada paso se recalculan a partir de `fraccion`, nunca se guardan dos veces.
- `cambiar_porciones` durante la cocina recalcula todo y conserva el paso actual.

## Sustituciones

Tabla `sustituciones`: `ingredienteOrigenId`, `ingredienteDestinoId`, `ratio` (1 g de mantequilla → 0,8 g de aceite), `recetaId` (null = válida en general), `contexto` (`horneado`, `salteado`, `cualquiera`), `resuelve` (dietas o alérgenos que evita), `impacto` (sabor/textura en una frase), `fuente` (`revisada` | `generada`).

Orden de búsqueda al pedir una sustitución:

1. Sustitución específica de la receta.
2. Sustitución general con contexto compatible con la técnica del paso.
3. Si no hay, el LLM propone una (máximo 3 opciones) con `fuente: generada`; la app comprueba que no rompe las restricciones del usuario antes de ofrecerla.

Una sustitución aplicada vive en la **sesión**, no modifica la receta guardada.

## Elegir recetas (búsqueda híbrida)

1. **Filtros duros:** restricciones y alergias del usuario, `estadoRevision = revisada`, equipo disponible, tiempo máximo.
2. **Puntuación:** cobertura de ingredientes que el usuario tiene (los básicos de despensa cuentan como presentes), menos penalización por cada faltante no opcional, más bonus si un faltante tiene sustitución con algo que el usuario sí tiene.
3. **Resultado:** lista ordenada con el panel "qué falta" (faltantes y sustituciones posibles) para cada una.
4. **Generada:** solo si ninguna receta pasa un umbral de cobertura, o si el usuario lo pide. Se genera con el esquema de este documento, se valida (esquema + reglas de seguridad) y se muestra al final con la etiqueta "Receta generada".

## Validación de recetas generadas

- Pasa el esquema (zod) sin campos extra.
- Todo ingrediente existe en el catálogo o se marca `ingredienteNuevo` para revisión.
- Proteínas animales llevan `seguridad` con temperatura o señal de cocción.
- Alérgenos y dietas se derivan, no se aceptan del modelo.
- Si falla, un reintento con el error; si vuelve a fallar, no se muestra.

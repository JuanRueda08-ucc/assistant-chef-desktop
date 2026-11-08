# Plan: despensa y chef que propone recetas

**Acordado con el autor el 2026-11-06** (decisiones 0018 y 0019). Este documento conserva la idea de producto y lo que el autor pidió, para continuar en otro chat o con otro agente sin perder contexto. Lee también `estado.md`.

## La idea del autor

La app debe ser muy funcional e interactiva. Una persona entra, reúne sus ingredientes en una **despensa**, y el chef (la IA) los revisa y le da recetas a escoger. Las precargadas se aceptan, pero no deben ser el límite: si ninguna encaja, la IA busca una solución. El autor considera **esencial** la búsqueda en internet y aprobó este flujo.

## Flujo aprobado

1. **Mi despensa:** elegir ingredientes del catálogo o buscarlos; si no están, igual se añaden. Se guarda para la próxima vez.
2. **Pedir recetas:** con un botón, por chat o por voz («algo rápido», «sin gluten»).
3. **Recetas guardadas:** el código compara la despensa con las semillas (hoy 18) y con las que el usuario guardó. Si alguna encaja, se ofrece al instante.
4. **Búsqueda en internet:** si ninguna sirve, Gemini busca en Google, lee los resultados y propone recetas con esos ingredientes, indicando sus fuentes y sin copiar el texto de las páginas.
5. **De memoria:** si la búsqueda falla o no hay saldo, Gemini crea la receta con lo que ya sabe, y la pantalla lo indica («Creada por el chef, sin buscar en internet»).
6. **Elegir y cocinar:** primero ideas cortas (nombre, tiempo, lo que falta) con «dame otras»; la receta completa se escribe solo para la elegida, se valida y se cocina con la guía de siempre.
7. **Guardar:** si gustó, pasa a «Mis recetas» y aparece en el paso 3 la próxima vez. La colección crece así.

## Reglas que no cambian

- **Alérgenos (aprobado por el autor):** un ingrediente fuera del catálogo queda como **«alérgenos sin verificar»**. La receta que lo use no declara ninguna dieta ni «sin X», y avisa si la persona tiene alergias registradas. La IA no decide alérgenos.
- **Cálculos en código:** porciones, unidades, temporizadores y comparación con la despensa.
- **Validación:** toda receta generada se valida antes de mostrarse y lleva la etiqueta «Receta generada». Se mantiene el aviso de que la creó una IA.

## Orden de trabajo

- [x] Modo de desarrollo sin cuenta y 18 recetas en borrador (0018).
- [x] **Tarea 37. Despensa guardada** por cuenta, junto con preferencias y alergias.
- [x] **Tarea 38. Ingredientes nuevos** con «alérgenos sin verificar». Falta crear el ingrediente real al guardar una receta generada (tareas 40 y 41).
- [ ] **Tarea 39. El chef propone:** guardadas, internet o memoria en una sola lista, con «dame otras». **Hecha y probada de memoria. Falta probar la búsqueda real cuando el autor active la facturación;** su pantalla se probó con un servidor simulado.
- [x] **Tarea 40. Receta completa:** generar, validar y cocinar la elegida; sustituye a la tarea 17. **Hecha de memoria.** Las ideas que vengan de internet tienen el botón desactivado hasta resolver las condiciones de Google.
- [x] **Tarea 41. Mis recetas:** guardar las generadas por cuenta, al terminar de cocinar; aparecen al buscar y en su propia pantalla.
- [x] **Tarea 42. Chat y voz** para pedir todo lo anterior: chat y botón «Hablar» (0020). Falta que el autor lo pruebe con su micrófono.

## Búsqueda en internet y costos

Comprobado el 2026-11-06 con la clave del autor: Gemini responde sin búsqueda, pero con `google_search` da **429** en `gemini-3.5-flash-lite` y `gemini-3.8-flash`. Hace falta facturación.

- **Activarla:** recarga mínima de **5 USD**, en prepago y **sin recarga automática**. Al llegar a 0 USD, las claves se detienen en vez de cobrar. El saldo no se devuelve y caduca a los 12 meses.
- **Precios:** 5.000 búsquedas gratis al mes y 14 USD por cada 1.000 más; máximo 1.500 al día. Con facturación, el proyecto pasa a plan de pago y también se cobra el texto: `gemini-3.5-flash-lite` 0,30/2,50 USD y `gemini-3.8-flash` 0,75/3,75 USD por millón de tokens de entrada/salida (el segundo se duplica desde el 1 de enero de 2027).
- **Cuándo:** el autor la activará **antes de la tarea 39**; avisarle al llegar. Antes no se usa, y hasta entonces la app usa el modo de memoria.
- **Condiciones de Google (leídas el 2026-11-07, sin asesoría legal):** un resultado con búsqueda debe mostrarse **con sus sugerencias de búsqueda** (ya se hace, en un iframe sin scripts) y solo a quien lo pidió. No se puede **modificar ni mezclar con otro contenido**, ni copiar o almacenar sus enlaces. No se puede **guardar en caché, analizar ni usar para entrenar**, salvo guardar el texto hasta **2 años** para fines limitados, como mostrar a la persona su historial. Esto **afecta a las tareas 40 y 41**: convertir un resultado con búsqueda en una receta estructurada y guardarla en «Mis recetas» podría no estar permitido. El autor eligió el 2026-11-07 seguir de memoria por ahora y resolverlo al activar la facturación (ver la sección siguiente). Generar la receta completa sin búsqueda a partir de una idea encontrada también hay que revisarlo contra las condiciones.
- **Alternativas revisadas:** OpenAI y Anthropic, 10 USD por 1.000 búsquedas; Grok, unos 5 USD (fuente de terceros); Kimi, 2 a 3 USD; DeepSeek, unos 5 yuanes (fuente de terceros). Se descartan por ahora porque habría que adaptar chat, narración y voz. Las bibliotecas TheMealDB, Spoonacular y Edamam se descartan por idioma, límites o instrucciones ausentes.

## Lo que enseñaron las pruebas con Gemini real (2026-11-06)

- **El modelo no es fiable para la seguridad.** Dijo «he anotado tu alergia» sin llamar a la herramienta, y guardó solo una parte de «soy vegetariano y no como lácteos». Por eso `nota-preferencias.ts` añade al chat lo guardado de verdad, calculado del estado. No depender solo del texto de las instrucciones en nada de seguridad: las recetas generadas (tareas 39 y 40) necesitan la misma red de seguridad en código.
- **Saturación:** `gemini-3.8-flash` responde 503 o tarda más de 80 s. Tras un fallo se usa `gemini-3.5-flash-lite` durante 5 minutos, lo que bajó el chat de 10–29 s a unos 3–6 s, con algún turno más lento (hasta 14 s).
- **Límite por minuto:** varias peticiones seguidas dan 429 en el plan gratis. Tenerlo en cuenta al proponer varias recetas. Puede cambiar con la facturación.

## Internet y memoria: lo que quiere el autor (2026-11-07)

- **Hoy, de memoria:** sin facturación, Gemini crea ideas y recetas con lo que ya sabe. Le parece bien para ahora y no hay que pagar para seguir.
- **Internet importa:** una receta de memoria no está comprobada por nadie (tiempos de cocción, por ejemplo). Quiere que, con facturación, Gemini busque recetas famosas o con reseñas reales, para ampliar las opciones y no depender solo de la IA.
- **Límite que hay que tener presente:** la búsqueda no comprueba reseñas. Gemini resume lo que encuentra y no hay datos fiables de puntuación; solo se puede pedir que prefiera esas fuentes y mostrarlas para que la persona las abra. No afirmar en pantalla «receta verificada» por venir de internet.
- **Sin decidir:** cómo cumplir las condiciones de Google al pasar de una idea encontrada a una receta completa (ver arriba). Si la receta la escribe Gemini aparte, ya no es la receta famosa encontrada. La fidelidad a la fuente y las condiciones chocan. El autor lo entendió y lo aplazó: al activar la facturación, revisar las condiciones y probar con búsquedas reales cuánto se parece la receta a la fuente, y decidir con eso. Hasta entonces, `DetalleIdea` no ofrece la receta de una idea con `fuente: internet`.

## Siguiente: conversación con el chef (tarea 44, aprobada como idea el 2026-11-08)

Lo que pidió el autor: además del panel lateral «Pregúntale al chef», una **pantalla aparte para conversar con el chef**, como ChatGPT o Claude. Desde Inicio, «Hablar con el chef» debe abrirla (hoy abre Preparar con el panel, y le resulta raro). En ella le dices lo que tienes, el chef te propone recetas, puedes pedir otras y, al elegir una, pasas a Elegir o a cocinar.

Propuesta aprobada, a llevar primero a maqueta:
- **Pantalla completa:** mensajes grandes, el chef a un lado y abajo el campo para escribir con el micrófono («Hablar», 0020).
- **Al empezar, frases para tocar:** «Tengo pollo y arroz», «Algo rápido para 2», «Sorpréndeme».
- **Respuestas con elementos, no solo texto:**
  - Los ingredientes que reconoce aparecen como etiquetas que se pueden quitar.
  - Las recetas, guardadas o ideas, aparecen como tarjetas con foto, con «Dame otras» y «Ver receta».
  - «Ver receta» abre el detalle en Elegir; «cocinémosla» pasa a Cocinar.
- **Mismas herramientas y reglas que el chat actual** (`seleccion.ts`, `herramientaIdea`, comprobaciones de alergias). Nada nuevo decide el modelo.
- **El panel lateral se queda** en Preparar, Elegir y Cocinar, para dudas rápidas.
- **Resuelto en la construcción (0023):** «Añadido a tu despensa · Deshacer» marca los cambios, y la conversación se conserva al ir a Elegir y volver, hasta «Nueva conversación».

**Hecho el 2026-11-08:** el autor eligió la opción A «Chat centrado» y el fondo 2 «Más presencia». Después eligió la variante 1 del desplegable de la tarea 45, también hecha.

Tarea 45, «Para inspirarte hoy» en Inicio: al pulsar una foto, un desplegable (no otra pantalla) con los ingredientes, lo que tienes y lo que falta. Desde ahí se confirma y se va a cocinar, pasando por la confirmación de Elegir. **Hecha el 2026-11-08 con la variante 1** (sube sobre el saludo), elegida por el autor.

Fondo del inicio: el autor preguntó si cambiarlo. Llevar a la maqueta los dibujos actuales y una variante con más presencia.

## Pendiente con el autor

- **Entrega como app descargable en Windows, Linux y Mac** (dicho el 2026-11-08). Los instaladores son la tarea 19. **Los chats y las recetas de cada usuario deben guardarse en la nube por cuenta, no en el equipo:** Supabase con el login (0024, tarea 47). Hasta crear el proyecto de Supabase, los chats viven en memoria.

- **Fecha:** el autor mencionó el **18 de noviembre de 2026** para su entrega o integración (dicho el 2026-11-07); hay tiempo para la interfaz (43).
- **Imagen de las recetas de la IA:** elegida por el autor el 2026-11-08 y programada. Como la búsqueda, solo funciona con la facturación de Gemini (todos los modelos de imagen dan 429 en el plan gratuito). Cuesta unos centavos de dólar por imagen; límite propio de 20 al día.
- **Voz para pedir recetas:** elegido y hecho el botón «Hablar» (0020). Falta su prueba con micrófono y decidir si el chef debe responder en voz alta allí.
- **Interfaz (dicho el 2026-11-07, para después; ver `estado.md`):** la materia es Diseño de Interfaces y la interfaz no le convence: desorganizada y con demasiada información. Hay que hacer un repaso propio.
- Revisar las 18 recetas en la app y aprobarlas; faltan también sus fotos (tarea 18).
- Activar la facturación cuando pueda y poner la clave en `.env` si cambia. La clave nunca se pide ni se escribe en el repositorio.
- **Tiene una idea sobre la voz del chef** que contará más adelante: preguntarle cuando se retome la voz.
- Cuentas con Supabase aplazadas (`despliegue.md`); prueba de voz aplazada (tarea 34).

## Entrenar un modelo propio

Caso **hipotético** y **trabajo aparte**, no incluido en estas tareas. La app no aplica machine learning: Gemini ya viene entrenado por Google y no aprende de las recetas. Lo que crece es la colección guardada.

Al autor le gustan dos ideas para más adelante:
- **Recomendador:** aprende qué recetas gustan a partir de las elecciones del usuario. Necesita datos de uso.
- **Clasificador de ingredientes:** adivina la categoría de un ingrediente nuevo. Nunca decidiría sus alérgenos.

Requeriría Python y PyTorch fuera de la app (el stack actual excluye Python) y exportar el modelo o publicarlo como servicio.

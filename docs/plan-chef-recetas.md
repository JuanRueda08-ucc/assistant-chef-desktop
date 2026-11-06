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
- [ ] **Tarea 39. El chef propone:** guardadas, internet o memoria en una sola lista, con «dame otras».
- [ ] **Tarea 40. Receta completa:** generar, validar y cocinar la elegida; sustituye a la tarea 17.
- [ ] **Tarea 41. Mis recetas:** guardar las generadas por cuenta.
- [ ] **Tarea 42. Chat y voz** para pedir todo lo anterior.

## Búsqueda en internet y costos

Comprobado el 2026-11-06 con la clave del autor: Gemini responde sin búsqueda, pero con `google_search` da **429** en `gemini-3.5-flash-lite` y `gemini-3.8-flash`. Hace falta facturación.

- **Activarla:** recarga mínima de **5 USD**, en prepago y **sin recarga automática**. Al llegar a 0 USD, las claves se detienen en vez de cobrar. El saldo no se devuelve y caduca a los 12 meses.
- **Precios:** 5.000 búsquedas gratis al mes y 14 USD por cada 1.000 más; máximo 1.500 al día. Con facturación, el proyecto pasa a plan de pago y también se cobra el texto: `gemini-3.5-flash-lite` 0,30/2,50 USD y `gemini-3.8-flash` 0,75/3,75 USD por millón de tokens de entrada/salida (el segundo se duplica desde el 1 de enero de 2027).
- **Cuándo:** el autor la activará **antes de la tarea 39**; avisarle al llegar. Antes no se usa, y hasta entonces la app usa el modo de memoria.
- **Alternativas revisadas:** OpenAI y Anthropic, 10 USD por 1.000 búsquedas; Grok, unos 5 USD (fuente de terceros); Kimi, 2 a 3 USD; DeepSeek, unos 5 yuanes (fuente de terceros). Se descartan por ahora porque habría que adaptar chat, narración y voz. Las bibliotecas TheMealDB, Spoonacular y Edamam se descartan por idioma, límites o instrucciones ausentes.

## Lo que enseñaron las pruebas con Gemini real (2026-11-06)

- **El modelo no es fiable para la seguridad.** Dijo «he anotado tu alergia» sin llamar a la herramienta, y guardó solo una parte de «soy vegetariano y no como lácteos». Por eso `nota-preferencias.ts` añade al chat lo guardado de verdad, calculado del estado. No depender solo del texto de las instrucciones en nada de seguridad: las recetas generadas (tareas 39 y 40) necesitan la misma red de seguridad en código.
- **Saturación:** `gemini-3.8-flash` responde 503 o tarda más de 80 s. Tras un fallo se usa `gemini-3.5-flash-lite` durante 5 minutos, lo que bajó el chat de 10–29 s a unos 3–6 s, con algún turno más lento (hasta 14 s).
- **Límite por minuto:** varias peticiones seguidas dan 429 en el plan gratis. Tenerlo en cuenta al proponer varias recetas. Puede cambiar con la facturación.

## Pendiente con el autor

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

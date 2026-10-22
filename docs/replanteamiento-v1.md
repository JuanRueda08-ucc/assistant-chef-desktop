# Replanteamiento de la v1

**Fecha:** 2026-10-20, con aclaración del autor en la decisión 0012. Organización de las pantallas existentes conservando su diseño; no se volverán a hacer maquetas del flujo completo. Describe trabajo pendiente de implementación.

## Lo que pidió el autor

- Selección libre de múltiples ingredientes: buscar y añadir sin depender de las categorías o del catálogo pequeño de la semilla.
- Conservar el diseño Mostaza y organizar mejor las pantallas: la interfaz actual resulta dispersa y cuesta localizar los elementos, especialmente al continuar una receta. No se pide una nueva identidad ni una conversión al minimalismo.
- Añadir login y registro con **cuentas reales**, requisito del profesor. El autor confirmó que la tecnología es libre.
- Anotar que **el autor todavía no ha probado el flujo de voz de Gemini con su micrófono**. Las comprobaciones técnicas del agente no sustituyen esa prueba.

## Criterio de organización

La persona está preparando comida o cocinando y necesita saber qué hacer a continuación. El paso o la tarea actual deben dominar la pantalla. El chef acompaña con instrucciones breves; su tamaño y sus controles deben dejar espacio al contenido.

Se conservan el chef, los colores, las tipografías, los componentes y el carácter visual Mostaza. El trabajo consiste en agrupar elementos relacionados, alinear bloques, ajustar espacios y establecer posiciones predecibles para las acciones. La jerarquía se comprueba sobre la app existente, pantalla por pantalla; no requiere repetir maquetas del flujo completo. Los formularios nuevos de acceso seguirán el mismo diseño.

| Pantalla o estado | Lo principal | Información o acciones bajo demanda |
|---|---|---|
| Iniciar sesión | Formulario de acceso y una acción «Entrar» | Enlace a registro, recuperación y errores del acceso |
| Registro | Crear una cuenta real con campos mínimos | Enlace para volver a iniciar sesión |
| Retomar, si existe una receta en curso | Nombre, paso pendiente y «Continuar receta» | Preparar otra receta; el micrófono sigue apagado al entrar |
| Preparar | Buscador, ingredientes añadidos y «Buscar recetas» | Preferencias agrupadas; resumen visible de porciones y restricciones activas |
| Elegir | Comparar recetas por nombre, tiempo e ingredientes que faltan | Vista previa con ingredientes, cantidades y detalles; una acción para empezar |
| Cocinar | «Paso N de M», instrucción actual y «Listo, siguiente» | Ingredientes del paso, técnica, sustituciones y conversación en controles con nombres claros |
| Final | Confirmación de receta terminada y siguiente acción | Resumen de la sesión |

En Cocinar, Atrás y Repetir mantienen una posición predecible y menor peso que avanzar. Los temporizadores activos y sus avisos siguen visibles. Los controles de micrófono y narración deben distinguirse claramente y mostrar su estado. El chat estará disponible mediante una entrada identificable, sin exigir una franja y un historial permanentes que compitan con el paso. Técnicas, ingredientes y temporizadores deben encontrarse por su nombre, sin depender de adivinar iconos.

Preparar no debe convertirse en un formulario largo de preferencias; las restricciones activas deben poder verse y corregirse aunque el panel de preferencias esté cerrado. Elegir necesita una comparación clara, evitando que grandes cápsulas decorativas y el avatar ocupen más espacio que la receta.

## Ingredientes libres

El usuario debe poder añadir uno, varios o seguir buscando sin perder su lista, tanto desde el buscador como diciéndoselo al chef por chat. Ambas entradas deben modificar la misma selección visible y permitir corregirla. La semilla actual de trece ingredientes es un dato de prueba, no el alcance del producto. Las categorías pueden servir como ayuda opcional.

El flujo deseado es: construir la lista por búsqueda o chat → revisar y decidir los ingredientes → buscar y elegir receta → recibir la guía paso a paso del chef. Mencionar un ingrediente en el chat no debe iniciar una receta automáticamente. El chef puede ayudar a concretar la selección antes de cocinar. Implementado el 2026-10-22 (tarea 28, decisión 0015): buscador con varios ingredientes, elementos «sin identificar» y chat que aplica lo reconocido.

Básicos de despensa: se descartó la propuesta de contarlos solo si se añaden. Sal, aceite, pimienta y agua se siguen dando por hechos y la interfaz los muestra aparte (decisión 0014, 2026-10-22).

Un ingrediente que aún no esté en el catálogo no debe desaparecer ni ser sustituido silenciosamente por otro. La implementación deberá separar el texto introducido de su identificación normalizada, resolver sinónimos/duplicados y pedir precisión cuando haya ambigüedad. La lista del usuario puede aceptar un ingrediente pendiente de identificar; la generación y el cálculo de etiquetas requieren datos validados. No se inventarán alérgenos o dietas para completar un ingrediente desconocido.

«Sin limitación» significa que la experiencia no queda encerrada en una lista de prueba o un número artificial de ingredientes. Los límites técnicos de transporte se tratarán con paginación o procesamiento por lotes, conservando la lista completa del usuario.

Los tipos, esquemas, persistencia, herramientas y generación se diseñarán juntos. La tarea 17 deberá consumir este contrato, para evitar rehacer la generación después.

## Autenticación real

El requisito confirmado es crear cuentas, iniciar sesión, conservar una sesión válida y cerrar sesión. Un formulario que solo cambie la pantalla o acepte cualquier contraseña no cumple el requisito.

Antes de integrar el proveedor de identidad se concretarán:

- Registro, acceso, recuperación y estados de error.
- Persistencia segura de la sesión en Electron y su vencimiento.
- Validación del usuario en el backend de IA; `X-Instalacion` es un identificador de uso, no autenticación.
- Qué preferencias y sesión de cocina pertenecen a cada cuenta; qué se restaura al volver y qué ocurre al cambiar de usuario.
- Comportamiento sin conexión y al cerrar sesión durante una receta, sin perder o mezclar datos de cuentas.

La tecnología queda a elección de implementación, según lo confirmado por el autor. Se documentará el proveedor y la persistencia elegidos antes de integrarlos. Las cuentas entran en v1; la sincronización entre dispositivos continúa fuera de alcance salvo nuevo requisito.

La investigación inicial de Supabase Auth, Firebase Authentication y Better Auth, con fuentes oficiales y sus implicaciones en Electron, está en `autenticacion-opciones.md`. El autor ha dejado **Better Auth y Supabase Auth** como finalistas para comparar después. Todavía no se ha elegido ni instalado un proveedor.

## Prueba de voz y repetición pendiente

El 2026-10-21 el autor comunicó su primera prueba: funcionamiento irregular, preguntas confundidas con órdenes, cambios inesperados de paso, dificultad de confirmación y error en el chat. Se registró como prueba realizada, sin aceptación. Las correcciones y la separación de modos aprobada están en 0013; falta repetir la prueba (34) en un lugar adecuado. Mientras está en público no se le pide hablar ni se abre su micrófono para comprobar el código.

La conexión técnica ya se comprobó con Google: chat, TTS, token efímero y audio Live con el cliente de la app. Falta que el autor pruebe y valore:

- Encontrar los controles de voz, activar el micrófono y reconocer su estado.
- Decir «Chef» y hacer una pregunta abierta sobre un paso.
- Avanzar con una orden local y escuchar la narración del siguiente paso.
- Entender cuándo se usa Gemini y cuándo el respaldo local.
- Calidad y gusto de la voz, latencia, errores y funcionamiento en una cocina real.

No marcar esta aceptación como completada basándose en los tests o en una conexión de audio ejecutada por el agente.

## Secuencia de trabajo

1. Repetir la prueba personal tras corregir las incidencias recibidas el 2026-10-21. Hacerlo cuando el autor pueda hablar en un lugar adecuado. Atender los problemas observados antes de reorganizar Retomar/Cocinar; las comprobaciones técnicas no sustituyen su aceptación.
2. Concretar los ajustes de agrupación y jerarquía sobre las pantallas existentes, empezando por retomar y Cocinar, donde el autor detectó dispersión. Conservar Mostaza y comprobar en la app si se localizan las acciones, sin repetir maquetas del conjunto.
3. Definir el contrato de ingredientes libres y comparar Better Auth con Supabase Auth para concretar el diseño técnico de autenticación; mantener las herramientas y el estado de cocina como fuente de verdad.
4. Aplicar la organización por pantalla e implementar selección y autenticación en entregas pequeñas, con sus pruebas y documentación.
5. Continuar recetas generadas (17), recetas revisadas y entrega sobre el flujo revisado.

El código actual sigue siendo el prototipo funcional. Las casillas de implementación completadas indican lo construido, no la aceptación visual o de voz por parte del autor.

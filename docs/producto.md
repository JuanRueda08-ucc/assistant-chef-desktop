# Producto

## Problema
Cocinar siguiendo una receta en pantalla obliga a tocar el dispositivo con las manos sucias, perder el paso y calcular cantidades a mano. Las apps de recetas son listas de texto; los asistentes de voz genéricos no saben en qué paso estás.

## Propuesta
Un chef digital que sabe qué receta estás haciendo, en qué paso vas y qué temporizadores corren. Le hablas ("siguiente", "¿puedo usar aceite en vez de mantequilla?", "somos seis") y actúa sobre la receta, no solo responde.

## Usuarios
Personas que cocinan en casa con lo que tienen, con poca experiencia o poco tiempo, que quieren manos libres mientras cocinan.

## Alcance v1
- Selección libre de múltiples ingredientes, por búsqueda o chat (sin foto), sin depender del catálogo pequeño de prueba. Revisar la lista antes de elegir receta y recibir la guía de cocina. Contrato e implementación pendientes.
- Porciones, restricciones y alergias, tiempo máximo, nivel y equipo.
- Recetas de una base revisada; generadas solo si no hay coincidencia, siempre etiquetadas.
- Modo cocina con voz, temporizadores con nombre, técnicas y sustituciones.
- Avatar 2D (Rive) con cuatro estados.
- Cuentas reales: registro, inicio de sesión, sesión persistente y cierre de sesión, requisito del profesor confirmado por el autor el 2026-10-20. Tecnología libre; implementación pendiente.
- Organizar las pantallas existentes para hacer localizables las acciones, conservando el diseño Mostaza y sin repetir maquetas del flujo completo; ver `replanteamiento-v1.md` y decisiones 0011–0012.

## Fuera de la v1
Reconocer ingredientes por foto, sincronización entre dispositivos, avatar 3D, modo sin conexión completo, versión móvil.

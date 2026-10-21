# 0011 · Replanteamiento de pantallas y cuentas reales en v1

**Fecha:** 2026-10-20

**Contexto:** tras probar el prototipo, el autor pide recuperar la selección libre de ingredientes, considera que las pantallas están sobrecargadas y cuesta localizar acciones al continuar una receta, y añade login/registro por requisito del profesor. Confirma cuentas reales y tecnología libre. La prueba de voz con su micrófono sigue pendiente.

**Decisión:**
- Actualizar el alcance de v1 para incluir autenticación real y replantear el flujo antes de continuar con recetas generadas. La tecnología de identidad y la persistencia por cuenta se concretarán en la implementación; no se elige un proveedor en este documento.
- Preparar nuevas maquetas de acceso, selección, elección, cocina, retomar y final, con una acción principal por pantalla y controles secundarios localizables bajo demanda. La identidad de 0005 es el punto de partida; este documento reabre la distribución de las pantallas, sin aprobar una paleta o tipografía nueva.
- La selección debe admitir múltiples ingredientes introducidos libremente. El catálogo interno ayudará a normalizar y validar, sin convertirse en una lista cerrada para el usuario. La representación de ingredientes pendientes, su persistencia y validación requieren concretar el contrato antes de implementar la generación.
- La aceptación visual y la prueba real de voz del autor se registran por separado de las verificaciones técnicas y de las tareas ya implementadas.
- El plan de trabajo y los criterios propuestos están en `docs/replanteamiento-v1.md`.

**Consecuencias:** se sustituye la exclusión de cuentas del alcance de producto anterior. La sincronización entre dispositivos sigue pendiente fuera de v1. La arquitectura de 0006 necesitará integrar validación de usuarios; `X-Instalacion` no basta como identidad autenticada. Los contratos actuales de ingredientes y la suposición de despensa son provisionales hasta completar su revisión. Electron/Svelte/SQLite, Gemini, Vosk, herramientas validadas y la confirmación desde la app continúan vigentes.

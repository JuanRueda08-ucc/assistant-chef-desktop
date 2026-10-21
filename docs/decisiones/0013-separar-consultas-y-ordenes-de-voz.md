# 0013 · Separar consultas abiertas y órdenes locales

**Fecha:** 2026-10-21

**Contexto:** en la prueba personal, el autor consiguió activar «Chef», pero algunas preguntas se confundían con «repetir» o «atrás», la navegación resultaba irregular y costaba confirmar pasos. El audio de la consulta abierta seguía pasando por la gramática cerrada de Vosk. El autor aprobó explícitamente separar ambos modos: «Sí, separar preguntas y órdenes locales».

**Decisión:**
- Mantener Vosk para la escucha local de «Chef» y órdenes cortas. Sin activación, no se transmite audio a Gemini.
- Tras «Chef» o «Hablar al chef», capturar la pregunta completa sin enviarla a la gramática cerrada. Una pausa de voz delimita la consulta, con un máximo de ocho segundos de audio en memoria. No se graba el micrófono a disco.
- Al terminar la respuesta y su reproducción, volver a órdenes locales, incluso si el modelo acabó con una pregunta. Una nueva consulta requiere otra activación explícita. Dentro de una consulta abierta, decir «listo» no constituye confirmación local.
- Mantener `confirmado: false` para todas las herramientas del modelo. Añadir al intérprete local frases completas de confirmación («ya está», «ya terminé», «hecho», «paso completado»), además de «listo» y «siguiente». Las negaciones y frases desconocidas no confirman.
- Descartar resultados locales y de Live si la sesión o el paso cambió mientras esperaban. Silenciar o narrar otro paso cancela la consulta pendiente.

**Consecuencias:** reemplaza la clasificación local de todas las frases durante una consulta abierta de 0008 y la apertura automática de escucha después de preguntas de 0007–0008. Conserva Gemini, Vosk, aislamiento de Electron, IPC validado, narración natural con respaldo local y confirmaciones controladas por la app. Reduce conflictos entre preguntas y gramática; no convierte la confianza de Vosk en una garantía de acierto ni completa la aceptación de voz del autor.

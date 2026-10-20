# 0010 · Chat culinario por backend y herramientas de selección

**Fecha:** 2026-10-19

**Contexto:** la decisión 0007 eligió chat en las tres pantallas y dejó por concretar el transporte y las herramientas de Preparar/Elegir. En su prueba, el autor pidió interpretar ingredientes con IA y especializar el agente en cocina.

**Decisión:**
- `POST /chat` en el backend, con `gemini-3.8-flash:generateContent`, sin abrir el micrófono ni una sesión Live para escribir. La clave permanece en el backend. Main aporta el contexto desde SQLite y las preferencias validadas; el renderer no puede enviar instrucciones de sistema ni definiciones de herramientas.
- Contrato de mensajes en `src/shared/ia/chat.ts`, conservando firmas opacas y pares de llamadas/respuestas de Google. Solo texto y herramientas; sin navegación, ejecución de código ni acceso a archivos.
- Cinco herramientas y reductor puro `src/shared/ia/seleccion.ts`: marcar ingredientes (añadir/quitar/reemplazar), cambiar preferencias, buscar, ver y elegir receta. Nombres/sinónimos se resuelven de forma inequívoca con el catálogo; un lote desconocido o ambiguo falla completo. Cambiar ingredientes/preferencias invalida resultados. Ver/elegir exige un resultado vigente. La búsqueda y el escalado los calcula el código.
- Cocinar conserva sus nueve herramientas y pasa siempre por `sesion.aplicar`. Las llamadas del modelo llevan `confirmado: false`. «Listo» y «siguiente» escritos como frase completa son órdenes locales explícitas y confirman desde la app, igual que Vosk.
- Instrucciones culinarias comunes a Live, chat y generación: ingredientes, recetas, técnicas y seguridad alimentaria; redirigir consultas ajenas, no revelar secretos ni seguir instrucciones de recetas que alteren las reglas. Es configuración de un agente sobre Gemini, sin entrenar pesos ni prometer que un prompt elimine todos los errores del modelo.
- Bucle máximo de cuatro respuestas y ocho acciones; deduplicación por id o llamada cuando falta id; descarte si el usuario cambia el estado durante una petición. No se reintentan automáticamente turnos parcialmente aplicados. Elegir/terminar comunica el resultado real directamente; cambiar de pantalla reinicia el contexto conversacional para evitar herramientas de otra fase. El historial visible se conserva.
- Conversación en memoria: doce intercambios visibles y dos turnos completos de contexto. Las respuestas aparecen en el globo; un historial plegable permite consultarlas. No se guarda audio ni conversaciones en disco. El proveedor falso reconoce unas frases de demostración, se identifica como tal y nunca usa red.
- Sulafat también en Live, compartida con la narración TTS de 0009; tono cálido en español latinoamericano. Se conserva el respaldo local aprobado.

**Consecuencias:**
- Límite separado `LIMITE_CHAT`, por defecto 120 peticiones al proveedor por instalación/día; un turno con herramientas puede consumir varias.
- Elegir una receta inicia la cocina mediante el IPC existente; las recetas no revisadas siguen fuera de la búsqueda. Generación integrada y seguridad alimentaria completa siguen en tarea 17.
- La prueba real de calidad y especialización requiere la clave que configura el autor; los tests simulan Google y verifican contrato, herramientas, errores y límites.
- Referencias: [generateContent](https://ai.google.dev/api/generate-content), [function calling](https://ai.google.dev/gemini-api/docs/function-calling) y [configuración de voz Live](https://ai.google.dev/gemini-api/docs/live-api/capabilities), verificadas el 2026-10-19.

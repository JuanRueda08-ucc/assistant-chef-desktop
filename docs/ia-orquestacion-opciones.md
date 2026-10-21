# Vosk, LangChain y LangGraph: capacidades y encaje

Investigación del 2026-10-21 con documentación oficial de JavaScript/TypeScript. Es una evaluación, sin adopción de dependencias ni cambio de las decisiones vigentes. El reconocimiento de voz, la interpretación de la petición y la ejecución de herramientas son responsabilidades distintas.

## Vosk y los comandos añadidos

Vosk es reconocimiento de voz sin conexión: convierte audio en texto. Su API permite un reconocedor general (`vosk_recognizer_new`) y otro con lista de frases (`vosk_recognizer_new_grm`). Una lista restringida puede favorecer velocidad y precisión para vocabularios pequeños; también puede devolver `[unk]` ante otras palabras. Fuentes: [Vosk](https://alphacephei.com/vosk/) y [API C oficial](https://github.com/alphacep/vosk-api/blob/master/src/vosk_api.h).

En esta app se elige expresamente la segunda configuración en `src/main/voz/nativo.ts`. La gramática viene de `FRASES_ORDENES`, variantes con «chef» y `[unk]`. El intérprete solo convierte las frases completas conocidas en acciones. Añadir una frase permite otra orden; no equivale a comprender cualquier expresión con el mismo significado. Transcripción libre también necesitaría una etapa que interprete el texto y valide qué acción se pidió.

Con la decisión 0013, una pregunta activada por «Chef» o el botón va a Gemini sin pasar por esa gramática; al terminar vuelve a órdenes locales. No necesitamos enumerar todas las preguntas que alguien puede hacer al chef. Una futura ampliación del reconocimiento general exigiría medir precisión, latencia y falsos positivos; no se realiza con esta investigación.

## Qué aporta cada biblioteca

| Biblioteca | Responsabilidad | Posible utilidad aquí |
|---|---|---|
| LangChain | Abstracciones para modelos, herramientas, mensajes y bucles de agente, con middleware | Simplificar integraciones del chat si aumentan proveedores y políticas |
| LangGraph | Organizar nodos y transiciones de un flujo con estado, mezclando código determinista y llamadas al modelo | Hacer explícito un proceso de generación, validación, corrección y respuesta |

LangChain ofrece `createAgent` y herramientas con esquemas. Sus agentes actuales usan LangGraph internamente. Una biblioteca no sustituye al modelo Gemini ni implica entrenarlo. Fuente: [LangChain para TypeScript](https://docs.langchain.com/oss/javascript/langchain/overview).

LangGraph se puede usar sin adoptar los agentes de LangChain. Tiene control de flujo, persistencia e interrupciones para esperar entrada externa. Fuente: [LangGraph para TypeScript](https://docs.langchain.com/oss/javascript/langgraph/overview).

La persistencia necesita configuración: `MemorySaver` conserva datos en RAM y no sobrevive a reinicios; se requiere almacenamiento persistente para retomarlos después. Fuente: [persistencia](https://docs.langchain.com/oss/javascript/langgraph/persistence). Además, al reanudar una interrupción puede volver a ejecutarse su nodo: sus efectos necesitan protección contra duplicados. Fuente: [interrupciones](https://docs.langchain.com/oss/javascript/langgraph/interrupts). En nuestra app esto exige conservar las garantías de confirmación y no repetir acciones de cocina al reanudar.

## Evaluación sobre el código existente

El proyecto ya tiene `ProveedorIA`, herramientas Zod/JSON Schema, bucle de herramientas en `src/renderer/lib/chat.ts`, deduplicación y contexto, y un reductor de cocina persistido en SQLite. No parte de cero. Cambiar a una biblioteca no elimina la necesidad de esas reglas ni soluciona por sí solo reconocimiento acústico, navegación tardía o disponibilidad de Google. Esta es una valoración del proyecto, no un resultado de rendimiento medido con las bibliotecas.

**LangChain:** sería útil si crecen las integraciones o el mantenimiento del bucle. Ahora duplica parte de las abstracciones que ya tenemos. Para una evaluación nueva con Gemini, la documentación recomienda `ChatGoogle` de `@langchain/google`; el adaptador anterior `@langchain/google-genai` anuncia su sustitución. Fuentes: [ChatGoogle](https://docs.langchain.com/oss/javascript/integrations/chat/google) y [aviso del adaptador anterior](https://docs.langchain.com/oss/javascript/integrations/chat/google_generative_ai).

**LangGraph:** candidato más interesante si la tarea 17 aumenta en complejidad. Podría compararse un flujo de backend que reciba el catálogo y las preferencias, genere una receta, aplique las validaciones existentes y corrija el resultado con un límite explícito. No requiere trasladar la sesión de cocina al grafo. Esta propuesta es una inferencia de diseño; no está implementada ni elegida.

Las herramientas que actúan sobre la app seguirían pasando por main/IPC y el reductor; el servidor no tiene acceso directo al SQLite local. Un agente de backend con herramientas ejecutables no sustituye automáticamente ese recorrido. El estado de un grafo tendría que describir la consulta en curso, sin competir con `SesionCocina` como fuente de verdad.

La documentación consultada de `ChatGoogle` cubre chat, herramientas y contenido multimodal; eso no comprueba equivalencia con nuestro WebSocket bidireccional de Gemini Live ni con sus tokens efímeros. No se plantea envolver el transporte de voz en una cadena o grafo como parte de esta evaluación.

## Recomendación

Mantener por ahora las correcciones de voz y completar la repetición de la prueba personal. Evaluar LangGraph de forma aislada al concretar generación/validación de recetas si el flujo lo justifica. Antes de adoptar, comparar con la solución actual: complejidad, latencia, coste por consulta, persistencia, errores y acciones duplicadas. LangChain puede aportar componentes si hacen falta, sin necesidad de migrar toda la app. Una adopción que altere los contratos actuales requerirá una decisión posterior.

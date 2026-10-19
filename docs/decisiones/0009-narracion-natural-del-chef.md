# 0009 · Narración automática con voz natural y respaldo local

**Fecha:** 2026-10-19

**Contexto:** al probar Cocinar, el autor observó que el chef solo hablaba al pulsar Repetir y rechazó la voz del sistema. Eligió expresamente «Gemini con voz natural y respaldo local sin conexión».

**Decisión:** sustituir la regla de repetición exclusivamente local de 0008 por narración Gemini TTS para el texto exacto del paso. Leer al entrar en Cocinar y al cambiar de paso; Repetir usa el mismo camino. El backend usa `gemini-3.8-flash-tts` por Interactions, voz Sulafat y estilo cálido en español latinoamericano. Main toma el texto del paso vigente en SQLite, valida ids, solicita `/voz/narrar` y conserva hasta doce audios en memoria. Nunca transmite la clave al renderer.

Si no hay proveedor real, conexión o audio válido, repetir con el lector del sistema y mostrar el uso del respaldo. La narración no abre el micrófono. Un cambio de paso, salida o silencio cancela la reproducción; los resultados tardíos no se reproducen. La voz puede silenciarse sin apagar Vosk.

**Consecuencias:** la lectura natural necesita clave y disponibilidad de Google; el respaldo conserva el funcionamiento sin conexión. Repetir audio ya recibido reutiliza la caché. Siguen pendientes la prueba de voz real, el ajuste de gusto y la medición de latencia. Vosk, Gemini Live y el aislamiento de Electron no cambian. Reemplaza solo la decisión de usar siempre el lector local para repetir de 0008.

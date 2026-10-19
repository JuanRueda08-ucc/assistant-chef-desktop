# 0008 · Integración nativa de Vosk y turnos Live

**Fecha:** 2026-10-19

La regla de repetición exclusivamente local fue reemplazada, con aprobación del autor, por [0009](0009-narracion-natural-del-chef.md): narración automática Gemini y lector local de respaldo. El resto de esta decisión sigue vigente.

**Contexto:** implementar las tareas 15–16 manteniendo Gemini Live y Vosk (0007), el renderer aislado y el contrato de confirmación (0004). Las órdenes cortas deben funcionar sin red y no producir efectos duplicados por llegar también al modelo.

**Decisión:**
- API C oficial de Vosk mediante Koffi, en un worker de Node controlado por main. Se ha verificado en Electron/Windows con el modelo español y una orden sintetizada; no se usa `ffi-napi` ni otro motor. AudioWorklet en el renderer, PCM16 mono a 16 kHz por IPC acotado. El worker libera los recursos C antes de cerrarse.
- `tools/preparar-voz.mjs` descarga el modelo español 0.42 y las bibliotecas oficiales (0.3.45 Windows/Linux, 0.3.42 universal macOS), comprueba SHA-256 y prepara `resources/voz/`. Recursos ignorados en Git y copiados fuera de ASAR con electron-builder; Koffi se desempaqueta. Caché reutilizable sin red.
- Primero se clasifica la frase en Vosk. Después de «Chef», o durante los ocho segundos posteriores a una pregunta, se conserva hasta ocho segundos de PCM en memoria y se envía la consulta abierta a Gemini Live al acabar la frase. Una orden corta se aplica en local y ese audio no llega a Google. No se guardan grabaciones.
- Gemini conecta directamente desde el renderer a `v1beta` con token efímero obtenido por main. Audio de salida y transcripción se reciben en streaming. Herramientas validadas, ejecutadas en serie y deduplicadas por id; cancelaciones pendientes respetadas. Siempre `confirmado: false` para el modelo.
- Repetición con el sintetizador instalado del sistema (SAPI/`say`/`espeak-ng`), sin Web Speech ni IA. Si no existe, el texto permanece en el globo y se informa.

**Consecuencias:** la detección local añade el tiempo de fin de frase antes de enviar consultas abiertas; medir en cocina (20). Se limita la consulta a ocho segundos y se vuelve a escucha local después de responder, salvo que el chef pregunte. Micrófono explícito y solo en Cocinar; errores de red conservan botones y órdenes locales. Windows está comprobado también desde el ejecutable empaquetado con captura simulada; macOS/Linux y conversación real con Google siguen pendientes de validación. Esta decisión complementa 0007, no la reemplaza.

# 0020 · Botón «Hablar» en el chat de Preparar y Elegir

**Fecha:** 2026-11-07

**Contexto:** el autor quiere pedir ideas y recetas también por voz (tarea 42). Hasta ahora solo Cocinar podía abrir el micrófono (0007, 0008 y 0013). El autor eligió esta opción frente a dejar solo el chat fuera de Cocinar.

**Decisión:**
- **Excepción acotada a «solo Cocinar abre el micrófono»:** en Preparar y Elegir, el chat ofrece «Hablar». El micrófono se abre al pulsarlo y se cierra solo tras una pausa, a los ocho segundos o al cerrar el chat. Nunca queda escuchando. En Cocinar nada cambia.
- **Permiso en main:** `dictado.activo` permite el micrófono solo durante esa frase y caduca a los 15 s aunque la ventana no lo retire.
- **Transcripción con Gemini:** `POST /voz/transcribir` recibe un WAV en memoria y devuelve el texto. Se usa `generateContent`, no Live ni Vosk, porque Vosk tiene gramática cerrada. No se guarda audio ni transcripción en disco; el audio se envía a Google.
- **Mismo camino que escribir:** el texto entra por `enviarChat`, con las mismas herramientas y comprobaciones. La respuesta es de texto.

**Consecuencias:** reemplaza en ese único caso la regla de 0013. Cada frase consume una petición del grupo `voz`, además de las del chat. La respuesta no se lee en voz alta.

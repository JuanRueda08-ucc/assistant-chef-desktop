# 0001 · Stack de la v1

**Fecha:** 2026-10-16

**Contexto:** app de escritorio para tres SO cuyo núcleo es micrófono, audio, animación y voz. La propuesta inicial incluía Tauri, Python/FastAPI y YOLO.

**Decisión:** Electron + Svelte + TypeScript + Vite (sin SvelteKit); SQLite local; IA por API con herramientas detrás de un backend serverless; voz en tiempo real por API (no Web Speech API); avatar Rive 2D detrás de una interfaz de estados. Sin Python ni visión en la v1.

**Consecuencias:** mismo Chromium en todos los SO; instaladores de ~100 MB; necesidad de un backend mínimo para la clave; el avatar puede pasar a 3D (Threlte/VRM) sin cambiar el resto.

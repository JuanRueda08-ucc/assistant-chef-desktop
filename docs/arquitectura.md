# Arquitectura

```
┌──────────── Electron ─────────────────────────────┐
│ Renderer (Svelte)          Main (Node)            │
│  pantallas, avatar,  ⇄IPC⇄  SQLite, sesiones,     │
│  audio/micrófono    preload  persistencia         │
│        │                                          │
│  src/shared: tipos, escalado, búsqueda,           │
│  reductor de sesión (usado por ambos)             │
└────────┼──────────────────────────────────────────┘
         │ HTTPS
   server/ (serverless) ── proveedor de IA y voz
```

## Responsabilidades
- **Main:** abre la ventana, posee la base SQLite (`chef.sqlite` en la carpeta de datos del usuario; esquema y semillas se aplican en cada arranque) y guarda `SesionCocina` en cada cambio. Expone canales IPC tipados (`recetas:buscar`, `sesion:aplicar`, etc.). Implementados (contrato en `src/shared/types/ipc.ts`):
  - `catalogo:ingredientes`: el catálogo completo, para Preparar.
  - `recetas:listar`, `recetas:obtener` y `recetas:buscar`. La búsqueda carga recetas, catálogo y sustituciones de la base y llama a `buscarRecetas` de shared.
  - `sesion:retomar`, `sesion:iniciar` y `sesion:aplicar`, en `src/main/cocina.ts`. Cargan el contexto de la base, llaman al reductor y guardan.
- **Preload:** `contextBridge` con una API mínima y tipada; el renderer no ve Node.
- **Renderer:** interfaz, avatar y audio. La sesión de voz en tiempo real se abre desde aquí con un token efímero del backend.
  - `voz/`: AudioWorklet de captura, reproducción PCM, controlador de activación local y WebSocket Live. Solo existe captura en Cocinar con el micrófono activado; se destruye al salir. Clasifica primero en Vosk y envía a Live únicamente consultas abiertas tras activación.
  - Main aloja el reconocimiento Vosk en un worker de Node (`src/main/voz/`) con Koffi y recursos externos a ASAR. El audio cruza IPC validado y acotado; SQLite sigue exclusivamente en main. Un lector local del sistema repite el paso sin modelo ni red. Ver decisión 0008.
- **Shared:** lógica pura. El reductor `aplicarHerramienta(sesion, llamada, ahora, contexto) → { sesion, resultado, avatar }` (`src/shared/cocina/aplicar.ts`) es el único sitio donde cambia el estado de cocina; lo usan los botones, las órdenes locales y las llamadas del modelo.
- **Server:** guarda la clave del proveedor, emite tokens de voz, genera y valida recetas, sugiere sustituciones, limita uso. Manejador `Request → Response` en `server/src/app.ts` con el proveedor detrás de `ProveedorIA` (decisión 0006).

## Flujo de una orden de voz
1. El micrófono capta "pon un temporizador de 10 minutos para la pasta".
2. Si es una orden corta conocida, se resuelve en local. Si no, va al modelo de voz con el contexto de la sesión.
3. El modelo llama `iniciar_temporizador({ segundos: 600, etiqueta: "Pasta" })`.
4. El reductor valida, actualiza la sesión, Main la persiste y devuelve el resultado.
5. El modelo habla con el `decir` del resultado; el avatar pasa a `senalar(temporizadores)` y luego `hablar`.

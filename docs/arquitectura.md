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
- **Main:** abre la ventana, posee la base SQLite (`chef.sqlite` en la carpeta de datos del usuario; esquema y semillas se aplican en cada arranque) y guarda `SesionCocina` en cada cambio. Expone canales IPC tipados (`recetas:buscar`, `sesion:aplicar`, etc.). Implementados: `recetas:listar`, `recetas:obtener` y `recetas:buscar` (contrato en `src/shared/types/ipc.ts`; la búsqueda carga recetas, catálogo y sustituciones de la base y llama a `buscarRecetas` de shared).
- **Preload:** `contextBridge` con una API mínima y tipada; el renderer no ve Node.
- **Renderer:** interfaz, avatar y audio. La sesión de voz en tiempo real se abre desde aquí con un token efímero del backend.
- **Shared:** lógica pura. El reductor `aplicarHerramienta(sesion, llamada) → { sesion, resultado }` es el único sitio donde cambia el estado de cocina; lo usan tanto las órdenes locales como las llamadas del modelo.
- **Server:** guarda la clave del proveedor, emite tokens de voz, genera y valida recetas, sugiere sustituciones, limita uso.

## Flujo de una orden de voz
1. El micrófono capta "pon un temporizador de 10 minutos para la pasta".
2. Si es una orden corta conocida, se resuelve en local. Si no, va al modelo de voz con el contexto de la sesión.
3. El modelo llama `iniciar_temporizador({ segundos: 600, etiqueta: "Pasta" })`.
4. El reductor valida, actualiza la sesión, Main la persiste y devuelve el resultado.
5. El modelo habla con el `decir` del resultado; el avatar pasa a `senalar(temporizadores)` y luego `hablar`.

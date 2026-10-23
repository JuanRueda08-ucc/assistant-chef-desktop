# Arquitectura

**Cuentas y despliegue (0017):** Supabase Auth gestiona cuentas, códigos por correo y JWT. Main (`src/main/cuenta.ts`) habla con `/auth/v1` con la clave publicable, guarda JWT y refresh token cifrados con `safeStorage`, renueva el JWT y lo envía como `Authorization: Bearer`; el renderer solo ve `EstadoCuenta` por `cuenta:*` y muestra Acceso hasta entrar. El backend corre como Edge Function `chef` de Supabase (`server/src/edge.ts`), verifica el JWT con el JWKS del proyecto y cuenta el uso diario en la tabla `uso_diario`. Las sesiones de cocina de `chef.sqlite` llevan `usuario_id`. `X-Instalacion` se mantiene, pero no autentica. La sincronización entre dispositivos continúa fuera del alcance acordado.

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
  - `voz/`: AudioWorklet de captura, reproducción PCM, controlador de activación local y WebSocket Live. Solo existe captura en Cocinar con el micrófono activado; se destruye al salir. En modo local Vosk reconoce órdenes y «Chef»; tras activación, la consulta abierta va a Gemini sin pasar por la gramática y al terminar vuelve a órdenes locales (0013).
  - Main aloja el reconocimiento Vosk en un worker de Node (`src/main/voz/`) con Koffi y recursos externos a ASAR. El audio local cruza IPC validado y acotado; SQLite sigue exclusivamente en main. La narración usa Gemini por backend con lector del sistema como respaldo sin red. Ver decisiones 0008–0009 y 0013.
- **Shared:** lógica pura. El reductor `aplicarHerramienta(sesion, llamada, ahora, contexto) → { sesion, resultado, avatar }` (`src/shared/cocina/aplicar.ts`) es el único sitio donde cambia el estado de cocina; lo usan los botones, las órdenes locales y las llamadas del modelo.
- **Server:** comprueba el JWT de Supabase, guarda la clave del proveedor, emite tokens de voz, genera y valida recetas, sugiere sustituciones, limita uso por cuenta. Manejador `Request → Response` en `server/src/app.ts` con el proveedor detrás de `ProveedorIA` (decisión 0006).

## Flujo de una orden de voz
1. En modo local, el micrófono escucha órdenes cortas y «Chef». Una frase desconocida no se transmite automáticamente.
2. Tras «Chef» o «Hablar al chef», la persona pide "pon un temporizador de 10 minutos para la pasta". Esa consulta va a Gemini con el contexto de la sesión, sin pasar por Vosk.
3. El modelo llama `iniciar_temporizador({ segundos: 600, etiqueta: "Pasta" })`.
4. El reductor valida, actualiza la sesión, Main la persiste y devuelve el resultado.
5. El modelo habla con el `decir` del resultado; el avatar pasa a `senalar(temporizadores)` y luego `hablar`.

Investigación de orquestación en `ia-orquestacion-opciones.md`: LangChain y LangGraph son candidatos evaluados, todavía sin adopción ni cambios del reparto de responsabilidades.

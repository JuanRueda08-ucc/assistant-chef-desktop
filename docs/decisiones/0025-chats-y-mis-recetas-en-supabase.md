# 0025 · Chats y Mis recetas en Supabase, leídos con el JWT de la cuenta

**Fecha:** 2026-11-10

**Contexto:** 0024 decidió guardar los chats con el chef y Mis recetas por cuenta en la nube, no en el equipo, al tener el login. El proyecto de Supabase ya existe y las cuentas funcionan (2026-11-09). Faltaba decidir cómo llegan los datos: por la Edge Function `chef` o directamente desde main contra la base. Además, la búsqueda, el chat y el inicio de la cocina leían Mis recetas de forma síncrona del SQLite local.

**Decisión:**
- **Tablas `chats` y `mis_recetas`** en Supabase (migración `20261110000000_chats_y_mis_recetas.sql`), con `usuario_id` por defecto `auth.uid()`, row level security con una política por tabla (`auth.uid() = usuario_id`) y permisos solo para `authenticated`. Al borrar la cuenta se borran sus filas. Un chat guarda como mucho 12 turnos y su contexto; hay un tope de tamaño por fila.
- **Main habla con PostgREST** (`src/main/datos-cuenta.ts`, `crearDatosNube`) con la clave publicable y el JWT de la persona, igual que con Supabase Auth. No pasa por la Edge Function: RLS ya separa a cada cuenta, y así no se gasta el cupo de IA ni hace falta redesplegar la función. La app nunca envía `usuario_id`.
- **Mis recetas en memoria de main:** se leen de la nube al entrar (`mis-recetas:listar`) y quedan en memoria para la búsqueda, el contexto del chat, `recetas:obtener` y `sesion:iniciar`. Guardar y quitar escriben en la nube y vuelven a leer.
- **Las recetas guardadas antes en el equipo** suben a la cuenta la primera vez que se listan y se borran del SQLite local.
- **Chats:** canales `chats:listar`, `chats:guardar` (upsert del chat entero tras cada turno y al llegar su nombre) y `chats:borrar`, validados con `esquemaChatChef` (`shared/esquemas/chats.ts`). Se listan los 50 más recientes.
- **Sin conexión,** la app sigue funcionando: si no puede leer o guardar, avisa en la lista de chats o con el error de la pantalla. No reintenta sola; el chat se vuelve a guardar con el siguiente mensaje.
- **Sin Supabase** (desarrollo, 0018), `crearDatosLocales`: chats en memoria de main y Mis recetas en el SQLite local, como antes.

**Consecuencias:** cada cambio de chat es una petición pequeña a Supabase; con 12 turnos como mucho, cabe de sobra en el plan gratuito. Las tarjetas de recetas de un chat antiguo no se guardan: al reabrirlo se ofrece «Buscar de nuevo». La despensa, las preferencias y la receta en curso siguen en el equipo, como dice 0024. Hay que aplicar la migración con `npx supabase db push` en cada proyecto.

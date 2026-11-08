# 0024 · Chats con nombre, y chats y recetas guardados por cuenta en la nube

**Fecha:** 2026-11-08

**Contexto:** el autor pidió un historial de chats con el chef, como en los asistentes de conversación: varios chats, cada uno con un nombre que pone la IA según los ingredientes o lo que se pidió. Al preguntarle dónde guardarlos, dijo que no en el equipo. La app se va a desplegar y debe poder **descargarse e instalarse en Windows, Linux y Mac**, porque así tiene que entregarla. Cada usuario debe encontrar sus chats y sus recetas al iniciar sesión.

**Decisión:**
- **Varios chats** (`app.chats`, `ChatChef` en `estado/app.svelte.ts`) en la pantalla de conversación, con una lista a la izquierda: «Nuevo chat», abrir uno anterior y borrarlo. Cada chat guarda sus mensajes y el contexto que se manda al modelo, para seguirlo al volver.
- **Nombre por IA:** con la primera pregunta, la app pide un título a `POST /chat/titulo` (`ProveedorIA.titularChat`, canal `chef:titular`). Usa el mismo grupo de límite que el chat. `limpiarTitulo` (`shared/ia/titulo.ts`) lo deja en una línea de 40 caracteres como máximo. Mientras llega, o si falla, se ve el principio de lo que escribió la persona (`tituloProvisional`).
- **Dónde se guardan:** por cuenta, en **Supabase** (Postgres con *row level security*, de modo que cada usuario solo ve lo suyo), al hacer el login (0017). Pasarán allí los chats y también Mis recetas, que hoy están en el SQLite local (`recetas_usuario`). En el equipo se quedan el catálogo, las semillas y la receta en curso.
- **Mientras no exista el proyecto de Supabase** (aplazado, 0018), los chats viven en memoria y se pierden al cerrar la app, como dice 0010. Al cerrar sesión se borran de la interfaz.

**Consecuencias:** 0010 sigue valiendo para el equipo, que no guarda conversaciones en disco; esta decisión añade el guardado en la nube por cuenta. El trabajo de Supabase queda como tarea 47, junto al login: tablas `chats` y `mis_recetas` con RLS por `auth.uid()`, leer y escribir con el JWT de la cuenta y migrar Mis recetas desde el SQLite local. Los instaladores para los tres sistemas siguen en la tarea 19 y son requisito de entrega.

# 0017 · Cuentas con Supabase Auth y backend como Edge Function de Supabase

**Fecha:** 2026-10-23 · **Sustituye a:** 0016

**Contexto:** con Better Auth (0016) las cuentas vivían en nuestro backend, que había que publicar con disco persistente y correo. El autor no puede pagar alojamiento ni tiene dominio propio. Comparados Railway (5 USD/mes) y Render Free (se duerme, borra el disco y bloquea SMTP), la opción gratuita con Better Auth exigía tres servicios (Render, Neon y Brevo), y los códigos enviados desde un Gmail sin autenticar podían acabar en spam. Las Edge Functions de Supabase bloquean SMTP, pero el correo de Auth lo envía Supabase Auth con su propio SMTP.

**Decisión:**
- **Cuentas:** Supabase Auth. Correo y contraseña con confirmación obligatoria y recuperación por **código** (`{{ .Token }}` en las plantillas «Confirm signup» y «Reset Password»; la app admite 6 a 10 cifras). Supabase envía los correos con el **SMTP de Gmail del autor** (contraseña de aplicación), configurado en su panel.
- **Tokens:** Supabase emite un **JWT de acceso** (1 h por defecto) y un **refresh token** de un solo uso. Main los guarda cifrados con `safeStorage` (`cuenta.bin`) y renueva el JWT cuando le queda menos de un minuto, con una sola renovación a la vez. Salir anula los refresh tokens de esta sesión (`/logout?scope=local`); el JWT emitido sigue valiendo hasta caducar. El renderer nunca ve tokens.
- **Main → Supabase:** REST de `/auth/v1` con la **clave publicable** (`apikey`), pública por diseño. `CHEF_SUPABASE_URL` y `CHEF_SUPABASE_CLAVE_PUBLICA` entran en el bundle de main como `CHEF_API_URL`.
- **Backend:** el mismo manejador `Request → Response` corre como **Edge Function `chef`** (`server/src/edge.ts`, empaquetado por `tools/empaquetar-funcion.mjs` con esbuild). Verifica el JWT con `jose` contra el JWKS del proyecto (`SUPABASE_JWKS` o `/auth/v1/.well-known/jwks.json`): firma, caducidad, emisor `<url>/auth/v1`, audiencia `authenticated`, rol `authenticated` y no anónimo. La verificación de la pasarela se desactiva (`verify_jwt = false`) para responder 401 `no_autenticado` con el formato de la app.
- **Límites diarios:** por cuenta, en la tabla `uso_diario` de Supabase con la función atómica `consumir_cupo` (migración en `supabase/migrations/`), con RLS activado y sin políticas. Solo la función, con la clave secreta, puede llamarla.
- **Desarrollo local:** `npm run server:dev` sigue disponible, con límites en memoria y la verificación del JWT contra el mismo proyecto de Supabase (`CHEF_SUPABASE_URL`).
- **Datos locales:** sin cambios respecto a 0016. `chef.sqlite` guarda las sesiones de cocina por `usuario_id` (ahora el id de Supabase).

**Consecuencias:**
- Desaparecen Better Auth, nodemailer, la base de cuentas del backend y `BETTER_AUTH_SECRET`; las cuentas creadas con Better Auth no se migran. Quien tenga `cuenta.bin` del formato anterior vuelve a Acceso.
- El plan gratuito pausa el proyecto tras una semana sin uso: hay que reactivarlo desde el panel antes de una demostración.
- La clave de Gemini pasa a ser un secreto de la Edge Function (`npx supabase secrets set`), nunca en el repositorio ni en la app.
- Pasos del autor en `docs/despliegue.md`.

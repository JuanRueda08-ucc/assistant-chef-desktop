# Despliegue en Supabase

Cuentas y backend del chef en un solo proyecto gratuito de Supabase (decisión 0017). Lo hace el autor: los secretos (contraseña de la base, contraseña de aplicación de Gmail, clave de Gemini, clave secreta del proyecto) **solo se escriben en los paneles de Supabase y en el `.env` local**, nunca en el repositorio ni en la app.

## 1. Proyecto

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (por ejemplo, `chef-digital`) en la región más cercana. Guarda la contraseña de la base en tu gestor de contraseñas.
2. En **Project Settings → API Keys** copia:
   - la **URL del proyecto** (`https://<ref>.supabase.co`; `<ref>` es el identificador del proyecto);
   - la **publishable key** (`sb_publishable_…`), pública por diseño.
   No copies la **secret key** a ningún sitio: la función la recibe sola.

## 2. Correo de los códigos (Brevo)

El correo propio de Supabase solo envía unos pocos por hora. Se usa **Brevo** (gratis, 300 correos al día, sin dominio propio). Gmail con contraseña de aplicación no sirvió: Google no ofreció la opción en la cuenta del autor (2026-11-09).

1. Crea una cuenta en [brevo.com](https://www.brevo.com) (plan Free).
2. **Remitentes, dominios e IP dedicadas → Remitentes → Añadir remitente**: nombre «Chef digital» y tu Gmail; confírmalo con el correo que te llega. Los avisos de DKIM y DMARC salen por usar un `@gmail.com`: funciona, pero algunos códigos pueden caer en spam hasta tener un dominio propio.
3. **SMTP y API → SMTP → Generar una nueva clave SMTP**: la **estándar** (64 caracteres). Se muestra una sola vez; guárdala en tu gestor de contraseñas.
4. En Supabase, **Authentication → Emails → SMTP Settings**, activa **Enable custom SMTP**:

   | Campo | Valor |
   |---|---|
   | Sender email | el Gmail verificado en Brevo |
   | Sender name | `Chef digital` |
   | Host | `smtp-relay.brevo.com` |
   | Port number | `587` |
   | Username | el **Login** de la pestaña SMTP de Brevo (`…@smtp-brevo.com`, no tu Gmail) |
   | Password | la clave SMTP |

5. **Authentication → Sign In / Providers**: en **User Signups**, **Allow new users to sign up** y **Confirm email** activados. En **Email**: proveedor activado, **Minimum password length** `8`, **Password requirements** «Lowercase, uppercase letters, digits and symbols», **Email OTP length** `6`. La app comprueba esos mismos requisitos (`src/shared/contrasena.ts`) y dice qué falta; si cambias la configuración, cambia también ese archivo.
6. **Authentication → Emails → Templates**: en **Confirm signup** y **Reset Password** pega el asunto y el cuerpo de `supabase/correos/` (ver su `README.md`). Llevan el código (`{{ .Token }}`) en vez del enlace y el dibujo del chef.

## 3. App y backend local

Añade a tu `.env` (ver `.env.example`):

```
CHEF_SUPABASE_URL=https://<ref>.supabase.co
CHEF_SUPABASE_CLAVE_PUBLICA=sb_publishable_...
```

Con eso, `npm run server:dev` y `npm run dev` ya usan cuentas reales. Puedes probar el registro antes de desplegar la función.

## 4. Desplegar la función y la tabla de límites

Desde la raíz del repositorio (la CLI se ejecuta con `npx`, sin instalar nada global):

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

`db push` crea la tabla `uso_diario`, la función `consumir_cupo` y sus permisos para la función del servidor (`service_role`). Los proyectos nuevos de Supabase no dan esos permisos solos: sin la segunda migración, el chat responde «El servicio de IA no pudo responder» y los registros de la función dicen «No se pudo contar el uso (HTTP 403)». Para comprobar qué migraciones están aplicadas: `npx supabase migration list`. Después, los secretos de la función. La clave de Gemini la escribes tú en el comando o en el panel (**Edge Functions → Secrets**):

```bash
npx supabase secrets set PROVEEDOR_IA=gemini
```

```bash
npx supabase secrets set PROVEEDOR_IA_API_KEY=<tu clave de Gemini>
```

Por último, empaqueta y despliega:

```bash
npm run supabase:desplegar
```

## 5. Apuntar la app a la función

En tu `.env`:

```
CHEF_API_URL=https://<ref>.supabase.co/functions/v1/chef
```

Reinicia `npm run dev`. Ya no hace falta `npm run server:dev`; sigue sirviendo para desarrollar el backend en local.

## Mantenimiento

- **Ver errores de la función:** Supabase → **Edge Functions → chef → Logs**. Las líneas rojas dicen qué falló, sin claves ni contraseñas.

- **Pausa por inactividad:** el plan gratuito pausa el proyecto tras una semana sin uso. Antes de una demostración, entra en el panel y reactívalo si está pausado (tarda unos minutos).
- **Cambiar el backend:** después de modificar `server/src/`, vuelve a ejecutar `npm run supabase:desplegar`.
- **Límites diarios:** `LIMITE_CHAT`, `LIMITE_VOZ`, `LIMITE_RECETAS` y `LIMITE_SUSTITUCIONES` se cambian como secretos de la función.

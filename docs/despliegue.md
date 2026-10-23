# Despliegue en Supabase

Cuentas y backend del chef en un solo proyecto gratuito de Supabase (decisión 0017). Lo hace el autor: los secretos (contraseña de la base, contraseña de aplicación de Gmail, clave de Gemini, clave secreta del proyecto) **solo se escriben en los paneles de Supabase y en el `.env` local**, nunca en el repositorio ni en la app.

## 1. Proyecto

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (por ejemplo, `chef-digital`) en la región más cercana. Guarda la contraseña de la base en tu gestor de contraseñas.
2. En **Project Settings → API Keys** copia:
   - la **URL del proyecto** (`https://<ref>.supabase.co`; `<ref>` es el identificador del proyecto);
   - la **publishable key** (`sb_publishable_…`), pública por diseño.
   No copies la **secret key** a ningún sitio: la función la recibe sola.

## 2. Correo de los códigos (Gmail)

1. En tu cuenta de Google activa la verificación en dos pasos y crea una **contraseña de aplicación** (Seguridad → Contraseñas de aplicaciones).
2. En Supabase, **Authentication → Emails → SMTP Settings**: activa el SMTP propio con host `smtp.gmail.com`, puerto `465`, usuario y remitente = tu Gmail, contraseña = la de aplicación, nombre del remitente «Chef digital». Sube el límite de correos por hora si lo necesitas (por defecto es bajo).
3. **Authentication → Sign In / Providers → Email**: activado, con **Confirm email** activado.
4. **Authentication → Emails → Templates**: en **Confirm signup** y **Reset Password** sustituye el enlace por el código:

   ```html
   <h2>Chef digital</h2>
   <p>Tu código es: <strong>{{ .Token }}</strong></p>
   <p>Caduca pronto. Si no lo pediste, ignora este correo.</p>
   ```

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

`db push` crea la tabla `uso_diario` y la función `consumir_cupo`. Después, los secretos de la función. La clave de Gemini la escribes tú en el comando o en el panel (**Edge Functions → Secrets**):

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

- **Pausa por inactividad:** el plan gratuito pausa el proyecto tras una semana sin uso. Antes de una demostración, entra en el panel y reactívalo si está pausado (tarda unos minutos).
- **Cambiar el backend:** después de modificar `server/src/`, vuelve a ejecutar `npm run supabase:desplegar`.
- **Límites diarios:** `LIMITE_CHAT`, `LIMITE_VOZ`, `LIMITE_RECETAS` y `LIMITE_SUSTITUCIONES` se cambian como secretos de la función.

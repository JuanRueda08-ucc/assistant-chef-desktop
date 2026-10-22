# 0016 · Cuentas reales con Better Auth en el backend

**Fecha:** 2026-10-22

**Contexto:** la v1 exige cuentas reales (0011). `autenticacion-opciones.md` dejaba dos candidatos, Better Auth y Supabase Auth. El autor elige **Better Auth** y pide la cuenta **al abrir la app**, antes de Preparar.

**Decisión:**
- **Backend:** Better Auth (`better-auth` 1.7) en el mismo manejador `Request → Response` (`server/src/cuentas.ts`), con rutas en `/auth/*`. Las cuentas se guardan en una SQLite propia del backend (`CUENTAS_DB`, por defecto `.datos/cuentas.sqlite`, fuera de Git), distinta del `chef.sqlite` de cada instalación. Las tablas se crean al arrancar con `getMigrations`.
- **Flujo:** correo y contraseña (8–128 caracteres), **verificación obligatoria** y recuperación con **códigos de 6 cifras** por correo (plugin `emailOTP`, 10 minutos), porque en escritorio es más fiable escribir un código que volver de un enlace. Un registro repetido responde igual que uno nuevo, para no revelar qué correos tienen cuenta.
- **Sesión:** plugin `bearer`, sin cookies. Main recibe el token (`set-auth-token`), lo guarda cifrado con `safeStorage` en `userData/cuenta.bin` y lo envía como `Authorization: Bearer`. Si el sistema no cifra (Linux con `basic_text`), no se guarda y hay que entrar en cada arranque. El renderer nunca ve el token: solo `EstadoCuenta` por los canales `cuenta:*`.
- **Origen:** el `fetch` de Node añade `sec-fetch-mode` y Better Auth exige entonces un Origin de confianza. Main envía `ORIGEN_APP` (`chef-digital://app`), que es el único `trustedOrigins`; otros orígenes se rechazan.
- **Rutas de IA:** `/chat`, `/voz/*`, `/recetas/generar` y `/sustituciones/sugerir` exigen una sesión válida con correo verificado (401 `no_autenticado`). Los límites diarios pasan a contarse por cuenta. `X-Instalacion` se mantiene, pero no autentica.
- **Datos por cuenta:** la tabla `sesiones` gana `usuario_id`; cada cuenta tiene como mucho una receta cocinándose y no ve la de otra. Las bases anteriores se migran con `ALTER TABLE` al abrir; sus sesiones quedan sin cuenta y no se muestran. Al salir se apaga la voz y se borra de la interfaz todo lo de la cuenta.
- **Sin conexión:** con una sesión guardada y el backend inaccesible, la app entra con `sinConexion: true` para cocinar con lo local; las funciones de IA dicen que no conectan. Si el backend responde 401, la sesión se olvida y se vuelve a Acceso.
- **Correo:** SMTP con `SMTP_HOST`/`SMTP_FROM` (nodemailer). Sin SMTP, en desarrollo los códigos se escriben en la consola del backend; con `NODE_ENV=production` el arranque falla si falta SMTP.

**Consecuencias:** `BETTER_AUTH_SECRET` (32+ caracteres) es obligatorio para arrancar el backend. Para que otras personas (el profesor) se registren hacen falta SMTP real y un backend accesible por HTTPS para todos; el despliegue queda pendiente. La sincronización de recetas entre dispositivos sigue fuera del alcance. Amplía 0006: el backend ya tiene una base de datos, solo para cuentas.

# Opciones de autenticación real

Investigación del 2026-10-20 para Electron + Svelte 5 + backend Node. El profesor exige cuentas reales; la tecnología es libre. El autor también está investigando. **Elección del autor (2026-10-22): Better Auth**, integrado según la decisión 0016. Lo que sigue es la comparación previa, que se conserva como referencia.

**Selección posterior del autor:** conservar **Better Auth y Supabase Auth** como los dos candidatos para comparar más adelante. Firebase se mantiene aquí como referencia de la investigación previa, fuera de esa selección. La comparación final y la implementación se retomarán después de la prueba personal de voz con Gemini; no se da por elegida ninguna de las dos herramientas.

## Qué debe resolver la entrega

Registro con correo y contraseña, acceso, cierre de sesión, recuperación de contraseña, verificación de correo y renovación/vencimiento de sesión. El backend debe comprobar la identidad para acceder a IA. `X-Instalacion` identifica una instalación para los límites actuales; no demuestra quién ha iniciado sesión.

La selección, las preferencias y la sesión de cocina deben tener una política por cuenta. Hay que definir cómo se trata la sesión local anterior al primer login y qué ocurre al cambiar de cuenta. Autenticar no implica sincronizar las recetas entre dispositivos; SQLite local se mantiene.

## Comparación

| Opción | Qué proporciona | Trabajo específico en este proyecto |
|---|---|---|
| Supabase Auth | Servicio de cuentas con correo/contraseña, recuperación, sesiones y JWT | Configurar proyecto y correo; adaptar persistencia en main, validar JWT en el backend y resolver los enlaces de verificación/recuperación |
| Firebase Authentication | Servicio de cuentas con correo/contraseña y SDK de administración para verificar tokens | Configurar proyecto, correo y acciones de cuenta; adaptar el cliente a Electron/main y validar ID tokens en el backend |
| Better Auth | Biblioteca para gestionar autenticación en nuestro servidor, con integración oficial para Electron | Mantener almacenamiento de cuentas, migraciones, servidor y envío de correo; revisar su puente IPC y protocolos frente al contrato actual |

### Supabase Auth

Su documentación cubre registro, login y recuperación por correo/contraseña. Para el backend ofrece verificación de JWT, incluida `getClaims`; leer el contenido de un token sin verificarlo no autentica al usuario. Fuentes: [cuentas por contraseña](https://supabase.com/docs/guides/auth/passwords) y [verificación de JWT](https://supabase.com/docs/guides/auth/jwts).

El envío de correo es un requisito concreto: el servicio de correo por defecto restringe destinatarios a miembros del equipo del proyecto. Para registrar y recuperar cuentas de compañeros o del profesor hay que configurar SMTP propio. No se debe presentar el registro como terminado probándolo únicamente con el correo del desarrollador. Fuente: [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

El plan Free consultado incluye 50 000 usuarios activos mensuales, pero los proyectos pueden pausarse tras una semana de inactividad y el envío de correo tiene su propio servicio y condiciones. Revisar estos límites antes de una demostración; no presupuestar un despliegue ilimitado sin coste. Fuente: [precios oficiales](https://supabase.com/pricing).

Encaje propuesto, todavía sin validar en la app: usar Auth como identidad y conservar las recetas en SQLite; no hace falta plantear una migración de toda la base de cocina para introducir cuentas. Hay que comprobar almacenamiento de sesión personalizado y el retorno seguro de enlaces al escritorio.

### Firebase Authentication

Ofrece creación de cuentas y acceso por correo/contraseña. El backend puede verificar los ID tokens con Firebase Admin; la comprobación de revocación debe definirse además de la validación habitual de firma y vencimiento. Fuentes: [cuentas por contraseña](https://firebase.google.com/docs/auth/web/password-auth) y [verificación en servidor](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

Su emulador de autenticación permite probar cuentas, verificación y recuperación sin usar cuentas de producción ni enviar correos reales. Las pruebas automatizadas del proyecto seguirían sin depender de un servicio remoto. El emulador no sustituye la comprobación final con cuentas reales. Fuente: [Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth).

El encaje con la arquitectura main/preload/renderer requiere una prueba antes de elegir SDK o transporte REST y persistencia. No copiar directamente un ejemplo web con tokens guardados en el renderer. Revisar las [cuotas de autenticación](https://firebase.google.com/docs/auth/limits) según el proyecto y las funciones habilitadas. Firebase y Gemini son configuraciones independientes; tener la clave de Gemini no configura las cuentas de usuarios.

### Better Auth

Su guía oficial de Electron contempla navegador del sistema, retorno por protocolo, cliente de main y puente preload. Documenta cómo empaquetar el preload para mantener `sandbox`; no obliga a quitar el aislamiento de Electron. Hay que revisar su IPC frente al puente tipado actual y comprobar las versiones compatibles antes de adoptarlo. Fuente: [integración de Electron](https://better-auth.com/docs/integrations/electron).

Para cuentas persistentes con correo/contraseña se necesita almacenamiento de usuarios en el servidor; la documentación admite SQLite, PostgreSQL y MySQL. La biblioteca aporta los flujos de contraseña, pero el proyecto debe configurar y operar sus correos de verificación/recuperación. Fuentes: [instalación y base de datos](https://better-auth.com/docs/installation) y [correo y contraseña](https://better-auth.com/docs/authentication/email-password).

Encaja si se prioriza controlar la autenticación en nuestro backend. Implica más responsabilidad de operación: base de usuarios, copias, actualizaciones, correo y alojamiento accesible para todos los clientes. La base de cuentas del servidor sería distinta del `chef.sqlite` de cada instalación. Esta ampliación requeriría documentar el cambio de arquitectura de 0006.

## Recomendación provisional

Evaluar primero **Supabase Auth** si se busca reducir el mantenimiento de cuentas, sujeto a resolver SMTP y comprobar la integración en Electron. **Firebase Authentication** es una alternativa comparable, especialmente por su emulador. **Better Auth** interesa si se prefiere controlar usuarios y sesiones en el backend y asumir su operación. Esta valoración es una inferencia para el proyecto, no un resultado de pruebas de las tres herramientas en la app.

Antes de cerrar la elección, comparar con la investigación del autor y comprobar un recorrido pequeño: crear una cuenta real, confirmar correo, entrar, reiniciar la app, acceder a una ruta protegida, cerrar sesión y recuperar contraseña. También rechazar un token inválido y comprobar que cambiar de cuenta no expone la sesión de cocina anterior.

## Contrato propuesto para integrar después de elegir

- Renderer: formularios Mostaza y estado mínimo del usuario; llamadas por IPC tipado, con los pasos de `AGENTS.md`.
- Main: gestionar credenciales de sesión, renovación y limpieza al salir de la cuenta. Evaluar `safeStorage` y comprobar su disponibilidad real por plataforma; Linux puede usar un backend sin cifrado, por lo que no basta con asumir que toda instalación protege el token. Fuente: [safeStorage de Electron](https://www.electronjs.org/docs/latest/api/safe-storage).
- Backend: verificar sesión/token con el proveedor elegido y asociar límites al usuario; no confiar en un id enviado por el renderer ni en `X-Instalacion` como autenticación.
- Sin conexión: definir qué datos locales pueden retomarse con una sesión existente; no presentar un login remoto fallido como acceso válido.
- Tests: proveedor simulado o emulador local, sin red ni claves reales en `npm test`. `PROVEEDOR_IA=falso` seguirá simulando la IA; no deberá convertirse en un atajo para eludir autenticación en el servicio desplegado.

La elección se registrará en una decisión posterior. No se crean proyectos externos, cuentas, claves ni dependencias con esta investigación.

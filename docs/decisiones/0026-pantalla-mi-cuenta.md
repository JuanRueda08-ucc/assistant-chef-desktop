# 0026 · Pantalla «Mi cuenta»: nombre, contraseña, uso y borrar la cuenta

**Fecha:** 2026-11-10

**Contexto:** con las cuentas reales (0017) el menú solo mostraba nombre, correo y «Cerrar sesión». El autor pidió una pantalla para ver la cuenta y sus opciones. Eligió la opción C, «Una columna», entre tres maquetas (`plan/diseno/mi-cuenta.html`).

**Decisión:**
- **Pantalla `MiCuenta.svelte`**, que se abre con «Ver mi cuenta» en el menú (`app.verMiCuenta`, encima de las demás, como Mis recetas). El chef saluda («Hola, Juan») con el correo y cuántos chats y recetas guarda la cuenta. Debajo hay una fila por opción, que se despliega en el sitio:
  - **Tu nombre:** `cuenta:cambiar-nombre` → `PUT /auth/v1/user` con `data.nombre`.
  - **Tu uso de hoy:** el que antes estaba en el menú (48), ahora con las cuatro barras.
  - **Contraseña:** `cuenta:cambiar-contrasena` pide la actual. Main vuelve a entrar con ella; si no coincide dice «La contraseña actual no es correcta». Después cambia la contraseña y sigue con los tokens nuevos, sin cerrar la sesión. Los requisitos son los de `shared/contrasena.ts`; «same_password» tiene su propio mensaje.
  - **Cerrar sesión.**
  - **Borrar mi cuenta:** zona roja con borde discontinuo. Pide la contraseña y escribir BORRAR. `cuenta:borrar` comprueba la contraseña y llama a `POST /cuenta/borrar` del backend. Solo si ese borrado sale bien, borra lo de la cuenta en este equipo (`db/cuenta-local.ts`: despensa, sesiones de cocina y recetas sin subir) y olvida la sesión.
- **Borrar necesita la clave secreta,** así que lo hace la Edge Function (`crearBorrarCuenta`): borra los contadores de `uso_diario` y la cuenta con `DELETE /auth/v1/admin/users/{id}`. Chats y Mis recetas se van con ella por `on delete cascade` (0025). Sin la función (backend local) responde 501 `no_disponible`.
- **Colores nuevos** para lo que no se deshace: `--color-tomate`, `--color-tomate-fondo` y `--color-tomate-borde` en `tokens.css`.
- En el modo de desarrollo sin cuenta (0018) la pantalla se ve entera, pero avisa de que esas acciones necesitan una cuenta real.

**Consecuencias:** hay que volver a desplegar la función (`npm run supabase:desplegar`) para que exista `/cuenta/borrar`. El correo no se puede cambiar por ahora: necesitaría confirmar el correo nuevo con código, como el registro.

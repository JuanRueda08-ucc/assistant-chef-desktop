# Correos de Supabase Auth

Plantillas de los correos con código (estilo «Libreta», elegido por el autor el 2026-11-09). Se pegan a mano en el panel de Supabase, en **Authentication → Emails → Templates**:

| Plantilla de Supabase | Asunto | Cuerpo |
|---|---|---|
| Confirm signup | `Tu código de Chef digital` | `confirmar.html` |
| Reset Password | `Recupera tu contraseña de Chef digital` | `recuperar.html` |

- `{{ .Token }}` lo sustituye Supabase por el código de 6 cifras.
- El dibujo del chef (`chef.png`, 128 px) se carga desde la copia pública del repositorio en GitHub (`raw.githubusercontent.com/.../main/supabase/correos/chef.png`). Si el repositorio deja de ser público o cambia de nombre, hay que alojar la imagen en otro sitio (por ejemplo, un bucket público de Supabase Storage) y cambiar la URL en las dos plantillas.
- Los estilos van en línea y la estructura en tablas, porque Gmail y Outlook ignoran casi todo lo demás. Las fuentes son de sistema (Georgia, Arial, Courier New).
- Si cambias una plantilla aquí, vuelve a pegarla en el panel: Supabase no lee estos archivos.

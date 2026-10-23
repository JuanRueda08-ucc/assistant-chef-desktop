// Ruta que ve app.ts cuando el backend corre como Edge Function `chef` (decisión 0017).

/** Supabase entrega la ruta con el nombre de la función delante (`/chef/chat`); se quita. */
export function rutaSinFuncion(url: string): string {
  const u = new URL(url)
  u.pathname = u.pathname.replace(/^(?:\/functions\/v1)?\/chef(?=\/|$)/, '') || '/'
  return u.toString()
}

-- Permisos explícitos de `uso_diario` para la Edge Function (clave secreta = rol service_role).
-- Los proyectos nuevos de Supabase ya no conceden permisos automáticos a las tablas creadas por
-- migraciones, y `consumir_cupo` (security invoker) fallaba con HTTP 403 al contar el uso
-- (2026-11-09). Ni la app ni los usuarios (anon, authenticated) reciben acceso.

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.uso_diario to service_role;
grant execute on function public.consumir_cupo(text, date) to service_role;

-- Contadores de uso diario por cuenta y función (decisión 0017). Solo los usa la Edge Function
-- `chef` con la clave secreta; la app y los usuarios no pueden leerlos ni cambiarlos.

create table if not exists public.uso_diario (
  clave  text    not null,
  dia    date    not null,
  usadas integer not null default 0,
  primary key (clave, dia)
);

-- RLS activado y sin políticas: nadie con la clave pública puede acceder a la tabla.
alter table public.uso_diario enable row level security;

-- Suma uno de forma atómica y devuelve el total del día. Borra los días de hace más de una semana.
create or replace function public.consumir_cupo(p_clave text, p_dia date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total integer;
begin
  insert into public.uso_diario as u (clave, dia, usadas)
  values (p_clave, p_dia, 1)
  on conflict (clave, dia) do update set usadas = u.usadas + 1
  returning u.usadas into total;
  delete from public.uso_diario where dia < p_dia - 7;
  return total;
end;
$$;

revoke all on function public.consumir_cupo(text, date) from public, anon, authenticated;
grant execute on function public.consumir_cupo(text, date) to service_role;

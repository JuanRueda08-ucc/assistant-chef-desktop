-- Chats con el chef y «Mis recetas» de cada cuenta (decisiones 0024 y 0025). La app los lee y
-- escribe con el JWT de la persona y la clave publicable: row level security deja a cada cuenta
-- ver y cambiar solo lo suyo. Al borrar la cuenta se borran sus datos.

create table if not exists public.chats (
  usuario_id  uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          uuid        not null,
  titulo      text        not null check (char_length(titulo) between 1 and 200),
  titulo_de_ia boolean    not null default false,
  turnos      jsonb       not null check (jsonb_typeof(turnos) = 'array'),
  contexto    jsonb       not null check (jsonb_typeof(contexto) = 'array'),
  actualizado timestamptz not null default now(),
  primary key (usuario_id, id),
  -- Un chat guarda como mucho 12 turnos; esto frena filas desmesuradas escritas a mano.
  check (octet_length(turnos::text) + octet_length(contexto::text) < 1000000)
);
create index if not exists chats_por_fecha on public.chats (usuario_id, actualizado desc);

create table if not exists public.mis_recetas (
  usuario_id  uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          text        not null check (char_length(id) between 1 and 100),
  datos       jsonb       not null check (jsonb_typeof(datos) = 'object'),
  guardada_en timestamptz not null default now(),
  primary key (usuario_id, id),
  check (octet_length(datos::text) < 500000)
);

alter table public.chats enable row level security;
alter table public.mis_recetas enable row level security;

drop policy if exists "cada cuenta sus chats" on public.chats;
create policy "cada cuenta sus chats" on public.chats
  for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

drop policy if exists "cada cuenta sus recetas" on public.mis_recetas;
create policy "cada cuenta sus recetas" on public.mis_recetas
  for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

-- Los proyectos nuevos no conceden permisos solos (ver 20261109000000). Solo cuentas con sesión;
-- `anon` (sin sesión) no recibe nada.
revoke all on table public.chats, public.mis_recetas from anon;
grant select, insert, update, delete on table public.chats, public.mis_recetas to authenticated;

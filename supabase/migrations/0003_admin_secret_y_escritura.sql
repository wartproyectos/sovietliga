-- ============================================================================
-- LIGA SOVIET · Password de admin + políticas de escritura
-- ============================================================================
-- Cubre dos cosas relacionadas:
--
-- 1. `admin_secret`: una única contraseña compartida (bcrypt) que la web pide
--    a quien quiera pasar a modo edición. La primera visita la fija; después
--    sólo se verifica. Nunca se lee el hash desde el cliente — sólo se llama a
--    las funciones RPC.
--
-- 2. Se abren INSERT/UPDATE/DELETE en las tablas de escritura para el rol
--    `anon`. Suficiente hasta que llegue la Fase 2 con login real: hoy protege
--    la UI y evita accidentes; NO evita que alguien con la anon key escriba
--    a mano. Aceptable para 20 amigos.
--
-- Ver docs/PLAN_TEMPORADA_2026-27.md.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- pgcrypto — `crypt()` + `gen_salt('bf')`.
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- admin_secret · una sola fila, id fijo a 1.
-- ----------------------------------------------------------------------------

create table admin_secret (
  id            integer primary key default 1,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint admin_secret_singleton check (id = 1)
);

comment on table admin_secret is
  'Una sola fila con la contraseña compartida de admin (bcrypt). El cliente '
  'nunca la lee: sólo llama a set_admin_password / verify_admin_password.';

alter table admin_secret enable row level security;
-- Sin políticas: nadie accede a la tabla directamente. Todo pasa por las
-- funciones SECURITY DEFINER de abajo.


-- ----------------------------------------------------------------------------
-- RPCs · única puerta de entrada desde el cliente.
-- ----------------------------------------------------------------------------

create or replace function admin_password_is_set()
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (select 1 from admin_secret where id = 1);
$$;

comment on function admin_password_is_set() is
  'True si ya se fijó la contraseña. La usa el gate del cliente para saber '
  'si mostrar "crear contraseña" o "introducir contraseña".';


create or replace function set_admin_password(new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(new_password, '')) < 6 then
    raise exception 'La contraseña necesita al menos 6 caracteres';
  end if;

  if exists (select 1 from admin_secret where id = 1) then
    raise exception 'La contraseña ya está fijada';
  end if;

  insert into admin_secret (id, password_hash)
  values (1, crypt(new_password, gen_salt('bf', 10)));
end;
$$;

comment on function set_admin_password(text) is
  'Fija la contraseña la PRIMERA vez. Falla si ya existe una — cambiarla '
  'requiere acción manual en la BD (llegará con la Fase 2).';


create or replace function verify_admin_password(input_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash from admin_secret where id = 1;
  if stored_hash is null then return false; end if;
  return stored_hash = crypt(coalesce(input_password, ''), stored_hash);
end;
$$;

comment on function verify_admin_password(text) is
  'Compara con bcrypt. Devuelve boolean; no revela el hash.';


-- El resto de operaciones sobre la tabla quedan cerradas.
revoke all on admin_secret from anon, authenticated;
grant execute on function admin_password_is_set()           to anon, authenticated;
grant execute on function set_admin_password(text)          to anon, authenticated;
grant execute on function verify_admin_password(text)       to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Políticas de escritura · tablas del flujo de resultados.
-- ----------------------------------------------------------------------------
-- Se abren para `anon` porque la app hoy no tiene sesión Supabase. La barrera
-- real es el password gate del cliente + el hecho de que la anon key sólo la
-- conoce quien la saque del bundle. En la Fase 2 estas políticas se atarán a
-- `auth.role() = 'authenticated'` + rol admin.

create policy "escritura publica" on jornadas       for all to anon using (true) with check (true);
create policy "escritura publica" on partidos       for all to anon using (true) with check (true);
create policy "escritura publica" on alineaciones   for all to anon using (true) with check (true);
create policy "escritura publica" on convocatorias  for all to anon using (true) with check (true);

-- Jugadores: sólo permitimos INSERT de invitados desde la web; el resto se
-- gestiona en Supabase Studio.
create policy "insertar invitados" on jugadores
  for insert to anon
  with check (tipo = 'invitado');

-- No damos UPDATE ni DELETE sobre jugadores desde la web: renombrar o borrar
-- un habitual corromperia la clasificación.

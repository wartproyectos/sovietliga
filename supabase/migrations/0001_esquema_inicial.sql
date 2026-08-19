-- ============================================================================
-- LIGA SOVIET · Esquema inicial
-- ============================================================================
-- Ejecutar en el SQL Editor de Supabase (o vía `supabase db push`).
-- Ver docs/PLAN_TEMPORADA_2026-27.md para el contexto de cada tabla.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------

create table temporadas (
  id           bigint generated always as identity primary key,
  nombre       text not null unique,               -- '2025/26'
  fecha_inicio date,
  fecha_fin    date,
  activa       boolean not null default false,
  created_at   timestamptz not null default now()
);

comment on table temporadas is
  'Una fila por temporada. El selector de temporada de la web está aplazado, '
  'pero la columna existe desde el día 1 para no tener que migrar después.';


create table jugadores (
  id             bigint generated always as identity primary key,
  nombre         text not null unique,
  pos_principal  smallint check (pos_principal between 1 and 5),
  pos_secundaria smallint check (pos_secundaria between 1 and 5),
  rating         numeric,
  tipo           text not null default 'habitual' check (tipo in ('habitual', 'invitado')),
  rol            text not null default 'jugador'  check (rol  in ('admin', 'jugador')),
  activo         boolean not null default true,
  auth_user_id   uuid unique references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on column jugadores.tipo is
  'habitual = cuenta para la clasificación. invitado = juega y afecta al '
  'resultado, pero no aparece en la tabla. Sustituye al antiguo EXCLUDED_PLAYERS.';
comment on column jugadores.pos_principal is '1=Base 2=Escolta 3=Alero 4=Ala-Pívot 5=Pívot';


create table jornadas (
  id           bigint generated always as identity primary key,
  temporada_id bigint not null references temporadas (id) on delete cascade,
  numero       smallint not null,
  fecha        date,
  alineador_id bigint references jugadores (id) on delete set null,
  estado       text not null default 'borrador'
                 check (estado in ('borrador', 'abierta', 'convocada', 'jugada')),
  created_at   timestamptz not null default now(),
  unique (temporada_id, numero)
);


-- Respuestas de disponibilidad (sustituye al Google Form).
create table disponibilidad (
  jornada_id    bigint not null references jornadas (id)  on delete cascade,
  jugador_id    bigint not null references jugadores (id) on delete cascade,
  disponible    boolean not null,
  respondido_at timestamptz not null default now(),
  primary key (jornada_id, jugador_id)
);


-- LO PREVISTO: quién fue convocado y con qué papel.
create table convocatorias (
  jornada_id bigint not null references jornadas (id)  on delete cascade,
  jugador_id bigint not null references jugadores (id) on delete cascade,
  rol        text not null check (rol in ('titular', 'reserva')),
  primary key (jornada_id, jugador_id)
);

comment on table convocatorias is
  'Lo previsto el domingo. NO es lo que pasó — para eso está alineaciones.';


create table partidos (
  id         bigint generated always as identity primary key,
  jornada_id bigint not null references jornadas (id) on delete cascade,
  puntos_a   smallint check (puntos_a >= 0),
  puntos_b   smallint check (puntos_b >= 0),
  resultado  text check (resultado in ('a', 'b', 'empate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Si hay marcador, el resultado no puede contradecirlo.
  constraint marcador_coherente check (
    puntos_a is null
    or puntos_b is null
    or resultado is null
    or resultado = case
                     when puntos_a > puntos_b then 'a'
                     when puntos_b > puntos_a then 'b'
                     else 'empate'
                   end
  )
);

comment on column partidos.resultado is
  'null = todavía sin resultado. Los datos migrados de 2025/26 tienen resultado '
  'pero no marcador, porque el Excel solo registraba quién ganó.';


-- LO QUE PASÓ: quién jugó de verdad y en qué equipo.
create table alineaciones (
  partido_id bigint not null references partidos (id)   on delete cascade,
  jugador_id bigint not null references jugadores (id)  on delete cascade,
  equipo     text check (equipo in ('a', 'b')),
  primary key (partido_id, jugador_id)
);

comment on column alineaciones.equipo is
  'null = equipo desconocido. Sólo ocurre en empates migrados de 2025/26: el '
  'Excel marcaba 0.5 a los 12 jugadores sin distinguir bandos. No se inventa '
  'un reparto que nunca existió; los totales salen igual porque un empate da '
  '0.5 independientemente del equipo.';


-- Índices para los joins de las vistas.
create index on jornadas      (temporada_id);
create index on partidos      (jornada_id);
create index on alineaciones  (jugador_id);
create index on convocatorias (jugador_id);


-- ----------------------------------------------------------------------------
-- Vistas · reproducen exactamente lo que hoy calcula la app desde el Sheet
-- ----------------------------------------------------------------------------

-- Una fila por (jugador, jornada jugada), con el valor de victoria de la liga:
-- 1 = ganó · 0.5 = empate · 0 = perdió
create view v_jugador_jornada
with (security_invoker = on) as
select
  jo.temporada_id,
  jo.id     as jornada_id,
  jo.numero as jornada_numero,
  al.jugador_id,
  al.equipo,
  case
    when pa.resultado is null     then null
    when pa.resultado = 'empate'  then 0.5
    when pa.resultado = al.equipo then 1
    else 0
  end::numeric as victoria
from alineaciones al
join partidos pa on pa.id = al.partido_id
join jornadas jo on jo.id = pa.jornada_id;


-- Descansos reales: convocado como reserva Y que no llegó a jugar.
-- Autocorrectivo: si editas un partido pasado para meter a un reserva que
-- acabó jugando, su contador de reservas baja solo.
create view v_reservas
with (security_invoker = on) as
select
  jo.temporada_id,
  jo.id     as jornada_id,
  jo.numero as jornada_numero,
  co.jugador_id
from convocatorias co
join jornadas jo on jo.id = co.jornada_id
where co.rol = 'reserva'
  and not exists (
    select 1
    from alineaciones al
    join partidos pa on pa.id = al.partido_id
    where pa.jornada_id = jo.id
      and al.jugador_id = co.jugador_id
  );


-- Clasificación por temporada. Nada de esto se guarda: se calcula.
create view v_clasificacion
with (security_invoker = on) as
with claves as (
  select temporada_id, jugador_id from v_jugador_jornada
  union
  select temporada_id, jugador_id from v_reservas
),
jugado as (
  select temporada_id, jugador_id,
         count(*)::int                     as pj,
         coalesce(sum(victoria), 0)::numeric as v
  from v_jugador_jornada
  group by 1, 2
),
descansado as (
  select temporada_id, jugador_id, count(*)::int as reservas
  from v_reservas
  group by 1, 2
)
select
  k.temporada_id,
  t.nombre                as temporada,
  k.jugador_id,
  ju.nombre,
  ju.pos_principal,
  ju.pos_secundaria,
  coalesce(g.pj, 0)       as pj,
  coalesce(g.v, 0)        as v,
  case when coalesce(g.pj, 0) > 0
       then round(g.v * 100.0 / g.pj, 2)
       else 0
  end                     as porcentaje,
  coalesce(d.reservas, 0) as reservas
from claves k
join temporadas t  on t.id  = k.temporada_id
join jugadores ju  on ju.id = k.jugador_id
left join jugado g     on g.temporada_id = k.temporada_id and g.jugador_id = k.jugador_id
left join descansado d on d.temporada_id = k.temporada_id and d.jugador_id = k.jugador_id
where ju.tipo = 'habitual';


-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- La clave publishable viaja en el bundle del navegador: cualquiera puede
-- leerla. Lo que protege los datos es esto, no la clave.
--
-- Fase 1: sólo lectura pública. No se crea NINGUNA política de insert/update/
-- delete, así que Postgres las deniega por defecto — la web todavía no escribe.
-- Las políticas de escritura llegan en la Fase 2, junto con el login.
-- ----------------------------------------------------------------------------

alter table temporadas     enable row level security;
alter table jugadores      enable row level security;
alter table jornadas       enable row level security;
alter table disponibilidad enable row level security;
alter table convocatorias  enable row level security;
alter table partidos       enable row level security;
alter table alineaciones   enable row level security;

create policy "lectura publica" on temporadas     for select using (true);
create policy "lectura publica" on jugadores      for select using (true);
create policy "lectura publica" on jornadas       for select using (true);
create policy "lectura publica" on convocatorias  for select using (true);
create policy "lectura publica" on partidos       for select using (true);
create policy "lectura publica" on alineaciones   for select using (true);

-- Disponibilidad NO se expone públicamente: quién puede y quién no cada semana
-- es información del grupo, no del mundo. Se abrirá a usuarios autenticados en
-- la Fase 2. Sin política, queda denegada para todos.

grant select on v_jugador_jornada, v_reservas, v_clasificacion to anon, authenticated;

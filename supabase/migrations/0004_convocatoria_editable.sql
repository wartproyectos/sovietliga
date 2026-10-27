-- ============================================================================
-- LIGA SOVIET · Convocatoria editable antes del partido
-- ============================================================================
-- El admin puede ajustar la convocatoria desde la web (mover entre equipos,
-- mandar a reserva, añadir o quitar jugadores) y guardarla antes de jugar.
--
-- 1. `convocatorias.equipo`: en qué equipo va cada titular de lo previsto.
--    null para reservas y para las convocatorias ya registradas, donde el
--    equipo real está en `alineaciones`.
--
-- 2. `v_reservas` ignora las jornadas en estado 'convocada': una convocatoria
--    guardada pero todavía sin jugar no debe sumar reservas en la
--    clasificación. Al registrar el resultado la jornada pasa a 'jugada' y
--    las reservas empiezan a contar.
-- ============================================================================

alter table convocatorias
  add column equipo text check (equipo in ('a', 'b'));

comment on column convocatorias.equipo is
  'Equipo previsto para los titulares (a = Negro, b = Rojo). null en reservas '
  'y en jornadas ya jugadas, donde manda alineaciones.';


create or replace view v_reservas
with (security_invoker = on) as
select
  jo.temporada_id,
  jo.id     as jornada_id,
  jo.numero as jornada_numero,
  co.jugador_id
from convocatorias co
join jornadas jo on jo.id = co.jornada_id
where co.rol = 'reserva'
  and jo.estado <> 'convocada'
  and not exists (
    select 1
    from alineaciones al
    join partidos pa on pa.id = al.partido_id
    where pa.jornada_id = jo.id
      and al.jugador_id = co.jugador_id
  );

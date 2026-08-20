import { supabase } from './supabase.js';

/**
 * Carga todo lo necesario para editar una jornada.
 *
 * Devuelve un snapshot plano que el modal usa como estado inicial:
 *
 *   { jornada, partido, alineaciones, reservas, jugadores }
 *
 * - `partido` puede ser null: hay jornadas antiguas (25/26) sin fila en
 *   `partidos` que igualmente tienen alineaciones migradas. En ese caso el
 *   guardado se encarga de crearlo.
 * - `alineaciones` es un array `{ jugador_id, equipo }` (equipo puede ser
 *   null en empates migrados).
 * - `reservas` es un array de `jugador_id` (los que están en `convocatorias`
 *   con rol = 'reserva').
 * - `jugadores` incluye habituales + invitados activos, para el picker.
 *
 * Si la jornada no existe (caso "registrar desde Convocatoria"), se crea
 * al vuelo. `jornadaFechaIso` es opcional (YYYY-MM-DD) — sólo se usa en la
 * creación; nunca sobrescribe la fecha de una jornada ya existente.
 */
export async function cargarEdicion(temporadaId, jornadaNumero, jornadaFechaIso = null) {
  const jSel = await supabase
    .from('jornadas')
    .select('id, numero, fecha, alineador_id')
    .eq('temporada_id', temporadaId)
    .eq('numero', jornadaNumero)
    .maybeSingle();
  if (jSel.error) throw jSel.error;

  let jornada = jSel.data;
  if (!jornada) {
    const ins = await supabase
      .from('jornadas')
      .insert({
        temporada_id: temporadaId,
        numero: jornadaNumero,
        fecha: jornadaFechaIso,
        estado: 'jugada',
      })
      .select('id, numero, fecha, alineador_id')
      .single();
    if (ins.error) throw new Error(`No se pudo crear la jornada: ${ins.error.message}`);
    jornada = ins.data;
  }

  const [pRes, cRes, jugRes] = await Promise.all([
    supabase
      .from('partidos')
      .select('id, puntos_a, puntos_b, resultado')
      .eq('jornada_id', jornada.id)
      .maybeSingle(),
    supabase
      .from('convocatorias')
      .select('jugador_id, rol')
      .eq('jornada_id', jornada.id),
    supabase
      .from('jugadores')
      .select('id, nombre, tipo, pos_principal, activo')
      .eq('activo', true),
  ]);
  if (pRes.error) throw pRes.error;
  if (cRes.error) throw cRes.error;
  if (jugRes.error) throw jugRes.error;

  const partido = pRes.data ?? null;
  let alineaciones = [];
  if (partido) {
    const aRes = await supabase
      .from('alineaciones')
      .select('jugador_id, equipo')
      .eq('partido_id', partido.id);
    if (aRes.error) throw aRes.error;
    alineaciones = aRes.data;
  }

  const reservas = cRes.data.filter((r) => r.rol === 'reserva').map((r) => r.jugador_id);

  return { jornada, partido, alineaciones, reservas, jugadores: jugRes.data };
}

/**
 * Escribe todos los cambios de una edición en Supabase.
 *
 * @param {object} params
 * @param {object} params.jornada
 * @param {object|null} params.partido
 * @param {number|null} params.puntosA — null si no hay marcador
 * @param {number|null} params.puntosB
 * @param {Array<{ jugador_id: number, equipo: 'a'|'b' }>} params.titulares
 * @param {Array<number>} params.reservas — jugador_ids en reserva
 * @param {Array<string>} params.invitadosNuevos — nombres a crear como
 *     jugadores tipo 'invitado' y añadir como titulares. Cada uno espera un
 *     objeto `{ nombre, equipo }` para saber a qué equipo va.
 * @param {number|undefined} params.alineadorId — jugador_id designado como
 *     alineador. `undefined` = no tocar el valor actual (útil al editar una
 *     jornada antigua desde Historial). `null` = borrarlo explícitamente.
 *
 *     Convenio de equipos: 'a' = Negro, 'b' = Rojo.
 */
export async function guardarEdicion({
  jornada,
  partido,
  puntosA,
  puntosB,
  titulares,
  reservas,
  invitadosNuevos,
  alineadorId,
}) {
  // 1) Crear invitados nuevos y añadirlos a titulares con jugador_id ya real.
  const titularesResueltos = [...titulares];
  for (const nuevo of invitadosNuevos) {
    if (!nuevo.nombre?.trim()) continue;
    const ins = await supabase
      .from('jugadores')
      .insert({ nombre: nuevo.nombre.trim(), tipo: 'invitado' })
      .select('id')
      .single();
    if (ins.error) throw new Error(`No se pudo crear el invitado ${nuevo.nombre}: ${ins.error.message}`);
    titularesResueltos.push({ jugador_id: ins.data.id, equipo: nuevo.equipo });
  }

  // 2) Calcular resultado consistente con el marcador.
  const marcadorSet = puntosA != null && puntosB != null;
  const resultado = !marcadorSet
    ? null
    : puntosA > puntosB
      ? 'a'
      : puntosB > puntosA
        ? 'b'
        : 'empate';

  // 3) Asegurar la fila de partido (crear si no existía).
  //
  // Sutileza: si el admin no puso marcador, NO tocamos `resultado`. Las
  // jornadas migradas de 25/26 tienen `resultado='a'|'b'` pero puntos NULL,
  // y machacar el resultado a null al re-guardar dejaría a todos como
  // "perdedores" en la clasificación. Solo cuando el admin fija marcador
  // deducimos el resultado a partir de él.
  const partidoPayload = {
    puntos_a: marcadorSet ? puntosA : null,
    puntos_b: marcadorSet ? puntosB : null,
  };
  if (marcadorSet) partidoPayload.resultado = resultado;

  let partidoId = partido?.id ?? null;
  if (!partidoId) {
    const ins = await supabase
      .from('partidos')
      .insert({ jornada_id: jornada.id, ...partidoPayload })
      .select('id')
      .single();
    if (ins.error) throw new Error(`No se pudo crear el partido: ${ins.error.message}`);
    partidoId = ins.data.id;
  } else {
    const upd = await supabase.from('partidos').update(partidoPayload).eq('id', partidoId);
    if (upd.error) throw new Error(`No se pudo actualizar el marcador: ${upd.error.message}`);
  }

  // 4) Reemplazar alineaciones completas.
  const del = await supabase.from('alineaciones').delete().eq('partido_id', partidoId);
  if (del.error) throw new Error(`No se pudieron borrar alineaciones previas: ${del.error.message}`);

  if (titularesResueltos.length > 0) {
    const rows = titularesResueltos.map((t) => ({
      partido_id: partidoId,
      jugador_id: t.jugador_id,
      equipo: t.equipo,
    }));
    const ins = await supabase.from('alineaciones').insert(rows);
    if (ins.error) throw new Error(`No se pudieron insertar alineaciones: ${ins.error.message}`);
  }

  // 5) Reemplazar TODAS las convocatorias de la jornada (titulares + reservas).
  //    Se borra todo y se reescribe con el estado final del editor. Escribir
  //    los titulares es lo que "congela" la convocatoria — hasta ahora sólo
  //    se guardaban las reservas, y los titulares se derivaban del Google Form
  //    en cada visita.
  const delConv = await supabase.from('convocatorias').delete().eq('jornada_id', jornada.id);
  if (delConv.error) throw new Error(`No se pudieron borrar convocatorias previas: ${delConv.error.message}`);

  const filasConv = [
    ...titularesResueltos.map((t) => ({
      jornada_id: jornada.id,
      jugador_id: t.jugador_id,
      rol: 'titular',
    })),
    ...reservas.map((jid) => ({
      jornada_id: jornada.id,
      jugador_id: jid,
      rol: 'reserva',
    })),
  ];
  if (filasConv.length > 0) {
    const insConv = await supabase.from('convocatorias').insert(filasConv);
    if (insConv.error) throw new Error(`No se pudieron insertar convocatorias: ${insConv.error.message}`);
  }

  // 6) Alineador. Solo se guarda si el llamante lo pasa; el editor desde
  //    Historial (jornadas antiguas) puede no tenerlo y no queremos borrar el
  //    valor existente por accidente — por eso undefined ≠ null aquí.
  if (alineadorId !== undefined) {
    const updJ = await supabase
      .from('jornadas')
      .update({ alineador_id: alineadorId, estado: 'jugada' })
      .eq('id', jornada.id);
    if (updJ.error) throw new Error(`No se pudo guardar el alineador: ${updJ.error.message}`);
  }
}

import { supabase } from './supabase.js';
import { reservarInvitados } from './invitados.js';

/**
 * Convocatoria ajustada a mano por el admin y guardada antes del partido.
 *
 * Mientras no hay una guardada, la página calcula la convocatoria en cada
 * visita a partir del formulario. En cuanto el admin guarda, la jornada pasa a
 * estado 'convocada' y lo que se enseña es lo guardado: las respuestas que
 * lleguen después ya no la reordenan.
 *
 * Convenio de equipos: 'a' = Negro, 'b' = Rojo.
 */

/**
 * Lo que ya hay en BD para el partido de `fechaIso` (YYYY-MM-DD):
 *
 *   { numero, guardada }
 *
 * - `numero`: número de la jornada si ya existe fila para esa fecha (se
 *   registró el resultado o se guardó la convocatoria); null si no.
 * - `guardada`: la convocatoria guardada por el admin, o null. Sólo cuenta si
 *   la jornada sigue en 'convocada': una vez registrado el resultado, lo que
 *   vale es lo que pasó (alineaciones), no lo previsto.
 *
 *     guardada = { jornadaId, alineadorId, filas: [{ jugador_id, rol, equipo, nombre, tipo }] }
 */
export async function cargarJornadaDelPartido(temporadaId, fechaIso) {
  const jSel = await supabase
    .from('jornadas')
    .select('id, numero, alineador_id, estado')
    .eq('temporada_id', temporadaId)
    .eq('fecha', fechaIso)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (jSel.error) throw jSel.error;
  if (!jSel.data) return { numero: null, guardada: null };

  const numero = jSel.data.numero;
  if (jSel.data.estado !== 'convocada') return { numero, guardada: null };

  const cSel = await supabase
    .from('convocatorias')
    .select('jugador_id, rol, equipo, jugadores(nombre, tipo)')
    .eq('jornada_id', jSel.data.id);
  if (cSel.error) throw cSel.error;
  if (cSel.data.length === 0) return { numero, guardada: null };

  const guardada = {
    jornadaId: jSel.data.id,
    alineadorId: jSel.data.alineador_id,
    filas: cSel.data.map((r) => ({
      jugador_id: r.jugador_id,
      rol: r.rol,
      equipo: r.equipo,
      nombre: r.jugadores?.nombre ?? '?',
      tipo: r.jugadores?.tipo ?? 'habitual',
    })),
  };
  return { numero, guardada };
}

/**
 * Guarda la convocatoria tal y como la dejó el admin.
 *
 * @param {object} params
 * @param {number} params.temporadaId
 * @param {number} params.jornadaNumero
 * @param {string} params.jornadaFechaIso — YYYY-MM-DD, sólo si hay que crear la jornada.
 * @param {Array<{ jugador_id: number, equipo: 'a'|'b' }>} params.titulares
 * @param {Array<number>} params.reservas — jugador_ids
 * @param {Array<'a'|'b'|'res'>} params.invitadosNuevos — destino de cada
 *     "Invitado" añadido; se les asigna un jugador invitado genérico al guardar.
 * @param {number|null} params.alineadorId
 */
export async function guardarConvocatoria({
  temporadaId,
  jornadaNumero,
  jornadaFechaIso,
  titulares,
  reservas,
  invitadosNuevos,
  alineadorId,
}) {
  // 1) Asegurar la jornada. Si ya tiene partido, el resultado está registrado
  //    y la convocatoria se corrige desde el editor de jornada, no desde aquí.
  const jSel = await supabase
    .from('jornadas')
    .select('id')
    .eq('temporada_id', temporadaId)
    .eq('numero', jornadaNumero)
    .maybeSingle();
  if (jSel.error) throw jSel.error;

  let jornadaId = jSel.data?.id ?? null;
  if (jornadaId) {
    const pSel = await supabase.from('partidos').select('id').eq('jornada_id', jornadaId).maybeSingle();
    if (pSel.error) throw pSel.error;
    if (pSel.data) {
      throw new Error('Esta jornada ya tiene resultado registrado. Edítala desde el registro del partido.');
    }
  } else {
    const ins = await supabase
      .from('jornadas')
      .insert({
        temporada_id: temporadaId,
        numero: jornadaNumero,
        fecha: jornadaFechaIso,
        estado: 'convocada',
      })
      .select('id')
      .single();
    if (ins.error) throw new Error(`No se pudo crear la jornada: ${ins.error.message}`);
    jornadaId = ins.data.id;
  }

  // 2) Dar a cada "Invitado" añadido su jugador invitado genérico.
  const titularesResueltos = [...titulares];
  const reservasResueltas = [...reservas];
  const ocupados = new Set([...titulares.map((t) => t.jugador_id), ...reservas]);
  const idsInvitados = await reservarInvitados(invitadosNuevos.length, ocupados);
  invitadosNuevos.forEach((destino, i) => {
    if (destino === 'res') reservasResueltas.push(idsInvitados[i]);
    else titularesResueltos.push({ jugador_id: idsInvitados[i], equipo: destino });
  });

  // 3) Reemplazar la convocatoria completa.
  const del = await supabase.from('convocatorias').delete().eq('jornada_id', jornadaId);
  if (del.error) throw new Error(`No se pudo borrar la convocatoria previa: ${del.error.message}`);

  const filas = [
    ...titularesResueltos.map((t) => ({
      jornada_id: jornadaId,
      jugador_id: t.jugador_id,
      rol: 'titular',
      equipo: t.equipo,
    })),
    ...reservasResueltas.map((jid) => ({
      jornada_id: jornadaId,
      jugador_id: jid,
      rol: 'reserva',
      equipo: null,
    })),
  ];
  if (filas.length > 0) {
    const ins = await supabase.from('convocatorias').insert(filas);
    if (ins.error) throw new Error(`No se pudo guardar la convocatoria: ${ins.error.message}`);
  }

  // 4) Marcar la jornada como convocada (si alguien abrió y canceló el editor
  //    de resultado, puede haberse quedado en 'jugada' sin partido).
  const upd = await supabase
    .from('jornadas')
    .update({ alineador_id: alineadorId, estado: 'convocada' })
    .eq('id', jornadaId);
  if (upd.error) throw new Error(`No se pudo actualizar la jornada: ${upd.error.message}`);
}

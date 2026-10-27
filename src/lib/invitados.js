import { supabase } from './supabase.js';

const PATRON_INVITADO = /^Invitado (\d+)$/;

/**
 * Devuelve `cantidad` jugador_ids de invitados genéricos para una jornada.
 *
 * En la web sólo hay un "Invitado" que se puede añadir varias veces, pero en BD
 * cada plaza necesita su propio jugador (la clave de convocatorias y
 * alineaciones es jornada + jugador). Se reutilizan los "Invitado N" que ya
 * existen y no están en `ocupados` (ids ya usados en esa jornada), y si no
 * llegan se crean los siguientes números.
 */
export async function reservarInvitados(cantidad, ocupados = new Set()) {
  if (cantidad <= 0) return [];

  const res = await supabase
    .from('jugadores')
    .select('id, nombre, tipo, activo')
    .ilike('nombre', 'Invitado %');
  if (res.error) throw res.error;

  const numerados = res.data
    .map((j) => ({ ...j, n: Number(j.nombre.match(PATRON_INVITADO)?.[1] ?? NaN) }))
    .filter((j) => Number.isFinite(j.n));

  const ids = numerados
    .filter((j) => j.tipo === 'invitado' && j.activo && !ocupados.has(j.id))
    .sort((a, b) => a.n - b.n)
    .slice(0, cantidad)
    .map((j) => j.id);

  let siguiente = Math.max(0, ...numerados.map((j) => j.n));
  while (ids.length < cantidad) {
    siguiente += 1;
    const ins = await supabase
      .from('jugadores')
      .insert({ nombre: `Invitado ${siguiente}`, tipo: 'invitado' })
      .select('id')
      .single();
    if (ins.error) throw new Error(`No se pudo crear el invitado: ${ins.error.message}`);
    ids.push(ins.data.id);
  }
  return ids;
}

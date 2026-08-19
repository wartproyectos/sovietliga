import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseData() {
  const [clasificacion, setClasificacion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jornada, setJornada] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError('');

        const { data: temporada, error: tErr } = await supabase
          .from('temporadas')
          .select('id')
          .eq('nombre', '2025/26')
          .single();
        if (tErr) throw new Error('No se encontró la temporada 2025/26');

        const tid = temporada.id;

        const [clasifRes, jjRes, resRes] = await Promise.all([
          supabase.from('v_clasificacion').select('*').eq('temporada_id', tid),
          supabase.from('v_jugador_jornada').select('jugador_id, jornada_numero, victoria').eq('temporada_id', tid),
          supabase.from('v_reservas').select('jugador_id, jornada_numero').eq('temporada_id', tid),
        ]);

        if (clasifRes.error) throw clasifRes.error;
        if (jjRes.error) throw jjRes.error;
        if (resRes.error) throw resRes.error;

        const clasif = clasifRes.data;
        const jugJorn = jjRes.data;
        const reservas = resRes.data;

        const maxNum = Math.max(
          0,
          ...jugJorn.map((r) => r.jornada_numero),
          ...reservas.map((r) => r.jornada_numero),
        );

        const habituales = new Set(clasif.map((c) => c.jugador_id));

        const partMap = new Map();
        const vicMap = new Map();

        for (const r of jugJorn) {
          if (!habituales.has(r.jugador_id)) continue;
          if (!partMap.has(r.jugador_id)) {
            partMap.set(r.jugador_id, new Array(maxNum).fill(null));
            vicMap.set(r.jugador_id, new Array(maxNum).fill(null));
          }
          partMap.get(r.jugador_id)[r.jornada_numero - 1] = 1;
          vicMap.get(r.jugador_id)[r.jornada_numero - 1] =
            r.victoria != null ? Number(r.victoria) : null;
        }

        for (const r of reservas) {
          if (!habituales.has(r.jugador_id)) continue;
          if (!partMap.has(r.jugador_id)) {
            partMap.set(r.jugador_id, new Array(maxNum).fill(null));
            vicMap.set(r.jugador_id, new Array(maxNum).fill(null));
          }
          partMap.get(r.jugador_id)[r.jornada_numero - 1] = 'R';
        }

        const merged = clasif
          .map((c) => ({
            nombre: c.nombre,
            pj: c.pj,
            v: Number(c.v),
            porcentaje: Number(c.porcentaje),
            reservas: c.reservas,
            pos_principal: c.pos_principal,
            pos_secundaria: c.pos_secundaria,
            jornadaParticipacion: partMap.get(c.jugador_id) ?? [],
            jornadaVictorias: vicMap.get(c.jugador_id) ?? [],
          }))
          .sort((a, b) => (b.v !== a.v ? b.v - a.v : b.porcentaje - a.porcentaje))
          .map((r, i) => ({ ...r, pos: i + 1 }));

        setClasificacion(merged);
        setJornada(maxNum > 0 ? maxNum : null);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Error al cargar datos de Supabase');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { clasificacion, loading, error, jornada };
}

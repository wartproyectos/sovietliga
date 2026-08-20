import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTemporada } from '../contexts/TemporadaContext';

export function useSupabaseData() {
  const { seleccionada, loading: tempLoading, error: tempError } = useTemporada();
  const [clasificacion, setClasificacion] = useState([]);
  const [marcadores, setMarcadores] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jornada, setJornada] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const tid = seleccionada?.id ?? null;

  useEffect(() => {
    if (tempError) {
      setError(tempError);
      setLoading(false);
      return;
    }
    if (tempLoading || !tid) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError('');

        // Los jugadores habituales vienen de la tabla base (no de la vista),
        // así aparecen aunque todavía no hayan jugado ningún partido. Es lo que
        // permite ver la lista completa al arrancar una temporada nueva.
        const [clasifRes, jjRes, resRes, habRes, partRes] = await Promise.all([
          supabase.from('v_clasificacion').select('*').eq('temporada_id', tid),
          supabase.from('v_jugador_jornada').select('jugador_id, jornada_numero, victoria').eq('temporada_id', tid),
          supabase.from('v_reservas').select('jugador_id, jornada_numero').eq('temporada_id', tid),
          supabase
            .from('jugadores')
            .select('id, nombre, pos_principal, pos_secundaria')
            .eq('tipo', 'habitual')
            .eq('activo', true),
          // Marcadores por jornada: fila por partido con puntos y jornada asociada.
          supabase
            .from('partidos')
            .select('id, puntos_a, puntos_b, jornadas!inner(id, numero, temporada_id)')
            .eq('jornadas.temporada_id', tid),
        ]);

        if (clasifRes.error) throw clasifRes.error;
        if (jjRes.error) throw jjRes.error;
        if (resRes.error) throw resRes.error;
        if (habRes.error) throw habRes.error;
        if (partRes.error) throw partRes.error;

        const marcadoresMap = new Map();
        for (const p of partRes.data) {
          if (p.puntos_a != null && p.puntos_b != null) {
            marcadoresMap.set(p.jornadas.numero, { puntos_a: p.puntos_a, puntos_b: p.puntos_b });
          }
        }
        setMarcadores(marcadoresMap);

        const statsPorId = new Map(clasifRes.data.map((c) => [c.jugador_id, c]));
        const jugJorn = jjRes.data;
        const reservas = resRes.data;

        const maxNum = Math.max(
          0,
          ...jugJorn.map((r) => r.jornada_numero),
          ...reservas.map((r) => r.jornada_numero),
        );

        const partMap = new Map();
        const vicMap = new Map();

        for (const r of jugJorn) {
          if (!partMap.has(r.jugador_id)) {
            partMap.set(r.jugador_id, new Array(maxNum).fill(null));
            vicMap.set(r.jugador_id, new Array(maxNum).fill(null));
          }
          partMap.get(r.jugador_id)[r.jornada_numero - 1] = 1;
          vicMap.get(r.jugador_id)[r.jornada_numero - 1] =
            r.victoria != null ? Number(r.victoria) : null;
        }

        for (const r of reservas) {
          if (!partMap.has(r.jugador_id)) {
            partMap.set(r.jugador_id, new Array(maxNum).fill(null));
            vicMap.set(r.jugador_id, new Array(maxNum).fill(null));
          }
          partMap.get(r.jugador_id)[r.jornada_numero - 1] = 'R';
        }

        const merged = habRes.data
          .map((h) => {
            const s = statsPorId.get(h.id);
            return {
              id: h.id,
              nombre: h.nombre,
              pj: s?.pj ?? 0,
              v: Number(s?.v ?? 0),
              porcentaje: Number(s?.porcentaje ?? 0),
              reservas: s?.reservas ?? 0,
              pos_principal: h.pos_principal,
              pos_secundaria: h.pos_secundaria,
              jornadaParticipacion: partMap.get(h.id) ?? [],
              jornadaVictorias: vicMap.get(h.id) ?? [],
            };
          })
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
  }, [tid, tempLoading, tempError, refreshTick]);

  const refrescar = () => setRefreshTick((t) => t + 1);

  return { clasificacion, marcadores, loading, error, jornada, refrescar };
}

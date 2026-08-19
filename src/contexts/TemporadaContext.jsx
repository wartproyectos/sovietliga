import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Estado global de temporadas.
 *
 * - `temporadas`: todas las que existen en la BD, ordenadas de la más reciente
 *   a la más antigua (útil para el selector).
 * - `activa`: la que corre ahora. La marca `activa=true` en Supabase; si por lo
 *   que fuera nadie está marcada, cae a la última por fecha_inicio para que la
 *   web no se quede sin defecto.
 * - `seleccionada`: la que el usuario está mirando. Arranca en `activa` y no se
 *   persiste — recargar la página vuelve a la activa (decisión de diseño).
 */

const TemporadaContext = createContext(null);

export function TemporadaProvider({ children }) {
  const [temporadas, setTemporadas] = useState([]);
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // `nullsFirst: false` — postgres pone nulls al principio con DESC por
        // defecto y la migración de 25/26 no trae fecha_inicio, así que sin
        // esto la temporada vieja aparece antes que la 26/27.
        const { data, error: err } = await supabase
          .from('temporadas')
          .select('id, nombre, fecha_inicio, activa')
          .order('fecha_inicio', { ascending: false, nullsFirst: false });

        if (err) throw err;
        if (!data?.length) throw new Error('No hay temporadas configuradas');

        setTemporadas(data);
        const activa = data.find((t) => t.activa) ?? data[0];
        setSeleccionadaId(activa.id);
      } catch (e) {
        console.error(e);
        setError(e.message || 'Error al cargar temporadas');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(() => {
    const activa = temporadas.find((t) => t.activa) ?? temporadas[0] ?? null;
    const seleccionada = temporadas.find((t) => t.id === seleccionadaId) ?? activa;
    return {
      temporadas,
      activa,
      seleccionada,
      esActivaSeleccionada: !!(seleccionada && activa && seleccionada.id === activa.id),
      setSeleccionadaId,
      loading,
      error,
    };
  }, [temporadas, seleccionadaId, loading, error]);

  return <TemporadaContext.Provider value={value}>{children}</TemporadaContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTemporada() {
  const ctx = useContext(TemporadaContext);
  if (!ctx) throw new Error('useTemporada tiene que estar dentro de <TemporadaProvider>');
  return ctx;
}

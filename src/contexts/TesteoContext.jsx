import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Modo pruebas para la convocatoria.
 *
 * `siempreAbierta` desactiva la restricción de "solo viernes 00:00 → domingo
 * 12:00": con ella activada, la convocatoria se puede generar y las respuestas
 * se leen sin filtrar por ventana. Pensado para poder testear la funcionalidad
 * cualquier día de la semana.
 *
 * Se persiste en localStorage y arranca en `true` para que, salvo que el admin
 * lo desactive expresamente, la convocatoria esté siempre disponible.
 */

const LS_KEY = 'sv-testeo-convocatoria-v1';

const TesteoContext = createContext(null);

function leerFlagInicial() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

export function TesteoProvider({ children }) {
  const [siempreAbierta, setSiempreAbiertaState] = useState(leerFlagInicial);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, siempreAbierta ? '1' : '0');
    } catch { /* localStorage bloqueado, sólo vive en memoria */ }
  }, [siempreAbierta]);

  const setSiempreAbierta = useCallback((valor) => {
    setSiempreAbiertaState(typeof valor === 'function' ? valor : Boolean(valor));
  }, []);

  const value = useMemo(
    () => ({ siempreAbierta, setSiempreAbierta }),
    [siempreAbierta, setSiempreAbierta],
  );

  return <TesteoContext.Provider value={value}>{children}</TesteoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTesteo() {
  const ctx = useContext(TesteoContext);
  if (!ctx) throw new Error('useTesteo tiene que estar dentro de <TesteoProvider>');
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Estado global del modo admin.
 *
 * - `passwordFijada`: si ya existe una contraseña en la BD (RPC
 *   `admin_password_is_set`). `null` mientras se consulta.
 * - `autenticado`: si el navegador actual pasó el gate en esta o en anteriores
 *   sesiones. Se persiste en `localStorage` — si la borras, hay que volver a
 *   introducir la contraseña.
 * - `error`: último error de RPC, útil para el modal.
 *
 * La contraseña real vive sólo en la BD (bcrypt). Estas funciones sólo llaman
 * a las RPCs correspondientes; no reciben ni guardan el hash.
 */

const LS_KEY = 'sv-admin-auth-v1';
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [autenticado, setAutenticado] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === 'ok';
    } catch {
      return false;
    }
  });
  const [passwordFijada, setPasswordFijada] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase.rpc('admin_password_is_set');
        if (err) throw err;
        if (!cancelled) setPasswordFijada(!!data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Error consultando el estado de admin');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const marcarAutenticado = useCallback(() => {
    try { localStorage.setItem(LS_KEY, 'ok'); } catch { /* localStorage bloqueado, seguimos en memoria */ }
    setAutenticado(true);
  }, []);

  const fijarPassword = useCallback(async (nueva) => {
    setPending(true);
    setError('');
    try {
      const { error: err } = await supabase.rpc('set_admin_password', { new_password: nueva });
      if (err) throw err;
      setPasswordFijada(true);
      marcarAutenticado();
      return true;
    } catch (e) {
      setError(e.message || 'No se pudo fijar la contraseña');
      return false;
    } finally {
      setPending(false);
    }
  }, [marcarAutenticado]);

  const verificarPassword = useCallback(async (input) => {
    setPending(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('verify_admin_password', { input_password: input });
      if (err) throw err;
      if (!data) {
        setError('Contraseña incorrecta');
        return false;
      }
      marcarAutenticado();
      return true;
    } catch (e) {
      setError(e.message || 'No se pudo verificar la contraseña');
      return false;
    } finally {
      setPending(false);
    }
  }, [marcarAutenticado]);

  const salir = useCallback(() => {
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    setAutenticado(false);
    setError('');
  }, []);

  const value = useMemo(
    () => ({ autenticado, passwordFijada, error, pending, fijarPassword, verificarPassword, salir }),
    [autenticado, passwordFijada, error, pending, fijarPassword, verificarPassword, salir],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth tiene que estar dentro de <AdminAuthProvider>');
  return ctx;
}

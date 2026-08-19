import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copia .env.example a .env.local y rellena los valores.'
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // Todavía no hay login (llega en la Fase 2). Sin sesión que persistir,
    // evitamos que el cliente toque localStorage en cada arranque.
    persistSession: false,
    autoRefreshToken: false,
  },
});

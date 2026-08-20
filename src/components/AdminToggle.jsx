import { useState } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminPasswordModal } from './AdminPasswordModal';

/**
 * Botón discreto en el header que activa/desactiva el modo admin.
 *
 * - Desautenticado: candado cerrado gris; al pulsar abre el modal.
 * - Autenticado: candado abierto rojo; al pulsar cierra sesión (borra flag
 *   de localStorage). No pide confirmación — es reversible sin fricción.
 */
export function AdminToggle() {
  const { autenticado, salir } = useAdminAuth();
  const [modalAbierto, setModalAbierto] = useState(false);

  const handleClick = () => {
    if (autenticado) salir();
    else setModalAbierto(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={autenticado ? 'Salir del modo admin' : 'Activar modo admin'}
        title={autenticado ? 'Modo admin activo — pulsa para salir' : 'Activar modo admin'}
        className={`w-8 h-8 flex items-center justify-center border-2 transition-colors ${
          autenticado
            ? 'border-[var(--sv-primary)] text-[var(--sv-primary)] bg-[color:rgb(196_18_48/0.08)]'
            : 'border-[var(--sv-on-surface-muted)] text-[var(--sv-on-surface-muted)] hover:border-[var(--sv-on-surface)] hover:text-[var(--sv-on-surface)]'
        }`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
          {autenticado ? (
            /* Candado abierto */
            <path d="M12 2a5 5 0 00-5 5v1H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2h-9V7a3 3 0 016 0v1h2V7a5 5 0 00-5-5z" />
          ) : (
            /* Candado cerrado */
            <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3H9z" />
          )}
        </svg>
      </button>

      {modalAbierto && (
        <AdminPasswordModal
          onCerrar={() => setModalAbierto(false)}
          onExito={() => setModalAbierto(false)}
        />
      )}
    </>
  );
}

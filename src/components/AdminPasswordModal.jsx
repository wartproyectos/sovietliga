import { useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { IconoEstrella } from './IconoEstrella';

/**
 * Modal que aparece cuando alguien pulsa "modo admin" sin estar autenticado.
 *
 * Dos modos:
 *   - Si la contraseña NO está fijada: pide una nueva (con confirmación).
 *   - Si YA está fijada: pide introducir la existente.
 *
 * Se monta sólo cuando está abierto (ver `AdminToggle`), así el estado local
 * arranca limpio cada vez y no hace falta resetearlo con un efecto.
 */
export function AdminPasswordModal({ onCerrar, onExito }) {
  const { passwordFijada, error, pending, fijarPassword, verificarPassword } = useAdminAuth();
  const [pass, setPass] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errLocal, setErrLocal] = useState('');
  const inputRef = useRef(null);

  const modoCrear = passwordFijada === false;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCerrar]);

  // Mientras cargamos el estado inicial, no sabemos aún si es crear/verificar.
  const cargando = passwordFijada === null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrLocal('');

    if (modoCrear) {
      if (pass.length < 6) {
        setErrLocal('Mínimo 6 caracteres');
        return;
      }
      if (pass !== confirmar) {
        setErrLocal('Las contraseñas no coinciden');
        return;
      }
      const ok = await fijarPassword(pass);
      if (ok) onExito?.();
    } else {
      const ok = await verificarPassword(pass);
      if (ok) onExito?.();
    }
  };

  const errMostrado = errLocal || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Modo administrador"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[color:rgb(20_10_10/0.55)] backdrop-blur-[2px]"
        onClick={onCerrar}
        aria-label="Cerrar"
      />

      <div className="relative w-full max-w-sm bg-[var(--sv-surface)] shadow-[10px_10px_0_rgba(0,0,0,0.5)]">
        <div className="h-1.5 bg-[var(--sv-primary)]" />

        <div className="bg-[var(--sv-on-surface)] px-5 py-5 flex items-center gap-2.5">
          <IconoEstrella className="w-6 h-6 text-[var(--sv-primary)] shrink-0" />
          <h3 className="font-[Oswald] text-xl font-bold uppercase tracking-[0.02em] text-[var(--sv-surface)] leading-none">
            {cargando ? 'Modo Admin' : modoCrear ? 'Crear contraseña' : 'Modo Admin'}
          </h3>
        </div>

        {cargando ? (
          <div className="p-5 text-sm text-[var(--sv-on-surface-muted)]">Comprobando estado…</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <p className="text-[13px] text-[var(--sv-on-surface)] leading-snug">
              {modoCrear
                ? 'Nadie ha fijado todavía la contraseña de admin. Elígela ahora y compártela con quien deba tener acceso.'
                : 'Introduce la contraseña compartida para activar el modo edición.'}
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)]">
                Contraseña
              </span>
              <input
                ref={inputRef}
                type="password"
                autoComplete={modoCrear ? 'new-password' : 'current-password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="border-2 border-[var(--sv-on-surface)] bg-white px-3 py-2.5 text-base font-mono focus:outline-none focus:border-[var(--sv-primary)]"
                required
              />
            </label>

            {modoCrear && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)]">
                  Repítela
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  className="border-2 border-[var(--sv-on-surface)] bg-white px-3 py-2.5 text-base font-mono focus:outline-none focus:border-[var(--sv-primary)]"
                  required
                />
              </label>
            )}

            {errMostrado && (
              <p
                role="alert"
                className="text-[12px] font-bold text-[var(--sv-primary)] uppercase tracking-[0.06em]"
              >
                {errMostrado}
              </p>
            )}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 border-2 border-[var(--sv-on-surface)] px-4 py-3 text-[13px] font-bold uppercase tracking-[0.09em] font-[Oswald] hover:bg-[var(--sv-surface-low)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="sv-cta flex-1 text-[13px] py-3 disabled:opacity-60"
              >
                {pending ? '…' : modoCrear ? 'Fijar' : 'Entrar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

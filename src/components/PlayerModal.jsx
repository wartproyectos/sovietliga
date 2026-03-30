import { useEffect } from 'react';

export function PlayerModal({ player, onClose }) {
  useEffect(() => {
    if (!player) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [player, onClose]);

  if (!player) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de ${player.nombre}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-stone-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-stone-200">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{player.nombre}</h3>
            <p className="text-sm text-stone-500">Posición #{player.pos}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC143C]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Partidos jugados</dt>
              <dd className="text-xl font-bold text-stone-900">{player.pj}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Victorias</dt>
              <dd className="text-xl font-bold text-stone-900">{player.v}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">% Victorias</dt>
              <dd className="text-xl font-bold text-stone-900">{player.porcentaje.toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Reservas</dt>
              <dd className="text-xl font-bold text-stone-900">{player.reservas}</dd>
            </div>
          </dl>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#DC143C] px-4 py-2 text-white text-sm font-medium hover:bg-[#b0102f] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#DC143C]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

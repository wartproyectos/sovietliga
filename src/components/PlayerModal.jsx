import { useEffect } from 'react';
import { posLabel } from '../data/posiciones';
import { IconoEstrella } from './IconoEstrella';

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

  const p = player.pos_principal;
  const s = player.pos_secundaria;
  const positionText = p
    ? `${posLabel(p)} (${p})${s ? ` · ${posLabel(s)} (${s})` : ''}`
    : 'Sin definir';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de ${player.nombre}`}
    >
      {/* Backdrop tintado. */}
      <button
        type="button"
        className="absolute inset-0 bg-[color:rgb(20_10_10/0.55)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="relative w-full max-w-md bg-[var(--sv-surface)] shadow-[10px_10px_0_rgba(0,0,0,0.5)]">
        {/* Barra de acento superior. */}
        <div className="h-1.5 bg-[var(--sv-primary)]" />

        {/* Cabecera negra. */}
        <div className="bg-[var(--sv-on-surface)] px-5 py-5 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 border-2 border-[var(--sv-surface)] flex items-center justify-center text-[var(--sv-surface)] hover:bg-[color:rgb(242_234_217/0.15)] transition-colors focus:outline-none"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5 pr-8">
            <IconoEstrella className="w-6 h-6 text-[var(--sv-primary)] shrink-0" />
            <h3 className="font-[Oswald] text-2xl sm:text-[26px] font-bold uppercase tracking-[0.02em] text-[var(--sv-surface)] leading-none">
              {player.nombre}
            </h3>
          </div>

          <div className="inline-block bg-[var(--sv-primary)] px-2.5 py-1 mt-3">
            <span className="font-[Oswald] text-[11px] font-bold uppercase tracking-[0.1em] text-white">
              Ranking #{player.pos}
            </span>
          </div>

          <p className="mt-3 font-[Oswald] text-xs uppercase tracking-[0.06em] text-[color:rgb(201_189_184/0.95)] font-semibold">
            Posición: {positionText}
          </p>
        </div>

        {/* Grid de stats. */}
        <div className="px-5 py-6 grid grid-cols-2 gap-y-5 gap-x-6">
          <StatCell label="Partidos jugados" value={player.pj} />
          <StatCell label="Victorias" value={player.v} />
          <StatCell label="% Victorias" value={`${Math.round(Number(player.porcentaje ?? 0))}%`} accent />
          <StatCell label="Reservas" value={player.reservas} />
        </div>

        {/* CTA cerrar. */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="sv-cta w-full text-[13px] py-3.5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent = false }) {
  return (
    <div>
      <p className="font-[Oswald] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--sv-on-surface-muted)] mb-1.5">
        {label}
      </p>
      <p className={`font-[Oswald] text-[30px] font-bold leading-none ${accent ? 'text-[var(--sv-primary)]' : 'text-[var(--sv-on-surface)]'}`}>
        {value}
      </p>
    </div>
  );
}

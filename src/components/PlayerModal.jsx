import { useEffect } from 'react';

const POS_LABELS = {
  1: 'Base',
  2: 'Escolta',
  3: 'Alero',
  4: 'Ala-Pívot',
  5: 'Pívot',
};

const PLAYER_POSITIONS = {
  Adrianskj: { principal: 4, secundaria: 3 },
  Alvarezko: { principal: 3, secundaria: 4 },
  Danilov: { principal: 2, secundaria: 1 },
  Davidov: { principal: 5, secundaria: 4 },
  Evgeni: { principal: 5, secundaria: 4 },
  Machin: { principal: 2, secundaria: 1 },
  Gazalov: { principal: 3, secundaria: 2 },
  Germanov: { principal: 5, secundaria: 4 },
  Isaac: { principal: 3, secundaria: 2 },
  Kostis: { principal: 4, secundaria: 5 },
  Ladrinskj: { principal: 1, secundaria: 2 },
  Mijailichenko: { principal: 3, secundaria: 4 },
  Oriolev: { principal: 4, secundaria: 5 },
  Ricky: { principal: 4, secundaria: 5 },
  Santiagovitx: { principal: 4, secundaria: 3 },
  Stefanov: { principal: 4, secundaria: 3 },
  Teleskov: { principal: 2, secundaria: 1 },
  Vinyalovic: { principal: 2, secundaria: 1 },
  Xavi: { principal: 2, secundaria: 3 },
  Yuri: { principal: 1, secundaria: 2 },
};

const normalizePlayerName = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
const PLAYER_POSITIONS_NORMALIZED = Object.fromEntries(
  Object.entries(PLAYER_POSITIONS).map(([name, data]) => [normalizePlayerName(name), data])
);

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

  const playerPos = PLAYER_POSITIONS_NORMALIZED[normalizePlayerName(player.nombre)] ?? null;
  const positionText = playerPos
    ? `${POS_LABELS[playerPos.principal]} (${playerPos.principal}) · ${POS_LABELS[playerPos.secundaria]} (${playerPos.secundaria})`
    : 'Sin definir';

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
        className="absolute inset-0 bg-[color:rgb(28_28_20/0.45)]"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="relative w-full max-w-md sv-card border-2 sv-ghost-line">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 bg-[var(--sv-on-surface)] text-[var(--sv-surface)]">
          <div>
            <h3 className="text-2xl font-bold">{player.nombre}</h3>
            <p className="text-xs uppercase tracking-[0.1em] opacity-80">Ranking #{player.pos}</p>
            <p className="text-xs uppercase tracking-[0.1em] opacity-80 mt-1">Posición: {positionText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-1 text-[var(--sv-surface)] hover:bg-[color:rgb(253_250_235/0.15)] focus:outline-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-[var(--sv-on-surface-muted)]">Partidos jugados</dt>
              <dd className="text-2xl font-bold text-[var(--sv-on-surface)]">{player.pj}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-[var(--sv-on-surface-muted)]">Victorias</dt>
              <dd className="text-2xl font-bold text-[var(--sv-on-surface)]">{player.v}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-[var(--sv-on-surface-muted)]">% Victorias</dt>
              <dd className="text-2xl font-bold text-[var(--sv-on-surface)]">{Math.round(Number(player.porcentaje ?? 0))}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-[var(--sv-on-surface-muted)]">Reservas</dt>
              <dd className="text-2xl font-bold text-[var(--sv-on-surface)]">{player.reservas}</dd>
            </div>
          </dl>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="sv-btn-primary px-4 py-2 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

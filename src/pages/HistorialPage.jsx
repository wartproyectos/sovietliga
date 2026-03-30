import { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A partir del array de jugadores (cada uno con jornadaParticipacion y
 * jornadaVictorias), construye un array de jornadas con la información
 * pivotada: ganadores, perdedores, empate, reservas.
 */
function buildHistorial(clasificacion) {
  if (!clasificacion || clasificacion.length === 0) return [];

  const maxLen = Math.max(
    ...clasificacion.map((p) => p.jornadaParticipacion?.length ?? 0)
  );

  const jornadas = [];

  for (let i = 0; i < maxLen; i++) {
    const ganadores = [];
    const perdedores = [];
    const empate = [];
    const reservas = [];
    let hasData = false;

    for (const player of clasificacion) {
      const part = player.jornadaParticipacion?.[i];
      const vic = player.jornadaVictorias?.[i];
      const isReserve = typeof part === 'string' && part.trim().toUpperCase() === 'R';

      if (isReserve) {
        reservas.push(player.nombre);
        hasData = true;
      } else if (part === 1) {
        hasData = true;
        if (vic === 1) ganadores.push(player.nombre);
        else if (vic === 0.5) empate.push(player.nombre);
        else perdedores.push(player.nombre); // vic === 0 o null
      }
    }

    if (hasData) {
      ganadores.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      perdedores.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      empate.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      reservas.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      jornadas.push({ numero: i + 1, ganadores, perdedores, empate, reservas });
    }
  }

  // Más reciente primero
  return jornadas.reverse();
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function PlayerBadge({ nombre, variant }) {
  const colors = {
    win: 'bg-[var(--sv-primary)] text-white',
    loss: 'bg-[var(--sv-surface)] text-[var(--sv-on-surface)]',
    draw: 'bg-[#efe9c9] text-[var(--sv-on-surface)]',
    reserve: 'bg-[var(--sv-surface-dim)] text-[var(--sv-on-surface)]',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] ${colors[variant]}`}
    >
      {nombre}
    </span>
  );
}

function TeamSection({ label, icon, players, variant, emptyMsg }) {
  if (!players || players.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.11em] text-[var(--sv-on-surface-muted)] mb-2">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {players.map((n) => (
          <PlayerBadge key={n} nombre={n} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function JornadaCard({ jornada }) {
  const [open, setOpen] = useState(false);
  const { numero, ganadores, perdedores, empate, reservas } = jornada;
  const isDraw = empate.length > 0 && ganadores.length === 0 && perdedores.length === 0;
  const totalJugadores = ganadores.length + perdedores.length + empate.length;

  let resultLabel;
  let resultColor;
  if (isDraw) {
    resultLabel = 'Empate';
    resultColor = 'text-amber-600';
  } else if (ganadores.length > 0 && perdedores.length > 0) {
    resultLabel = `${ganadores[0]} y ${ganadores.length - 1 > 0 ? `+${ganadores.length - 1}` : ''} ganaron`;
    resultColor = 'text-emerald-700';
  } else {
    resultLabel = 'Sin resultado';
    resultColor = 'text-stone-400';
  }

  return (
    <div className="sv-panel overflow-hidden">
      {/* Header (siempre visible) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-5 flex items-center justify-between gap-3 hover:bg-[var(--sv-surface-low)] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-left min-w-0">
            <p className="text-lg font-bold text-[var(--sv-on-surface)] truncate uppercase">
              Jornada {numero}
            </p>
            <p className={`text-xs truncate uppercase tracking-[0.08em] ${resultColor}`}>{resultLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
            {totalJugadores} jugaron · {reservas.length} res.
          </span>
          <span
            className={`text-[var(--sv-on-surface-muted)] transition-transform text-sm ${open ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Detalle expandible */}
      {open && (
        <div className="px-6 pb-5 pt-3 border-t sv-ghost-line flex flex-col gap-3">
          {ganadores.length > 0 && (
            <TeamSection
              label="Equipo ganador"
              icon="🏆"
              players={ganadores}
              variant="win"
            />
          )}
          {perdedores.length > 0 && (
            <TeamSection
              label="Equipo perdedor"
              icon="😤"
              players={perdedores}
              variant="loss"
            />
          )}
          {empate.length > 0 && (
            <TeamSection
              label="Empate"
              icon="🤝"
              players={empate}
              variant="draw"
            />
          )}
          {reservas.length > 0 && (
            <TeamSection
              label="Reservas"
              icon="🪑"
              players={reservas}
              variant="reserve"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function HistorialPage({ clasificacion }) {
  const historial = useMemo(() => buildHistorial(clasificacion), [clasificacion]);

  if (!clasificacion || clasificacion.length === 0) {
    return (
      <div className="sv-panel p-8 text-left">
        <div className="text-4xl mb-4">◪</div>
        <p className="text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">Cargando historial...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-4xl font-bold text-[var(--sv-on-surface)] leading-none">Historial de Jornadas</h2>
          <p className="text-sm text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em] mt-2">{historial.length} jornadas registradas</p>
        </div>
      </div>

      {/* Lista de jornadas */}
      {historial.length === 0 ? (
        <div className="sv-panel p-8 text-center text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
          No hay jornadas con resultado registrado.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {historial.map((j) => (
            <JornadaCard key={j.numero} jornada={j} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { PageState } from '../components/PageState';
import { IconoEstrella } from '../components/IconoEstrella';

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

/** Tag con nombre — sólido rojo para ganadores, contorno negro para perdedores. */
function PlayerTag({ nombre, variant }) {
  const styles = {
    win: 'bg-[var(--sv-primary)] text-white border-2 border-[var(--sv-primary)]',
    loss: 'bg-transparent text-[var(--sv-on-surface)] border-2 border-[var(--sv-on-surface)]',
    draw: 'bg-[var(--sv-surface-low)] text-[var(--sv-on-surface)] border-2 border-[var(--sv-on-surface)]',
    reserve: 'bg-transparent text-[var(--sv-on-surface-soft)] border-2 border-dashed border-[var(--sv-on-surface-muted)]',
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.02em] ${styles[variant]}`}
    >
      {nombre}
    </span>
  );
}

function TeamSection({ label, iconMode, players, variant }) {
  if (!players || players.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {iconMode === 'star' ? (
          <IconoEstrella className="w-4 h-4 text-[var(--sv-primary)] shrink-0" />
        ) : iconMode === 'ring' ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-[var(--sv-on-surface-muted)] rounded-full shrink-0" />
        ) : (
          <span className="inline-block w-3.5 h-3.5 bg-[var(--sv-on-surface-muted)] shrink-0" />
        )}
        <span className={`text-[12px] font-bold uppercase tracking-[0.02em] ${variant === 'win' ? 'text-[var(--sv-on-surface)]' : 'text-[var(--sv-on-surface-muted)]'}`}>
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {players.map((n) => (
          <PlayerTag key={n} nombre={n} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function JornadaCard({ jornada, isFirst }) {
  const [open, setOpen] = useState(isFirst);
  const { numero, ganadores, perdedores, empate, reservas } = jornada;
  const isDraw = empate.length > 0 && ganadores.length === 0 && perdedores.length === 0;
  const totalJugadores = ganadores.length + perdedores.length + empate.length;

  let resultLabel;
  if (isDraw) {
    resultLabel = 'Empate';
  } else if (ganadores.length > 0 && perdedores.length > 0) {
    resultLabel =
      ganadores.length === 1
        ? `Ganó ${ganadores[0]}`
        : `Ganaron ${ganadores[0]} y ${ganadores.length - 1} más`;
  } else {
    resultLabel = 'Sin resultado';
  }

  // Las tarjetas comparten bordes con la siguiente para formar una tira continua.
  return (
    <div className={`bg-white border-2 border-[var(--sv-on-surface)] ${isFirst ? '' : 'border-t-0'}`}>
      {/* Fila resumen (siempre visible). */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--sv-surface-low)] transition-colors"
      >
        <div className="min-w-0">
          <p className="font-[Oswald] text-[17px] font-bold uppercase tracking-[0.02em] text-[var(--sv-on-surface)] leading-none">
            Jornada {numero}
          </p>
          <p className="mt-1.5 text-[12px] font-bold text-[var(--sv-primary)] truncate">
            {resultLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-semibold text-[var(--sv-on-surface-muted)] uppercase tracking-[0.06em]">
            {totalJugadores} jugaron · {reservas.length} res.
          </span>
          <span
            className={`text-[var(--sv-on-surface-muted)] transition-transform text-xs ${open ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Detalle expandible. */}
      {open && (
        <div className="border-t-2 border-[var(--sv-on-surface)] px-4 py-4 flex flex-col gap-4">
          {ganadores.length > 0 && (
            <TeamSection
              label="Equipo ganador"
              iconMode="star"
              players={ganadores}
              variant="win"
            />
          )}
          {perdedores.length > 0 && (
            <TeamSection
              label="Equipo perdedor"
              iconMode="ring"
              players={perdedores}
              variant="loss"
            />
          )}
          {empate.length > 0 && (
            <TeamSection
              label="Empate"
              iconMode="ring"
              players={empate}
              variant="draw"
            />
          )}
          {reservas.length > 0 && (
            <TeamSection
              label="Reservas"
              iconMode="square"
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

export function HistorialPage({ clasificacion, loading, error }) {
  const historial = useMemo(() => buildHistorial(clasificacion), [clasificacion]);

  // Número de la última jornada jugada (historial está ordenado de más reciente
  // a más antigua, así que el primer elemento tiene el número más alto).
  const totalJornadas = historial.length > 0 ? historial[0].numero : 0;

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingMessage="Cargando historial..." />;
  }

  return (
    <div className="flex flex-col gap-6 px-4">
      {/* Cabecera. */}
      <div>
        <div className="flex items-center gap-3">
          <IconoEstrella className="w-6 h-6 text-[var(--sv-primary)] shrink-0" />
          <h2 className="text-[28px] sm:text-[32px] leading-[0.96] font-bold text-[var(--sv-on-surface)]">
            Historial de<br />Jornadas
          </h2>
        </div>
        <p className="mt-3 font-[Oswald] text-xs font-semibold uppercase tracking-[0.09em] text-[var(--sv-on-surface-muted)]">
          {totalJornadas} jornadas registradas
        </p>
      </div>

      {/* Lista de jornadas — bordes fundidos en una sola tira. */}
      {historial.length === 0 ? (
        <div className="bg-white border-2 border-[var(--sv-on-surface)] p-8 text-center text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em] font-[Oswald]">
          No hay jornadas con resultado registrado.
        </div>
      ) : (
        <div>
          {historial.map((j, i) => (
            <JornadaCard key={j.numero} jornada={j} isFirst={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

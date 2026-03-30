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
    win:     'bg-emerald-50 text-emerald-800 border border-emerald-200',
    loss:    'bg-red-50 text-red-800 border border-red-200',
    draw:    'bg-amber-50 text-amber-800 border border-amber-200',
    reserve: 'bg-stone-100 text-stone-500 border border-stone-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}
    >
      {nombre}
    </span>
  );
}

function TeamSection({ label, icon, players, variant, emptyMsg }) {
  if (!players || players.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">
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
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
      {/* Header (siempre visible) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-9 h-9 rounded-full bg-[#DC143C]/10 flex items-center justify-center text-sm font-bold text-[#DC143C]">
            {numero}
          </span>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-stone-800 truncate">
              Jornada {numero}
            </p>
            <p className={`text-xs truncate ${resultColor}`}>{resultLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-stone-400">
            {totalJugadores} jugaron · {reservas.length} res.
          </span>
          <span
            className={`text-stone-400 transition-transform text-sm ${open ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Detalle expandible */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-stone-100 flex flex-col gap-3">
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
  const [filter, setFilter] = useState('todas'); // 'todas' | 'con-resultado'

  const filtered = useMemo(() => {
    if (filter === 'con-resultado') {
      return historial.filter(
        (j) => j.ganadores.length > 0 || j.empate.length > 0
      );
    }
    return historial;
  }, [historial, filter]);

  if (!clasificacion || clasificacion.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-stone-500">Cargando historial...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + filtro */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Historial de Jornadas</h2>
          <p className="text-sm text-stone-400">{historial.length} jornadas registradas</p>
        </div>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1 text-xs font-medium">
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'con-resultado', label: 'Con resultado' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filter === id
                  ? 'bg-white text-[#DC143C] shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de jornadas */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-stone-400">
          No hay jornadas con resultado registrado.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((j) => (
            <JornadaCard key={j.numero} jornada={j} />
          ))}
        </div>
      )}
    </div>
  );
}

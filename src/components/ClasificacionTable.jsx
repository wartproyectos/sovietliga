import { Fragment, useState, useMemo } from 'react';
import { PlayerModal } from './PlayerModal';
import { CHAMPION_JORNADA, MIN_PARTIDOS_CLASIFICACION } from '../constants';

const SORT_ARROW = { asc: ' ▲', desc: ' ▼' };

function SortableHeader({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-2 sm:px-4 py-2 sm:py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`w-full flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-[0.12em] hover:text-[var(--sv-primary-strong)] transition-colors ${active ? 'text-[var(--sv-primary-strong)] font-semibold' : ''}`}
      >
        {label}
        {active ? SORT_ARROW[sort.dir] : ''}
      </button>
    </th>
  );
}

export function ClasificacionTable({ clasificacion, jornada }) {
  // Orden inicial: %V de mayor a menor (la cabecera de "%V" usa sortKey="porcentaje")
  const [sort, setSort] = useState({ key: 'porcentaje', dir: 'desc' });
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  function toggleSort(key) {
    setSort((s) => {
      if (s.key === key) return { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: key === 'nombre' ? 'asc' : 'desc' };
    });
  }

  const sorted = useMemo(() => {
    const copy = [...clasificacion];
    const { key, dir } = sort;

    const compareByCurrentSort = (a, b) => {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'string' || typeof vb === 'string') {
        const cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'es', { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
      }
      return dir === 'asc' ? Number(va ?? 0) - Number(vb ?? 0) : Number(vb ?? 0) - Number(va ?? 0);
    };

    // Regla de clasificación: jugadores por debajo del mínimo de PJ siempre al final.
    const withMinGames = copy
      .filter((p) => Number(p.pj ?? 0) >= MIN_PARTIDOS_CLASIFICACION)
      .sort(compareByCurrentSort);
    const underMinGames = copy
      .filter((p) => Number(p.pj ?? 0) < MIN_PARTIDOS_CLASIFICACION)
      .sort(compareByCurrentSort);
    const ordered = withMinGames.concat(underMinGames);

    return ordered.map((r, i) => ({ ...r, pos: i + 1 }));
  }, [clasificacion, sort]);

  const cutoffIdx = useMemo(
    () => sorted.findIndex((p) => Number(p.pj ?? 0) < MIN_PARTIDOS_CLASIFICACION),
    [sorted]
  );

  // Campeón: líder oficial (%V, con mínimo de 10 PJ) una vez alcanzada la jornada
  // definida en CHAMPION_JORNADA. Se calcula según la clasificación real,
  // independientemente del orden que el usuario aplique a la tabla.
  const championNombre = useMemo(() => {
    if (!jornada || jornada < CHAMPION_JORNADA) return null;
    const eligible = clasificacion.filter((p) => Number(p.pj ?? 0) >= MIN_PARTIDOS_CLASIFICACION);
    if (eligible.length === 0) return null;
    const leader = [...eligible].sort(
      (a, b) => Number(b.porcentaje ?? 0) - Number(a.porcentaje ?? 0)
    )[0];
    return leader?.nombre ?? null;
  }, [clasificacion, jornada]);

  return (
    <>
      <section className="sv-panel overflow-hidden">
        <div className="px-4 sm:px-7 pt-4 sm:pt-5 pb-5 sm:pb-8">
          <h2 className="text-[38px] sm:text-[56px] leading-[0.96] sm:leading-[0.94] font-bold text-[var(--sv-on-surface)]">Clasificación General</h2>
          <div className="mt-3 sm:mt-5 w-16 sm:w-24 h-3 sm:h-4 bg-[var(--sv-primary-strong)]" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--sv-on-surface)] text-[var(--sv-surface)] text-[10px] sm:text-xs font-semibold tracking-[0.08em] sm:tracking-[0.16em] uppercase">
                <th className="px-2 sm:px-4 py-2 sm:py-3 w-8 sm:w-10">#</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('nombre')}
                    className={`flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-[0.12em] hover:text-[var(--sv-primary-strong)] transition-colors ${sort.key === 'nombre' ? 'text-[var(--sv-primary-strong)] font-semibold' : ''}`}
                  >
                    Jugador{sort.key === 'nombre' ? SORT_ARROW[sort.dir] : ''}
                  </button>
                </th>
                <SortableHeader label="PJ"   sortKey="pj"         sort={sort} onSort={toggleSort} className="text-center w-16" />
                <SortableHeader label="V"    sortKey="v"          sort={sort} onSort={toggleSort} className="text-center w-16" />
                <SortableHeader label="%V"   sortKey="porcentaje" sort={sort} onSort={toggleSort} className="text-center w-20" />
                <SortableHeader label="Res." sortKey="reservas"   sort={sort} onSort={toggleSort} className="text-center w-16" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const isChampion = championNombre && row.nombre === championNombre;
                return (
                <Fragment key={row.nombre}>
                  {cutoffIdx > 0 && idx === cutoffIdx && (
                    <tr className="bg-[var(--sv-surface)]">
                      <td colSpan={6} className="px-3 sm:px-6 py-2 sm:py-3 text-[11px] sm:text-base text-[var(--sv-primary)] font-bold uppercase tracking-[0.03em] border-b-4 border-[var(--sv-primary)]">
                        Jugadores con menos de {MIN_PARTIDOS_CLASIFICACION} Partidos Jugados
                      </td>
                    </tr>
                  )}
                  <tr className={`${isChampion ? 'sv-champion' : idx % 2 === 0 ? 'bg-[var(--sv-surface)]' : 'bg-[var(--sv-surface-low)]'} border-b sv-ghost-line transition-colors`}>
                    <td className={`px-2 sm:px-4 py-2.5 sm:py-4 font-bold text-lg sm:text-3xl ${isChampion ? 'text-[var(--sv-gold-strong)]' : 'text-[var(--sv-on-surface)]'}`}>{isChampion ? '★' : String(row.pos).padStart(2, '0')}</td>
                    <td className="px-2 sm:px-4 py-2">
                      <button
                        type="button"
                        className="font-bold uppercase text-[11px] sm:text-base text-[var(--sv-on-surface)] text-left w-full hover:text-[var(--sv-primary-strong)] transition-colors focus:outline-none"
                        onClick={() => setSelectedPlayer(row)}
                      >
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {row.nombre}
                          {isChampion && <span className="sv-champion-badge text-[9px] sm:text-[11px]">★ Campeón</span>}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 sm:px-4 py-2 text-center text-[var(--sv-on-surface)] text-base sm:text-3xl font-medium">{row.pj}</td>
                    <td className="px-2 sm:px-4 py-2 text-center text-[var(--sv-on-surface)] text-base sm:text-3xl font-medium">{row.v}</td>
                    <td className="px-2 sm:px-4 py-2 text-center font-semibold text-[var(--sv-on-surface)] text-base sm:text-3xl">{Math.round(Number(row.porcentaje ?? 0))}%</td>
                    <td className="px-2 sm:px-4 py-2 text-center text-[var(--sv-on-surface-muted)] text-xs sm:text-lg">{row.reservas}</td>
                  </tr>
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-3 sm:px-4 py-3 sm:py-4 bg-[var(--sv-surface-dim)] text-[10px] sm:text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.06em] sm:tracking-[0.08em]">
          PJ = Partidos jugados · V = Victorias · %V = % victorias · Res. = Veces reserva
        </div>
      </section>

      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </>
  );
}

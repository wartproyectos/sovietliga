import { Fragment, useState, useMemo } from 'react';
import { PlayerModal } from './PlayerModal';

const SORT_ARROW = { asc: ' ▲', desc: ' ▼' };

function SortableHeader({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`w-full flex items-center justify-center gap-1 uppercase tracking-[0.12em] hover:text-[var(--sv-primary-strong)] transition-colors ${active ? 'text-[var(--sv-primary-strong)] font-semibold' : ''}`}
      >
        {label}
        {active ? SORT_ARROW[sort.dir] : ''}
      </button>
    </th>
  );
}

export function ClasificacionTable({ clasificacion }) {
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

    // Regla de clasificación: jugadores con menos de 10 PJ siempre al final.
    const withMinGames = copy.filter((p) => Number(p.pj ?? 0) >= 10).sort(compareByCurrentSort);
    const underMinGames = copy.filter((p) => Number(p.pj ?? 0) < 10).sort(compareByCurrentSort);
    const ordered = withMinGames.concat(underMinGames);

    return ordered.map((r, i) => ({ ...r, pos: i + 1 }));
  }, [clasificacion, sort]);

  const cutoffIdx = useMemo(
    () => sorted.findIndex((p) => Number(p.pj ?? 0) < 10),
    [sorted]
  );

  return (
    <>
      <section className="sv-panel overflow-hidden">
        <div className="px-7 pt-5 pb-8">
          <h2 className="text-[56px] leading-[0.94] font-bold text-[var(--sv-on-surface)]">Clasificación General</h2>
          <div className="mt-5 w-24 h-4 bg-[var(--sv-primary-strong)]" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--sv-on-surface)] text-[var(--sv-surface)] text-xs font-semibold tracking-[0.16em] uppercase">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('nombre')}
                    className={`flex items-center gap-1 uppercase tracking-[0.12em] hover:text-[var(--sv-primary-strong)] transition-colors ${sort.key === 'nombre' ? 'text-[var(--sv-primary-strong)] font-semibold' : ''}`}
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
              {sorted.map((row, idx) => (
                <Fragment key={row.nombre}>
                  {cutoffIdx > 0 && idx === cutoffIdx && (
                    <tr className="bg-[var(--sv-surface)]">
                      <td colSpan={6} className="px-6 py-3 text-base text-[var(--sv-primary)] font-bold uppercase tracking-[0.03em] border-b-4 border-[var(--sv-primary)]">
                        Jugadores con menos de 10 Partidos Jugados
                      </td>
                    </tr>
                  )}
                  <tr className={`${idx % 2 === 0 ? 'bg-[var(--sv-surface)]' : 'bg-[var(--sv-surface-low)]'} border-b sv-ghost-line transition-colors`}>
                    <td className="px-4 py-4 font-bold text-[var(--sv-on-surface)] text-3xl">{String(row.pos).padStart(2, '0')}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-bold uppercase text-[var(--sv-on-surface)] text-left w-full hover:text-[var(--sv-primary-strong)] transition-colors focus:outline-none"
                        onClick={() => setSelectedPlayer(row)}
                      >
                        {row.nombre}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--sv-on-surface)] text-3xl font-medium">{row.pj}</td>
                    <td className="px-4 py-3 text-center text-[var(--sv-on-surface)] text-3xl font-medium">{row.v}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[var(--sv-on-surface)] text-3xl">{row.porcentaje.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center text-[var(--sv-on-surface-muted)] text-lg">{row.reservas}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-4 bg-[var(--sv-surface-dim)] text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
          PJ = Partidos jugados · V = Victorias · %V = % victorias · Res. = Veces reserva
        </div>
      </section>

      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </>
  );
}

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
        className={`w-full flex items-center justify-center gap-1 hover:text-[#DC143C] transition-colors ${active ? 'text-[#DC143C] font-semibold' : ''}`}
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
      <section className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-amber-50">
          <h2 className="text-lg font-semibold text-stone-800">Clasificación</h2>
          <p className="text-sm text-stone-500">Toca un jugador para ver su detalle</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-100 text-stone-600 text-sm font-medium">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('nombre')}
                    className={`flex items-center gap-1 hover:text-[#DC143C] transition-colors ${sort.key === 'nombre' ? 'text-[#DC143C] font-semibold' : ''}`}
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
                    <tr className="border-t-2 border-[#DC143C]/30 bg-red-50/50">
                      <td colSpan={6} className="px-4 py-2 text-[11px] text-red-700 font-medium text-center">
                        Jugadores con menos de 10 Partidos Jugados
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-stone-100 hover:bg-amber-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-stone-400 text-sm">{row.pos}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-stone-800 text-left w-full hover:text-[#DC143C] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC143C] rounded"
                        onClick={() => setSelectedPlayer(row)}
                      >
                        {row.nombre}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-stone-600 text-sm">{row.pj}</td>
                    <td className="px-4 py-3 text-center text-stone-600 text-sm">{row.v}</td>
                    <td className="px-4 py-3 text-center font-medium text-stone-800 text-sm">{row.porcentaje.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center text-stone-600 text-sm">{row.reservas}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 bg-stone-50 text-xs text-stone-400 border-t border-stone-100">
          PJ = Partidos jugados · V = Victorias · %V = % victorias · Res. = Veces reserva
        </div>
      </section>

      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </>
  );
}

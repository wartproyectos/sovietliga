import { useState, useMemo } from 'react';
import { getPrincipalPos, getSecondaryPos, posLabel } from '../data/posiciones';
import { PageState } from '../components/PageState';

export function EquiposPage({ clasificacion, loading, error }) {
  const [selectedNames, setSelectedNames] = useState(new Set());
  const [generado, setGenerado] = useState(null);
  const [draggedPlayer, setDraggedPlayer] = useState(null); // { nombre, fromTeam }
  const [dragOverTeam, setDragOverTeam] = useState(null); // 'equipo1' | 'equipo2' | null

  // Jugadores disponibles agrupados por posición principal y ordenados alfabéticamente.
  const jugadoresPorPosicion = useMemo(() => {
    const grupos = { 1: [], 2: [], 3: [], 4: [], 5: [], otros: [] };
    const sorted = [...clasificacion].sort((a, b) => a.nombre.localeCompare(b.nombre));

    for (const player of sorted) {
      const pos = getPrincipalPos(player.nombre);
      if ([1, 2, 3, 4, 5].includes(pos)) grupos[pos].push(player);
      else grupos.otros.push(player);
    }

    return grupos;
  }, [clasificacion]);

  const togglePlayer = (nombre) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else {
        if (next.size < 12) next.add(nombre);
      }
      return next;
    });
  };

  const averagePct = (players) => {
    if (!players || players.length === 0) return 0;
    const total = players.reduce((sum, p) => sum + Number(p.porcentaje ?? 0), 0);
    return total / players.length;
  };

  const movePlayerToOtherTeam = (fromTeamKey, playerName) => {
    setGenerado((prev) => {
      if (!prev) return prev;
      const from = fromTeamKey === 'equipo1' ? 'equipo1' : 'equipo2';
      const to = from === 'equipo1' ? 'equipo2' : 'equipo1';

      const player = prev[from].find((p) => p.nombre === playerName);
      if (!player) return prev;

      return {
        ...prev,
        [from]: prev[from].filter((p) => p.nombre !== playerName),
        [to]: [...prev[to], player],
      };
    });
  };

  const handleDragStart = (fromTeamKey, playerName) => {
    setDraggedPlayer({ nombre: playerName, fromTeam: fromTeamKey });
  };

  const handleDragEnd = () => {
    setDraggedPlayer(null);
    setDragOverTeam(null);
  };

  const handleDropOnTeam = (targetTeamKey) => {
    if (!draggedPlayer) return;
    if (draggedPlayer.fromTeam === targetTeamKey) {
      setDraggedPlayer(null);
      setDragOverTeam(null);
      return;
    }
    movePlayerToOtherTeam(draggedPlayer.fromTeam, draggedPlayer.nombre);
    setDraggedPlayer(null);
    setDragOverTeam(null);
  };

  const generarEquipos = () => {
    if (selectedNames.size !== 12) return;

    // Obtener objetos de jugador de los seleccionados
    const chosen = clasificacion
      .filter((p) => selectedNames.has(p.nombre))
      .map((p) => ({
        ...p,
        posPrincipal: getPrincipalPos(p.nombre),
        posSecundaria: getSecondaryPos(p.nombre),
      }));

    const slots = [];
    for (let pos = 1; pos <= 5; pos++) slots.push({ team: 1, pos });
    for (let pos = 1; pos <= 5; pos++) slots.push({ team: 2, pos });

    const mismatchCostForSlot = (player, slotPos) => {
      if (player.posPrincipal === slotPos) return 0;
      if (player.posSecundaria === slotPos) return 1;
      return 4;
    };

    const getChangeMainPos = (player) => {
      return player.posPrincipal ?? player.posSecundaria ?? null;
    };

    let best = null; // { team1StartersByPos, team2StartersByPos, change1, change2, positionCost, positionBalanceDiff, percentDiff, changePosDiff }

    // Elegimos explícitamente el cambio (6º jugador) de cada equipo.
    // Luego, los 10 restantes se asignan a los 10 slots de posiciones (1-5 en cada equipo).
    for (let i = 0; i < chosen.length; i++) {
      for (let j = 0; j < chosen.length; j++) {
        if (i === j) continue;

        const change1 = chosen[i];
        const change2 = chosen[j];
        const starters = chosen.filter((_, idx) => idx !== i && idx !== j);

        // Ordenamos slots para reducir branching: primero los más "difíciles" de cubrir con 0/1 coste.
        const slotsSorted = [...slots].sort((a, b) => {
          const aMinCount = starters.reduce((acc, p) => acc + (mismatchCostForSlot(p, a.pos) <= 1 ? 1 : 0), 0);
          const bMinCount = starters.reduce((acc, p) => acc + (mismatchCostForSlot(p, b.pos) <= 1 ? 1 : 0), 0);
          return aMinCount - bMinCount;
        });

        const used = new Array(starters.length).fill(false);
        let positionCostSum = 0;
        let team1PositionCost = 0;
        let team2PositionCost = 0;

        const team1StartersByPos = {};
        const team2StartersByPos = {};

        function updateBestIfBetter() {
          const sum1 =
            change1.porcentaje + Object.values(team1StartersByPos).reduce((s, p) => s + p.porcentaje, 0);
          const sum2 =
            change2.porcentaje + Object.values(team2StartersByPos).reduce((s, p) => s + p.porcentaje, 0);
          const percentDiff = Math.abs(sum1 - sum2);

          const c1Pos = getChangeMainPos(change1);
          const c2Pos = getChangeMainPos(change2);
          const changePosDiff = c1Pos == null || c2Pos == null ? 999 : Math.abs(c1Pos - c2Pos);

          const candidate = {
            team1StartersByPos: { ...team1StartersByPos },
            team2StartersByPos: { ...team2StartersByPos },
            change1,
            change2,
            positionCost: positionCostSum,
            positionBalanceDiff: Math.abs(team1PositionCost - team2PositionCost),
            percentDiff,
            changePosDiff,
          };

          if (!best) {
            best = candidate;
            return;
          }

          // Comparación lexicográfica:
          // 1) encaje total de posiciones (lo más 1-1),
          // 2) equilibrio posicional entre ambos equipos,
          // 3) balance de ranking (%V),
          // 4) similitud posicional del cambio.
          if (candidate.positionCost < best.positionCost) best = candidate;
          else if (
            candidate.positionCost === best.positionCost &&
            candidate.positionBalanceDiff < best.positionBalanceDiff
          ) best = candidate;
          else if (
            candidate.positionCost === best.positionCost &&
            candidate.positionBalanceDiff === best.positionBalanceDiff &&
            candidate.percentDiff < best.percentDiff
          ) best = candidate;
          else if (
            candidate.positionCost === best.positionCost &&
            candidate.positionBalanceDiff === best.positionBalanceDiff &&
            candidate.percentDiff === best.percentDiff &&
            candidate.changePosDiff < best.changePosDiff
          ) best = candidate;
        }

        function backtrack(slotIdx) {
          if (slotIdx === slotsSorted.length) {
            updateBestIfBetter();
            return;
          }

          const slot = slotsSorted[slotIdx];

          // Probar primero jugadores con mejor ajuste de posición (coste 0 -> 1 -> 4).
          const candidateIndices = [];
          for (let pIdx = 0; pIdx < starters.length; pIdx++) {
            if (used[pIdx]) continue;
            const cost = mismatchCostForSlot(starters[pIdx], slot.pos);
            candidateIndices.push({ pIdx, cost });
          }
          candidateIndices.sort((a, b) => a.cost - b.cost);

          for (const { pIdx, cost } of candidateIndices) {
            const nextCostSum = positionCostSum + cost;
            if (best && nextCostSum > best.positionCost) continue; // poda lexicográfica por posición

            used[pIdx] = true;

            const player = starters[pIdx];
            if (slot.team === 1) {
              team1StartersByPos[slot.pos] = player;
              team1PositionCost += cost;
            } else {
              team2StartersByPos[slot.pos] = player;
              team2PositionCost += cost;
            }

            positionCostSum = nextCostSum;
            backtrack(slotIdx + 1);
            positionCostSum -= cost;

            if (slot.team === 1) {
              delete team1StartersByPos[slot.pos];
              team1PositionCost -= cost;
            } else {
              delete team2StartersByPos[slot.pos];
              team2PositionCost -= cost;
            }

            used[pIdx] = false;
          }
        }

        backtrack(0);
      }
    }

    if (!best) return;

    const equipo1 = [1, 2, 3, 4, 5].map((pos) => best.team1StartersByPos[pos]).concat([best.change1]);
    const equipo2 = [1, 2, 3, 4, 5].map((pos) => best.team2StartersByPos[pos]).concat([best.change2]);

    setGenerado({ equipo1, equipo2 });
  };

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingMessage="Cargando jugadores..." />;
  }

  if (!clasificacion || clasificacion.length === 0) {
    return (
      <div className="sv-panel p-8 mx-3 sm:mx-4 text-left text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
        No hay jugadores disponibles.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-8 px-3 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--sv-on-surface)] leading-none">Generador de Equipos</h2>
          <p className="text-xs sm:text-sm text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em] mt-2">Selecciona 12 jugadores para equilibrar (seleccionados: {selectedNames.size}/12)</p>
        </div>
      </div>

      {!generado ? (
        <div className="sv-panel overflow-hidden">
          <div className="p-4 flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map((pos) => {
              const players = jugadoresPorPosicion[pos];
              if (!players || players.length === 0) return null;

              return (
                <section key={pos} className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--sv-on-surface-muted)]">
                    {posLabel(pos)} ({pos})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                    {players.map((player) => {
                      const selected = selectedNames.has(player.nombre);
                      const mainPos = getPrincipalPos(player.nombre);
                      const mainLabel = posLabel(mainPos);
                      return (
                        <button
                          key={player.nombre}
                          onClick={() => togglePlayer(player.nombre)}
                          disabled={!selected && selectedNames.size >= 12}
                          className={`flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 border text-left transition-all relative ${
                            selected
                              ? 'border-[var(--sv-primary)] bg-[color:rgb(204_0_0/0.08)] text-[var(--sv-primary)] font-semibold'
                              : 'sv-ghost-line bg-[var(--sv-surface)] text-[var(--sv-on-surface-muted)] hover:bg-[var(--sv-surface-high)]'
                          } ${!selected && selectedNames.size >= 12 ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <span className="truncate text-xs sm:text-sm flex-1">
                            {player.nombre}
                            {mainLabel ? ` · ${mainLabel} (${mainPos})` : ''}
                          </span>
                          {selected && <span className="text-xs">✔</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {jugadoresPorPosicion.otros.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">
                  Sin posición definida
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {jugadoresPorPosicion.otros.map((player) => {
                    const selected = selectedNames.has(player.nombre);
                    return (
                      <button
                        key={player.nombre}
                        onClick={() => togglePlayer(player.nombre)}
                        disabled={!selected && selectedNames.size >= 12}
                        className={`flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 border text-left transition-all relative ${
                          selected
                            ? 'border-[var(--sv-primary)] bg-[color:rgb(204_0_0/0.08)] text-[var(--sv-primary)] font-semibold'
                            : 'sv-ghost-line bg-[var(--sv-surface)] text-[var(--sv-on-surface-muted)] hover:bg-[var(--sv-surface-high)]'
                        } ${!selected && selectedNames.size >= 12 ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="truncate text-xs sm:text-sm flex-1">{player.nombre}</span>
                        {selected && <span className="text-xs">✔</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <div className="p-4 bg-[var(--sv-surface-dim)] flex flex-col gap-4">
            <button
              onClick={generarEquipos}
              disabled={selectedNames.size !== 12}
              className={`w-full py-3 sm:py-4 font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all ${
                selectedNames.size === 12
                  ? 'sv-btn-primary'
                  : 'bg-[#b9b6aa] text-[var(--sv-surface)] cursor-not-allowed'
              }`}
            >
              Generar Combinación
            </button>
            {selectedNames.size < 12 && (
              <p className="text-center text-xs text-[var(--sv-on-surface-muted)] uppercase tracking-[0.08em]">
                Faltan {12 - selectedNames.size} jugadores por seleccionar
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Equipo 1 */}
            <div className="sv-card border-l-8 border-stone-900 overflow-hidden">
              <div className="bg-stone-900 px-4 py-3 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <span className="text-xl">⚫</span> Equipo Negro
                </h3>
                <span className="text-xs font-semibold text-stone-900 px-2 py-0.5 bg-white rounded-full border border-stone-200">
                  Avg: {Math.round(averagePct(generado.equipo1))}% ({generado.equipo1.length} jug.)
                </span>
              </div>
              <div
                className={`p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 transition-colors ${
                  dragOverTeam === 'equipo1' ? 'bg-stone-100/70 ring-2 ring-stone-300' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverTeam('equipo1');
                }}
                onDragEnter={() => setDragOverTeam('equipo1')}
                onDragLeave={() => setDragOverTeam((prev) => (prev === 'equipo1' ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnTeam('equipo1');
                }}
              >
                {generado.equipo1.map((p) => (
                  <div
                    key={p.nombre}
                    draggable
                    onDragStart={() => handleDragStart('equipo1', p.nombre)}
                    onDragEnd={handleDragEnd}
                    className="flex flex-col p-2 border sv-ghost-line bg-[var(--sv-surface)] cursor-grab active:cursor-grabbing"
                  >
                    <span className="text-stone-800 font-medium text-sm sm:text-base">
                      {p.nombre}
                      {p.posPrincipal ? ` · ${posLabel(p.posPrincipal)} (${p.posPrincipal})` : ''}
                    </span>
                    <span className="text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-tighter">PJ: {p.pj} · {Math.round(Number(p.porcentaje ?? 0))}% V</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipo 2 */}
            <div className="sv-card border-l-8 border-[var(--sv-primary-strong)] overflow-hidden">
              <div className="bg-[var(--sv-primary)] px-4 py-3 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <span className="text-xl">🔴</span> Equipo Rojo
                </h3>
                <span className="text-xs font-semibold text-[var(--sv-primary)] px-2 py-0.5 bg-white border border-[color:rgb(158_0_0/0.2)]">
                  Avg: {Math.round(averagePct(generado.equipo2))}% ({generado.equipo2.length} jug.)
                </span>
              </div>
              <div
                className={`p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 transition-colors ${
                  dragOverTeam === 'equipo2' ? 'bg-red-50/80 ring-2 ring-red-200' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverTeam('equipo2');
                }}
                onDragEnter={() => setDragOverTeam('equipo2')}
                onDragLeave={() => setDragOverTeam((prev) => (prev === 'equipo2' ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnTeam('equipo2');
                }}
              >
                {generado.equipo2.map((p) => (
                  <div
                    key={p.nombre}
                    draggable
                    onDragStart={() => handleDragStart('equipo2', p.nombre)}
                    onDragEnd={handleDragEnd}
                    className="flex flex-col p-2 border sv-ghost-line bg-[var(--sv-surface)] cursor-grab active:cursor-grabbing"
                  >
                    <span className="text-stone-800 font-medium text-sm sm:text-base">
                      {p.nombre}
                      {p.posPrincipal ? ` · ${posLabel(p.posPrincipal)} (${p.posPrincipal})` : ''}
                    </span>
                    <span className="text-[10px] text-[var(--sv-on-surface-muted)] uppercase tracking-tighter">PJ: {p.pj} · {Math.round(Number(p.porcentaje ?? 0))}% V</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setGenerado(null)}
            className="w-full py-3 border-2 border-[var(--sv-primary)] text-[var(--sv-primary)] font-bold uppercase tracking-[0.08em] hover:bg-[color:rgb(158_0_0/0.08)] transition-colors"
          >
            Resetear selección
          </button>
        </div>
      )}

      {/* Explicación de lógica */}
      <div className="bg-[var(--sv-surface-dim)] p-5 flex items-start gap-3">
        <span className="text-lg text-[var(--sv-primary)]">★</span>
        <div>
          <h4 className="text-sm font-bold text-[var(--sv-on-surface)] leading-none mb-2 uppercase tracking-[0.08em]">Criterio de balanceo</h4>
          <p className="text-xs text-[var(--sv-on-surface)] leading-relaxed uppercase tracking-[0.04em]">
            Los equipos se optimizan para que encajen lo más posible en el esquema <b>1 jugador - 1 posición</b> usando la
            posición <b>principal</b> (y la <b>secundaria</b> como fallback), y además el balance de rendimiento por ranking (%V).
            El jugador de cambio también intenta ser de posiciones parecidas.
          </p>
        </div>
      </div>
    </div>
  );
}

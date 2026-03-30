import { useState, useMemo } from 'react';

export function EquiposPage({ clasificacion }) {
  const [selectedNames, setSelectedNames] = useState(new Set());
  const [generado, setGenerado] = useState(null);
  const [draggedPlayer, setDraggedPlayer] = useState(null); // { nombre, fromTeam }
  const [dragOverTeam, setDragOverTeam] = useState(null); // 'equipo1' | 'equipo2' | null

  const POS_LABELS = {
    1: 'Base',
    2: 'Escolta',
    3: 'Alero',
    4: 'Ala-Pívot',
    5: 'Pívot',
  };

  // Mapa de posiciones por jugador (principal y secundaria) para que el generador respete 1-1 lo más posible.
  // Si un jugador no aparece aquí, se tratará como "flexible" (penalización alta en su encaje por posición).
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
    Ricky: { principal: 5, secundaria: 4 },
    Santiagovitx: { principal: 4, secundaria: 3 },
    Stefanov: { principal: 4, secundaria: 3 },
    Teleskov: { principal: 2, secundaria: 1 },
    Vinyalovic: { principal: 2, secundaria: 1 },
    Yuri: { principal: 1, secundaria: 2 },
  };

  const normalizePlayerName = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
  const PLAYER_POSITIONS_NORMALIZED = Object.fromEntries(
    Object.entries(PLAYER_POSITIONS).map(([name, data]) => [normalizePlayerName(name), data])
  );

  function getPrincipalPos(playerName) {
    const key = normalizePlayerName(playerName);
    return PLAYER_POSITIONS_NORMALIZED[key]?.principal ?? null;
  }

  function getSecondaryPos(playerName) {
    const key = normalizePlayerName(playerName);
    return PLAYER_POSITIONS_NORMALIZED[key]?.secundaria ?? null;
  }

  function posLabelFromNumber(pos) {
    return pos ? POS_LABELS[pos] : null;
  }

  // Jugadores disponibles ordenados alfabéticamente
  const jugadoresDisponibles = useMemo(() => {
    return [...clasificacion].sort((a, b) => a.nombre.localeCompare(b.nombre));
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
        const assignmentBySlotIdx = new Array(slotsSorted.length).fill(null);
        let positionCostSum = 0;
        let team1PositionCost = 0;
        let team2PositionCost = 0;

        const team1StartersByPos = {};
        const team2StartersByPos = {};

        function updateBestIfBetter(leafAssignment) {
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
            updateBestIfBetter(assignmentBySlotIdx);
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
            assignmentBySlotIdx[slotIdx] = starters[pIdx];

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
            assignmentBySlotIdx[slotIdx] = null;
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

  if (!clasificacion || clasificacion.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center text-stone-500">
        <div className="text-3xl mb-3 animate-pulse">⚡</div>
        Cargando jugadores...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Generador de Equipos</h2>
          <p className="text-sm text-stone-400">Selecciona 12 jugadores para equilibrar (seleccionados: {selectedNames.size}/12)</p>
        </div>
      </div>

      {!generado ? (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {jugadoresDisponibles.map((player) => {
              const selected = selectedNames.has(player.nombre);
              const mainPos = getPrincipalPos(player.nombre);
              const mainLabel = posLabelFromNumber(mainPos);
              return (
                <button
                  key={player.nombre}
                  onClick={() => togglePlayer(player.nombre)}
                  disabled={!selected && selectedNames.size >= 12}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all relative ${
                    selected
                      ? 'border-[#DC143C] bg-red-50 text-[#DC143C] font-semibold ring-1 ring-[#DC143C]'
                      : 'border-stone-100 bg-white text-stone-600 hover:border-stone-200'
                  } ${!selected && selectedNames.size >= 12 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="truncate text-sm flex-1">
                    {player.nombre}
                    {mainLabel ? ` · ${mainLabel} (${mainPos})` : ''}
                  </span>
                  {selected && <span className="text-xs">✔</span>}
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-stone-50 border-t border-stone-100 flex flex-col gap-4">
            <button
              onClick={generarEquipos}
              disabled={selectedNames.size !== 12}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-red-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                selectedNames.size === 12
                  ? 'bg-[#DC143C] text-white hover:bg-red-700'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              🚀 Generar Combinación
            </button>
            {selectedNames.size < 12 && (
              <p className="text-center text-xs text-stone-400">
                Faltan {12 - selectedNames.size} jugadores por seleccionar
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 gap-4">
            {/* Equipo 1 */}
            <div className="bg-white rounded-2xl shadow-md border-l-4 border-stone-900 overflow-hidden">
              <div className="bg-stone-900 px-4 py-3 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <span className="text-xl">⚫</span> Equipo Negro
                </h3>
                <span className="text-xs font-semibold text-stone-900 px-2 py-0.5 bg-white rounded-full border border-stone-200">
                  Avg: {averagePct(generado.equipo1).toFixed(1)}% ({generado.equipo1.length} jug.)
                </span>
              </div>
              <div
                className={`p-4 grid grid-cols-2 gap-3 rounded-b-2xl transition-colors ${
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
                    className="flex flex-col p-2 rounded-lg border border-stone-100 bg-white cursor-grab active:cursor-grabbing"
                  >
                    <span className="text-stone-800 font-medium">
                      {p.nombre}
                      {p.posPrincipal ? ` · ${posLabelFromNumber(p.posPrincipal)} (${p.posPrincipal})` : ''}
                    </span>
                    <span className="text-[10px] text-stone-400 uppercase tracking-tighter">PJ: {p.pj} · {Number(p.porcentaje ?? 0).toFixed(1)}% V</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipo 2 */}
            <div className="bg-white rounded-2xl shadow-md border-l-4 border-[#DC143C] overflow-hidden">
              <div className="bg-red-50 px-4 py-3 flex justify-between items-center">
                <h3 className="text-[#DC143C] font-bold flex items-center gap-2">
                  <span className="text-xl">🔴</span> Equipo Rojo
                </h3>
                <span className="text-xs font-semibold text-[#DC143C] px-2 py-0.5 bg-white rounded-full border border-red-100">
                  Avg: {averagePct(generado.equipo2).toFixed(1)}% ({generado.equipo2.length} jug.)
                </span>
              </div>
              <div
                className={`p-4 grid grid-cols-2 gap-3 rounded-b-2xl transition-colors ${
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
                    className="flex flex-col p-2 rounded-lg border border-stone-100 bg-white cursor-grab active:cursor-grabbing"
                  >
                    <span className="text-stone-800 font-medium">
                      {p.nombre}
                      {p.posPrincipal ? ` · ${posLabelFromNumber(p.posPrincipal)} (${p.posPrincipal})` : ''}
                    </span>
                    <span className="text-[10px] text-stone-400 uppercase tracking-tighter">PJ: {p.pj} · {Number(p.porcentaje ?? 0).toFixed(1)}% V</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setGenerado(null)}
            className="w-full py-3 bg-stone-100 text-stone-600 rounded-xl font-semibold hover:bg-stone-200 transition-colors"
          >
            🔄 Resetear selección
          </button>
        </div>
      )}

      {/* Explicación de lógica */}
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
        <span className="text-lg">ℹ️</span>
        <div>
          <h4 className="text-sm font-bold text-amber-900 leading-none mb-1">Criterio de balanceo</h4>
          <p className="text-xs text-amber-800 opacity-80 leading-relaxed">
            Los equipos se optimizan para que encajen lo más posible en el esquema <b>1 jugador - 1 posición</b> usando la
            posición <b>principal</b> (y la <b>secundaria</b> como fallback), y además el balance de rendimiento por ranking (%V).
            El jugador de cambio también intenta ser de posiciones parecidas.
          </p>
        </div>
      </div>
    </div>
  );
}

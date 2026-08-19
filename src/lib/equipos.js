import { PLAZAS_CONVOCATORIA } from '../constants.js';

/**
 * Reparto de 12 jugadores en dos equipos de 6.
 *
 * Cada equipo cubre las cinco posiciones (1-5) más un cambio. Se elige el par
 * de cambios y se asignan los otros diez a los diez huecos por backtracking,
 * comparando candidatos lexicográficamente:
 *
 *   1) encaje total de posiciones (lo más 1-1 posible),
 *   2) equilibrio posicional entre ambos equipos,
 *   3) balance de ranking (%V),
 *   4) similitud posicional de los dos cambios.
 *
 * Devuelve `{ equipo1, equipo2 }` con los cinco titulares por posición seguidos
 * del cambio, o `null` si no recibe exactamente 12 jugadores.
 */
export function balancearEquipos(jugadores) {
  if (!jugadores || jugadores.length !== PLAZAS_CONVOCATORIA) return null;

  const chosen = jugadores.map((p) => ({
    ...p,
    posPrincipal: p.pos_principal ?? null,
    posSecundaria: p.pos_secundaria ?? null,
    porcentaje: Number(p.porcentaje ?? 0),
  }));

  const slots = [];
  for (let pos = 1; pos <= 5; pos++) slots.push({ team: 1, pos });
  for (let pos = 1; pos <= 5; pos++) slots.push({ team: 2, pos });

  const mismatchCostForSlot = (player, slotPos) => {
    if (player.posPrincipal === slotPos) return 0;
    if (player.posSecundaria === slotPos) return 1;
    return 4;
  };

  const getChangeMainPos = (player) => player.posPrincipal ?? player.posSecundaria ?? null;

  let best = null;

  for (let i = 0; i < chosen.length; i++) {
    for (let j = 0; j < chosen.length; j++) {
      if (i === j) continue;

      const change1 = chosen[i];
      const change2 = chosen[j];
      const starters = chosen.filter((_, idx) => idx !== i && idx !== j);

      // Primero los huecos más difíciles de cubrir con coste 0/1: poda antes.
      const slotsSorted = [...slots].sort((a, b) => {
        const aMinCount = starters.reduce(
          (acc, p) => acc + (mismatchCostForSlot(p, a.pos) <= 1 ? 1 : 0),
          0,
        );
        const bMinCount = starters.reduce(
          (acc, p) => acc + (mismatchCostForSlot(p, b.pos) <= 1 ? 1 : 0),
          0,
        );
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
          change1.porcentaje +
          Object.values(team1StartersByPos).reduce((s, p) => s + p.porcentaje, 0);
        const sum2 =
          change2.porcentaje +
          Object.values(team2StartersByPos).reduce((s, p) => s + p.porcentaje, 0);

        const c1Pos = getChangeMainPos(change1);
        const c2Pos = getChangeMainPos(change2);

        const candidate = {
          team1StartersByPos: { ...team1StartersByPos },
          team2StartersByPos: { ...team2StartersByPos },
          change1,
          change2,
          positionCost: positionCostSum,
          positionBalanceDiff: Math.abs(team1PositionCost - team2PositionCost),
          percentDiff: Math.abs(sum1 - sum2),
          changePosDiff: c1Pos == null || c2Pos == null ? 999 : Math.abs(c1Pos - c2Pos),
        };

        if (!best) {
          best = candidate;
          return;
        }

        if (candidate.positionCost < best.positionCost) best = candidate;
        else if (
          candidate.positionCost === best.positionCost &&
          candidate.positionBalanceDiff < best.positionBalanceDiff
        )
          best = candidate;
        else if (
          candidate.positionCost === best.positionCost &&
          candidate.positionBalanceDiff === best.positionBalanceDiff &&
          candidate.percentDiff < best.percentDiff
        )
          best = candidate;
        else if (
          candidate.positionCost === best.positionCost &&
          candidate.positionBalanceDiff === best.positionBalanceDiff &&
          candidate.percentDiff === best.percentDiff &&
          candidate.changePosDiff < best.changePosDiff
        )
          best = candidate;
      }

      function backtrack(slotIdx) {
        if (slotIdx === slotsSorted.length) {
          updateBestIfBetter();
          return;
        }

        const slot = slotsSorted[slotIdx];

        const candidateIndices = [];
        for (let pIdx = 0; pIdx < starters.length; pIdx++) {
          if (used[pIdx]) continue;
          candidateIndices.push({ pIdx, cost: mismatchCostForSlot(starters[pIdx], slot.pos) });
        }
        candidateIndices.sort((a, b) => a.cost - b.cost);

        for (const { pIdx, cost } of candidateIndices) {
          const nextCostSum = positionCostSum + cost;
          if (best && nextCostSum > best.positionCost) continue;

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

  if (!best) return null;

  return {
    equipo1: [1, 2, 3, 4, 5].map((pos) => best.team1StartersByPos[pos]).concat([best.change1]),
    equipo2: [1, 2, 3, 4, 5].map((pos) => best.team2StartersByPos[pos]).concat([best.change2]),
  };
}

/**
 * Posiciones de los jugadores.
 *
 * 1 = Base · 2 = Escolta · 3 = Alero · 4 = Ala-Pívot · 5 = Pívot
 *
 * Cada jugador tiene una posición principal y una secundaria. El generador de
 * equipos las usa para repartir el esquema "1 jugador - 1 posición", usando la
 * secundaria como alternativa cuando la principal ya está cubierta.
 *
 * Nota: estos datos son estáticos a propósito mientras la fuente de verdad sea
 * el Google Sheet. Al migrar a base de datos (ver docs/PLAN_TEMPORADA_2026-27.md)
 * pasan a la tabla `jugadores` y este fichero desaparece.
 */

export const POS_LABELS = {
  1: 'Base',
  2: 'Escolta',
  3: 'Alero',
  4: 'Ala-Pívot',
  5: 'Pívot',
};

export const PLAYER_POSITIONS = {
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

export const normalizePlayerName = (s) =>
  typeof s === 'string' ? s.trim().toLowerCase() : '';

const BY_NORMALIZED_NAME = Object.fromEntries(
  Object.entries(PLAYER_POSITIONS).map(([nombre, data]) => [normalizePlayerName(nombre), data])
);

/** Devuelve `{ principal, secundaria }` o `null` si el jugador no tiene posiciones. */
export function getPosiciones(nombre) {
  return BY_NORMALIZED_NAME[normalizePlayerName(nombre)] ?? null;
}

export function getPrincipalPos(nombre) {
  return getPosiciones(nombre)?.principal ?? null;
}

export function getSecondaryPos(nombre) {
  return getPosiciones(nombre)?.secundaria ?? null;
}

/** Etiqueta de una posición numérica, o `null`. */
export function posLabel(pos) {
  return pos ? POS_LABELS[pos] ?? null : null;
}

/** Ej. "Ala-Pívot (4) · Alero (3)", o `null` si no tiene posiciones definidas. */
export function describePosiciones(nombre) {
  const p = getPosiciones(nombre);
  if (!p) return null;
  return `${posLabel(p.principal)} (${p.principal}) · ${posLabel(p.secundaria)} (${p.secundaria})`;
}

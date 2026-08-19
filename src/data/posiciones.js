export const POS_LABELS = {
  1: 'Base',
  2: 'Escolta',
  3: 'Alero',
  4: 'Ala-Pívot',
  5: 'Pívot',
};

export function posLabel(pos) {
  return pos ? POS_LABELS[pos] ?? null : null;
}

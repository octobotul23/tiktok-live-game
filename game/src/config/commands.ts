// Aliasurile comenzilor de mișcare, comune tuturor modurilor.
// Se compară după normalizare: litere mici, fără diacritice (stânga = stanga), fără variation selector la emoji.
// Cuvintele trebuie să apară ca token separat („up” se potrivește în „go up!”, dar nu în „supa”).

export type Dir = 'up' | 'down' | 'left' | 'right';

export const MOVE_ALIASES: Record<Dir, string[]> = {
  up: ['up', 'u', 'sus', '⬆', '↑', '👆', '🔼'],
  down: ['down', 'd', 'jos', '⬇', '↓', '👇', '🔽'],
  left: ['left', 'l', 'stanga', '⬅', '←', '👈', '◀'],
  right: ['right', 'r', 'dreapta', '➡', '→', '👉', '▶'],
};

/** Voturile: cifra simplă sau emoji keycap (1️⃣ 2️⃣ 3️⃣). */
export const VOTE_ALIASES: string[][] = [
  ['1', '1⃣'],
  ['2', '2⃣'],
  ['3', '3⃣'],
];

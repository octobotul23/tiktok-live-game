const FIRST = [
  'andrei', 'mara', 'vlad', 'ioana', 'alex', 'bianca', 'radu', 'elena', 'cristi', 'denisa',
  'mihai', 'sara', 'tudor', 'ana', 'darius', 'maria', 'luca', 'irina', 'stefan', 'raluca',
  'gabi', 'cosmin', 'diana', 'sebi', 'larisa', 'paul', 'roxana', 'matei', 'alina', 'robert',
  'gamer', 'shadow', 'pixel', 'ninja', 'lupul', 'dragon', 'turbo', 'kiwi', 'mango', 'neo',
];
const SUFFIX = ['', '_', '.', 'x', '_ro', '.official', '_gg', 'xd', '_live', '.tv'];
const DECOR = ['', '', '', '', ' 🔥', ' ✨', ' 👑', ' 💀', ' 🐺', ' 🎮'];

function pick<T>(arr: readonly T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Generează un handle + nickname plauzibil pentru spectatorul fals cu indexul dat (determinist). */
export function fakeIdentity(index: number): { uniqueId: string; nickname: string } {
  let seed = (index + 1) * 2654435761;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 10000) / 10000;
  };
  const first = pick(FIRST, rnd);
  const num = rnd() < 0.7 ? String(Math.floor(rnd() * 999)) : '';
  const uniqueId = `${first}${pick(SUFFIX, rnd)}${num}`.replace(/[^a-z0-9._]/g, '');
  const nick = first.charAt(0).toUpperCase() + first.slice(1);
  const nickname = rnd() < 0.5 ? `${nick}${pick(DECOR, rnd)}` : `${uniqueId}${pick(DECOR, rnd)}`;
  return { uniqueId, nickname };
}

import { MOVE_ALIASES, VOTE_ALIASES, type Dir } from '../config/commands';

/** Comandă proprie a unui mod (max 2 per mod). Aliasurile pot avea mai multe cuvinte: „echipa sus”. */
export interface ModeCommand {
  id: string;
  aliases: string[];
  /** Textul afișat pe ecran, ex. „echipa sus”. */
  label: string;
}

export type Parsed =
  | { kind: 'move'; dir: Dir; alias: string }
  | { kind: 'vote'; option: number }
  | { kind: 'mode'; id: string; alias: string };

export interface ParseOptions {
  modeCommands?: readonly ModeCommand[];
  allowVote?: boolean;
}

interface Token {
  text: string;
  index: number;
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritice: ă â î ș ț → a a i s t
    .replace(/[︎️]/g, '') // variation selectors: ⬆️ → ⬆
    .toLowerCase();
}

function tokenize(norm: string): Token[] {
  const tokens: Token[] = [];
  const re = /[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) tokens.push({ text: m[0], index: m.index });
  return tokens;
}

const isWordAlias = (a: string) => /^[a-z0-9]+( [a-z0-9]+)*$/.test(a);

/** Poziția celei mai timpurii apariții a aliasului, sau -1. Cuvintele trebuie să fie tokenuri întregi. */
function findAlias(alias: string, norm: string, tokens: Token[]): number {
  const a = normalize(alias);
  if (!isWordAlias(a)) return norm.indexOf(a);
  const words = a.split(' ');
  for (let i = 0; i + words.length <= tokens.length; i++) {
    let ok = true;
    for (let w = 0; w < words.length && ok; w++) ok = tokens[i + w].text === words[w];
    if (ok) return tokens[i].index;
  }
  return -1;
}

/**
 * Transformă un comentariu în comandă. Restul textului e ignorat.
 * Prioritate: comanda modului > vot (doar în faza de vot) > mișcare; în cadrul aceluiași tip câștigă
 * prima apariție din text („left right” → left).
 */
export function parseCommand(text: string, opts: ParseOptions = {}): Parsed | null {
  const norm = normalize(text);
  if (!norm.trim()) return null;
  const tokens = tokenize(norm);

  if (opts.modeCommands?.length) {
    let best: { pos: number; id: string; alias: string } | null = null;
    for (const cmd of opts.modeCommands) {
      for (const alias of cmd.aliases) {
        const pos = findAlias(alias, norm, tokens);
        if (pos >= 0 && (!best || pos < best.pos)) best = { pos, id: cmd.id, alias: normalize(alias) };
      }
    }
    if (best) return { kind: 'mode', id: best.id, alias: best.alias };
  }

  if (opts.allowVote) {
    let best: { pos: number; option: number } | null = null;
    VOTE_ALIASES.forEach((aliases, option) => {
      for (const alias of aliases) {
        const pos = findAlias(alias, norm, tokens);
        if (pos >= 0 && (!best || pos < best.pos)) best = { pos, option };
      }
    });
    if (best) return { kind: 'vote', option: (best as { option: number }).option };
  }

  let move: { pos: number; dir: Dir; alias: string } | null = null;
  for (const dir of Object.keys(MOVE_ALIASES) as Dir[]) {
    for (const alias of MOVE_ALIASES[dir]) {
      const pos = findAlias(alias, norm, tokens);
      if (pos >= 0 && (!move || pos < move.pos)) move = { pos, dir, alias: normalize(alias) };
    }
  }
  return move ? { kind: 'move', dir: move.dir, alias: move.alias } : null;
}

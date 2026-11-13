// Setările boților (simulatorul de spectatori falși). Un singur loc pentru limite și valori implicite:
// serverul le folosește ca să verifice ce primește, panoul ca să-și construiască singur sliderele.

export interface SimSettings {
  enabled: boolean;
  // --- câți boți ---
  /** Câți boți sunt în live (0–1000). */
  viewers: number;
  /** Câți boți noi intră pe secundă până se umple numărul de mai sus. */
  joinsPerSec: number;
  /** Câți boți pleacă pe minut și sunt înlocuiți de alții noi (public care se schimbă). */
  churnPerMin: number;
  /** Procentul de boți care scriu; restul doar privesc (dau like/follow, dar nu primesc caracter). */
  activePct: number;
  // --- cât de activi ---
  /** Înmulțește toate ritmurile (comentarii, like-uri, cadouri, follow-uri): 100 = normal. */
  activity: number;
  /** Cât de mult variază ritmul în valuri (0 = constant, 100 = valuri mari și vârfuri). */
  burstiness: number;
  commentsPerSec: number;
  likesPerSec: number;
  /** Cele mai multe like-uri dintr-o apăsare (un spectator real trimite rafale). */
  likeBurstMax: number;
  // --- ce scriu ---
  /** Din comentariile obișnuite, câte sunt comenzi de mișcare (restul: „salut”, „gg”, emoji). */
  movePct: number;
  /** Cât de des folosesc comenzile speciale ale modului curent (ex. „echipa sus”). */
  modeCmdPct: number;
  /** În timpul votului, câte comentarii sunt voturi (1/2/3). */
  votePct: number;
  /** 0 = fiecare bot își votează favoritul; 1–3 = boții împing opțiunea asta. */
  voteFor: number;
  /** Cu voteFor ales: câte voturi merg la opțiunea aleasă. */
  votePushPct: number;
  /** În PvP: câți boți țin cu echipa de sus. */
  pvpTopPct: number;
  // --- cadouri ---
  giftsPerMin: number;
  /** Cel mai scump cadou pe care îl trimit boții singuri (în diamante). */
  giftMaxDiamonds: number;
  /** Cea mai lungă serie de cadouri (ex. 8 trandafiri la rând). */
  giftStreakMax: number;
  /** În timpul votului, câte cadouri automate sunt cadouri de vot. */
  voteGiftPct: number;
  // --- urmăritori ---
  /** Procentul de boți care sunt deja urmăritori. */
  followerPct: number;
  /** Câți boți dau follow pe minut. */
  followsPerMin: number;
}

export type SimNumberKey = Exclude<keyof SimSettings, 'enabled'>;

export interface SimField {
  min: number;
  max: number;
  step: number;
  def: number;
  /** Valori fixe (listă de alegere) în loc de slider. */
  options?: readonly number[];
}

export const SIM_FIELDS: Record<SimNumberKey, SimField> = {
  viewers: { min: 0, max: 1000, step: 1, def: 40 },
  joinsPerSec: { min: 1, max: 200, step: 1, def: 30 },
  churnPerMin: { min: 0, max: 300, step: 1, def: 0 },
  activePct: { min: 0, max: 100, step: 1, def: 100 },
  activity: { min: 0, max: 300, step: 5, def: 100 },
  burstiness: { min: 0, max: 100, step: 1, def: 0 },
  commentsPerSec: { min: 0, max: 300, step: 0.1, def: 10 },
  likesPerSec: { min: 0, max: 100, step: 0.1, def: 4 },
  likeBurstMax: { min: 1, max: 100, step: 1, def: 15 },
  movePct: { min: 0, max: 100, step: 1, def: 92 },
  modeCmdPct: { min: 0, max: 100, step: 1, def: 12 },
  votePct: { min: 0, max: 100, step: 1, def: 75 },
  voteFor: { min: 0, max: 3, step: 1, def: 0, options: [0, 1, 2, 3] },
  votePushPct: { min: 0, max: 100, step: 1, def: 80 },
  pvpTopPct: { min: 0, max: 100, step: 1, def: 50 },
  giftsPerMin: { min: 0, max: 120, step: 0.1, def: 3 },
  giftMaxDiamonds: { min: 1, max: 29999, step: 1, def: 30, options: [1, 5, 30, 100, 299, 1000, 29999] },
  giftStreakMax: { min: 1, max: 100, step: 1, def: 8 },
  voteGiftPct: { min: 0, max: 100, step: 1, def: 70 },
  followerPct: { min: 0, max: 100, step: 1, def: 70 },
  followsPerMin: { min: 0, max: 120, step: 0.1, def: 4 },
};

export const SIM_KEYS = Object.keys(SIM_FIELDS) as SimNumberKey[];

export function simDefaults(enabled: boolean): SimSettings {
  const out = { enabled } as SimSettings;
  for (const k of SIM_KEYS) out[k] = SIM_FIELDS[k].def;
  return out;
}

/** O valoare venită din panou (sau din fișierul salvat), adusă în limite; null dacă nu e număr. */
export function cleanSimValue(key: SimNumberKey, raw: unknown): number | null {
  const f = SIM_FIELDS[key];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (f.options) {
    // Cea mai apropiată valoare din listă.
    return f.options.reduce((best, o) => (Math.abs(o - raw) < Math.abs(best - raw) ? o : best), f.options[0]);
  }
  const stepped = Math.round(raw / f.step) * f.step;
  return Math.min(f.max, Math.max(f.min, Number(stepped.toFixed(2))));
}

/** Doar cheile cunoscute, cu valori în limite. Restul se ignoră. */
export function cleanSimPatch(raw: unknown): Partial<SimSettings> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<SimSettings> = {};
  if (typeof r.enabled === 'boolean') out.enabled = r.enabled;
  for (const k of SIM_KEYS) {
    const v = cleanSimValue(k, r[k]);
    if (v !== null) out[k] = v;
  }
  return out;
}

/** Stiluri gata făcute: un clic schimbă mai multe setări deodată. */
export const SIM_PRESETS: { id: 'quiet' | 'normal' | 'busy' | 'chaos'; values: Partial<SimSettings> }[] = [
  {
    id: 'quiet',
    values: {
      viewers: 20, joinsPerSec: 2, churnPerMin: 2, activePct: 60, activity: 100, burstiness: 15,
      commentsPerSec: 2, likesPerSec: 1, giftsPerMin: 0.5, followsPerMin: 1, giftMaxDiamonds: 30,
    },
  },
  {
    id: 'normal',
    values: {
      viewers: 80, joinsPerSec: 8, churnPerMin: 6, activePct: 85, activity: 100, burstiness: 30,
      commentsPerSec: 10, likesPerSec: 4, giftsPerMin: 3, followsPerMin: 4, giftMaxDiamonds: 30,
    },
  },
  {
    id: 'busy',
    values: {
      viewers: 300, joinsPerSec: 30, churnPerMin: 20, activePct: 90, activity: 100, burstiness: 50,
      commentsPerSec: 40, likesPerSec: 15, giftsPerMin: 12, followsPerMin: 10, giftMaxDiamonds: 100,
    },
  },
  {
    id: 'chaos',
    values: {
      viewers: 1000, joinsPerSec: 120, churnPerMin: 60, activePct: 100, activity: 100, burstiness: 80,
      commentsPerSec: 150, likesPerSec: 50, giftsPerMin: 60, followsPerMin: 30, giftMaxDiamonds: 1000,
    },
  },
];

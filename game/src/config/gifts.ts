// Maparea cadourilor → efecte. Editează liber: cheia e NUMELE cadoului (ca pe TikTok, ex. "Rose")
// sau ID-ul lui numeric (ex. 5655). Numele nu țin cont de litere mari/mici.
//
// Efectele se aplică o singură dată pentru toată seria, multiplicate cu cantitatea (count), cu limitele
// de mai jos. Efectele de luptă (shield, speed, power, bomb, revive) funcționează doar în timpul rundei;
// skin-urile și XP-ul se păstrează oricând, pe toată sesiunea.

export type GiftEffect =
  /** Scut personal: nu poate fi doborât (s × cantitate). */
  | { type: 'shield'; seconds: number }
  /** Scut pentru toată echipa (s, nu se înmulțește cu cantitatea). */
  | { type: 'teamShield'; seconds: number }
  /** Viteză: dash mai lung și atac mai rapid (s × cantitate). */
  | { type: 'speed'; seconds: number }
  /** Damage dublu pentru cel care trimite (s × cantitate). */
  | { type: 'power'; seconds: number }
  /** Bombă pe tot ecranul (damage × cantitate, scalat cu numărul de jucători). */
  | { type: 'bomb'; damage: number }
  /** Ridică toți jucătorii căzuți; în Survival repară și baza. */
  | { type: 'revive' }
  /** Skin permanent pe sesiune (vezi core/SkinCatalog.ts). */
  | { type: 'skin'; skinId: string }
  /** Tower Defense: construiește (sau îmbunătățește) un turn lângă drum; nivelul crește cu cantitatea. */
  | { type: 'tower'; kind: TowerKind; levels: number };

export type TowerKind = 'arrow' | 'frost' | 'cannon';

/** Plafon pentru efectele în secunde, ca o serie de 500 de trandafiri să nu dea scut 40 de minute. */
export const MAX_EFFECT_SECONDS = 45;

/** Efectele comune tuturor modurilor. */
export const FALLBACK_GIFTS: Record<string, GiftEffect[]> = {
  Rose: [{ type: 'speed', seconds: 4 }],
  TikTok: [{ type: 'shield', seconds: 5 }],
  GG: [{ type: 'power', seconds: 5 }],
  'Ice Cream Cone': [{ type: 'speed', seconds: 4 }],
  'Finger Heart': [{ type: 'revive' }, { type: 'shield', seconds: 8 }],
  Doughnut: [{ type: 'bomb', damage: 300 }],
  'Hand Hearts': [{ type: 'teamShield', seconds: 8 }, { type: 'skin', skinId: 'golden' }],
  'Hat and Mustache': [{ type: 'skin', skinId: 'golden' }, { type: 'power', seconds: 15 }],
  Corgi: [{ type: 'bomb', damage: 1200 }, { type: 'skin', skinId: 'golden' }],
  Galaxy: [{ type: 'bomb', damage: 4000 }, { type: 'teamShield', seconds: 10 }, { type: 'skin', skinId: 'galaxy' }],
  Lion: [
    { type: 'bomb', damage: 20000 },
    { type: 'revive' },
    { type: 'teamShield', seconds: 15 },
    { type: 'skin', skinId: 'lion' },
  ],
};

/** Pentru cadourile care nu apar nicăieri în mapare: o bombă proporțională cu valoarea (damage per diamant). */
export const UNKNOWN_GIFT_BOMB_PER_DIAMOND = 10;

/**
 * Suprascrieri per mod: modId → (cadou → efecte). Dacă un cadou apare aici, înlocuiește complet
 * efectele din FALLBACK_GIFTS pentru modul respectiv. Cadourile care lipsesc de aici folosesc maparea comună.
 */
export const MODE_GIFTS: Record<string, Record<string, GiftEffect[]>> = {
  // Survival: totul se învârte în jurul cristalului; Hand Hearts îl și repară (revive), pe lângă scut.
  // (Nu pune revive pe un cadou de 1 monedă: o serie de TikTok-uri ar face cristalul invincibil.)
  survival: {
    Doughnut: [{ type: 'bomb', damage: 400 }],
    'Hand Hearts': [{ type: 'revive' }, { type: 'teamShield', seconds: 8 }, { type: 'skin', skinId: 'golden' }],
  },
  // Boss Slayer: lovitura vine din zonele de pe jos, deci scutul contează mai mult decât viteza.
  boss: {
    Rose: [{ type: 'shield', seconds: 3 }],
    TikTok: [{ type: 'shield', seconds: 8 }],
    'Finger Heart': [{ type: 'revive' }, { type: 'teamShield', seconds: 4 }],
  },
  // PvP: totul ajută doar echipa expeditorului. Bomba lovește baza adversă și slăbește adversarii
  // (vezi `pvp.bombPlayerMul` în config.ts); revive-ul ridică doar aliații și repară baza echipei.
  pvp: {
    Rose: [{ type: 'power', seconds: 3 }],
    TikTok: [{ type: 'shield', seconds: 6 }],
    'Finger Heart': [{ type: 'revive' }, { type: 'teamShield', seconds: 4 }],
    Doughnut: [{ type: 'bomb', damage: 600 }],
    'Hand Hearts': [{ type: 'teamShield', seconds: 6 }, { type: 'skin', skinId: 'golden' }],
  },
  // Tower Defense: cadourile mici construiesc turnuri (sau le cresc nivelul cu fiecare bucată din serie).
  td: {
    Rose: [{ type: 'tower', kind: 'arrow', levels: 1 }],
    TikTok: [{ type: 'tower', kind: 'arrow', levels: 1 }],
    'Ice Cream Cone': [{ type: 'tower', kind: 'frost', levels: 1 }],
    'Finger Heart': [{ type: 'tower', kind: 'frost', levels: 2 }],
    Doughnut: [{ type: 'tower', kind: 'cannon', levels: 2 }],
    'Hand Hearts': [{ type: 'tower', kind: 'cannon', levels: 3 }, { type: 'revive' }, { type: 'skin', skinId: 'golden' }],
  },
};

/**
 * Cadouri de vot: în faza de vot, fiecare cadou de aici adaugă voturi opțiunii asociate (1, 2 sau 3).
 * Voturi = diamante × VOTES_PER_DIAMOND × cantitate, ca un cadou mai scump să valoreze proporțional mai mult.
 */
export const VOTE_GIFTS: Record<string, 1 | 2 | 3> = {
  Rose: 1,
  TikTok: 2,
  'Finger Heart': 3,
};
export const VOTES_PER_DIAMOND = 5;

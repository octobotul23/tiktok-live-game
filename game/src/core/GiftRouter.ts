import {
  FALLBACK_GIFTS,
  MAX_EFFECT_SECONDS,
  MODE_GIFTS,
  UNKNOWN_GIFT_BOMB_PER_DIAMOND,
  VOTE_GIFTS,
  VOTES_PER_DIAMOND,
  type GiftEffect,
} from '../config/gifts';

function lookup(map: Record<string, GiftEffect[]> | undefined, giftName: string, giftId: number): GiftEffect[] | null {
  if (!map) return null;
  if (map[String(giftId)]) return map[String(giftId)];
  const name = giftName.trim().toLowerCase();
  for (const key of Object.keys(map)) if (key.toLowerCase() === name) return map[key];
  return null;
}

/**
 * Efectele unui cadou în modul dat, deja multiplicate cu cantitatea:
 * întâi maparea modului, apoi cea comună, apoi o bombă proporțională cu valoarea cadoului.
 */
export function resolveGift(modeId: string, giftName: string, giftId: number, count: number, diamonds: number): GiftEffect[] {
  const base =
    lookup(MODE_GIFTS[modeId], giftName, giftId) ??
    lookup(FALLBACK_GIFTS, giftName, giftId) ??
    [{ type: 'bomb', damage: Math.max(1, diamonds) * UNKNOWN_GIFT_BOMB_PER_DIAMOND } satisfies GiftEffect];
  return base.map((e) => scale(e, count));
}

function scale(e: GiftEffect, count: number): GiftEffect {
  switch (e.type) {
    case 'shield':
    case 'speed':
    case 'power':
      return { ...e, seconds: Math.min(MAX_EFFECT_SECONDS, e.seconds * count) };
    case 'bomb':
      return { ...e, damage: e.damage * count };
    case 'tower':
      return { ...e, levels: e.levels * count };
    default:
      return e;
  }
}

/** Opțiunea de vot (0-based) și numărul de voturi pentru un cadou de vot, sau null. */
export function voteForGift(giftName: string, count: number, diamonds: number): { option: number; votes: number } | null {
  const name = giftName.trim().toLowerCase();
  const key = Object.keys(VOTE_GIFTS).find((k) => k.toLowerCase() === name);
  if (!key) return null;
  return { option: VOTE_GIFTS[key] - 1, votes: Math.max(1, diamonds) * VOTES_PER_DIAMOND * count };
}

/** Efectele care au sens doar în timpul unei runde. */
export function isCombatEffect(e: GiftEffect): boolean {
  return e.type !== 'skin';
}

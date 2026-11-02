import { t, type StringKey } from '../i18n';
import { RO } from '../i18n/ro';
import { TEX } from './textures';

/**
 * Definițiile de skin. Pentru a folosi grafică reală, încarcă imaginea în BootScene.preload()
 * sub cheia din `texture` (sau schimbă cheia aici). `tinted: false` = sprite colorat deja, fără tint.
 * Skin-urile se primesc din cadouri (vezi config/gifts.ts) și rămân pe toată sesiunea.
 */
export interface SkinDef {
  id: string;
  name: string;
  texture: string;
  scale: number;
  tinted: boolean;
  /** Culoarea aurei (strălucire + scântei în jurul caracterului); null = fără aură. */
  aura: number | null;
  /** Rangul: un cadou nu înlocuiește un skin mai valoros. */
  rank: number;
}

export const SKINS: Record<string, SkinDef> = {
  default: { id: 'default', name: 'Clasic', texture: TEX.body, scale: 1, tinted: true, aura: null, rank: 0 },
  golden: { id: 'golden', name: 'Rege', texture: TEX.skinGolden, scale: 1.35, tinted: false, aura: 0xffd60a, rank: 1 },
  galaxy: { id: 'galaxy', name: 'Galaxie', texture: TEX.skinGalaxy, scale: 1.6, tinted: false, aura: 0xc77dff, rank: 2 },
  lion: { id: 'lion', name: 'Leu', texture: TEX.skinLion, scale: 1.9, tinted: false, aura: 0xff8800, rank: 3 },
};

export function getSkin(id: string): SkinDef {
  return SKINS[id] ?? SKINS.default;
}

/** Numele afișat, în limba curentă; un skin nou fără traducere în i18n folosește `name`. */
export function skinName(skin: SkinDef): string {
  const key = `skin.${skin.id}`;
  return key in RO ? t(key as StringKey) : skin.name;
}

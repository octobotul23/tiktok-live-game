/**
 * Straturile de desenare (depth). Mulțimea pornește de la 100 și urcă ușor cu fiecare comentariu
 * (bringToFront), deci tot ce trebuie să rămână vizibil peste o mulțime densă stă mult mai sus.
 */
export const LAYER = {
  /** Zonele de atac ale boss-ului: peste mulțime, semi-transparente, ca avertizarea să se vadă mereu. */
  zones: 38_000,
  base: 39_000,
  enemies: 39_500,
  enemyBars: 39_900,
} as const;

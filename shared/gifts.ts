// Catalog de cadouri TikTok folosit de simulator și de butoanele din panou.
// ID-urile reale pot diferi între regiuni; maparea efectelor din joc se face de preferință după nume.
// `streakable` = cadoul poate fi trimis în serie (giftType 1 în TikTok), cu repeatCount crescător.

export interface GiftDef {
  id: number;
  name: string;
  diamonds: number;
  streakable: boolean;
}

export const GIFT_CATALOG: GiftDef[] = [
  { id: 5655, name: 'Rose', diamonds: 1, streakable: true },
  { id: 5269, name: 'TikTok', diamonds: 1, streakable: true },
  { id: 5487, name: 'Finger Heart', diamonds: 5, streakable: true },
  { id: 5879, name: 'Doughnut', diamonds: 30, streakable: true },
  { id: 5660, name: 'Hand Hearts', diamonds: 100, streakable: false },
  { id: 6064, name: 'GG', diamonds: 1, streakable: true },
  { id: 6427, name: 'Hat and Mustache', diamonds: 99, streakable: false },
  { id: 5827, name: 'Ice Cream Cone', diamonds: 1, streakable: true },
  { id: 6267, name: 'Corgi', diamonds: 299, streakable: false },
  { id: 11046, name: 'Galaxy', diamonds: 1000, streakable: false },
  { id: 6369, name: 'Lion', diamonds: 29999, streakable: false },
];

export function findGift(name: string): GiftDef | undefined {
  const n = name.trim().toLowerCase();
  return GIFT_CATALOG.find((g) => g.name.toLowerCase() === n);
}

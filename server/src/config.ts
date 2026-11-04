import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { GameSettings } from '../../shared/protocol';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

const username = (process.env.TIKTOK_USERNAME ?? '').trim().replace(/^@/, '');
const flag = (name: string, fallback: boolean) => {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '' ? fallback : v === 'true' || v === '1' || v === 'da' || v === 'yes';
};

export const SERVER_CONFIG = {
  rootDir,
  port: Number(process.env.SERVER_PORT ?? 8790),
  tiktokUsername: username,
  // Fără username nu avem la ce să ne conectăm, deci simulatorul pornește oricum.
  simulate: (process.env.SIMULATE ?? 'true').toLowerCase() !== 'false' || username === '',
  // Cât așteptăm după ultimul eveniment dintr-o serie de cadouri fără repeatEnd înainte s-o închidem forțat.
  giftStreakTimeoutMs: 4000,
  // Setările de pornire ale jocului; din panou se pot schimba în timpul live-ului.
  game: {
    lang: (process.env.GAME_LANG ?? '').trim().toLowerCase() === 'en' ? 'en' : 'ro',
    followersOnly: flag('FOLLOWERS_ONLY', false),
    giftersBypass: flag('GIFTERS_BYPASS', true),
  } satisfies GameSettings as GameSettings,
};

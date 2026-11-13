import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { MAX_ACTIVE_RANGE, NEWCOMER_SEC_RANGE, type GameSettings } from '../../shared/protocol';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

const username = (process.env.TIKTOK_USERNAME ?? '').trim().replace(/^@/, '');
const flag = (name: string, fallback: boolean) => {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '' ? fallback : v === 'true' || v === '1' || v === 'da' || v === 'yes';
};

const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { version?: string };

export const SERVER_CONFIG = {
  rootDir,
  version: rootPkg.version ?? '0.0.0',
  // Portul paginii de joc; `tailscale serve --https=5180` îl publică cu același număr pentru telefon.
  gamePort: Number(process.env.GAME_PORT ?? 5180),
  port: Number(process.env.SERVER_PORT ?? 8790),
  // WIFI=true: jocul se deschide și în rețeaua de acasă, ca telefonul să intre prin IP (fără Tailscale).
  wifi: flag('WIFI', false),
  tiktokUsername: username,
  // Fără username nu avem la ce să ne conectăm, deci simulatorul pornește oricum.
  simulate: (process.env.SIMULATE ?? 'true').toLowerCase() !== 'false' || username === '',
  // Cu SIMULATE=false și un username, serverul se conectează singur la TikTok LIVE la pornire.
  tiktokAutoConnect: (process.env.SIMULATE ?? 'true').toLowerCase() === 'false' && username !== '',
  // Cheie Euler Stream (opțională, gratuită pe eulerstream.com): ridică limitele de conectare. Stă doar în .env.
  tiktokSignApiKey: (process.env.TIKTOK_SIGN_API_KEY ?? '').trim(),
  // Setările salvate din panou (ex. boții). DATA_DIR îl mută; folderul nu se urcă pe git.
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, 'data'),
  // Jurnalele conexiunii TikTok (un fișier pe zi); folderul e în .gitignore.
  logDir: path.join(rootDir, 'logs'),
  // Cât așteptăm după ultimul eveniment dintr-o serie de cadouri fără repeatEnd înainte s-o închidem forțat.
  giftStreakTimeoutMs: 4000,
  // Setările de pornire ale jocului; din panou se pot schimba în timpul live-ului.
  game: {
    lang: (process.env.GAME_LANG ?? '').trim().toLowerCase() === 'en' ? 'en' : 'ro',
    followersOnly: flag('FOLLOWERS_ONLY', false),
    giftersBypass: flag('GIFTERS_BYPASS', true),
    maxActive: clampMaxActive(Number(process.env.MAX_ACTIVE) || 300),
    newcomerSec: clampNewcomerSec(Number(process.env.NEWCOMER_SEC?.trim() || 10)),
  } satisfies GameSettings as GameSettings,
};

/** Secundele de evidențiere a caracterelor noi: întreg între 0 și 60; ce nu e număr devine 10. */
export function clampNewcomerSec(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.round(Math.min(NEWCOMER_SEC_RANGE.max, Math.max(NEWCOMER_SEC_RANGE.min, n)));
}

/** Plafonul de caractere, întreg și în limitele permise. */
export function clampMaxActive(n: number): number {
  return Math.round(Math.min(MAX_ACTIVE_RANGE.max, Math.max(MAX_ACTIVE_RANGE.min, n)));
}

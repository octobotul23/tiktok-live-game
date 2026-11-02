import { BossMode } from './boss/BossMode';
import type { GameMode } from './GameMode';
import { PvpMode } from './pvp/PvpMode';
import { SandboxMode } from './sandbox/SandboxMode';
import { SurvivalMode } from './survival/SurvivalMode';
import { TowerDefenseMode } from './td/TowerDefenseMode';

/**
 * Lista modurilor de joc. Pentru un mod nou: creează fișierul (o clasă care extinde BaseMode)
 * și adaugă aici o linie. Votul alege doar dintre modurile cu `inVote: true`.
 * Ordinea contează pentru streamer: tastele 1–9 aleg modurile din vot în ordinea de aici.
 */
export const MODES: { create: () => GameMode; inVote: boolean }[] = [
  { create: () => new SurvivalMode(), inVote: true },
  { create: () => new BossMode(), inVote: true },
  { create: () => new PvpMode(), inVote: true },
  { create: () => new TowerDefenseMode(), inVote: true },
  { create: () => new SandboxMode(), inVote: false },
];

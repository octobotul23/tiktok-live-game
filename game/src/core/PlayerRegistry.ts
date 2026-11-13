import type { Viewer } from '../../../shared/protocol';
import type { CrowdEntity } from './Crowd';

export interface PlayerStats {
  comments: number;
  commands: number;
  damage: number;
  kills: number;
  gifts: number;
  diamonds: number;
  roundsPlayed: number;
  wins: number;
}

/** Profilul unui spectator. Rămâne pe toată sesiunea, între moduri și după despawn. */
export interface Player {
  id: string;
  uniqueId: string;
  nickname: string;
  /** Număr scurt afișat pe caracter (#47). */
  num: number;
  color: number;
  skinId: string;
  xp: number;
  /** Scorul din runda curentă (damage, puncte, monede… după mod). Se resetează la fiecare rundă. */
  roundScore: number;
  stats: PlayerStats;
  /** Urmărește contul (din ultimul eveniment care a spus-o, sau dintr-un follow în live). */
  isFollower: boolean;
  /** Momentul ultimei activități (ms, timpul jocului). */
  lastActive: number;
  /** Caracterul de pe ecran, dacă există. */
  entity: CrowdEntity | null;
}

const GOLDEN_ANGLE = 137.508;

/** Culori bine separate pentru numere consecutive: nuanța sare cu unghiul de aur, luminozitatea alternează. */
export function colorForNumber(num: number): number {
  const h = (num * GOLDEN_ANGLE) % 360;
  const s = 0.72 + ((num >> 1) % 3) * 0.09;
  const l = num % 2 === 0 ? 0.56 : 0.66;
  return hslToInt(h / 360, s, l);
}

export function hslToInt(h: number, s: number, l: number): number {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue(p, q, h) * 255);
  const b = Math.round(hue(p, q, h - 1 / 3) * 255);
  return (r << 16) | (g << 8) | b;
}

/** Nivelul crește tot mai greu: nivel 2 la 50 XP, 3 la 200, 4 la 450… */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export class PlayerRegistry {
  private players = new Map<string, Player>();
  private nextNum = 1;

  get(id: string): Player | undefined {
    return this.players.get(id);
  }

  getOrCreate(viewer: Viewer, now: number): Player {
    let p = this.players.get(viewer.userId);
    if (!p) {
      const num = this.nextNum++;
      p = {
        id: viewer.userId,
        uniqueId: viewer.uniqueId,
        nickname: viewer.nickname || viewer.uniqueId,
        num,
        color: colorForNumber(num),
        skinId: 'default',
        xp: 0,
        roundScore: 0,
        stats: { comments: 0, commands: 0, damage: 0, kills: 0, gifts: 0, diamonds: 0, roundsPlayed: 0, wins: 0 },
        isFollower: false,
        lastActive: now,
        entity: null,
      };
      this.players.set(viewer.userId, p);
    } else if (viewer.nickname && viewer.nickname !== p.nickname) {
      p.nickname = viewer.nickname;
    }
    // Lipsă = evenimentul nu spune; păstrăm ce știam.
    if (viewer.isFollower !== undefined) p.isFollower = viewer.isFollower;
    return p;
  }

  get size(): number {
    return this.players.size;
  }

  all(): IterableIterator<Player> {
    return this.players.values();
  }
}

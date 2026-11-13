import type Phaser from 'phaser';
import type { Dir } from '../config/commands';
import type { Bounds, Crowd } from '../core/Crowd';
import type { Combat } from '../core/Combat';
import type { ModeCommand } from '../core/CommandParser';
import type { BoltPool, FloatingTextPool, ParticlePool } from '../core/Effects';
import type { GiftEffect } from '../config/gifts';
import type { Player, PlayerRegistry } from '../core/PlayerRegistry';
import type { Hud, ModeStatus } from '../ui/Hud';
import { t } from '../i18n';

/** Ce primește un mod de la core. */
export interface ModeContext {
  scene: Phaser.Scene;
  crowd: Crowd;
  registry: PlayerRegistry;
  floating: FloatingTextPool;
  particles: ParticlePool;
  /** Proiectilele (pentru turnuri sau alte atacuri ale modului). */
  bolts: BoltPool;
  /** Atacul automat comun; modul îi setează `source` (ce poate fi atacat). */
  combat: Combat;
  /** Pentru anunțuri mari (hud.announce). */
  hud: Hud;
  /** Zona utilă (safe zone) în care modul își așază arena. */
  safe: Bounds;
}

export interface RoundResults {
  /** Titlul ecranului de rezultate, ex. „Baza a căzut la valul 7” sau „Echipa SUS a câștigat”. */
  headline: string;
  /** Clasamentul, deja sortat. */
  ranking: { player: Player; score: number }[];
  /** Jucătorii care au câștigat runda (primesc bonus de XP). */
  winners: Player[];
}

/**
 * Contractul unui mod de joc. Core-ul se ocupă de conexiune, parser, jucători, coadă, despawn,
 * evidențiere și mișcare; modul adaugă regulile. Un mod nou = un fișier nou + o linie în registry.ts.
 */
export interface GameMode {
  readonly id: string;
  readonly name: string;
  /** Instrucțiuni scurte pentru ecranul de lobby. */
  readonly instructions: string;
  /** Eticheta scorului din leaderboard: „DAMAGE”, „PUNCTE”, „MONEDE”… */
  readonly scoreLabel: string;
  /** Maxim 2 comenzi proprii; apar mereu pe ecran. */
  readonly commands: readonly ModeCommand[];
  /** Durata maximă a rundei (s); null = fără limită (ex. Sandbox). */
  readonly maxDurationSec: number | null;

  /** Pregătește arena la începutul lobby-ului (modul e vizibil, dar runda n-a început). */
  setup(ctx: ModeContext): void;
  /** Lobby-ul s-a terminat: începe runda propriu-zisă. */
  onRoundStart(): void;
  teardown(): void;

  /** Zona în care se pot mișca jucătorii în modul ăsta. */
  arena(): Bounds;
  onPlayerJoin(player: Player): void;
  onPlayerLeave(player: Player): void;
  /**
   * Comanda de mișcare, înainte de dash. Întoarce true dacă modul a consumat-o
   * (ex. în PvP, „sus” al unui jucător fără echipă îl pune în echipa de sus).
   */
  onMove(player: Player, dir: Dir, alias: string): boolean;
  onCommand(player: Player, commandId: string): void;
  /** Întoarce true dacă modul a tratat cadoul; altfel se aplică efectul comun (fallback). */
  onGift(player: Player, giftName: string, count: number): boolean;
  /**
   * Un efect de cadou (din MODE_GIFTS sau din maparea comună), înainte de aplicarea comună.
   * Întoarce true dacă modul l-a aplicat el (ex. `tower` în Tower Defense). Se cheamă și în lobby.
   */
  applyEffect(player: Player, effect: GiftEffect): boolean;
  onLike(player: Player, count: number): void;
  /** Bara de like-uri s-a umplut. Întoarce true dacă modul are bonusul lui; altfel se aplică bonusul comun. */
  onLikeBonus(): boolean;
  /** Un cadou de tip revive tocmai a ridicat jucătorii căzuți (ex. Survival repară baza). */
  onRevive(by: Player): void;
  /**
   * Sunt în aceeași echipă? Cadourile „pentru echipă” (scut, revive) ajung doar la aliații expeditorului.
   * În modurile cooperative toți sunt aliați.
   */
  isAlly(a: Player, b: Player): boolean;
  /** Apelat doar cât runda e în desfășurare. */
  update(dt: number): void;
  /** Rândul de stare de sus (val, viața boss-ului…); null = nimic. */
  getStatus(): ModeStatus | null;
  isOver(): boolean;
  getResults(): RoundResults;
  /** Scorul live al jucătorului în runda curentă (pentru leaderboard). */
  getLiveScore(player: Player): number;
}

/** Implementări implicite goale, ca fiecare mod să suprascrie doar ce îi trebuie. */
export abstract class BaseMode implements GameMode {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly instructions: string;
  get scoreLabel(): string {
    return t('score.default');
  }
  /** Getter, ca modurile să-și poată traduce etichetele comenzilor în limba curentă. */
  get commands(): readonly ModeCommand[] {
    return [];
  }
  readonly maxDurationSec: number | null = 180;

  protected ctx!: ModeContext;

  setup(ctx: ModeContext): void {
    this.ctx = ctx;
  }
  onRoundStart(): void {}
  teardown(): void {}
  arena(): Bounds {
    return this.ctx.safe;
  }
  onPlayerJoin(_player: Player): void {}
  onPlayerLeave(_player: Player): void {}
  onMove(_player: Player, _dir: Dir, _alias: string): boolean {
    return false;
  }
  onCommand(_player: Player, _commandId: string): void {}
  onGift(_player: Player, _giftName: string, _count: number): boolean {
    return false;
  }
  applyEffect(_player: Player, _effect: GiftEffect): boolean {
    return false;
  }
  onLike(_player: Player, _count: number): void {}
  onLikeBonus(): boolean {
    return false;
  }
  onRevive(_by: Player): void {}
  isAlly(_a: Player, _b: Player): boolean {
    return true;
  }
  update(_dt: number): void {}
  getStatus(): ModeStatus | null {
    return null;
  }
  isOver(): boolean {
    return false;
  }
  getResults(): RoundResults {
    return { headline: this.name, ranking: rankByScore(this.ctx.registry), winners: [] };
  }
  /** Implicit: scorul de rundă acumulat de core (damage-ul din combat). */
  getLiveScore(player: Player): number {
    return player.roundScore;
  }
}

/** Toți jucătorii sesiunii care au punctat în runda curentă (chiar dacă au ieșit între timp), sortați după scor. */
export function rankByScore(registry: PlayerRegistry): { player: Player; score: number }[] {
  const out: { player: Player; score: number }[] = [];
  for (const p of registry.all()) if (p.roundScore > 0) out.push({ player: p, score: p.roundScore });
  return out.sort((a, b) => b.score - a.score);
}

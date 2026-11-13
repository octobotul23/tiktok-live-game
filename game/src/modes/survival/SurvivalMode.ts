import Phaser from 'phaser';
import { CONFIG } from '../../config/config';
import { EnemyManager, type EnemyKind } from '../../core/Enemies';
import { LAYER } from '../../core/layers';
import type { Player } from '../../core/PlayerRegistry';
import { TEX } from '../../core/textures';
import type { ModeStatus } from '../../ui/Hud';
import { BaseMode, rankByScore, type ModeContext, type RoundResults } from '../GameMode';
import { t } from '../../i18n';

const LOST_DELAY_SEC = 1.6;

/**
 * Survival: monștrii vin din marginile arenei spre cristalul din centru, în valuri tot mai mari.
 * La fiecare al N-lea val apare un boss. Runda se termină când cristalul cade sau expiră timpul.
 */
export class SurvivalMode extends BaseMode {
  readonly id = 'survival';
  get name(): string {
    return t('survival.name');
  }
  get instructions(): string {
    return t('survival.instructions');
  }
  get scoreLabel(): string {
    return t('score.damage');
  }
  readonly maxDurationSec = CONFIG.survival.maxDurationSec;

  private enemies!: EnemyManager;
  private base!: Phaser.GameObjects.Image;
  private baseX = 0;
  private baseY = 0;
  private baseHp = 0;
  private baseHitT = 0;
  private wave = 0;
  private waveActive = false;
  private toSpawn = 0;
  private bossPending = false;
  private spawnT = 0;
  private spawnInterval = 0;
  private breakT = 0;
  private hpMul = 1;
  private lost = false;
  private lostT = 0;
  private time = 0;

  setup(ctx: ModeContext): void {
    super.setup(ctx);
    const a = this.arena();
    this.baseX = (a.x0 + a.x1) / 2;
    this.baseY = (a.y0 + a.y1) / 2;
    this.baseHp = CONFIG.survival.baseHp;
    this.base = ctx.scene.add.image(this.baseX, this.baseY, TEX.base).setOrigin(0.5, 112 / 160).setDepth(LAYER.base);
    this.enemies = new EnemyManager(ctx.scene, ctx.particles);
    this.enemies.onKilled = (e) => {
      if (e.kind === 'boss') ctx.hud.announce(t('survival.bossDown'), '#9ef01a', 1.6);
    };
    ctx.combat.source = this.enemies;
  }

  onRoundStart(): void {
    this.wave = 0;
    this.waveActive = false;
    this.breakT = 1;
  }

  onRevive(): void {
    if (this.lost) return;
    const max = CONFIG.survival.baseHp;
    const healed = Math.min(max - this.baseHp, max * CONFIG.survival.reviveRepair);
    if (healed <= 0) return;
    this.baseHp += healed;
    this.ctx.particles.burst(this.baseX, this.baseY - 40, 24, 0x9ef01a, 300, 0.7, 1.8);
    this.ctx.floating.show(this.baseX, this.baseY - 120, `🔧 +${Math.round((healed / max) * 100)}%`, '#9ef01a', 1.6);
  }

  teardown(): void {
    this.enemies.clear();
    this.base.destroy();
  }

  update(dt: number): void {
    this.time += dt;
    const cfg = CONFIG.survival;

    if (this.lost) {
      this.lostT += dt;
      this.enemies.update(dt);
      return;
    }

    // Valuri: pauză → spawn treptat → val terminat când nu mai rămâne niciun monstru.
    if (!this.waveActive) {
      this.breakT -= dt;
      if (this.breakT <= 0) this.startWave();
    } else if (this.toSpawn > 0) {
      this.spawnT -= dt;
      while (this.spawnT <= 0 && this.toSpawn > 0 && this.enemies.count < cfg.maxAliveMonsters) {
        this.spawnOne();
        this.spawnT += this.spawnInterval;
      }
      if (this.spawnT < 0) this.spawnT = 0;
    } else if (this.enemies.count === 0) {
      this.waveActive = false;
      this.breakT = cfg.breakBetweenWavesSec;
      this.ctx.hud.announce(t('survival.waveCleared', { n: this.wave }), '#9ef01a', 1.5);
    }

    this.moveEnemies(dt);
    this.enemies.update(dt);
    this.ctx.crowd.pushOut(this.baseX, this.baseY, cfg.baseRadius);

    // Cristalul clipește roșu și tremură când e lovit.
    if (this.baseHitT > 0) {
      this.baseHitT -= dt;
      const shake = Math.sin(this.time * 60) * 3;
      this.base.setPosition(this.baseX + shake, this.baseY).setTint(0xff8080);
    } else this.base.setPosition(this.baseX, this.baseY).clearTint();

    if (this.baseHp <= 0) {
      this.lost = true;
      this.ctx.particles.burst(this.baseX, this.baseY - 40, 60, 0x48cae4, 620, 1, 2.6);
      this.base.setVisible(false);
      this.ctx.hud.announce(t('survival.lost'), '#ff6b6b', 2);
    }
  }

  private startWave(): void {
    const cfg = CONFIG.survival;
    this.wave++;
    const players = this.ctx.crowd.activeCount;
    const mult = Phaser.Math.Clamp(players / 25, 1, 4);
    this.toSpawn = Math.round((6 + 3 * this.wave) * mult);
    this.bossPending = this.wave % cfg.bossEvery === 0;
    if (this.bossPending) this.toSpawn++;
    this.spawnInterval = cfg.spawnEverySec / Math.sqrt(mult);
    this.spawnT = 0;
    this.hpMul = (1 + cfg.hpPerWave * (this.wave - 1)) * (1 + players / cfg.hpPlayersDivisor);
    this.waveActive = true;
    this.ctx.hud.announce(t(this.bossPending ? 'survival.waveBoss' : 'survival.wave', { n: this.wave }), this.bossPending ? '#ff4dd2' : '#ffe066');
  }

  private spawnOne(): void {
    const a = this.arena();
    let kind: EnemyKind;
    if (this.bossPending) {
      kind = 'boss';
      this.bossPending = false;
    } else kind = Math.random() < Math.min(0.5, 0.12 + this.wave * 0.04) ? 'tank' : 'fast';
    const m = CONFIG.survival.monsters[kind];

    // Un punct aleatoriu pe perimetrul arenei.
    const w = a.x1 - a.x0;
    const h = a.y1 - a.y0;
    let p = Math.random() * 2 * (w + h);
    let x: number;
    let y: number;
    if (p < w) [x, y] = [a.x0 + p, a.y0];
    else if ((p -= w) < h) [x, y] = [a.x1, a.y0 + p];
    else if ((p -= h) < w) [x, y] = [a.x1 - p, a.y1];
    else [x, y] = [a.x0, a.y1 - (p - w)];

    this.enemies.spawn(kind, x, y, { hp: m.hp * this.hpMul, speed: m.speed, radius: m.radius, dps: m.baseDps, color: m.color });
    this.toSpawn--;
  }

  private moveEnemies(dt: number): void {
    const list = this.enemies.list;
    const reach = CONFIG.survival.baseRadius;
    for (const e of list) {
      const dx = this.baseX - e.x;
      const dy = this.baseY - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > reach + e.radius - 6) {
        e.attached = false;
        // Mers ușor șerpuit, ca să nu arate ca niște bile pe șine.
        const side = Math.sin(this.time * 3 + e.wobble) * 0.35;
        const vx = dx / d - (dy / d) * side;
        const vy = dy / d + (dx / d) * side;
        e.x += vx * e.speed * dt;
        e.y += vy * e.speed * dt;
      } else {
        e.attached = true;
        this.baseHp = Math.max(0, this.baseHp - e.dps * dt);
        this.baseHitT = 0.12;
      }
    }
    // Separare simplă între monștri (sunt maxim ~100, deci O(n²) e ieftin).
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const min = (a.radius + b.radius) * 0.8;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.25;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }

  isOver(): boolean {
    return this.lost && this.lostT >= LOST_DELAY_SEC;
  }

  getStatus(): ModeStatus {
    const k = this.baseHp / CONFIG.survival.baseHp;
    const wave = this.wave > 0 ? t('survival.statusWave', { n: this.wave }) : t('survival.statusReady');
    return {
      text: t('survival.statusCrystal', { wave, pct: Math.ceil(k * 100) }),
      progress: k,
      color: k > 0.5 ? 0x52d273 : k > 0.25 ? 0xffd43b : 0xff4d4d,
    };
  }

  getResults(): RoundResults {
    const ranking = rankByScore(this.ctx.registry);
    if (this.lost) {
      return { headline: t('survival.resultLost', { n: this.wave }), ranking, winners: [] };
    }
    const winners = new Set<Player>(ranking.map((r) => r.player));
    for (const e of this.ctx.crowd.entities) winners.add(e.player);
    const headline = this.wave === 1 ? t('survival.resultWonOne') : t('survival.resultWon', { n: this.wave });
    return { headline, ranking, winners: [...winners] };
  }
}

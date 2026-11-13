import Phaser from 'phaser';
import type { Target, TargetSource } from './Combat';
import type { ParticlePool } from './Effects';
import { LAYER } from './layers';
import type { Player } from './PlayerRegistry';
import { TEX } from './textures';

export type EnemyKind = 'fast' | 'tank' | 'boss';

export interface Enemy extends Target {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  /** Damage pe secundă când atinge ce atacă (ex. baza). */
  dps: number;
  color: number;
  /** Variabile libere pentru mod (ex. dacă a ajuns la bază). */
  attached: boolean;
  /** Distanța parcursă pe drum (Tower Defense). */
  progress: number;
  /** Secunde rămase din încetinire (turnul de gheață). */
  slowT: number;
  wobble: number;
  flashT: number;
  img: Phaser.GameObjects.Image;
  barBg: Phaser.GameObjects.Image;
  barFill: Phaser.GameObjects.Image;
}

/** Textura și raza corpului desenat în ea, ca scara să iasă din raza dorită. */
const LOOK: Record<EnemyKind, { tex: string; bodyRadius: number; depth: number }> = {
  fast: { tex: TEX.monFast, bodyRadius: 15, depth: LAYER.enemies },
  tank: { tex: TEX.monTank, bodyRadius: 20, depth: LAYER.enemies + 1 },
  boss: { tex: TEX.monBoss, bodyRadius: 44, depth: LAYER.enemies + 2 },
};
const BAR_DEPTH = LAYER.enemyBars;
const FLASH_SEC = 0.06;
/** Clipirea albă la lovitură apare cel mult o dată pe ciclu, altfel sub sute de atacuri ținta ar rămâne mereu albă. */
const FLASH_CYCLE = 0.25;

/**
 * Monștrii (pooled). Mișcarea o face modul; managerul ține viața, barele de viață, lovirea și moartea.
 * Implementează TargetSource, deci combat-ul comun îi poate ataca direct.
 */
export class EnemyManager implements TargetSource {
  readonly list: Enemy[] = [];
  onKilled: (e: Enemy, by: Player | null) => void = () => {};

  private pool: Enemy[] = [];
  private time = 0;

  constructor(
    private scene: Phaser.Scene,
    private particles: ParticlePool,
  ) {}

  spawn(kind: EnemyKind, x: number, y: number, stats: { hp: number; speed: number; radius: number; dps: number; color: number }): Enemy {
    const look = LOOK[kind];
    let e = this.pool.pop();
    if (!e) {
      e = {
        kind, x, y, radius: 0, alive: true, combo: 0, comboT: 99, hp: 0, maxHp: 0, speed: 0, dps: 0, color: 0,
        attached: false, progress: 0, slowT: 0, wobble: 0, flashT: 0,
        img: this.scene.add.image(0, 0, look.tex),
        barBg: this.scene.add.image(0, 0, TEX.pixel).setOrigin(0, 0.5).setTint(0x000000).setDepth(BAR_DEPTH),
        barFill: this.scene.add.image(0, 0, TEX.pixel).setOrigin(0, 0.5).setDepth(BAR_DEPTH + 0.1),
      };
    }
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.radius = stats.radius;
    e.alive = true;
    e.combo = 0;
    e.comboT = 99;
    e.hp = e.maxHp = stats.hp;
    e.speed = stats.speed;
    e.dps = stats.dps;
    e.color = stats.color;
    e.attached = false;
    e.progress = 0;
    e.slowT = 0;
    e.wobble = Math.random() * Math.PI * 2;
    e.flashT = 0;
    e.img
      .setTexture(look.tex)
      .setTint(stats.color)
      .setScale(stats.radius / look.bodyRadius)
      .setDepth(look.depth)
      .setPosition(x, y)
      .setAlpha(1)
      .setVisible(true);
    e.barBg.setVisible(false);
    e.barFill.setVisible(false);
    this.list.push(e);
    return e;
  }

  /** Câți monștri vii sunt. */
  get count(): number {
    return this.list.length;
  }

  nearest(x: number, y: number, range: number): Target | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.list) {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx * dx + dy * dy) - e.radius;
      if (d < bestD && d <= range) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  hit(target: Target, damage: number, by: Player | null): number {
    const e = target as Enemy;
    if (!e.alive) return 0;
    const dealt = Math.min(e.hp, damage);
    e.hp -= dealt;
    if (e.flashT <= 0) e.flashT = FLASH_CYCLE;
    if (e.hp <= 0) this.kill(e, by);
    return dealt;
  }

  damageAll(damage: number, by: Player): number {
    let total = 0;
    // Copie, pentru că hit() poate scoate monștri din listă.
    for (const e of this.list.slice()) total += this.hit(e, damage, by);
    return total;
  }

  targets(): readonly Target[] {
    return this.list;
  }

  kill(e: Enemy, by: Player | null): void {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    if (by) by.stats.kills++;
    const big = e.kind === 'boss';
    this.particles.burst(e.x, e.y, big ? 46 : e.kind === 'tank' ? 16 : 10, e.color, big ? 520 : 260, big ? 0.9 : 0.5, big ? 2.4 : 1.4);
    this.release(e);
    this.onKilled(e, by);
  }

  /** Scoate un monstru fără explozie și fără să-l numere ca ucis (ex. a ajuns la bază). */
  remove(e: Enemy): void {
    if (!e.alive) return;
    e.alive = false;
    this.release(e);
  }

  /** Scoate toți monștrii fără efecte (între runde). */
  clear(): void {
    for (const e of this.list.slice()) {
      e.alive = false;
      this.release(e);
    }
  }

  /** Doar vizual: poziții, clipire la lovitură, bare de viață. */
  update(dt: number): void {
    this.time += dt;
    for (const e of this.list) {
      const s = e.radius / LOOK[e.kind].bodyRadius;
      const wob = 1 + 0.06 * Math.sin(this.time * 9 + e.wobble);
      e.img.setPosition(e.x, e.y).setScale(s * wob, s / wob);
      if (e.flashT > 0) {
        e.flashT -= dt;
        if (e.flashT > FLASH_CYCLE - FLASH_SEC) e.img.setTintFill(0xffffff);
        else e.img.setTint(e.color);
      }
      // Monștrii rapizi mor din câteva lovituri; barele lor doar ar aglomera ecranul.
      if (e.kind !== 'fast' && e.hp < e.maxHp) {
        const w = Math.max(34, e.radius * 1.8);
        const h = e.kind === 'boss' ? 10 : 6;
        const bx = e.x - w / 2;
        const by = e.y - e.radius - 12;
        const k = e.hp / e.maxHp;
        e.barBg.setVisible(true).setPosition(bx - 2, by).setDisplaySize(w + 4, h + 4);
        e.barFill
          .setVisible(true)
          .setPosition(bx, by)
          .setDisplaySize(Math.max(1, w * k), h)
          .setTint(k > 0.5 ? 0x52d273 : k > 0.25 ? 0xffd43b : 0xff4d4d);
      }
    }
  }

  private release(e: Enemy): void {
    const i = this.list.indexOf(e);
    if (i >= 0) {
      const last = this.list.pop()!;
      if (last !== e) this.list[i] = last;
    }
    e.img.setVisible(false);
    e.barBg.setVisible(false);
    e.barFill.setVisible(false);
    this.pool.push(e);
  }
}

import Phaser from 'phaser';
import { CONFIG } from '../../config/config';
import type { Target, TargetSource } from '../../core/Combat';
import type { CrowdEntity } from '../../core/Crowd';
import { LAYER } from '../../core/layers';
import type { Player } from '../../core/PlayerRegistry';
import { TEX } from '../../core/textures';
import { formatTime, type ModeStatus } from '../../ui/Hud';
import { BaseMode, rankByScore, type ModeContext, type RoundResults } from '../GameMode';
import { t } from '../../i18n';

type Shape = 'circle' | 'line' | 'ring' | 'cross';

interface Zone {
  shape: Shape;
  g: Phaser.GameObjects.Graphics;
  color: number;
  /** Secunde de la anunț; impactul are loc la `warn`. */
  t: number;
  warn: number;
  x: number;
  y: number;
  /** circle: rază; line/cross: grosime; ring: raza interioară. */
  a: number;
  /** ring: raza exterioară; line: 0 = orizontal, 1 = vertical. */
  b: number;
  /** Cercul urmărește jucătorul ăsta în prima jumătate a avertizării („umbra” care vânează grupuri). */
  follow: CrowdEntity | null;
  hit: boolean;
}

const BOSS_TEX_RADIUS = 100;
const BOSS_ORIGIN_Y = 136 / 260;
const ZONE_DEPTH = LAYER.zones;
const AFTER_IMPACT_SEC = 0.35;
const FLASH_SEC = 0.05;
/** Clipire la lovitură cel mult de 4 ori pe secundă (altfel, cu sute de jucători, boss-ul ar fi mereu alb). */
const FLASH_CYCLE = 0.25;
const DEATH_SEC = 1.8;
const PATTERNS: Shape[][] = [['circle', 'line'], ['circle', 'line', 'ring'], ['circle', 'line', 'ring', 'cross']];

/**
 * Boss Slayer: un boss uriaș cu 3 faze. Atacurile sunt anunțate cu 2–3 s înainte prin zone
 * colorate pe jos care se umplu progresiv (comentariile vin cu întârziere, deci avertizarea e lungă).
 * Cine e prins într-o zonă fără scut cade câteva secunde.
 */
export class BossMode extends BaseMode implements TargetSource {
  readonly id = 'boss';
  get name(): string {
    return t('boss.name');
  }
  get instructions(): string {
    return t('boss.instructions');
  }
  get scoreLabel(): string {
    return t('score.damage');
  }
  readonly maxDurationSec = CONFIG.boss.maxDurationSec;

  private boss: Target & { hp: number; maxHp: number } = { x: 0, y: 0, radius: CONFIG.boss.radius, alive: true, combo: 0, comboT: 99, hp: 1, maxHp: 1 };
  private img!: Phaser.GameObjects.Image;
  private zones: Zone[] = [];
  private freeGraphics: Phaser.GameObjects.Graphics[] = [];
  /** Zonele sunt tăiate la marginile arenei (inelul mare ar ieși peste comentarii). */
  private clip!: Phaser.GameObjects.Graphics;
  private mask!: Phaser.Display.Masks.GeometryMask;
  private phase = 0;
  private attackT = 0;
  private goalX = 0;
  private goalY = 0;
  private flashT = 0;
  private roarT = 0;
  private dead = false;
  private deadT = 0;
  private elapsed = 0;
  private time = 0;
  private readonly targetList: Target[] = [];

  setup(ctx: ModeContext): void {
    super.setup(ctx);
    const a = this.arena();
    this.boss.x = this.goalX = (a.x0 + a.x1) / 2;
    this.boss.y = this.goalY = a.y0 + (a.y1 - a.y0) * 0.38;
    this.boss.alive = true;
    this.resetHp();
    this.img = ctx.scene.add
      .image(this.boss.x, this.boss.y, TEX.boss)
      .setOrigin(0.5, BOSS_ORIGIN_Y)
      .setScale(this.boss.radius / BOSS_TEX_RADIUS)
      .setTint(CONFIG.boss.phases[0].color)
      .setDepth(LAYER.enemies);
    this.targetList.push(this.boss);
    this.clip = ctx.scene.make.graphics({}, false);
    this.clip.fillStyle(0xffffff).fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    this.mask = this.clip.createGeometryMask();
    ctx.combat.source = this;
  }

  onRoundStart(): void {
    // Viața se calculează la start, cu jucătorii care au intrat în lobby.
    this.resetHp();
    this.attackT = 2.5;
    this.ctx.hud.announce(t('boss.fight'), '#ff4dd2', 1.4);
  }

  teardown(): void {
    for (const z of this.zones) z.g.destroy();
    for (const g of this.freeGraphics) g.destroy();
    this.zones = [];
    this.freeGraphics = [];
    this.img.destroy();
    this.mask.destroy();
    this.clip.destroy();
  }

  private resetHp(): void {
    const cfg = CONFIG.boss;
    this.boss.maxHp = this.boss.hp = Math.round(cfg.hp * (1 + this.ctx.crowd.activeCount / cfg.hpPlayersDivisor));
    this.phase = 0;
  }

  // --- TargetSource -----------------------------------------------------------
  nearest(x: number, y: number, range: number): Target | null {
    if (!this.boss.alive) return null;
    const dx = this.boss.x - x;
    const dy = this.boss.y - y;
    return Math.sqrt(dx * dx + dy * dy) - this.boss.radius <= range ? this.boss : null;
  }

  hit(_t: Target, damage: number, _by: Player): number {
    const b = this.boss;
    if (!b.alive) return 0;
    const dealt = Math.min(b.hp, damage);
    b.hp -= dealt;
    if (this.flashT <= 0) this.flashT = FLASH_CYCLE;
    const k = b.hp / b.maxHp;
    const nextAt = CONFIG.boss.phaseAt[this.phase];
    if (nextAt !== undefined && k <= nextAt && b.hp > 0) this.enterPhase(this.phase + 1);
    if (b.hp <= 0) this.die();
    return dealt;
  }

  damageAll(damage: number, by: Player): number {
    return this.hit(this.boss, damage, by);
  }

  targets(): readonly Target[] {
    return this.boss.alive ? this.targetList : [];
  }

  // --- joc ----------------------------------------------------------------------
  update(dt: number): void {
    this.time += dt;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / DEATH_SEC);
      this.img.setScale((this.boss.radius / BOSS_TEX_RADIUS) * (1 + k * 0.4)).setAlpha(1 - k).setAngle(Math.sin(this.time * 40) * 6 * (1 - k));
      if (Math.random() < 0.4) {
        this.ctx.particles.burst(this.boss.x + Phaser.Math.Between(-90, 90), this.boss.y + Phaser.Math.Between(-90, 90), 6, 0xffffff, 300);
      }
      return;
    }
    this.elapsed += dt;
    this.move(dt);

    const phase = CONFIG.boss.phases[this.phase];
    this.attackT -= dt;
    if (this.attackT <= 0) {
      this.launchAttack();
      this.attackT = phase.attackEverySec;
    }
    this.updateZones(dt);
  }

  private move(dt: number): void {
    const b = this.boss;
    const a = this.arena();
    const dx = this.goalX - b.x;
    const dy = this.goalY - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 10) this.pickGoal();
    else {
      const speed = CONFIG.boss.speed * (1 + this.phase * 0.35);
      b.x += (dx / d) * speed * dt;
      b.y += (dy / d) * speed * dt;
    }
    b.x = Phaser.Math.Clamp(b.x, a.x0 + b.radius, a.x1 - b.radius);
    b.y = Phaser.Math.Clamp(b.y, a.y0 + b.radius, a.y1 - b.radius);
    this.ctx.crowd.pushOut(b.x, b.y, b.radius + 8);

    if (this.roarT > 0) this.roarT -= dt;
    const roar = this.roarT > 0 ? 1 + 0.08 * Math.sin(this.roarT * 30) : 1;
    const breath = 1 + 0.03 * Math.sin(this.time * 2.4);
    const s = (b.radius / BOSS_TEX_RADIUS) * roar;
    this.img.setPosition(b.x, b.y + Math.sin(this.time * 2) * 6).setScale(s * breath, s / breath);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT > FLASH_CYCLE - FLASH_SEC) this.img.setTintFill(0xffffff);
      else this.img.setTint(CONFIG.boss.phases[this.phase].color);
    }
  }

  /** Boss-ul se plimbă spre jucători: ținta e lângă un caracter ales la întâmplare. */
  private pickGoal(): void {
    const a = this.arena();
    const e = this.randomPlayer();
    const x = e ? e.x + Phaser.Math.Between(-150, 150) : Phaser.Math.Between(a.x0, a.x1);
    const y = e ? e.y + Phaser.Math.Between(-150, 150) : Phaser.Math.Between(a.y0, a.y1);
    this.goalX = Phaser.Math.Clamp(x, a.x0 + this.boss.radius, a.x1 - this.boss.radius);
    this.goalY = Phaser.Math.Clamp(y, a.y0 + this.boss.radius, a.y1 - this.boss.radius);
  }

  private randomPlayer(): CrowdEntity | null {
    const list = this.ctx.crowd.entities;
    for (let tries = 0; tries < 6 && list.length; tries++) {
      const e = list[Math.floor(Math.random() * list.length)];
      if (e.state === 'alive' && e.downedT <= 0) return e;
    }
    return list[0] ?? null;
  }

  private launchAttack(): void {
    const phase = CONFIG.boss.phases[this.phase];
    const options = PATTERNS[this.phase];
    let usedCross = false;
    this.roarT = 0.5;
    for (let i = 0; i < phase.zonesPerAttack; i++) {
      let shape = options[Math.floor(Math.random() * options.length)];
      if (shape === 'cross' && usedCross) shape = 'circle';
      if (shape === 'cross') usedCross = true;
      // Zonele aceleiași salve se declanșează ușor decalat, ca să se poată citi.
      this.addZone(shape, phase.warnSec + i * 0.35, phase.color);
    }
  }

  private addZone(shape: Shape, warn: number, color: number): void {
    const a = this.arena();
    const b = this.boss;
    const g = this.freeGraphics.pop() ?? this.ctx.scene.add.graphics().setMask(this.mask);
    g.setDepth(ZONE_DEPTH).setVisible(true).setAlpha(1);
    const target = this.randomPlayer();
    const z: Zone = { shape, g, color, t: 0, warn, x: b.x, y: b.y, a: 0, b: 0, follow: null, hit: false };
    switch (shape) {
      case 'circle':
        z.follow = target;
        z.x = target?.x ?? Phaser.Math.Between(a.x0, a.x1);
        z.y = target?.y ?? Phaser.Math.Between(a.y0, a.y1);
        z.a = 150;
        break;
      case 'line':
        z.b = Math.random() < 0.5 ? 0 : 1;
        z.x = target?.x ?? b.x;
        z.y = target?.y ?? b.y;
        z.a = 150;
        break;
      case 'ring':
        z.a = b.radius + 50;
        z.b = b.radius + 280;
        break;
      case 'cross':
        z.a = 130;
        break;
    }
    this.zones.push(z);
  }

  private updateZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      // Zonele centrate pe boss îl urmează până la impact; cercul vânează un jucător în prima jumătate.
      if (!z.hit && (z.shape === 'ring' || z.shape === 'cross')) {
        z.x = this.boss.x;
        z.y = this.boss.y;
      }
      if (!z.hit && z.follow && z.t < z.warn * 0.5 && z.follow.state !== 'despawning') {
        z.x += (z.follow.x - z.x) * Math.min(1, dt * 3);
        z.y += (z.follow.y - z.y) * Math.min(1, dt * 3);
      }
      if (!z.hit && z.t >= z.warn) this.impact(z);
      if (z.hit && z.t >= z.warn + AFTER_IMPACT_SEC) {
        z.g.clear().setVisible(false);
        this.freeGraphics.push(z.g);
        this.zones.splice(i, 1);
        continue;
      }
      this.drawZone(z);
    }
  }

  private drawZone(z: Zone): void {
    const g = z.g;
    const a = this.arena();
    const k = Math.min(1, z.t / z.warn);
    g.clear();
    if (z.hit) {
      // Flash-ul impactului, care se stinge.
      const f = 1 - (z.t - z.warn) / AFTER_IMPACT_SEC;
      g.setAlpha(Math.max(0, f));
      g.fillStyle(0xffffff, 0.75);
      this.fillShape(g, z, 1, a);
      return;
    }
    // Clipește în ultimele 0.4 s.
    const blink = z.warn - z.t < 0.4 && Math.floor(z.t * 12) % 2 === 0;
    g.fillStyle(z.color, 0.16);
    this.fillShape(g, z, 1, a);
    g.fillStyle(blink ? 0xffffff : z.color, 0.42);
    this.fillShape(g, z, k, a);
    g.lineStyle(5, z.color, 0.95);
    this.strokeShape(g, z, a);
  }

  /** Forma zonei, „umplută” în proporție de k (0–1). */
  private fillShape(g: Phaser.GameObjects.Graphics, z: Zone, k: number, a: { x0: number; y0: number; x1: number; y1: number }): void {
    switch (z.shape) {
      case 'circle':
        g.fillCircle(z.x, z.y, z.a * k);
        break;
      case 'line': {
        const half = (z.a / 2) * k;
        if (z.b === 0) g.fillRect(a.x0, z.y - half, a.x1 - a.x0, half * 2);
        else g.fillRect(z.x - half, a.y0, half * 2, a.y1 - a.y0);
        break;
      }
      case 'ring': {
        // Inelul se umple din interior spre exterior.
        const outer = z.a + (z.b - z.a) * k;
        g.beginPath();
        g.arc(z.x, z.y, outer, 0, Math.PI * 2, false);
        g.arc(z.x, z.y, z.a, 0, Math.PI * 2, true);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'cross': {
        const half = (z.a / 2) * k;
        g.fillRect(a.x0, z.y - half, a.x1 - a.x0, half * 2);
        g.fillRect(z.x - half, a.y0, half * 2, a.y1 - a.y0);
        break;
      }
    }
  }

  private strokeShape(g: Phaser.GameObjects.Graphics, z: Zone, a: { x0: number; y0: number; x1: number; y1: number }): void {
    switch (z.shape) {
      case 'circle':
        g.strokeCircle(z.x, z.y, z.a);
        break;
      case 'line':
        if (z.b === 0) g.strokeRect(a.x0, z.y - z.a / 2, a.x1 - a.x0, z.a);
        else g.strokeRect(z.x - z.a / 2, a.y0, z.a, a.y1 - a.y0);
        break;
      case 'ring':
        g.strokeCircle(z.x, z.y, z.a);
        g.strokeCircle(z.x, z.y, z.b);
        break;
      case 'cross':
        g.strokeRect(a.x0, z.y - z.a / 2, a.x1 - a.x0, z.a);
        g.strokeRect(z.x - z.a / 2, a.y0, z.a, a.y1 - a.y0);
        break;
    }
  }

  private inside(z: Zone, x: number, y: number): boolean {
    const dx = x - z.x;
    const dy = y - z.y;
    switch (z.shape) {
      case 'circle':
        return dx * dx + dy * dy <= z.a * z.a;
      case 'line':
        return z.b === 0 ? Math.abs(dy) <= z.a / 2 : Math.abs(dx) <= z.a / 2;
      case 'ring': {
        const d2 = dx * dx + dy * dy;
        return d2 >= z.a * z.a && d2 <= z.b * z.b;
      }
      case 'cross':
        return Math.abs(dy) <= z.a / 2 || Math.abs(dx) <= z.a / 2;
    }
  }

  private impact(z: Zone): void {
    z.hit = true;
    let downed = 0;
    for (const e of this.ctx.crowd.entities) {
      if (e.state === 'despawning' || !this.inside(z, e.x, e.y)) continue;
      if (this.ctx.crowd.down(e, CONFIG.combat.downedSec)) downed++;
    }
    this.ctx.particles.burst(z.x, z.y, 18, z.color, 420, 0.6, 2);
    this.ctx.scene.cameras.main.shake(140, 0.004);
    if (downed > 0) this.ctx.floating.show(z.x, z.y - 40, t('boss.downed', { n: downed }), '#ff6b6b', 1.4);
  }

  private enterPhase(phase: number): void {
    this.phase = phase;
    const color = CONFIG.boss.phases[phase].color;
    this.img.setTint(color);
    this.roarT = 1;
    this.attackT = Math.min(this.attackT, 1.5);
    this.ctx.particles.burst(this.boss.x, this.boss.y, 40, color, 600, 0.8, 2.2);
    this.ctx.hud.announce(t('boss.phase', { n: phase + 1 }), '#ff4dd2', 2);
  }

  private die(): void {
    this.boss.alive = false;
    this.dead = true;
    this.deadT = 0;
    for (const z of this.zones) {
      z.g.clear().setVisible(false);
      this.freeGraphics.push(z.g);
    }
    this.zones = [];
    this.ctx.crowd.reviveAllDowned();
    this.ctx.particles.burst(this.boss.x, this.boss.y, 80, 0xffffff, 700, 1.2, 2.6);
    this.ctx.hud.announce(t('boss.defeated'), '#9ef01a', 2.2);
  }

  isOver(): boolean {
    return this.dead && this.deadT >= DEATH_SEC;
  }

  getStatus(): ModeStatus {
    const k = this.boss.hp / this.boss.maxHp;
    return {
      text: t('boss.status', { n: this.phase + 1, pct: Math.ceil(k * 100) }),
      progress: k,
      color: CONFIG.boss.phases[this.phase].color,
    };
  }

  getResults(): RoundResults {
    const ranking = rankByScore(this.ctx.registry);
    if (!this.dead) {
      const pct = Math.ceil((this.boss.hp / this.boss.maxHp) * 100);
      return { headline: t('boss.resultLost', { pct }), ranking, winners: [] };
    }
    const winners = new Set<Player>(ranking.map((r) => r.player));
    for (const e of this.ctx.crowd.entities) winners.add(e.player);
    return { headline: t('boss.resultWon', { time: formatTime(this.elapsed) }), ranking, winners: [...winners] };
  }
}

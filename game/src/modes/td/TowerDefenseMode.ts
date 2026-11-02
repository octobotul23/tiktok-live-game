import Phaser from 'phaser';
import { CONFIG } from '../../config/config';
import type { GiftEffect, TowerKind } from '../../config/gifts';
import { credit } from '../../core/Combat';
import { EnemyManager, type Enemy, type EnemyKind } from '../../core/Enemies';
import { LAYER } from '../../core/layers';
import type { Player } from '../../core/PlayerRegistry';
import { TEX } from '../../core/textures';
import type { ModeStatus } from '../../ui/Hud';
import { BaseMode, rankByScore, type ModeContext, type RoundResults } from '../GameMode';
import { t } from '../../i18n';

const LOST_DELAY_SEC = 1.6;

/** Drumul, în fracțiuni din arenă (0..1): șerpuiește de sus-stânga până la cristal, jos-dreapta. */
const PATH: readonly [number, number][] = [
  [-0.03, 0.1],
  [0.85, 0.1],
  [0.85, 0.42],
  [0.15, 0.42],
  [0.15, 0.76],
  [0.72, 0.76],
];
/** Sloturile de turnuri, tot în fracțiuni: între benzile drumului, ca un turn să bată în două benzi. */
const SLOTS: readonly [number, number][] = [
  [0.3, 0.26],
  [0.58, 0.26],
  [0.97, 0.26],
  [0.03, 0.59],
  [0.42, 0.59],
  [0.68, 0.59],
  [0.4, 0.93],
  [0.92, 0.76],
];
/** Înălțimea „gurii” turnului față de bază, de unde pleacă proiectilele. */
const MUZZLE_Y = 58;

interface Slot {
  x: number;
  y: number;
  marker: Phaser.GameObjects.Image;
  tower: Tower | null;
}

interface Tower {
  kind: TowerKind;
  level: number;
  owner: Player;
  cd: number;
  /** Mică animație la construire/upgrade. */
  pop: number;
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

/**
 * Tower Defense: monștrii merg pe un drum fix spre cristal. Jucătorii sunt „turnuri vii” (atacul automat
 * comun), iar cadourile construiesc și îmbunătățesc turnuri pe sloturile de lângă drum, chiar și în lobby.
 */
export class TowerDefenseMode extends BaseMode {
  readonly id = 'td';
  get name(): string {
    return t('td.name');
  }
  get instructions(): string {
    return t('td.instructions');
  }
  get scoreLabel(): string {
    return t('score.damage');
  }
  readonly maxDurationSec = CONFIG.td.maxDurationSec;

  private enemies!: EnemyManager;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private points: { x: number; y: number }[] = [];
  /** Lungimea cumulată a drumului la fiecare punct. */
  private dist: number[] = [];
  private length = 0;
  private slots: Slot[] = [];
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
    const at = ([fx, fy]: readonly [number, number]) => ({ x: a.x0 + fx * (a.x1 - a.x0), y: a.y0 + fy * (a.y1 - a.y0) });
    this.points = PATH.map(at);
    this.dist = [0];
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i - 1];
      const q = this.points[i];
      this.dist.push(this.dist[i - 1] + Math.hypot(q.x - p.x, q.y - p.y));
    }
    this.length = this.dist[this.dist.length - 1];
    this.drawPath();

    const end = this.points[this.points.length - 1];
    this.baseX = end.x;
    this.baseY = end.y;
    this.baseHp = CONFIG.td.baseHp;
    this.base = ctx.scene.add.image(end.x, end.y, TEX.base).setOrigin(0.5, 112 / 160).setDepth(LAYER.base);
    this.objects.push(this.base);

    this.slots = SLOTS.map((s) => {
      const p = at(s);
      const marker = ctx.scene.add.image(p.x, p.y, TEX.slot).setAlpha(0.55).setDepth(6);
      this.objects.push(marker);
      return { x: p.x, y: p.y, marker, tower: null };
    });

    this.enemies = new EnemyManager(ctx.scene, ctx.particles);
    this.enemies.onKilled = (e) => {
      if (e.kind === 'boss') ctx.hud.announce(t('survival.bossDown'), '#9ef01a', 1.6);
    };
    ctx.combat.source = this.enemies;
  }

  /** Drumul: o bandă de pământ cu margine închisă și colțuri rotunjite, sub mulțime. */
  private drawPath(): void {
    const g = this.ctx.scene.add.graphics().setDepth(5);
    const w = CONFIG.td.pathWidth;
    const pts = this.points;
    const band = (width: number, color: number, alpha: number) => {
      g.lineStyle(width, color, alpha);
      for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      g.fillStyle(color, alpha);
      for (let i = 1; i < pts.length - 1; i++) g.fillCircle(pts[i].x, pts[i].y, width / 2);
    };
    band(w + 12, 0x1b1410, 0.9);
    band(w, 0x6b5440, 0.9);
    // Săgeți discrete pe drum, ca să se vadă încotro merg monștrii.
    g.fillStyle(0xffffff, 0.18);
    for (let d = 60; d < this.length - 80; d += 120) {
      const p = this.pointAt(d);
      const q = this.pointAt(d + 1);
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      g.fillTriangle(p.x + c * 14, p.y + s * 14, p.x - c * 10 - s * 11, p.y - s * 10 + c * 11, p.x - c * 10 + s * 11, p.y - s * 10 - c * 11);
    }
    this.objects.push(g);
  }

  /** Punctul de pe drum aflat la distanța `d` de la început. */
  private pointAt(d: number, out = { x: 0, y: 0, nx: 0, ny: 0 }): { x: number; y: number; nx: number; ny: number } {
    const pts = this.points;
    let i = 1;
    while (i < pts.length - 1 && this.dist[i] < d) i++;
    const p = pts[i - 1];
    const q = pts[i];
    const seg = this.dist[i] - this.dist[i - 1] || 1;
    const k = Phaser.Math.Clamp((d - this.dist[i - 1]) / seg, 0, 1);
    out.x = p.x + (q.x - p.x) * k;
    out.y = p.y + (q.y - p.y) * k;
    // Normala segmentului, pentru decalajul lateral al fiecărui monstru.
    out.nx = -(q.y - p.y) / seg;
    out.ny = (q.x - p.x) / seg;
    return out;
  }

  onRoundStart(): void {
    this.wave = 0;
    this.waveActive = false;
    this.breakT = 1;
  }

  applyEffect(player: Player, effect: GiftEffect): boolean {
    if (effect.type !== 'tower') return false;
    this.build(player, effect.kind, effect.levels);
    return true;
  }

  /**
   * Fiecare nivel primit: întâi crește turnul de același tip al expeditorului (până la nivelul maxim),
   * apoi construiește unul nou pe slotul liber cel mai apropiat; dacă nu mai e loc, crește alt turn de același tip.
   */
  private build(p: Player, kind: TowerKind, levels: number): void {
    const touched = new Set<Slot>();
    for (let n = 0; n < levels; n++) {
      // lowest() sare peste turnurile ajunse la nivelul maxim.
      let slot = this.lowest((tw) => tw.owner === p && tw.kind === kind);
      if (!slot) {
        slot = this.freeSlotNear(p);
        if (slot) slot.tower = this.makeTower(slot, kind, p);
      }
      slot ??= this.lowest((tw) => tw.kind === kind) ?? this.lowest(() => true);
      if (!slot) break;
      const tw = slot.tower!;
      tw.level++;
      tw.pop = 0.35;
      touched.add(slot);
    }
    for (const s of touched) {
      this.refreshTower(s.tower!);
      this.ctx.particles.burst(s.x, s.y - 30, 18, CONFIG.td.towers[s.tower!.kind].color, 320, 0.6, 1.6);
    }
    if (touched.size > 0) {
      const tw = [...touched][0].tower!;
      this.ctx.hud.announce(t('td.built', { name: p.nickname, tower: t(`td.tower.${kind}`), lvl: tw.level }), '#ffd166', 1.6);
    } else {
      const e = p.entity;
      if (e) this.ctx.floating.show(e.x, e.y - 90, t('td.maxed'), '#ffd166', 1.6);
    }
  }

  /** Slotul cu turnul de nivel cel mai mic (sub maxim) care trece filtrul. */
  private lowest(filter: (tw: Tower) => boolean): Slot | null {
    let best: Slot | null = null;
    for (const s of this.slots) {
      const tw = s.tower;
      if (!tw || tw.level >= CONFIG.td.maxTowerLevel || !filter(tw)) continue;
      if (!best || tw.level < best.tower!.level) best = s;
    }
    return best;
  }

  private freeSlotNear(p: Player): Slot | null {
    const e = p.entity;
    let best: Slot | null = null;
    let bestD = Infinity;
    for (const s of this.slots) {
      if (s.tower) continue;
      const d = e ? (s.x - e.x) ** 2 + (s.y - e.y) ** 2 : 0;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private makeTower(slot: Slot, kind: TowerKind, owner: Player): Tower {
    const scene = this.ctx.scene;
    slot.marker.setVisible(false);
    const img = scene.add.image(slot.x, slot.y + 20, TEX.tower).setOrigin(0.5, 84 / 96).setDepth(LAYER.base - 1);
    const label = scene.add
      .text(slot.x, slot.y + 34, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(LAYER.enemyBars);
    this.objects.push(img, label);
    // Nivelul 0: build() îl ridică imediat la 1.
    return { kind, level: 0, owner, cd: 0, pop: 0, img, label };
  }

  private refreshTower(tw: Tower): void {
    tw.img.setTint(CONFIG.td.towers[tw.kind].color);
    tw.label.setText(`${'★'.repeat(tw.level)}\n${tw.owner.nickname.slice(0, 12)}`);
  }

  onRevive(): void {
    if (this.lost) return;
    const max = CONFIG.td.baseHp;
    const healed = Math.min(max - this.baseHp, max * CONFIG.td.reviveRepair);
    if (healed <= 0) return;
    this.baseHp += healed;
    this.ctx.particles.burst(this.baseX, this.baseY - 40, 24, 0x9ef01a, 300, 0.7, 1.8);
    this.ctx.floating.show(this.baseX, this.baseY - 120, `🔧 +${Math.round((healed / max) * 100)}%`, '#9ef01a', 1.6);
  }

  teardown(): void {
    this.enemies.clear();
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.slots = [];
  }

  update(dt: number): void {
    this.time += dt;
    const cfg = CONFIG.td;
    this.animateTowers(dt);

    if (this.lost) {
      this.lostT += dt;
      this.enemies.update(dt);
      return;
    }

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
    this.fireTowers(dt);
    this.enemies.update(dt);
    this.ctx.crowd.pushOut(this.baseX, this.baseY, cfg.baseRadius);

    if (this.baseHitT > 0) {
      this.baseHitT -= dt;
      const shake = Math.sin(this.time * 60) * 4;
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
    const cfg = CONFIG.td;
    this.wave++;
    const players = this.ctx.crowd.activeCount;
    const mult = Phaser.Math.Clamp(players / 25, 1, 4);
    this.toSpawn = Math.round((8 + 3 * this.wave) * mult);
    this.bossPending = this.wave % cfg.bossEvery === 0;
    if (this.bossPending) this.toSpawn++;
    this.spawnInterval = cfg.spawnEverySec / Math.sqrt(mult);
    this.spawnT = 0;
    this.hpMul = (1 + cfg.hpPerWave * (this.wave - 1)) * (1 + players / cfg.hpPlayersDivisor);
    this.waveActive = true;
    this.ctx.hud.announce(t(this.bossPending ? 'survival.waveBoss' : 'survival.wave', { n: this.wave }), this.bossPending ? '#ff4dd2' : '#ffe066');
  }

  private spawnOne(): void {
    let kind: EnemyKind;
    if (this.bossPending) {
      kind = 'boss';
      this.bossPending = false;
    } else kind = Math.random() < Math.min(0.5, 0.12 + this.wave * 0.04) ? 'tank' : 'fast';
    const m = CONFIG.td.monsters[kind];
    const start = this.points[0];
    // `dps` nu contează aici: monștrii nu atacă, doar scapă la capăt (leak).
    this.enemies.spawn(kind, start.x, start.y, { hp: m.hp * this.hpMul, speed: m.speed, radius: m.radius, dps: 0, color: m.color });
    this.toSpawn--;
  }

  private readonly tmp = { x: 0, y: 0, nx: 0, ny: 0 };

  private moveEnemies(dt: number): void {
    const cfg = CONFIG.td;
    const lane = cfg.pathWidth * 0.32;
    for (const e of this.enemies.list.slice()) {
      const slow = e.slowT > 0 ? cfg.towers.frost.slowMul : 1;
      if (e.slowT > 0) e.slowT -= dt;
      e.progress += e.speed * slow * dt;
      if (e.progress >= this.length) {
        this.leak(e);
        continue;
      }
      const p = this.pointAt(e.progress, this.tmp);
      // Fiecare monstru are banda lui laterală (din `wobble`), ca să nu meargă toți pe aceeași linie.
      const side = (e.kind === 'boss' ? 0 : Math.sin(e.wobble * 3.7) * lane) + Math.sin(this.time * 3 + e.wobble) * 4;
      e.x = p.x + p.nx * side;
      e.y = p.y + p.ny * side;
    }
  }

  private leak(e: Enemy): void {
    const dmg = CONFIG.td.monsters[e.kind].leak;
    this.baseHp = Math.max(0, this.baseHp - dmg);
    this.baseHitT = 0.25;
    this.ctx.particles.burst(this.baseX, this.baseY - 40, 12, 0xff4d4d, 300, 0.5, 1.4);
    this.ctx.floating.show(this.baseX, this.baseY - 110, `-${dmg}`, '#ff6b6b', 1);
    this.enemies.remove(e);
  }

  private animateTowers(dt: number): void {
    for (const s of this.slots) {
      const tw = s.tower;
      if (!tw) continue;
      tw.pop = Math.max(0, tw.pop - dt);
      const k = 0.85 + 0.07 * tw.level;
      tw.img.setScale(k * (1 + tw.pop * 0.8));
    }
  }

  private fireTowers(dt: number): void {
    const cfg = CONFIG.td;
    for (const s of this.slots) {
      const tw = s.tower;
      if (!tw || tw.level === 0) continue;
      tw.cd -= dt;
      if (tw.cd > 0) continue;
      const spec = cfg.towers[tw.kind];
      const lvl = 1 + cfg.towerPerLevel * (tw.level - 1);
      const range = spec.range * (1 + 0.08 * (tw.level - 1));
      const target = this.furthestInRange(s.x, s.y, range);
      if (!target) {
        tw.cd = 0.1;
        continue;
      }
      tw.cd = spec.cooldownSec;
      const damage = spec.damage * lvl * this.ctx.combat.damageMultiplier;
      const mx = s.x;
      const my = s.y + 20 - MUZZLE_Y * tw.img.scaleY;
      this.ctx.bolts.fire(mx, my, target.x, target.y, spec.color);
      let dealt = 0;
      if (tw.kind === 'cannon') {
        const r = cfg.towers.cannon.splash;
        const tx = target.x;
        const ty = target.y;
        for (const e of this.enemies.list.slice()) {
          if ((e.x - tx) ** 2 + (e.y - ty) ** 2 <= (r + e.radius) ** 2) dealt += this.enemies.hit(e, damage, tw.owner);
        }
        this.ctx.particles.burst(tx, ty, 14, spec.color, 340, 0.45, 1.8);
      } else {
        if (tw.kind === 'frost') {
          target.slowT = cfg.towers.frost.slowSec;
          this.ctx.particles.burst(target.x, target.y, 6, spec.color, 160, 0.4, 1.2);
        }
        dealt = this.enemies.hit(target, damage, tw.owner);
      }
      credit(tw.owner, dealt);
    }
  }

  /** Ținta cea mai avansată pe drum (cea mai aproape de cristal) din rază. */
  private furthestInRange(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.enemies.list) {
      const r = range + e.radius;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 > r * r) continue;
      if (!best || e.progress > best.progress) best = e;
    }
    return best;
  }

  isOver(): boolean {
    return this.lost && this.lostT >= LOST_DELAY_SEC;
  }

  getStatus(): ModeStatus {
    const k = this.baseHp / CONFIG.td.baseHp;
    const wave = this.wave > 0 ? t('survival.statusWave', { n: this.wave }) : t('survival.statusReady');
    const built = this.slots.filter((s) => s.tower).length;
    return {
      text: t('td.status', { wave, pct: Math.ceil(k * 100), built, slots: this.slots.length }),
      progress: k,
      color: k > 0.5 ? 0x52d273 : k > 0.25 ? 0xffd43b : 0xff4d4d,
    };
  }

  getResults(): RoundResults {
    const ranking = rankByScore(this.ctx.registry);
    if (this.lost) return { headline: t('survival.resultLost', { n: this.wave }), ranking, winners: [] };
    const winners = new Set<Player>(ranking.map((r) => r.player));
    for (const e of this.ctx.crowd.entities) winners.add(e.player);
    const headline = this.wave === 1 ? t('survival.resultWonOne') : t('survival.resultWon', { n: this.wave });
    return { headline, ranking, winners: [...winners] };
  }
}

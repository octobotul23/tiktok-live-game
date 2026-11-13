import Phaser from 'phaser';
import type { Dir } from '../config/commands';
import { CONFIG, HEIGHT, WIDTH } from '../config/config';
import type { TrailPool } from './Effects';
import type { Player } from './PlayerRegistry';
import { getSkin } from './SkinCatalog';
import { SpatialHash } from './SpatialHash';
import { TEX } from './textures';

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type EntityState = 'spawning' | 'alive' | 'despawning';

export interface CrowdEntity {
  player: Player;
  x: number;
  y: number;
  state: EntityState;
  stateT: number;
  /** Timp rămas din dash-ul curent (s). */
  dashT: number;
  dashVX: number;
  dashVY: number;
  trailAcc: number;
  /** Multiplicator pentru distanța dash-ului (ex. bonus de viteză din cadouri). */
  speedMul: number;
  /** Modul poate bloca mișcarea (ex. jucător eliminat). */
  frozen: boolean;
  scale: number;
  depth: number;
  phase: number;
  body: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  /** Secunde până la următorul atac automat. */
  attackCd: number;
  /** Secunde rămase cât e „căzut” (nu se mișcă, nu atacă). */
  downedT: number;
  shieldT: number;
  speedT: number;
  powerT: number;
  /** Secunde rămase cât caracterul e „nou”: aură roșie și numele roșu deasupra (vezi NewcomerTags). */
  newT: number;
  /** Strălucirea din spate (aura skin-ului, bonusul de putere sau roșul de jucător nou). */
  aura: Phaser.GameObjects.Image | null;
  /** Bula de scut. */
  bubble: Phaser.GameObjects.Image | null;
  /** Culoarea echipei (PvP): înlocuiește culoarea jucătorului pe corp și colorează numărul. */
  teamColor: number | null;
}

const DIR_VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const BODY_ORIGIN_Y = 20 / 44;
const LABEL_OFFSET_Y = 24;
const DEPTH_BASE = 100;
const DOWNED_TINT = 0x555555;
const SHIELD_TINT = 0x4cc9f0;
const POWER_TINT = 0xff7b00;
export const NEWCOMER_TINT = 0xfe2c55;
const SPEED_MUL = 1.5;

/**
 * Mulțimea de caractere: spawn/despawn cu pool de obiecte, dash cu urmă și separare moale.
 * Toate caracterele folosesc aceeași textură (colorată prin tint), deci WebGL le desenează în batch.
 */
export class Crowd {
  readonly entities: CrowdEntity[] = [];
  bounds: Bounds;
  onRemoved: (player: Player) => void = () => {};

  private bodyPool: Phaser.GameObjects.Image[] = [];
  private labelPool: Phaser.GameObjects.BitmapText[] = [];
  private auraPool: Phaser.GameObjects.Image[] = [];
  private bubblePool: Phaser.GameObjects.Image[] = [];
  private hash: SpatialHash;
  private z = 0;
  private time = 0;
  private sepI = 0;
  private sepCount = 0;
  private sepK = 0;

  constructor(
    private scene: Phaser.Scene,
    private trails: TrailPool,
  ) {
    this.bounds = { x0: 0, y0: 0, x1: WIDTH, y1: HEIGHT };
    this.hash = new SpatialHash(WIDTH, HEIGHT, 40, 1024);
  }

  /** Caractere care ocupă un loc (cele care dispar nu se mai numără). */
  get activeCount(): number {
    let n = 0;
    for (const e of this.entities) if (e.state !== 'despawning') n++;
    return n;
  }

  spawn(player: Player, x?: number, y?: number): CrowdEntity {
    const b = this.bounds;
    const sx = x ?? Phaser.Math.Between(b.x0 + 60, b.x1 - 60);
    const sy = y ?? Phaser.Math.Between(b.y0 + 60, b.y1 - 60);
    const body = this.bodyPool.pop() ?? this.scene.add.image(0, 0, TEX.body);
    body.setOrigin(0.5, BODY_ORIGIN_Y).setAlpha(1).setVisible(true);

    // Celulele RetroFont au lățime fixă; spațierea negativă strânge cifrele.
    const label = this.labelPool.pop() ?? this.scene.add.bitmapText(0, 0, TEX.digits, '', 18).setLetterSpacing(-4);
    label.setText(`#${player.num}`).setOrigin(0.5, 0).setAlpha(1).setVisible(true);

    const e: CrowdEntity = {
      player, x: sx, y: sy, state: 'spawning', stateT: 0,
      dashT: 0, dashVX: 0, dashVY: 0, trailAcc: 0, speedMul: 1, frozen: false,
      scale: 1, depth: 0, phase: Math.random() * Math.PI * 2, body, label,
      attackCd: Math.random() * CONFIG.combat.cooldownSec, downedT: 0, shieldT: 0, speedT: 0, powerT: 0, newT: 0,
      aura: null, bubble: null, teamColor: null,
    };
    label.clearTint();
    this.entities.push(e);
    player.entity = e;
    this.applySkin(e);
    this.bringToFront(e);
    this.syncSprite(e);
    return e;
  }

  despawn(e: CrowdEntity): void {
    if (e.state === 'despawning') return;
    e.state = 'despawning';
    e.stateT = 0;
    e.dashT = 0;
  }

  /** Comentează în timp ce dispare: rămâne în joc. */
  revive(e: CrowdEntity): void {
    if (e.state !== 'despawning') return;
    e.state = 'alive';
    e.stateT = 0;
  }

  /** Aplică skin-ul din profil (textură, mărime, aură). Se cheamă la spawn și când se schimbă skin-ul. */
  applySkin(e: CrowdEntity): void {
    const skin = getSkin(e.player.skinId);
    e.scale = skin.scale;
    e.body.setTexture(skin.texture);
    this.restoreTint(e);
    this.syncAura(e);
  }

  /** Pune caracterul la pământ pentru `sec` secunde. Scutul îl protejează (întoarce false). */
  down(e: CrowdEntity, sec: number): boolean {
    if (e.state === 'despawning' || e.shieldT > 0) return false;
    const wasDown = e.downedT > 0;
    e.downedT = Math.max(e.downedT, sec);
    e.dashT = 0;
    if (!wasDown) e.body.setTint(DOWNED_TINT);
    return true;
  }

  /** Ridică jucătorii căzuți (toți sau doar cei acceptați de filtru); întoarce câți au fost ridicați. */
  reviveAllDowned(filter?: (e: CrowdEntity) => boolean): number {
    let n = 0;
    for (const e of this.entities) {
      if (e.downedT <= 0 || (filter && !filter(e))) continue;
      e.downedT = 0;
      this.restoreTint(e);
      n++;
    }
    return n;
  }

  /** Șterge toate efectele temporare (între runde). */
  clearStatuses(): void {
    this.reviveAllDowned();
    for (const e of this.entities) {
      e.shieldT = 0;
      e.speedT = 0;
      if (e.powerT > 0) {
        e.powerT = 0;
        this.syncAura(e);
      }
    }
  }

  /** Culoarea echipei; null o scoate (înapoi la culoarea jucătorului). */
  setTeamColor(e: CrowdEntity, color: number | null): void {
    if (e.teamColor === color) return;
    e.teamColor = color;
    if (color === null) e.label.clearTint();
    else e.label.setTint(color);
    this.restoreTint(e);
  }

  giveShield(e: CrowdEntity, sec: number): void {
    e.shieldT = Math.max(e.shieldT, sec);
  }

  giveSpeed(e: CrowdEntity, sec: number): void {
    e.speedT = Math.max(e.speedT, sec);
  }

  givePower(e: CrowdEntity, sec: number): void {
    const had = e.powerT > 0;
    e.powerT = Math.max(e.powerT, sec);
    if (!had) this.syncAura(e);
  }

  /** Caracter nou pe ecran: aură roșie `sec` secunde (0 o oprește). */
  markNew(e: CrowdEntity, sec: number): void {
    const had = e.newT > 0;
    e.newT = Math.max(0, sec);
    if (had !== e.newT > 0) this.syncAura(e);
  }

  dash(e: CrowdEntity, dir: Dir): void {
    if (e.state === 'despawning' || e.frozen || e.downedT > 0) return;
    const [dx, dy] = DIR_VEC[dir];
    const dur = CONFIG.dash.durationSec;
    // Viteză care scade liniar la 0: distanța parcursă = v0 * dur / 2.
    const boost = e.speedT > 0 ? SPEED_MUL : 1;
    const v0 = (2 * CONFIG.dash.distance * e.speedMul * boost) / dur;
    e.dashVX = dx * v0;
    e.dashVY = dy * v0;
    e.dashT = dur;
    e.trailAcc = CONFIG.dash.trailEverySec; // prima fantomă imediat
  }

  /** Aduce caracterul deasupra celorlalte (folosit la fiecare comentariu). */
  bringToFront(e: CrowdEntity): void {
    e.depth = DEPTH_BASE + ++this.z * 0.001;
    e.body.setDepth(e.depth);
    e.label.setDepth(e.depth + 0.0005);
    e.aura?.setDepth(e.depth - 0.0003);
    e.bubble?.setDepth(e.depth + 0.0003);
  }

  /** Iterează caracterele vii din jurul unui punct (pentru moduri: ținte, zone, coliziuni). */
  forEachNear(x: number, y: number, radius: number, fn: (e: CrowdEntity) => void): void {
    const r2 = radius * radius;
    this.hash.query(x, y, radius, (i) => {
      const e = this.entities[i];
      if (!e || e.state === 'despawning') return;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= r2) fn(e);
    });
  }

  /** Împinge caracterele afară dintr-un cerc solid (baza, corpul boss-ului). */
  pushOut(x: number, y: number, radius: number): void {
    this.forEachNear(x, y, radius, (e) => {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      e.x = x + (dx / d) * radius;
      e.y = y + (dy / d) * radius;
    });
  }

  update(dt: number): void {
    this.time += dt;
    const cfg = CONFIG.crowd;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.stateT += dt;
      if (e.state === 'spawning' && e.stateT >= cfg.spawnPopSec) e.state = 'alive';
      if (e.state === 'despawning' && e.stateT >= cfg.despawnFadeSec) {
        this.remove(i);
        continue;
      }
      if (e.dashT > 0) this.integrateDash(e, dt);
      this.tickStatuses(e, dt);
    }

    this.separate(dt);

    const b = this.bounds;
    for (const e of this.entities) {
      e.x = Phaser.Math.Clamp(e.x, b.x0, b.x1);
      e.y = Phaser.Math.Clamp(e.y, b.y0, b.y1);
      this.syncSprite(e);
    }
  }

  private tickStatuses(e: CrowdEntity, dt: number): void {
    if (e.downedT > 0) {
      e.downedT -= dt;
      if (e.downedT <= 0) {
        e.downedT = 0;
        this.restoreTint(e);
      }
    }
    if (e.shieldT > 0) e.shieldT = Math.max(0, e.shieldT - dt);
    if (e.speedT > 0) e.speedT = Math.max(0, e.speedT - dt);
    if (e.powerT > 0) {
      e.powerT -= dt;
      if (e.powerT <= 0) {
        e.powerT = 0;
        this.syncAura(e);
      }
    }
    if (e.newT > 0) {
      e.newT -= dt;
      if (e.newT <= 0) {
        e.newT = 0;
        this.syncAura(e);
      }
    }
    // Bula de scut apare/dispare odată cu efectul.
    if (e.shieldT > 0 && !e.bubble) {
      e.bubble = this.bubblePool.pop() ?? this.scene.add.image(0, 0, TEX.ring);
      e.bubble.setTint(SHIELD_TINT).setVisible(true).setDepth(e.depth + 0.0003);
    } else if (e.shieldT <= 0 && e.bubble) {
      e.bubble.setVisible(false);
      this.bubblePool.push(e.bubble);
      e.bubble = null;
    }
  }

  private restoreTint(e: CrowdEntity): void {
    if (e.downedT > 0) e.body.setTint(DOWNED_TINT);
    else if (getSkin(e.player.skinId).tinted) e.body.setTint(e.teamColor ?? e.player.color);
    else e.body.clearTint();
  }

  /** Aura: bonusul de putere are prioritate, apoi roșul de jucător nou, apoi aura skin-ului. */
  private syncAura(e: CrowdEntity): void {
    const color = e.powerT > 0 ? POWER_TINT : e.newT > 0 ? NEWCOMER_TINT : getSkin(e.player.skinId).aura;
    if (color === null) {
      if (e.aura) {
        e.aura.setVisible(false);
        this.auraPool.push(e.aura);
        e.aura = null;
      }
      return;
    }
    if (!e.aura) e.aura = this.auraPool.pop() ?? this.scene.add.image(0, 0, TEX.glow);
    e.aura.setTint(color).setVisible(true).setDepth(e.depth - 0.0003);
  }

  private integrateDash(e: CrowdEntity, dt: number): void {
    const step = Math.min(dt, e.dashT);
    const k = e.dashT / CONFIG.dash.durationSec; // 1 → 0
    const kNext = (e.dashT - step) / CONFIG.dash.durationSec;
    const avg = (k + kNext) / 2;
    e.x += e.dashVX * avg * step;
    e.y += e.dashVY * avg * step;
    e.dashT -= step;

    e.trailAcc += dt;
    if (e.trailAcc >= CONFIG.dash.trailEverySec) {
      e.trailAcc = 0;
      this.trails.emit(e.x, e.y, e.teamColor ?? e.player.color, e.scale, CONFIG.dash.trailLifeSec);
    }
  }

  /** Separare moale: perechile prea apropiate se împing parțial, ca o mulțime, nu ca bile rigide. */
  private separate(dt: number): void {
    const n = this.entities.length;
    this.hash.clear();
    for (let i = 0; i < n; i++) this.hash.insert(i, this.entities[i].x, this.entities[i].y);
    this.sepK = Math.min(1, CONFIG.crowd.separationStrength * dt) * 0.5;
    for (let i = 0; i < n; i++) {
      if (this.entities[i].state === 'despawning') continue;
      this.sepI = i;
      this.sepCount = 0;
      this.hash.query(this.entities[i].x, this.entities[i].y, CONFIG.crowd.separationDist, this.separateVisit);
    }
  }

  // Callback fix (nu o închidere nouă pe frame) ca să nu producem gunoi pentru GC.
  private separateVisit = (j: number): boolean | void => {
    const i = this.sepI;
    if (j <= i) return;
    const a = this.entities[i];
    const b = this.entities[j];
    if (b.state === 'despawning') return;
    const min = CONFIG.crowd.separationDist;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return;
    if (d2 < 0.0001) {
      // Exact unul peste altul: direcție pseudo-aleatoare stabilă.
      const ang = (i * 12.9898 + j * 78.233) % (Math.PI * 2);
      dx = Math.cos(ang) * 0.01;
      dy = Math.sin(ang) * 0.01;
      d2 = 0.0001;
    }
    const d = Math.sqrt(d2);
    const push = ((min - d) / d) * this.sepK;
    a.x -= dx * push;
    a.y -= dy * push;
    b.x += dx * push;
    b.y += dy * push;
    if (++this.sepCount >= CONFIG.crowd.maxNeighbors) return true;
  };

  private syncSprite(e: CrowdEntity): void {
    const cfg = CONFIG.crowd;
    let s = e.scale;
    let alpha = 1;
    if (e.state === 'spawning') s *= Phaser.Math.Easing.Back.Out(Math.min(1, e.stateT / cfg.spawnPopSec));
    else if (e.state === 'despawning') {
      const k = 1 - e.stateT / cfg.despawnFadeSec;
      alpha = k;
      s *= 0.6 + 0.4 * k;
    }
    // Respirație ușoară când stă; turtire în direcția dash-ului când se mișcă.
    let sx = s;
    let sy = s * (1 + 0.035 * Math.sin(this.time * 5 + e.phase));
    if (e.dashT > 0) {
      const horizontal = Math.abs(e.dashVX) > Math.abs(e.dashVY);
      sx = s * (horizontal ? 1.18 : 0.86);
      sy = s * (horizontal ? 0.86 : 1.18);
    }
    const bodyAlpha = e.downedT > 0 ? alpha * 0.55 : alpha;
    e.body.setPosition(e.x, e.y).setScale(sx, sy).setAlpha(bodyAlpha);
    e.label.setPosition(e.x, e.y + LABEL_OFFSET_Y * e.scale).setAlpha(alpha);
    if (e.aura) {
      if (e.powerT <= 0 && e.newT > 0) {
        // Jucător nou: aură roșie mai mare, care pulsează și se stinge lin în ultima secundă.
        const pulse = 0.88 + 0.12 * Math.sin(this.time * 6 + e.phase);
        const fade = Math.min(1, e.newT / 0.8);
        e.aura.setPosition(e.x, e.y).setScale(s * 1.6 * pulse).setAlpha(alpha * 0.95 * fade);
      } else {
        const pulse = 0.85 + 0.15 * Math.sin(this.time * 4 + e.phase);
        e.aura.setPosition(e.x, e.y).setScale(s * 1.25 * pulse).setAlpha(alpha * 0.75);
      }
    }
    if (e.bubble) {
      // Clipește în ultima secundă, ca să se vadă că expiră.
      const blink = e.shieldT < 1 ? 0.35 + 0.65 * Math.abs(Math.sin(this.time * 14)) : 1;
      e.bubble.setPosition(e.x, e.y).setScale(s * 1.3).setAlpha(alpha * 0.85 * blink);
    }
  }

  private remove(i: number): void {
    const e = this.entities[i];
    const last = this.entities.pop()!;
    if (last !== e) this.entities[i] = last;
    e.body.setVisible(false);
    e.label.setVisible(false);
    this.bodyPool.push(e.body);
    this.labelPool.push(e.label);
    if (e.aura) {
      e.aura.setVisible(false);
      this.auraPool.push(e.aura);
      e.aura = null;
    }
    if (e.bubble) {
      e.bubble.setVisible(false);
      this.bubblePool.push(e.bubble);
      e.bubble = null;
    }
    if (e.player.entity === e) e.player.entity = null;
    this.onRemoved(e.player);
  }
}

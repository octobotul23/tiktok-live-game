import Phaser from 'phaser';
import type { Dir } from '../../config/commands';
import { CONFIG } from '../../config/config';
import type { Target, TargetSource } from '../../core/Combat';
import type { ModeCommand } from '../../core/CommandParser';
import type { CrowdEntity } from '../../core/Crowd';
import { LAYER } from '../../core/layers';
import type { Player } from '../../core/PlayerRegistry';
import { TEX } from '../../core/textures';
import { t } from '../../i18n';
import type { ModeStatus } from '../../ui/Hud';
import { BaseMode, rankByScore, type ModeContext, type RoundResults } from '../GameMode';

export type Team = 'top' | 'bottom';

const OVER_DELAY_SEC = 1.8;
const BAR_W = 150;
const BAR_H = 14;
const other = (team: Team): Team => (team === 'top' ? 'bottom' : 'top');
const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Caracterul unui jucător cu echipă: ținta pe care o lovesc adversarii. */
class Fighter implements Target {
  combo = 0;
  comboT = 99;
  constructor(
    readonly entity: CrowdEntity,
    public team: Team,
    public hp: number,
  ) {}
  get x(): number {
    return this.entity.x;
  }
  get y(): number {
    return this.entity.y;
  }
  get radius(): number {
    return 14 * this.entity.scale;
  }
  get alive(): boolean {
    const e = this.entity;
    return e.state !== 'despawning' && e.downedT <= 0 && e.player.entity === e;
  }
}

interface Base extends Target {
  team: Team;
  hp: number;
  maxHp: number;
  hitT: number;
  img: Phaser.GameObjects.Image;
  barBg: Phaser.GameObjects.Image;
  barFill: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

/**
 * PvP Sus vs Jos: echipa de sus apără baza din jumătatea de sus, cea de jos pe cea de jos.
 * Echipa se alege cu „echipa sus” / „echipa jos”, sau cu „sus” / „jos” cât timp jucătorul n-are încă echipă;
 * cine nu alege intră în echipa mai mică. Câștigă cine distruge baza adversă (sau, la expirarea timpului,
 * echipa cu baza mai întreagă). Cadourile pentru echipă (scut, revive) ajung doar la aliații expeditorului.
 */
export class PvpMode extends BaseMode implements TargetSource {
  readonly id = 'pvp';
  get name(): string {
    return t('pvp.name');
  }
  get instructions(): string {
    return t('pvp.instructions');
  }
  get scoreLabel(): string {
    return t('score.damage');
  }
  get commands(): readonly ModeCommand[] {
    return [
      { id: 'teamTop', aliases: ['echipa sus', 'team up', 'team top'], label: t('pvp.cmdTop') },
      { id: 'teamBottom', aliases: ['echipa jos', 'team down', 'team bottom'], label: t('pvp.cmdBottom') },
    ];
  }
  readonly maxDurationSec = CONFIG.pvp.maxDurationSec;

  /** Echipa fiecărui jucător în runda asta; rămâne și dacă iese, ca la întoarcere să revină în aceeași. */
  private teamOf = new Map<Player, Team>();
  /** Au caracter, dar încă n-au echipă (primul lor comentariu poate fi „sus” / „jos”). */
  private pending = new Set<Player>();
  private fighters = new Map<Player, Fighter>();
  private bases!: Record<Team, Base>;
  private targetList: Target[] = [];
  private targetsDirty = true;
  private zones: Phaser.GameObjects.GameObject[] = [];
  private midY = 0;
  private started = false;
  private winner: Team | null = null;
  private overT = 0;
  private likes: Record<Team, number> = { top: 0, bottom: 0 };
  private bonusTeam: Team | null = null;
  private bonusT = 0;
  private time = 0;

  setup(ctx: ModeContext): void {
    super.setup(ctx);
    const a = this.arena();
    const cfg = CONFIG.pvp;
    const cx = (a.x0 + a.x1) / 2;
    this.midY = (a.y0 + a.y1) / 2;

    // Jumătățile arenei, colorate discret, și linia de mijloc.
    const g = ctx.scene.add.graphics().setDepth(-5);
    g.fillStyle(cfg.colors.top, 0.07).fillRect(a.x0, a.y0, a.x1 - a.x0, this.midY - a.y0);
    g.fillStyle(cfg.colors.bottom, 0.07).fillRect(a.x0, this.midY, a.x1 - a.x0, a.y1 - this.midY);
    g.lineStyle(4, 0xffffff, 0.25);
    for (let x = a.x0; x < a.x1; x += 40) g.lineBetween(x, this.midY, Math.min(x + 22, a.x1), this.midY);
    this.zones.push(g);

    this.bases = {
      top: this.makeBase('top', cx, a.y0 + cfg.baseInset),
      bottom: this.makeBase('bottom', cx, a.y1 - cfg.baseInset),
    };
    ctx.combat.source = this;
    this.syncVisuals();
  }

  private makeBase(team: Team, x: number, y: number): Base {
    const scene = this.ctx.scene;
    const color = CONFIG.pvp.colors[team];
    const hp = CONFIG.pvp.baseHp;
    const img = scene.add.image(x, y, TEX.pvpBase).setOrigin(0.5, 136 / 170).setTint(color).setDepth(LAYER.base);
    // Bara de viață sub bază pentru echipa de sus, deasupra pentru cea de jos: spre mijlocul arenei.
    const barY = team === 'top' ? y + 42 : y - 150;
    const barBg = scene.add.image(x - BAR_W / 2, barY, TEX.pixel).setOrigin(0, 0.5)
      .setDisplaySize(BAR_W, BAR_H).setTint(0x000000).setAlpha(0.7).setDepth(LAYER.enemyBars);
    const barFill = scene.add.image(x - BAR_W / 2 + 2, barY, TEX.pixel).setOrigin(0, 0.5)
      .setDisplaySize(BAR_W - 4, BAR_H - 4).setTint(color).setDepth(LAYER.enemyBars + 0.1);
    const label = scene.add
      .text(x + 90, y - 40, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '30px',
        color: css(color),
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0, 0.5)
      .setDepth(LAYER.enemyBars);
    this.zones.push(barBg, barFill, label);
    return { team, x, y: y - 40, radius: CONFIG.pvp.baseRadius, alive: true, combo: 0, comboT: 99, hp, maxHp: hp, hitT: 0, img, barBg, barFill, label };
  }

  onRoundStart(): void {
    this.started = true;
    for (const p of [...this.pending]) this.assign(p, this.smallerTeam());
    // Viața bazelor crește cu numărul de jucători prezenți la start.
    const cfg = CONFIG.pvp;
    const hp = cfg.baseHp + cfg.baseHpPerPlayer * this.ctx.crowd.activeCount;
    for (const b of Object.values(this.bases)) b.hp = b.maxHp = hp;
    for (const f of this.fighters.values()) f.hp = cfg.playerHp;
    this.ctx.hud.announce(t('pvp.fight'), '#ffe066');
  }

  teardown(): void {
    for (const e of this.ctx.crowd.entities) this.ctx.crowd.setTeamColor(e, null);
    for (const b of Object.values(this.bases)) b.img.destroy();
    for (const z of this.zones) z.destroy();
    this.zones.length = 0;
  }

  // --- echipe -----------------------------------------------------------------------------

  isAlly(a: Player, b: Player): boolean {
    if (a === b) return true;
    const ta = this.teamOf.get(a);
    return ta !== undefined && ta === this.teamOf.get(b);
  }

  /** Echipa cu mai puține caractere active (la egalitate, la întâmplare). */
  private smallerTeam(): Team {
    let top = 0;
    let bottom = 0;
    for (const f of this.fighters.values()) {
      if (f.entity.state === 'despawning') continue;
      if (f.team === 'top') top++;
      else bottom++;
    }
    if (top !== bottom) return top < bottom ? 'top' : 'bottom';
    return Math.random() < 0.5 ? 'top' : 'bottom';
  }

  private assign(p: Player, team: Team): void {
    this.teamOf.set(p, team);
    this.pending.delete(p);
    const e = p.entity;
    if (!e) return;
    let f = this.fighters.get(p);
    if (!f || f.entity !== e) {
      f = new Fighter(e, team, CONFIG.pvp.playerHp);
      this.fighters.set(p, f);
      this.targetsDirty = true;
    }
    f.team = team;
    this.ctx.crowd.setTeamColor(e, CONFIG.pvp.colors[team]);
    // Cine nu e în jumătatea echipei lui e mutat acolo (la spawn sau la schimbarea echipei).
    const inHalf = team === 'top' ? e.y < this.midY : e.y > this.midY;
    if (!inHalf) {
      const a = this.arena();
      e.x = Phaser.Math.Between(a.x0 + 60, a.x1 - 60);
      e.y = team === 'top' ? Phaser.Math.Between(a.y0 + 30, this.midY - 40) : Phaser.Math.Between(this.midY + 40, a.y1 - 30);
      e.dashT = 0;
      this.ctx.particles.burst(e.x, e.y, 8, CONFIG.pvp.colors[team], 160, 0.4, 1.2);
    }
  }

  onPlayerJoin(p: Player): void {
    const team = this.teamOf.get(p);
    if (team) {
      this.assign(p, team);
      return;
    }
    this.pending.add(p);
    if (p.entity) this.ctx.crowd.setTeamColor(p.entity, CONFIG.pvp.colors.neutral);
  }

  onPlayerLeave(p: Player): void {
    this.pending.delete(p);
    if (this.fighters.delete(p)) this.targetsDirty = true;
  }

  /** „sus” / „jos” alege echipa cât timp jucătorul n-are una; după aceea e mișcare obișnuită. */
  onMove(p: Player, dir: Dir): boolean {
    if (this.teamOf.has(p) && !this.pending.has(p)) return false;
    if (dir === 'up' || dir === 'down') {
      this.assign(p, dir === 'up' ? 'top' : 'bottom');
      return true;
    }
    this.assign(p, this.smallerTeam());
    return false;
  }

  onCommand(p: Player, commandId: string): void {
    const team: Team = commandId === 'teamTop' ? 'top' : 'bottom';
    const current = this.pending.has(p) ? undefined : this.teamOf.get(p);
    if (current === team) return;
    if (current && this.started && !CONFIG.pvp.switchDuringRound) {
      const e = p.entity;
      if (e) this.ctx.floating.show(e.x, e.y - 50, t('pvp.switchLocked'), '#ffffff', 1.4);
      return;
    }
    this.assign(p, team);
  }

  onGift(p: Player): boolean {
    // Cadoul se aplică de core (efectele comune / MODE_GIFTS); aici doar ne asigurăm că expeditorul are echipă.
    if (this.pending.has(p)) this.assign(p, this.smallerTeam());
    return false;
  }

  onLike(p: Player, count: number): void {
    const team = this.teamOf.get(p);
    if (team) this.likes[team] += count;
  }

  /** Bonusul de like-uri merge la echipa care a dat mai multe like-uri de la ultimul bonus. */
  onLikeBonus(): boolean {
    const { top, bottom } = this.likes;
    if (top === 0 && bottom === 0) return false;
    const team: Team = top === bottom ? (Math.random() < 0.5 ? 'top' : 'bottom') : top > bottom ? 'top' : 'bottom';
    this.likes = { top: 0, bottom: 0 };
    this.bonusTeam = team;
    this.bonusT = CONFIG.likes.bonusSec;
    this.ctx.hud.announce(
      t('pvp.likeBonus', { team: this.teamName(team), mul: CONFIG.likes.bonusDamageMul, sec: CONFIG.likes.bonusSec }),
      css(CONFIG.pvp.colors[team]),
      2,
    );
    return true;
  }

  /** Revive-ul ridică doar aliații (core) și repară puțin baza echipei expeditorului. */
  onRevive(by: Player): void {
    const team = this.teamOf.get(by);
    if (!team || this.winner) return;
    const b = this.bases[team];
    const healed = Math.min(b.maxHp - b.hp, b.maxHp * CONFIG.pvp.reviveRepair);
    if (healed <= 0) return;
    b.hp += healed;
    this.ctx.particles.burst(b.x, b.y, 20, 0x9ef01a, 260, 0.7, 1.6);
    this.ctx.floating.show(b.x, b.y - 90, `🔧 +${Math.round((healed / b.maxHp) * 100)}%`, '#9ef01a', 1.6);
  }

  private teamName(team: Team): string {
    return t(team === 'top' ? 'pvp.top' : 'pvp.bottom');
  }

  // --- combat -------------------------------------------------------------------------------

  private nearBest: Target | null = null;
  private nearD = 0;
  private nearTeam: Team = 'top';
  private nearX = 0;
  private nearY = 0;

  nearest(x: number, y: number, range: number, by: Player): Target | null {
    const team = this.teamOf.get(by);
    if (!team || this.winner || this.pending.has(by)) return null;
    const enemy = other(team);
    this.nearBest = null;
    this.nearD = range;
    this.nearTeam = enemy;
    this.nearX = x;
    this.nearY = y;
    const base = this.bases[enemy];
    if (base.alive) {
      const d = Math.hypot(base.x - x, base.y - y) - base.radius;
      if (d <= this.nearD) {
        this.nearBest = base;
        this.nearD = d;
      }
    }
    this.ctx.crowd.forEachNear(x, y, range + 20, this.visitNear);
    return this.nearBest;
  }

  // Callback fix (nu o închidere nouă la fiecare atac), ca la separarea din Crowd.
  private visitNear = (e: CrowdEntity): void => {
    const f = this.fighters.get(e.player);
    if (!f || f.team !== this.nearTeam || !f.alive) return;
    const d = Math.hypot(f.x - this.nearX, f.y - this.nearY) - f.radius;
    if (d < this.nearD) {
      this.nearBest = f;
      this.nearD = d;
    }
  };

  hit(target: Target, damage: number, by: Player): number {
    if (this.bonusT > 0 && this.teamOf.get(by) === this.bonusTeam) damage *= CONFIG.likes.bonusDamageMul;
    return target instanceof Fighter ? this.hitFighter(target, damage) : this.hitBase(target as Base, damage);
  }

  /** Bomba: baza adversă primește tot damage-ul, fiecare jucător advers doar o parte (altfel o gogoașă ar șterge echipa). */
  damageAll(damage: number, by: Player): number {
    const team = this.teamOf.get(by);
    if (!team || this.winner) return 0;
    const enemy = other(team);
    let dealt = this.hitBase(this.bases[enemy], damage);
    const perPlayer = damage * CONFIG.pvp.bombPlayerMul;
    for (const f of this.fighters.values()) {
      if (f.team === enemy && f.alive) dealt += this.hitFighter(f, perPlayer);
    }
    return dealt;
  }

  targets(): readonly Target[] {
    if (this.targetsDirty) {
      this.targetsDirty = false;
      this.targetList = [this.bases.top, this.bases.bottom, ...this.fighters.values()];
    }
    return this.targetList;
  }

  private hitFighter(f: Fighter, damage: number): number {
    const e = f.entity;
    if (!f.alive || e.shieldT > 0) return 0;
    const dealt = Math.min(f.hp, damage);
    f.hp -= dealt;
    if (f.hp <= 0) this.knockOut(f);
    return dealt;
  }

  /** Doborât: se întoarce lângă baza lui, stă jos câteva secunde, apoi revine cu viața plină și scurt scut. */
  private knockOut(f: Fighter): void {
    const e = f.entity;
    const cfg = CONFIG.pvp;
    this.ctx.particles.burst(e.x, e.y, 10, cfg.colors[f.team], 220, 0.5, 1.4);
    const home = this.bases[f.team];
    const a = this.arena();
    e.x = Phaser.Math.Clamp(home.x + Phaser.Math.Between(-220, 220), a.x0 + 30, a.x1 - 30);
    e.y = Phaser.Math.Clamp(home.y + (f.team === 'top' ? 1 : -1) * Phaser.Math.Between(90, 170), a.y0 + 20, a.y1 - 20);
    this.ctx.crowd.down(e, cfg.respawnSec);
    this.ctx.crowd.giveShield(e, cfg.respawnSec + cfg.spawnShieldSec);
    f.hp = cfg.playerHp;
  }

  private hitBase(b: Base, damage: number): number {
    if (!b.alive) return 0;
    const dealt = Math.min(b.hp, damage);
    b.hp -= dealt;
    b.hitT = 0.12;
    if (b.hp <= 0) this.destroyBase(b);
    return dealt;
  }

  private destroyBase(b: Base): void {
    b.alive = false;
    b.hp = 0;
    b.img.setVisible(false);
    this.ctx.particles.burst(b.x, b.y, 70, CONFIG.pvp.colors[b.team], 680, 1.1, 2.8);
    this.ctx.hud.announce(t('pvp.baseDown', { team: this.teamName(b.team) }), css(CONFIG.pvp.colors[other(b.team)]), 2);
    this.winner = other(b.team);
  }

  // --- rundă --------------------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    if (this.bonusT > 0) this.bonusT = Math.max(0, this.bonusT - dt);
    // Cine a intrat din coadă în timpul rundei, fără să comenteze, primește echipa mai mică.
    if (this.pending.size > 0) for (const p of [...this.pending]) this.assign(p, this.smallerTeam());
    if (this.winner) this.overT += dt;

    for (const b of Object.values(this.bases)) {
      if (!b.alive) continue;
      this.ctx.crowd.pushOut(b.x, b.y, b.radius);
      if (b.hitT > 0) {
        b.hitT -= dt;
        b.img.setPosition(b.x + Math.sin(this.time * 60) * 3, b.y + 40).setTintFill(0xffffff);
        if (b.hitT <= 0) b.img.setPosition(b.x, b.y + 40).setTint(CONFIG.pvp.colors[b.team]);
      }
    }
    this.syncVisuals();
  }

  /** Barele de viață și etichetele bazelor (apelat și din getStatus, ca să meargă și în lobby). */
  private syncVisuals(): void {
    const counts = this.teamCounts();
    for (const b of Object.values(this.bases)) {
      const k = Math.max(0, b.hp / b.maxHp);
      b.barFill.setDisplaySize(Math.max(0.001, (BAR_W - 4) * k), BAR_H - 4).setVisible(b.alive);
      b.barBg.setVisible(b.alive);
      const text = `${this.teamName(b.team)} · ${counts[b.team]}`;
      if (b.label.text !== text) b.label.setText(text);
    }
  }

  private teamCounts(): Record<Team, number> {
    const n = { top: 0, bottom: 0 };
    for (const f of this.fighters.values()) if (f.entity.state !== 'despawning') n[f.team]++;
    return n;
  }

  private pct(team: Team): number {
    const b = this.bases[team];
    return Math.ceil((Math.max(0, b.hp) / b.maxHp) * 100);
  }

  isOver(): boolean {
    return this.winner !== null && this.overT >= OVER_DELAY_SEC;
  }

  getStatus(): ModeStatus {
    this.syncVisuals();
    const counts = this.teamCounts();
    const topPct = this.pct('top');
    const bottomPct = this.pct('bottom');
    return {
      text: t('pvp.status', {
        top: t('pvp.top'), bottom: t('pvp.bottom'), topPct, bottomPct, topN: counts.top, bottomN: counts.bottom,
      }),
      // Bara arată cine conduce: plină de albastru = baza de jos aproape distrusă.
      progress: topPct + bottomPct > 0 ? topPct / (topPct + bottomPct) : 0.5,
      color: CONFIG.pvp.colors.top,
    };
  }

  getResults(): RoundResults {
    const ranking = rankByScore(this.ctx.registry);
    const topPct = this.pct('top');
    const bottomPct = this.pct('bottom');
    let winner = this.winner;
    let headline: string;
    if (winner) headline = t('pvp.resultWon', { team: this.teamName(winner) });
    else if (topPct !== bottomPct) {
      winner = topPct > bottomPct ? 'top' : 'bottom';
      headline = t('pvp.resultTime', {
        team: this.teamName(winner), pct: Math.max(topPct, bottomPct), other: Math.min(topPct, bottomPct),
      });
    } else headline = t('pvp.resultDraw', { pct: topPct });

    const winners: Player[] = [];
    if (winner) for (const [p, team] of this.teamOf) if (team === winner) winners.push(p);
    return { headline, ranking, winners };
  }
}

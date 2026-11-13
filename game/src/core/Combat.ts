import Phaser from 'phaser';
import { CONFIG } from '../config/config';
import type { Crowd } from './Crowd';
import type { BoltPool } from './Effects';
import type { Player } from './PlayerRegistry';
import { t as tr } from '../i18n';

/** Orice poate fi lovit de atacul automat: monștri, boss, baze inamice… */
export interface Target {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  /** Lovituri la rând primite (pentru „x47 ATACURI”). */
  combo: number;
  /** Secunde de la ultima lovitură. */
  comboT: number;
}

/** Modul îi spune combat-ului ce poate fi atacat. */
export interface TargetSource {
  /**
   * Cea mai apropiată țintă vie a atacatorului, cu distanța măsurată până la marginea ei; null dacă nu e
   * niciuna în rază. `by` contează doar unde țintele depind de echipă (PvP).
   */
  nearest(x: number, y: number, range: number, by: Player): Target | null;
  /** Aplică damage și întoarce cât s-a scăzut efectiv din viață. */
  hit(target: Target, damage: number, by: Player): number;
  /** Bombă pe tot ecranul: aplică damage fiecărei ținte; întoarce totalul. */
  damageAll(damage: number, by: Player): number;
  /** Țintele vii (pentru contorul de combo). */
  targets(): readonly Target[];
}

const LABELS = 4;
const LABEL_REFRESH_SEC = 0.1;

/**
 * Atacul automat comun: fiecare caracter lovește cea mai apropiată țintă din rază, cu cooldown.
 * Jitter-ul pe cooldown împrăștie atacurile în timp, ca 500 de jucători să nu lovească în același frame.
 */
export class Combat {
  enabled = false;
  source: TargetSource | null = null;
  /** Secunde rămase din bonusul de like-uri (damage × bonusDamageMul pentru toți). */
  likeBonusT = 0;

  private labels: { text: Phaser.GameObjects.Text; target: Target | null; shown: number; pop: number }[] = [];
  private labelT = 0;
  private ranked: Target[] = [];

  constructor(
    scene: Phaser.Scene,
    private crowd: Crowd,
    private bolts: BoltPool,
  ) {
    for (let i = 0; i < LABELS; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '34px',
          color: '#ffe066',
          stroke: '#000000',
          strokeThickness: 8,
        })
        .setOrigin(0.5, 1)
        .setDepth(55_000)
        .setVisible(false);
      this.labels.push({ text, target: null, shown: -1, pop: 0 });
    }
  }

  get damageMultiplier(): number {
    return this.likeBonusT > 0 ? CONFIG.likes.bonusDamageMul : 1;
  }

  /** Damage-ul unui atac al jucătorului, cu toate bonusurile. */
  damageFor(powerT: number): number {
    return CONFIG.combat.damage * this.damageMultiplier * (powerT > 0 ? 2 : 1);
  }

  /** Bomba din cadouri; întoarce damage-ul total dat (deja trecut în scorul jucătorului). */
  bomb(by: Player, damage: number): number {
    if (!this.source) return 0;
    const dealt = this.source.damageAll(damage * this.damageMultiplier, by);
    credit(by, dealt);
    return dealt;
  }

  /** Oprește combat-ul și ascunde contoarele (între runde). */
  reset(): void {
    this.enabled = false;
    this.source = null;
    this.likeBonusT = 0;
    for (const l of this.labels) {
      l.target = null;
      l.text.setVisible(false);
    }
  }

  update(dt: number): void {
    if (this.likeBonusT > 0) this.likeBonusT = Math.max(0, this.likeBonusT - dt);
    const src = this.source;
    if (!this.enabled || !src) return;

    const cfg = CONFIG.combat;
    for (const t of src.targets()) t.comboT += dt;

    for (const e of this.crowd.entities) {
      if (e.state !== 'alive' || e.downedT > 0) continue;
      e.attackCd -= dt;
      if (e.attackCd > 0) continue;
      const t = src.nearest(e.x, e.y, cfg.range, e.player);
      if (!t) {
        // Nimic în rază: verifică din nou curând, nu la fiecare frame.
        e.attackCd = 0.15 + Math.random() * 0.1;
        continue;
      }
      e.attackCd = cfg.cooldownSec * (0.85 + Math.random() * 0.3);
      const dealt = src.hit(t, this.damageFor(e.powerT), e.player);
      credit(e.player, dealt);
      if (t.comboT > cfg.comboResetSec) t.combo = 0;
      t.combo++;
      t.comboT = 0;
      // Proiectilul se oprește pe marginea țintei.
      const dx = t.x - e.x;
      const dy = t.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = Math.max(0, d - t.radius * 0.8) / d;
      this.bolts.fire(e.x, e.y - 6, e.x + dx * k, e.y - 6 + dy * k, e.teamColor ?? e.player.color);
    }

    this.updateLabels(dt, src);
  }

  /** „x47 ATACURI” deasupra celor mai lovite ținte. Textul se regenerează doar la ~10 Hz (Text e scump). */
  private updateLabels(dt: number, src: TargetSource): void {
    const cfg = CONFIG.combat;
    this.labelT -= dt;
    if (this.labelT <= 0) {
      this.labelT = LABEL_REFRESH_SEC;
      this.ranked.length = 0;
      for (const t of src.targets()) {
        if (t.alive && t.combo >= cfg.comboMin && t.comboT < cfg.comboResetSec) this.ranked.push(t);
      }
      this.ranked.sort((a, b) => b.combo - a.combo);
      for (let i = 0; i < this.labels.length; i++) {
        const l = this.labels[i];
        const t = this.ranked[i] ?? null;
        l.target = t;
        if (!t) {
          l.text.setVisible(false);
          continue;
        }
        if (t.combo !== l.shown) {
          if (t.combo > l.shown) l.pop = 0.12;
          l.shown = t.combo;
          l.text.setText(tr('combat.hits', { n: t.combo }));
        }
        l.text.setVisible(true);
      }
    }
    for (const l of this.labels) {
      const t = l.target;
      if (!t || !l.text.visible) continue;
      if (!t.alive) {
        l.text.setVisible(false);
        continue;
      }
      l.pop = Math.max(0, l.pop - dt);
      l.text.setPosition(t.x, t.y - t.radius - 18).setScale(1 + l.pop * 2.5);
    }
  }
}

export function credit(p: Player, damage: number): void {
  if (damage <= 0) return;
  p.roundScore += damage;
  p.stats.damage += damage;
}

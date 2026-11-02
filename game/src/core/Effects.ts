import Phaser from 'phaser';
import { TEX } from './textures';

/**
 * Urma dash-ului: „fantome” care se estompează. Pool fix cu inel circular: dacă se termină,
 * cea mai veche fantomă e refolosită. Toate folosesc aceeași textură, deci un singur batch.
 */
export class TrailPool {
  private imgs: Phaser.GameObjects.Image[] = [];
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseScale: Float32Array;
  private cursor = 0;

  constructor(scene: Phaser.Scene, size: number, depth: number) {
    this.life = new Float32Array(size);
    this.maxLife = new Float32Array(size);
    this.baseScale = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      this.imgs.push(scene.add.image(0, 0, TEX.bodyFlat).setVisible(false).setDepth(depth));
    }
  }

  emit(x: number, y: number, tint: number, scale: number, life: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.imgs.length;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseScale[i] = scale;
    this.imgs[i].setPosition(x, y).setTint(tint).setScale(scale).setAlpha(0.55).setVisible(true);
  }

  update(dt: number): void {
    for (let i = 0; i < this.imgs.length; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const img = this.imgs[i];
      if (this.life[i] <= 0) {
        img.setVisible(false);
        continue;
      }
      const k = this.life[i] / this.maxLife[i];
      img.setAlpha(0.55 * k).setScale(this.baseScale[i] * (0.55 + 0.45 * k));
    }
  }
}

/** Text plutitor (ex. „🎁 Rose x5”), refolosit dintr-un pool mic. */
export class FloatingTextPool {
  private items: { text: Phaser.GameObjects.Text; life: number; vy: number }[] = [];
  private cursor = 0;

  constructor(scene: Phaser.Scene, size: number, depth: number) {
    for (let i = 0; i < size; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '30px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setDepth(depth)
        .setVisible(false);
      this.items.push({ text, life: 0, vy: 0 });
    }
  }

  show(x: number, y: number, message: string, color = '#ffffff', life = 1.6): void {
    const item = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    item.life = life;
    item.vy = -70;
    item.text.setText(message).setColor(color).setPosition(x, y).setAlpha(1).setScale(1).setVisible(true);
  }

  update(dt: number): void {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.text.setVisible(false);
        continue;
      }
      item.text.y += item.vy * dt;
      item.text.setAlpha(Math.min(1, item.life / 0.4));
    }
  }
}

/**
 * Scântei (explozii, lovituri, bombe). Pool fix cu inel circular, aceeași textură → un singur batch.
 * Poziția și viteza stau în Float32Array, fără obiecte noi pe frame.
 */
export class ParticlePool {
  private imgs: Phaser.GameObjects.Image[] = [];
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private cursor = 0;

  constructor(scene: Phaser.Scene, count: number, depth: number) {
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.imgs.push(scene.add.image(0, 0, TEX.spark).setVisible(false).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD));
    }
  }

  /** `count` scântei care pleacă radial din (x, y). */
  burst(x: number, y: number, count: number, tint: number, speed = 260, life = 0.5, size = 1.4): void {
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.imgs.length;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = Math.cos(a) * v;
      this.vy[i] = Math.sin(a) * v;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.4);
      this.size[i] = size * (0.6 + Math.random() * 0.6);
      this.imgs[i].setPosition(x, y).setTint(tint).setScale(this.size[i]).setAlpha(1).setVisible(true);
    }
  }

  update(dt: number): void {
    const drag = Math.max(0, 1 - 3.5 * dt);
    for (let i = 0; i < this.imgs.length; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const img = this.imgs[i];
      if (this.life[i] <= 0) {
        img.setVisible(false);
        continue;
      }
      this.vx[i] *= drag;
      this.vy[i] *= drag;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      const k = this.life[i] / this.maxLife[i];
      img.setPosition(this.x[i], this.y[i]).setAlpha(k).setScale(this.size[i] * (0.4 + 0.6 * k));
    }
  }
}

/** Proiectilele atacului automat: un punct luminos care zboară de la jucător la țintă. */
export class BoltPool {
  private imgs: Phaser.GameObjects.Image[] = [];
  private x0: Float32Array;
  private y0: Float32Array;
  private x1: Float32Array;
  private y1: Float32Array;
  private t: Float32Array;
  private cursor = 0;

  constructor(
    scene: Phaser.Scene,
    count: number,
    depth: number,
    private durationSec: number,
  ) {
    this.x0 = new Float32Array(count);
    this.y0 = new Float32Array(count);
    this.x1 = new Float32Array(count);
    this.y1 = new Float32Array(count);
    this.t = new Float32Array(count).fill(-1);
    for (let i = 0; i < count; i++) {
      this.imgs.push(scene.add.image(0, 0, TEX.spark).setVisible(false).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD));
    }
  }

  fire(x0: number, y0: number, x1: number, y1: number, tint: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.imgs.length;
    this.x0[i] = x0;
    this.y0[i] = y0;
    this.x1[i] = x1;
    this.y1[i] = y1;
    this.t[i] = 0;
    this.imgs[i].setPosition(x0, y0).setTint(tint).setScale(1.1).setAlpha(1).setVisible(true);
  }

  update(dt: number): void {
    const step = dt / this.durationSec;
    for (let i = 0; i < this.imgs.length; i++) {
      if (this.t[i] < 0) continue;
      this.t[i] += step;
      const img = this.imgs[i];
      if (this.t[i] >= 1) {
        this.t[i] = -1;
        img.setVisible(false);
        continue;
      }
      const k = this.t[i];
      img.setPosition(this.x0[i] + (this.x1[i] - this.x0[i]) * k, this.y0[i] + (this.y1[i] - this.y0[i]) * k);
    }
  }
}

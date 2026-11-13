import Phaser from 'phaser';
import { HEIGHT, SAFE_BOTTOM, SAFE_TOP, WIDTH } from '../config/config';
import { createTextures } from '../core/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    // Aici se încarcă sprite-urile reale când vor exista, sub aceleași chei ca în core/textures.ts, ex.:
    // this.load.image('char-blob', 'assets/characters/blob.png');
  }

  create(): void {
    createTextures(this);
    createBackground(this);
    this.scene.start('game');
  }
}

/** Fundal static desenat o singură dată într-o textură (o imagine e mai ieftină decât un Graphics redesenat). */
function createBackground(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas('bg', WIDTH, HEIGHT)!;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, '#0c1024');
  g.addColorStop(0.4, '#151b3a');
  g.addColorStop(1, '#090b18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Grilă discretă doar în zona de joc, ca mișcarea să se citească mai bine.
  ctx.strokeStyle = 'rgba(120, 140, 255, 0.07)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, SAFE_TOP);
    ctx.lineTo(x, SAFE_BOTTOM);
    ctx.stroke();
  }
  for (let y = SAFE_TOP; y <= SAFE_BOTTOM; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  tex.refresh();
}

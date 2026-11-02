import Phaser from 'phaser';
import { HEIGHT, SAFE_BOTTOM, SAFE_TOP, WIDTH } from '../config/config';
import { t } from '../i18n';

const DEPTH = 200_000;

/** Zonele acoperite de UI-ul TikTok + statistici. Pornit cu ?debug=1, tasta F2 sau din panou. */
export class DebugOverlay {
  private gfx: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private stats: Phaser.GameObjects.Text;
  visible = false;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH);
    this.gfx.fillStyle(0xff2d55, 0.22);
    this.gfx.fillRect(0, 0, WIDTH, SAFE_TOP);
    this.gfx.fillRect(0, SAFE_BOTTOM, WIDTH, HEIGHT - SAFE_BOTTOM);
    this.gfx.lineStyle(4, 0x00ff88, 0.9);
    this.gfx.strokeRect(2, SAFE_TOP, WIDTH - 4, SAFE_BOTTOM - SAFE_TOP);

    const style = { fontFamily: 'monospace', fontSize: '26px', color: '#ffffff', stroke: '#000', strokeThickness: 5 };
    this.labels.push(
      scene.add.text(WIDTH / 2, SAFE_TOP / 2, '', style).setOrigin(0.5),
      scene.add.text(WIDTH / 2, (SAFE_BOTTOM + HEIGHT) / 2, '', style).setOrigin(0.5),
      scene.add.text(WIDTH - 12, SAFE_TOP + 8, '', { ...style, color: '#00ff88' }).setOrigin(1, 0),
    );
    for (const l of this.labels) l.setDepth(DEPTH);
    this.relabel();

    this.stats = scene.add
      .text(12, SAFE_BOTTOM + 12, '', { fontFamily: 'monospace', fontSize: '24px', color: '#00ff88', stroke: '#000', strokeThickness: 5 })
      .setDepth(DEPTH);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.gfx.setVisible(v);
    this.stats.setVisible(v);
    for (const l of this.labels) l.setVisible(v);
  }

  /** Rescrie etichetele fixe (la schimbarea limbii). */
  relabel(): void {
    const keys = ['debug.tiktokBar', 'debug.chatArea', 'debug.safeArea'] as const;
    this.labels.forEach((l, i) => l.setText(t(keys[i])));
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setStats(lines: string[]): void {
    if (this.visible) this.stats.setText(lines.join('\n'));
  }
}

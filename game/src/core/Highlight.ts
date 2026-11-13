import Phaser from 'phaser';
import { CONFIG, WIDTH } from '../config/config';
import type { Crowd, CrowdEntity } from './Crowd';
import { TEX } from './textures';

interface Slot {
  entity: CrowdEntity | null;
  until: number;
  ring: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
}

const NAME_DEPTH = 50_000;

/**
 * Evidențierea la comentariu: caracterul vine în față, primește contur alb și numele deasupra
 * pentru câteva secunde. Numărul de nume afișate simultan e limitat (pool fix); la nevoie se refolosește
 * cel mai vechi, ca un val de comentarii să nu umple ecranul de text.
 */
export class Highlight {
  private slots: Slot[] = [];

  constructor(
    scene: Phaser.Scene,
    private crowd: Crowd,
  ) {
    for (let i = 0; i < CONFIG.highlight.maxNames; i++) {
      const ring = scene.add.image(0, 0, TEX.ring).setVisible(false);
      const name = scene.add
        .text(0, 0, '', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '22px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 6,
        })
        .setOrigin(0.5, 1)
        .setDepth(NAME_DEPTH)
        .setVisible(false);
      this.slots.push({ entity: null, until: 0, ring, name });
    }
  }

  show(entity: CrowdEntity, now: number): void {
    this.crowd.bringToFront(entity);
    const until = now + CONFIG.highlight.nameSec * 1000;

    let slot = this.slots.find((s) => s.entity === entity);
    if (!slot) {
      slot = this.slots.find((s) => s.entity === null);
      if (!slot) slot = this.slots.reduce((a, b) => (a.until <= b.until ? a : b));
      slot.entity = entity;
      slot.name.setText(truncate(entity.player.nickname, 18)).setVisible(true);
      slot.ring.setVisible(true);
    }
    slot.until = until;
    // Ultimul care a comentat are numele deasupra celorlalte nume.
    slot.name.setDepth(NAME_DEPTH + (entity.depth % 1000));
  }

  update(now: number): void {
    for (const slot of this.slots) {
      const e = slot.entity;
      if (!e) continue;
      if (now > slot.until || e.state === 'despawning' || e.player.entity !== e) {
        this.clear(slot);
        continue;
      }
      slot.ring.setPosition(e.x, e.y).setScale(e.body.scaleX, e.body.scaleY).setDepth(e.depth - 0.0004);
      const fade = Math.min(1, (slot.until - now) / 400);
      slot.ring.setAlpha(0.95 * fade);
      // Numele nu iese din ecran la margini.
      const half = slot.name.width / 2 + 4;
      slot.name.setPosition(Phaser.Math.Clamp(e.x, half, WIDTH - half), e.y - 22 * e.scale).setAlpha(fade);
      // Cât e „nou”, numele lui stă deja deasupra, în roșu (NewcomerTags): nu-l dublăm.
      slot.name.setVisible(e.newT <= 0);
    }
  }

  private clear(slot: Slot): void {
    slot.entity = null;
    slot.ring.setVisible(false);
    slot.name.setVisible(false);
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

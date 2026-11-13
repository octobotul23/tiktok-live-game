import Phaser from 'phaser';
import { CONFIG, WIDTH } from '../config/config';
import { NEWCOMER_TINT, type CrowdEntity } from './Crowd';

interface Tag {
  entity: CrowdEntity | null;
  born: number;
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

const TAG_DEPTH = 51_000; // deasupra numelor albe de la comentarii
const PAD_X = 16;
const BOX_H = 42;
const ARROW = 11;

/**
 * Numele roșu de deasupra unui caracter nou, cât timp e „nou” (CrowdEntity.newT; aura roșie o face Crowd).
 * Așa fiecare spectator care tocmai a intrat își găsește imediat caracterul pe ecran.
 * Etichetele vin dintr-un pool fix: la un val mare de intrări, cea mai veche e refolosită pentru cel mai nou.
 */
export class NewcomerTags {
  private tags: Tag[] = [];

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < CONFIG.newcomer.maxTags; i++) {
      const bg = scene.add.graphics();
      const text = scene.add
        .text(0, -ARROW - BOX_H / 2, '', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0.5, 0.5);
      const box = scene.add.container(0, 0, [bg, text]).setDepth(TAG_DEPTH).setVisible(false);
      this.tags.push({ entity: null, born: 0, box, bg, text });
    }
  }

  show(entity: CrowdEntity, now: number): void {
    let tag = this.tags.find((t) => t.entity === entity);
    if (!tag) {
      tag = this.tags.find((t) => t.entity === null) ?? this.tags.reduce((a, b) => (a.born <= b.born ? a : b));
      tag.entity = entity;
      tag.text.setText(truncate(entity.player.nickname, 18));
      this.draw(tag);
      tag.box.setVisible(true);
    }
    tag.born = now;
  }

  update(now: number): void {
    for (const tag of this.tags) {
      const e = tag.entity;
      if (!e) continue;
      if (e.newT <= 0 || e.state === 'despawning' || e.player.entity !== e) {
        tag.entity = null;
        tag.box.setVisible(false);
        continue;
      }
      // Apare cu un mic „pop”, se stinge lin în ultima secundă.
      const age = (now - tag.born) / 1000;
      const pop = age < 0.25 ? Phaser.Math.Easing.Back.Out(age / 0.25) : 1;
      const fade = Math.min(1, e.newT / 0.8);
      const half = tag.text.width / 2 + PAD_X + 4;
      tag.box
        .setPosition(Phaser.Math.Clamp(e.x, half, WIDTH - half), e.y - 22 * e.scale)
        .setScale(0.6 + 0.4 * pop)
        .setAlpha(fade);
    }
  }

  /** Pilula roșie cu contur alb și săgeata spre caracter (desenată o dată, la atribuire). */
  private draw(tag: Tag): void {
    const w = tag.text.width + PAD_X * 2;
    const g = tag.bg;
    g.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -ARROW - BOX_H + 4, w, BOX_H, BOX_H / 2);
    g.fillStyle(NEWCOMER_TINT, 1).fillRoundedRect(-w / 2, -ARROW - BOX_H, w, BOX_H, BOX_H / 2);
    g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-w / 2, -ARROW - BOX_H, w, BOX_H, BOX_H / 2);
    g.fillStyle(0xffffff, 1).fillTriangle(-ARROW, -ARROW - 1, ARROW, -ARROW - 1, 0, 0);
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

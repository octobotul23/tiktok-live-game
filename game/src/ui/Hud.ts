import Phaser from 'phaser';
import { CONFIG, SAFE_BOTTOM, SAFE_TOP, WIDTH } from '../config/config';
import type { ModeCommand } from '../core/CommandParser';
import { t } from '../i18n';

export const HUD_DEPTH = 100_000;
export const FONT = '"Arial Black", Arial, sans-serif';

/** Rândul de stare al modului (ex. „VALUL 3” + viața bazei). */
export interface ModeStatus {
  text: string;
  /** 0–1; null = fără bară. */
  progress: number | null;
  color?: number;
}

export interface LeaderRow {
  name: string;
  score: number;
}

const STATUS_Y = SAFE_TOP + 124;
const STATUS_W = 600;
const STATUS_H = 34;
const LIKE_W = 400;
const LIKE_H = 26;

/**
 * UI-ul comun tuturor modurilor: titlul modului, comenzile, timer, rândul de stare,
 * leaderboard top 5, bara de like-uri, contorul de jucători și anunțurile mari din centru.
 */
export class Hud {
  private modeTitle: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private commandBg: Phaser.GameObjects.Graphics;
  private commandText: Phaser.GameObjects.Text;
  private countText: Phaser.GameObjects.Text;
  private statusBar: Phaser.GameObjects.Graphics;
  private statusText: Phaser.GameObjects.Text;
  private boardBg: Phaser.GameObjects.Graphics;
  private boardText: Phaser.GameObjects.Text;
  private likeBar: Phaser.GameObjects.Graphics;
  private likeText: Phaser.GameObjects.Text;
  private announceText: Phaser.GameObjects.Text;
  private followText: Phaser.GameObjects.Text;
  private announceT = 0;
  private time = 0;
  private lastCount = '';
  private lastTimer = '';
  private lastStatus = '';
  private lastBoard = '';
  private lastLikes = '';
  private likeShown = 0;
  private likeGlowT = 0;

  constructor(private scene: Phaser.Scene) {
    const y = SAFE_TOP + 14;
    const stroke = { stroke: '#000', strokeThickness: 7 };
    this.modeTitle = scene.add
      .text(WIDTH / 2, y, '', { fontFamily: FONT, fontSize: '34px', color: '#ffe066', ...stroke, strokeThickness: 8 })
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH);

    this.timerText = scene.add
      .text(WIDTH - CONFIG.safeZone.marginX, y + 2, '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', ...stroke })
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);

    this.commandBg = scene.add.graphics().setDepth(HUD_DEPTH - 1);
    this.commandText = scene.add
      .text(WIDTH / 2, y + 52, '', {
        fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#000', strokeThickness: 5, align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH);

    this.statusBar = scene.add.graphics().setDepth(HUD_DEPTH - 1);
    this.statusText = scene.add
      .text(WIDTH / 2, STATUS_Y, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    this.boardBg = scene.add.graphics().setDepth(HUD_DEPTH - 1);
    this.boardText = scene.add
      .text(WIDTH - CONFIG.safeZone.marginX - 12, STATUS_Y + 36, '', {
        fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'right', lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);

    this.countText = scene.add
      .text(CONFIG.safeZone.marginX, SAFE_BOTTOM - 10, '', {
        fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 5,
      })
      .setOrigin(0, 1)
      .setAlpha(0.85)
      .setDepth(HUD_DEPTH);

    this.likeBar = scene.add.graphics().setDepth(HUD_DEPTH - 1);
    this.likeText = scene.add
      .text(WIDTH - CONFIG.safeZone.marginX - LIKE_W / 2, SAFE_BOTTOM - 10 - LIKE_H / 2, '', {
        fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    // Stânga sus, lângă titlu: vizibil doar cu „doar urmăritorii”.
    this.followText = scene.add
      .text(CONFIG.safeZone.marginX, y + 2, '', {
        fontFamily: FONT, fontSize: '20px', color: '#ff8fb8', stroke: '#000', strokeThickness: 5, lineSpacing: 2,
      })
      .setOrigin(0, 0)
      .setDepth(HUD_DEPTH);

    this.announceText = scene.add
      .text(WIDTH / 2, SAFE_TOP + 420, '', {
        fontFamily: FONT, fontSize: '64px', color: '#ffffff', stroke: '#000', strokeThickness: 12, align: 'center',
        wordWrap: { width: WIDTH - 120 },
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 50)
      .setVisible(false);
  }

  setMode(name: string, commands: readonly ModeCommand[]): void {
    this.modeTitle.setText(name.toUpperCase());
    const parts = [...moveHints(), ...commands.map((c) => `★ ${c.label}`)];
    this.commandText.setText(parts.join('   '));
    const pad = 14;
    const w = this.commandText.width + pad * 2;
    const h = this.commandText.height + pad;
    this.commandBg.clear();
    this.commandBg.fillStyle(0x000000, 0.45);
    this.commandBg.fillRoundedRect(WIDTH / 2 - w / 2, this.commandText.y - pad / 2, w, h, 16);
  }

  /** Secunde rămase; null ascunde timer-ul. */
  setTimer(sec: number | null, urgent = false): void {
    const text = sec === null || !Number.isFinite(sec) ? '' : `⏱ ${formatTime(sec)}`;
    if (text !== this.lastTimer) {
      this.lastTimer = text;
      this.timerText.setText(text);
    }
    this.timerText.setColor(urgent && sec !== null && sec <= 10 ? '#ff6b6b' : '#ffffff');
  }

  setStatus(status: ModeStatus | null): void {
    const key = status ? `${status.text}|${status.progress?.toFixed(3)}|${status.color}` : '';
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.statusBar.clear();
    if (!status) {
      this.statusText.setText('');
      return;
    }
    this.statusText.setText(status.text);
    const x = WIDTH / 2 - STATUS_W / 2;
    const y = STATUS_Y - STATUS_H / 2;
    this.statusBar.fillStyle(0x000000, 0.55);
    this.statusBar.fillRoundedRect(x - 4, y - 4, STATUS_W + 8, STATUS_H + 8, 12);
    if (status.progress !== null) {
      const k = Phaser.Math.Clamp(status.progress, 0, 1);
      if (k > 0) {
        this.statusBar.fillStyle(status.color ?? 0x52d273, 0.9);
        this.statusBar.fillRoundedRect(x, y, Math.max(16, STATUS_W * k), STATUS_H, 9);
      }
    }
  }

  setLeaderboard(title: string, rows: LeaderRow[]): void {
    const text = rows.length
      ? [t('hud.leaderboard', { label: title }), ...rows.map((r, i) => `${i + 1}. ${truncate(r.name, 13)}  ${formatScore(r.score)}`)].join('\n')
      : '';
    if (text === this.lastBoard) return;
    this.lastBoard = text;
    this.boardText.setText(text);
    this.boardBg.clear();
    if (!text) return;
    const pad = 10;
    const b = this.boardText.getBounds();
    this.boardBg.fillStyle(0x000000, 0.45);
    this.boardBg.fillRoundedRect(b.x - pad, b.y - pad / 2, b.width + pad * 2, b.height + pad, 12);
  }

  /** Bara comună de like-uri (0–1). */
  setLikes(value: number, threshold: number): void {
    const k = Phaser.Math.Clamp(value / threshold, 0, 1);
    this.likeShown += (k - this.likeShown) * 0.2;
    if (k < this.likeShown - 0.5) this.likeShown = k; // tocmai s-a golit
    const text = `❤️ ${Math.floor(value)} / ${threshold}`;
    if (text !== this.lastLikes) {
      this.lastLikes = text;
      this.likeText.setText(text);
    }
    const x = WIDTH - CONFIG.safeZone.marginX - LIKE_W;
    const y = SAFE_BOTTOM - 10 - LIKE_H;
    this.likeBar.clear();
    this.likeBar.fillStyle(0x000000, 0.55);
    this.likeBar.fillRoundedRect(x - 3, y - 3, LIKE_W + 6, LIKE_H + 6, 10);
    if (this.likeShown > 0.005) {
      this.likeBar.fillStyle(this.likeGlowT > 0 ? 0xffffff : 0xff4d8d, 0.95);
      this.likeBar.fillRoundedRect(x, y, Math.max(12, LIKE_W * this.likeShown), LIKE_H, 8);
    }
  }

  /** Text mare în centru (val nou, faza boss-ului, bonus de like-uri…). */
  announce(message: string, color = '#ffffff', sec = 2.2): void {
    this.announceT = sec;
    this.announceText.setText(message).setColor(color).setVisible(true).setAlpha(1).setScale(0.4);
    this.scene.tweens.add({ targets: this.announceText, scale: 1, duration: 260, ease: 'Back.Out' });
  }

  /** Eticheta „doar urmăritorii”; text gol o ascunde. */
  setFollowHint(text: string): void {
    this.followText.setText(text).setVisible(text !== '');
  }

  flashLikes(): void {
    this.likeGlowT = 0.6;
  }

  setCounts(active: number, queued: number): void {
    const text = queued > 0 ? `👥 ${active}   ⏳ ${t('hud.queued', { n: queued })}` : `👥 ${active}`;
    if (text === this.lastCount) return;
    this.lastCount = text;
    this.countText.setText(text);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.followText.visible) this.followText.setAlpha(0.75 + 0.25 * Math.sin(this.time * 4));
    if (this.likeGlowT > 0) this.likeGlowT -= dt;
    if (this.announceT > 0) {
      this.announceT -= dt;
      if (this.announceT <= 0) this.announceText.setVisible(false);
      else this.announceText.setAlpha(Math.min(1, this.announceT / 0.4));
    }
  }
}

/** „▲ sus   ▼ jos …” în limba curentă (chat-ul acceptă oricum ambele limbi). */
export function moveHints(): string[] {
  return [`▲ ${t('cmd.up')}`, `▼ ${t('cmd.down')}`, `◀ ${t('cmd.left')}`, `▶ ${t('cmd.right')}`];
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatScore(n: number): string {
  const v = Math.round(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

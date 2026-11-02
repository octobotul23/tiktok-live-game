import Phaser from 'phaser';
import { WIDTH } from '../config/config';
import type { ModeCommand } from '../core/CommandParser';
import { t } from '../i18n';
import { FONT, HUD_DEPTH, formatScore, formatTime, moveHints, truncate } from './Hud';

const DEPTH = HUD_DEPTH + 10;
const PANEL_W = 920;
const BAR_X = WIDTH / 2 - PANEL_W / 2 + 120;
const BAR_W = PANEL_W - 160;
const ROW_H = 118;
const VOTE_COLORS = [0x4cc9f0, 0xf72585, 0xffd60a];

export interface ResultRow {
  name: string;
  score: number;
  level: number;
  leveledUp: boolean;
}

/**
 * Cardurile dintre runde, desenate peste arenă: lobby (modul următor + comenzi),
 * rezultate (top + nivel) și vot (3 bare live). Un singur set de obiecte, refolosit.
 */
export class RoundOverlay {
  private bg: Phaser.GameObjects.Graphics;
  private bars: Phaser.GameObjects.Graphics;
  private kicker: Phaser.GameObjects.Text;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private countdown: Phaser.GameObjects.Text;
  private footer: Phaser.GameObjects.Text;
  private rows: { num: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; votes: Phaser.GameObjects.Text }[] = [];
  private top = 0;
  private bottom = 0;
  private voteCount = 0;
  private voteShown: number[] = [];
  private voteTarget: number[] = [];
  private lastCountdown = '';

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics().setDepth(DEPTH);
    this.bars = scene.add.graphics().setDepth(DEPTH + 1);
    const text = (size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) =>
      scene.add
        .text(WIDTH / 2, 0, '', {
          fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: Math.round(size / 5), align: 'center',
          wordWrap: { width: PANEL_W - 70 }, ...extra,
        })
        .setOrigin(0.5, 0)
        .setDepth(DEPTH + 2)
        .setVisible(false);
    this.kicker = text(28, '#9ef01a');
    this.title = text(60, '#ffe066');
    this.body = text(30, '#ffffff', { lineSpacing: 10 });
    this.countdown = text(40, '#ffffff');
    this.footer = text(24, '#dddddd');
    for (let i = 0; i < 3; i++) {
      const num = text(54, '#ffffff').setOrigin(0.5, 0.5);
      const name = text(34, '#ffffff', { align: 'left' }).setOrigin(0, 0.5);
      const votes = text(32, '#ffffff', { align: 'right' }).setOrigin(1, 0.5);
      this.rows.push({ num, name, votes });
    }
    this.hide();
  }

  /** `note` = un rând în plus sub comenzi (ex. „doar urmăritorii intră”); gol = nimic. */
  showLobby(modeName: string, instructions: string, commands: readonly ModeCommand[], note = ''): void {
    this.reset();
    const extra = commands.map((c) => `★ ${c.label}`).join('   ');
    this.layout(560, note ? 1120 : 1060);
    this.place(this.kicker, this.top + 34, t('overlay.next'));
    this.place(this.title, this.top + 74, modeName.toUpperCase());
    const lines = [instructions, '', moveHints().join('  ')];
    if (extra) lines.push(extra);
    if (note) lines.push('', note);
    this.place(this.body, this.top + 168, lines.join('\n'));
    this.place(this.countdown, this.bottom - 78, '');
  }

  showResults(headline: string, scoreLabel: string, rows: ResultRow[]): void {
    this.reset();
    this.layout(440, 1160);
    this.place(this.kicker, this.top + 30, t('overlay.results'));
    this.place(this.title, this.top + 68, headline);
    this.title.setFontSize(headline.length > 26 ? 44 : 54);
    const lines = rows.length
      ? rows.map((r, i) => {
          const medal = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
          const lvl = `${t('overlay.level', { n: r.level })}${r.leveledUp ? ' ⬆' : ''}`;
          return `${medal} ${truncate(r.name, 16)}   ${formatScore(r.score)} ${scoreLabel}   ${lvl}`;
        })
      : [t('overlay.noScore')];
    this.place(this.body, this.title.y + this.title.height + 36, lines.join('\n'));
    this.body.setFontSize(rows.length > 5 ? 28 : 32);
    // Panoul se strânge pe conținut.
    this.layout(this.top, this.body.y + this.body.height + 130);
    this.place(this.countdown, this.bottom - 70, '');
  }

  showVote(names: string[], hint: string): void {
    this.reset();
    this.voteCount = names.length;
    this.voteShown = names.map(() => 0);
    this.voteTarget = names.map(() => 0);
    const listTop = 620;
    this.layout(450, listTop + names.length * ROW_H + 170);
    this.place(this.kicker, this.top + 30, t('overlay.voteTitle'));
    this.place(this.title, this.top + 66, t('overlay.voteHow', { options: names.map((_, i) => i + 1).join(', ') }));
    this.title.setFontSize(46);
    names.forEach((name, i) => {
      const y = listTop + i * ROW_H + ROW_H / 2;
      const r = this.rows[i];
      r.num.setText(String(i + 1)).setPosition(BAR_X - 62, y).setVisible(true);
      r.name.setText(name).setPosition(BAR_X + 18, y).setVisible(true);
      r.votes.setText('0').setPosition(BAR_X + BAR_W - 18, y).setVisible(true);
    });
    this.place(this.footer, listTop + names.length * ROW_H + 16, hint);
    this.place(this.countdown, this.bottom - 72, '');
  }

  setVotes(totals: number[]): void {
    for (let i = 0; i < this.voteCount; i++) {
      this.voteTarget[i] = totals[i] ?? 0;
      this.rows[i].votes.setText(String(totals[i] ?? 0));
    }
  }

  setCountdown(sec: number): void {
    const text = Number.isFinite(sec) ? `⏳ ${formatTime(sec)}` : '';
    if (text === this.lastCountdown) return;
    this.lastCountdown = text;
    this.countdown.setText(text);
  }

  hide(): void {
    this.reset();
    this.bg.setVisible(false);
  }

  update(): void {
    if (this.voteCount === 0) return;
    const max = Math.max(1, ...this.voteTarget);
    const leader = this.voteTarget.indexOf(Math.max(...this.voteTarget));
    this.bars.clear();
    for (let i = 0; i < this.voteCount; i++) {
      this.voteShown[i] += (this.voteTarget[i] / max - this.voteShown[i]) * 0.15;
      const y = 620 + i * ROW_H + 14;
      const h = ROW_H - 28;
      this.bars.fillStyle(0xffffff, 0.12);
      this.bars.fillRoundedRect(BAR_X, y, BAR_W, h, 16);
      const w = BAR_W * this.voteShown[i];
      if (w > 4) {
        this.bars.fillStyle(VOTE_COLORS[i % VOTE_COLORS.length], this.voteTarget[i] > 0 && i === leader ? 0.95 : 0.7);
        this.bars.fillRoundedRect(BAR_X, y, Math.max(32, w), h, 16);
      }
      this.bars.fillStyle(VOTE_COLORS[i % VOTE_COLORS.length], 1);
      this.bars.fillCircle(BAR_X - 62, y + h / 2, 40);
    }
  }

  private layout(top: number, bottom: number): void {
    this.top = top;
    this.bottom = bottom;
    this.bg.clear().setVisible(true);
    this.bg.fillStyle(0x0b0b1e, 0.82);
    this.bg.fillRoundedRect(WIDTH / 2 - PANEL_W / 2, top, PANEL_W, bottom - top, 28);
    this.bg.lineStyle(4, 0xffe066, 0.8);
    this.bg.strokeRoundedRect(WIDTH / 2 - PANEL_W / 2, top, PANEL_W, bottom - top, 28);
  }

  private place(t: Phaser.GameObjects.Text, y: number, text: string): void {
    t.setText(text).setY(y).setVisible(true);
  }

  private reset(): void {
    for (const t of [this.kicker, this.title, this.body, this.countdown, this.footer]) t.setVisible(false);
    this.title.setFontSize(60);
    this.body.setFontSize(30);
    for (const r of this.rows) {
      r.num.setVisible(false);
      r.name.setVisible(false);
      r.votes.setVisible(false);
    }
    this.voteCount = 0;
    this.bars.clear();
    this.lastCountdown = '';
  }
}

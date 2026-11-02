import type { GameState, LiveEvent, SimSettings, Viewer } from '../../../shared/protocol';
import { GIFT_CATALOG, findGift, type GiftDef } from '../../../shared/gifts';
import type { GiftStreakCollapser } from '../tiktok/normalize';
import { fakeIdentity } from './names';

const TICK_MS = 100;
const MAX_JOINS_PER_SEC = 120;
const STREAK_STEP_MS = 140;

// Stiluri de comentarii, ca parserul să fie testat cu ce scriu oamenii de fapt.
const MOVE_TEXTS: Record<string, string[]> = {
  up: ['up', 'UP', 'u', 'sus', 'Sus!!', '⬆️', '⬆️⬆️⬆️', 'up up', 'go up', 'sus pls', 'U'],
  down: ['down', 'Down', 'd', 'jos', 'JOS', '⬇️', 'down!!', 'mergi jos', 'd d d', '⬇️ hai'],
  left: ['left', 'LEFT', 'l', 'stanga', 'stânga', 'Stanga 🔥', '⬅️', 'left pls', '⬅️⬅️'],
  right: ['right', 'Right', 'r', 'dreapta', 'DREAPTA', '➡️', 'right!!', 'la dreapta', '➡️🔥'],
};
const DIRS = Object.keys(MOVE_TEXTS);
const CHATTER = ['salut', 'ce joc tare 😂', 'hahaha', 'hai ca putem', '🔥🔥🔥', 'gg', 'unde sunt?', 'wow', 'lol', '❤️'];
const CHEAP_GIFTS = GIFT_CATALOG.filter((g) => g.diamonds <= 30);

interface FakeViewer extends Viewer {
  /** Preferința la vot (0..2), ca barele să nu fie perfect egale. */
  voteBias: number;
  /** Direcția spre care tinde, ca grupurile să curgă natural. */
  drift: number;
  /** 0–100, fix per spectator: e urmăritor dacă followRoll < followerPct (sau dacă a dat follow în live). */
  followRoll: number;
  followedLive: boolean;
}

interface Streak {
  viewer: Viewer;
  gift: GiftDef;
  total: number;
  sent: number;
  nextAt: number;
}

export class Simulator {
  settings: SimSettings;
  private pool: FakeViewer[] = [];
  private joined = new Set<string>();
  private state: GameState | null = null;
  private acc = { comments: 0, likes: 0, gifts: 0, joins: 0, follows: 0 };
  private streaks: Streak[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    initial: SimSettings,
    private emit: (e: LiveEvent) => void,
    private gifts: GiftStreakCollapser,
  ) {
    this.settings = { ...initial };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(TICK_MS / 1000), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  update(patch: Partial<SimSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.settings.viewers = clamp(Math.round(this.settings.viewers), 0, 1000);
    this.settings.followerPct = clamp(this.settings.followerPct, 0, 100);
    for (const v of this.pool) this.applyFollow(v);
    // Cine iese din intervalul activ trebuie să „reintre” cu un comentariu dacă revine.
    for (const v of this.pool.slice(this.settings.viewers)) this.joined.delete(v.userId);
  }

  setGameState(state: GameState): void {
    this.state = state;
  }

  /** Buton din panou: un spectator (uneori unul nou, fără caracter) trimite cadoul. */
  sendGift(giftName: string, count: number): void {
    const gift = findGift(giftName);
    if (!gift) return;
    const viewer = Math.random() < 0.3 ? this.spareViewer() : this.randomJoined() ?? this.spareViewer();
    this.queueGift(viewer, gift, Math.max(1, Math.floor(count)));
  }

  /** Mesaj scris manual din panou, ca să testezi parserul cu orice text. */
  sendChat(nickname: string, text: string, isFollower: boolean): void {
    this.emit({ type: 'chat', user: { ...panelViewer(nickname), isFollower }, text, ts: Date.now() });
  }

  /** Buton din panou: spectatorul de test dă follow. */
  sendFollow(nickname: string): void {
    this.emit({ type: 'follow', user: { ...panelViewer(nickname), isFollower: true }, ts: Date.now() });
  }

  private tick(dt: number): void {
    const now = Date.now();
    this.advanceStreaks(now);
    if (!this.settings.enabled) return;

    this.ensurePool(this.settings.viewers);
    this.processJoins(dt);

    this.acc.comments += this.settings.commentsPerSec * dt;
    while (this.acc.comments >= 1) {
      this.acc.comments -= 1;
      const v = this.randomJoined();
      if (v) this.emit({ type: 'chat', user: v, text: this.commentFor(v), ts: now });
    }

    this.acc.likes += this.settings.likesPerSec * dt;
    while (this.acc.likes >= 1) {
      this.acc.likes -= 1;
      const v = this.randomJoined();
      if (v) this.emit({ type: 'like', user: v, count: 1 + Math.floor(Math.random() * 15), ts: now });
    }

    this.acc.follows += (this.settings.followsPerMin / 60) * dt;
    while (this.acc.follows >= 1) {
      this.acc.follows -= 1;
      const v = this.randomJoined();
      if (v && !v.isFollower) {
        v.followedLive = true;
        this.applyFollow(v);
        this.emit({ type: 'follow', user: v, ts: now });
      }
    }

    this.acc.gifts += (this.settings.giftsPerMin / 60) * dt;
    while (this.acc.gifts >= 1) {
      this.acc.gifts -= 1;
      const v = this.randomJoined();
      const gift = this.voteGiftFor(v) ?? CHEAP_GIFTS[Math.floor(Math.random() * CHEAP_GIFTS.length)];
      if (v) this.queueGift(v, gift, gift.streakable ? 1 + Math.floor(Math.random() * 8) : 1);
    }
  }

  /** Primul comentariu al fiecărui spectator nou, limitat ca rată ca să arate ca un val real. */
  private processJoins(dt: number): void {
    this.acc.joins = Math.min(this.acc.joins + MAX_JOINS_PER_SEC * dt, MAX_JOINS_PER_SEC);
    for (let i = 0; i < this.settings.viewers && this.acc.joins >= 1; i++) {
      const v = this.pool[i];
      if (this.joined.has(v.userId)) continue;
      this.joined.add(v.userId);
      this.acc.joins -= 1;
      const text = Math.random() < 0.6 ? this.moveText(v) : pickOne(CHATTER);
      this.emit({ type: 'chat', user: v, text, ts: Date.now() });
    }
  }

  /** În timpul votului, majoritatea cadourilor automate sunt cadouri de vot pentru opțiunea preferată. */
  private voteGiftFor(v: FakeViewer | null): GiftDef | undefined {
    const s = this.state;
    if (!v || s?.phase !== 'vote' || s.voteOptions.length === 0 || Math.random() > 0.7) return undefined;
    const name = s.voteGifts[v.voteBias % s.voteOptions.length];
    return name ? findGift(name) : undefined;
  }

  private commentFor(v: FakeViewer): string {
    const s = this.state;
    if (s?.phase === 'vote' && s.voteOptions.length > 0 && Math.random() < 0.75) {
      const opt = Math.random() < 0.6 ? v.voteBias % s.voteOptions.length : Math.floor(Math.random() * s.voteOptions.length);
      return String(opt + 1);
    }
    if (s?.modeId === 'pvp') {
      // Fiecare spectator fals ține cu o echipă: în lobby o alege, în rundă împinge spre baza adversă.
      const top = v.userId.charCodeAt(v.userId.length - 1) % 2 === 0;
      if (s.phase === 'lobby' && Math.random() < 0.4) return top ? 'echipa sus' : 'echipa jos';
      if (s.phase === 'playing' && Math.random() < 0.45) return pickOne(MOVE_TEXTS[top ? 'down' : 'up']);
      if (s.phase === 'playing') return Math.random() < 0.08 ? pickOne(CHATTER) : this.moveText(v);
    }
    if (s && s.modeCommandSamples.length > 0 && Math.random() < 0.12) return pickOne(s.modeCommandSamples);
    if (Math.random() < 0.08) return pickOne(CHATTER);
    return this.moveText(v);
  }

  private moveText(v: FakeViewer): string {
    const dir = Math.random() < 0.35 ? DIRS[v.drift] : pickOne(DIRS);
    return pickOne(MOVE_TEXTS[dir]);
  }

  private queueGift(viewer: Viewer, gift: GiftDef, count: number): void {
    if (!gift.streakable) {
      this.gifts.push({ user: viewer, giftId: gift.id, giftName: gift.name, diamonds: gift.diamonds, giftType: 2, repeatCount: count, repeatEnd: true });
      return;
    }
    this.streaks.push({ viewer, gift, total: count, sent: 0, nextAt: Date.now() });
  }

  private advanceStreaks(now: number): void {
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      while (s.nextAt <= now && s.sent < s.total) {
        s.sent += 1;
        s.nextAt += STREAK_STEP_MS;
        this.gifts.push({
          user: s.viewer, giftId: s.gift.id, giftName: s.gift.name, diamonds: s.gift.diamonds,
          giftType: 1, repeatCount: s.sent, repeatEnd: false,
        });
      }
      if (s.sent >= s.total) {
        // TikTok trimite la final încă un eveniment cu același repeatCount și repeatEnd = true.
        this.gifts.push({
          user: s.viewer, giftId: s.gift.id, giftName: s.gift.name, diamonds: s.gift.diamonds,
          giftType: 1, repeatCount: s.total, repeatEnd: true,
        });
        this.streaks.splice(i, 1);
      }
    }
  }

  private ensurePool(n: number): void {
    while (this.pool.length < n) {
      const i = this.pool.length;
      const id = fakeIdentity(i);
      this.pool.push({
        userId: `sim:${i}`, uniqueId: id.uniqueId, nickname: id.nickname,
        voteBias: Math.floor(Math.random() * 3), drift: Math.floor(Math.random() * 4),
        followRoll: Math.random() * 100, followedLive: false,
      });
      this.applyFollow(this.pool[i]);
    }
  }

  private randomJoined(): FakeViewer | null {
    const n = this.settings.viewers;
    if (n === 0 || this.joined.size === 0) return null;
    for (let tries = 0; tries < 8; tries++) {
      const v = this.pool[Math.floor(Math.random() * n)];
      if (this.joined.has(v.userId)) return v;
    }
    return null;
  }

  private applyFollow(v: FakeViewer): void {
    v.isFollower = v.followedLive || v.followRoll < this.settings.followerPct;
  }

  /** Un spectator din afara intervalului activ: încă nu are caracter în joc. */
  private spareViewer(): FakeViewer {
    const i = this.settings.viewers + Math.floor(Math.random() * 200);
    this.ensurePool(i + 1);
    return this.pool[i];
  }
}

/** Spectatorul scris de mână din panou: același nume = același spectator. */
function panelViewer(nickname: string): Viewer {
  const nick = nickname.trim() || 'Tester';
  return { userId: `panel:${nick.toLowerCase()}`, uniqueId: nick.toLowerCase(), nickname: nick };
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

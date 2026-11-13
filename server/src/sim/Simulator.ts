import type { GameState, LiveEvent, Viewer } from '../../../shared/protocol';
import { GIFT_CATALOG, findGift, type GiftDef } from '../../../shared/gifts';
import { cleanSimPatch, type SimSettings } from '../../../shared/sim';
import type { GiftStreakCollapser } from '../tiktok/normalize';
import { fakeIdentity } from './names';

const TICK_MS = 100;
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

interface FakeViewer extends Viewer {
  /** Preferința la vot (0..2), ca barele să nu fie perfect egale. */
  voteBias: number;
  /** Direcția spre care tinde, ca grupurile să curgă natural. */
  drift: number;
  /** 0–100, fix per bot: e urmăritor dacă followRoll < followerPct (sau dacă a dat follow în live). */
  followRoll: number;
  followedLive: boolean;
  /** 0–100, fix per bot: scrie dacă talkRoll < activePct; altfel doar privește. */
  talkRoll: number;
  /** 0–100, fix per bot: în PvP ține cu echipa de sus dacă teamRoll < pvpTopPct. */
  teamRoll: number;
}

interface Streak {
  viewer: Viewer;
  gift: GiftDef;
  total: number;
  sent: number;
  nextAt: number;
}

/**
 * Boții: spectatori falși care intră, scriu, dau like, cadouri și follow, după setările din panou.
 * Primele `viewers` locuri din `pool` sunt boții din live; `present` = cei care au intrat deja.
 */
export class Simulator {
  settings: SimSettings;
  private pool: FakeViewer[] = [];
  private present = new Set<string>();
  private nextIdentity = 0;
  private state: GameState | null = null;
  private acc = { comments: 0, likes: 0, gifts: 0, joins: 0, follows: 0, churn: 0 };
  private wave = { factor: 1, target: 1, nextAt: 0 };
  private streaks: Streak[] = [];
  /** Ceasul ultimului pas; seriile de cadouri pornesc de la el (testele dau un ceas propriu). */
  private clock = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    initial: SimSettings,
    private emit: (e: LiveEvent) => void,
    private gifts: GiftStreakCollapser,
    private rnd: () => number = Math.random,
  ) {
    this.settings = { ...initial };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.step(TICK_MS / 1000), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Setări noi din panou: doar cheile cunoscute, aduse în limite. */
  update(patch: Partial<SimSettings>): void {
    this.settings = { ...this.settings, ...cleanSimPatch(patch) };
    for (const v of this.pool) this.applyFollow(v);
    // Cine iese din numărul de boți „pleacă”; dacă revine, intră din nou cu un comentariu.
    for (const v of this.pool.slice(this.settings.viewers)) this.present.delete(v.userId);
  }

  setGameState(state: GameState): void {
    this.state = state;
  }

  /** Buton din panou: un spectator (uneori unul nou, fără caracter) trimite cadoul. */
  sendGift(giftName: string, count: number): void {
    const gift = findGift(giftName);
    if (!gift) return;
    const viewer = this.rnd() < 0.3 ? this.spareViewer() : this.randomPresent(false) ?? this.spareViewer();
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

  /** Un pas de simulare (dt în secunde). Public pentru teste. */
  step(dt: number, now = Date.now()): void {
    this.clock = now;
    this.advanceStreaks(now);
    const s = this.settings;
    if (!s.enabled) return;

    this.ensurePool(s.viewers);
    this.processJoins(dt, now);
    this.processChurn(dt);

    // „Activitate” înmulțește tot; valurile fac ritmul să urce și să coboare ca într-un live real.
    const k = (s.activity / 100) * this.waveFactor(dt, now);

    this.acc.comments += s.commentsPerSec * k * dt;
    while (this.acc.comments >= 1) {
      this.acc.comments -= 1;
      const v = this.randomPresent(true);
      if (v) this.emit({ type: 'chat', user: v, text: this.commentFor(v), ts: now });
    }

    this.acc.likes += s.likesPerSec * k * dt;
    while (this.acc.likes >= 1) {
      this.acc.likes -= 1;
      const v = this.randomPresent(false);
      if (v) this.emit({ type: 'like', user: v, count: 1 + Math.floor(this.rnd() * s.likeBurstMax), ts: now });
    }

    this.acc.follows += (s.followsPerMin / 60) * k * dt;
    while (this.acc.follows >= 1) {
      this.acc.follows -= 1;
      const v = this.randomPresent(false);
      if (v && !v.isFollower) {
        v.followedLive = true;
        this.applyFollow(v);
        this.emit({ type: 'follow', user: v, ts: now });
      }
    }

    this.acc.gifts += (s.giftsPerMin / 60) * k * dt;
    while (this.acc.gifts >= 1) {
      this.acc.gifts -= 1;
      const v = this.randomPresent(false);
      if (!v) continue;
      const gift = this.voteGiftFor(v) ?? this.randomGift();
      this.queueGift(v, gift, gift.streakable ? 1 + Math.floor(this.rnd() * s.giftStreakMax) : 1);
    }
  }

  /** Câți boți sunt acum în live (pentru teste). */
  get presentCount(): number {
    return this.present.size;
  }

  /** Boții noi intră treptat; cei care scriu se prezintă cu un comentariu (așa primesc caracter). */
  private processJoins(dt: number, now: number): void {
    const s = this.settings;
    this.acc.joins = Math.min(this.acc.joins + s.joinsPerSec * dt, Math.max(1, s.joinsPerSec));
    for (let i = 0; i < s.viewers && this.acc.joins >= 1; i++) {
      const v = this.pool[i];
      if (this.present.has(v.userId)) continue;
      this.present.add(v.userId);
      this.acc.joins -= 1;
      if (this.talks(v)) {
        const text = this.pct(s.movePct) ? this.moveText(v) : this.pick(CHATTER);
        this.emit({ type: 'chat', user: v, text, ts: now });
      }
    }
  }

  /** Public care se schimbă: un bot pleacă, locul lui îl ia unul nou (alt nume, intră din nou). */
  private processChurn(dt: number): void {
    const s = this.settings;
    this.acc.churn += (s.churnPerMin / 60) * dt;
    while (this.acc.churn >= 1) {
      this.acc.churn -= 1;
      if (s.viewers === 0) break;
      const i = Math.floor(this.rnd() * s.viewers);
      this.present.delete(this.pool[i].userId);
      this.pool[i] = this.makeViewer();
    }
  }

  /** Factorul de val: 1 = ritm normal; cu burstiness mare urcă și coboară, cu vârfuri scurte. */
  private waveFactor(dt: number, now: number): number {
    const b = this.settings.burstiness / 100;
    if (b <= 0) {
      this.wave.factor = 1;
      return 1;
    }
    if (now >= this.wave.nextAt) {
      const spike = this.rnd() < 0.15 * b;
      this.wave.target = spike ? 1 + 3 * b : Math.max(0, 1 + (this.rnd() * 2 - 1) * 0.9 * b);
      this.wave.nextAt = now + (spike ? 1500 : 2500 + this.rnd() * 4000);
    }
    this.wave.factor += (this.wave.target - this.wave.factor) * Math.min(1, dt * 2);
    return this.wave.factor;
  }

  /** Opțiunea votată (0..n-1): favoritul botului, sau cea împinsă din panou. */
  private voteChoice(v: FakeViewer, n: number): number {
    const s = this.settings;
    if (s.voteFor > 0 && s.voteFor <= n && this.pct(s.votePushPct)) return s.voteFor - 1;
    return this.rnd() < 0.6 ? v.voteBias % n : Math.floor(this.rnd() * n);
  }

  /** În timpul votului, o parte din cadourile automate sunt cadouri de vot. */
  private voteGiftFor(v: FakeViewer): GiftDef | undefined {
    const st = this.state;
    if (st?.phase !== 'vote' || st.voteOptions.length === 0 || !this.pct(this.settings.voteGiftPct)) return undefined;
    const name = st.voteGifts[this.voteChoice(v, st.voteOptions.length)];
    return name ? findGift(name) : undefined;
  }

  /** Un cadou până la prețul maxim ales; cele ieftine vin mai des, ca în realitate. */
  private randomGift(): GiftDef {
    const max = this.settings.giftMaxDiamonds;
    let allowed = GIFT_CATALOG.filter((g) => g.diamonds <= max);
    if (allowed.length === 0) allowed = [GIFT_CATALOG.reduce((a, b) => (b.diamonds < a.diamonds ? b : a))];
    const weights = allowed.map((g) => 1 / Math.sqrt(g.diamonds));
    let r = this.rnd() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < allowed.length; i++) {
      r -= weights[i];
      if (r <= 0) return allowed[i];
    }
    return allowed[allowed.length - 1];
  }

  private commentFor(v: FakeViewer): string {
    const st = this.state;
    const s = this.settings;
    if (st?.phase === 'vote' && st.voteOptions.length > 0 && this.pct(s.votePct)) {
      return String(this.voteChoice(v, st.voteOptions.length) + 1);
    }
    if (st?.modeId === 'pvp') {
      // Fiecare bot ține cu o echipă: în lobby o alege, în rundă împinge spre baza adversă.
      const top = v.teamRoll < s.pvpTopPct;
      if (st.phase === 'lobby' && this.rnd() < 0.4) return top ? 'echipa sus' : 'echipa jos';
      if (st.phase === 'playing' && this.rnd() < 0.45) return this.pick(MOVE_TEXTS[top ? 'down' : 'up']);
      if (st.phase === 'playing') return this.pct(s.movePct) ? this.moveText(v) : this.pick(CHATTER);
    }
    if (st && st.modeCommandSamples.length > 0 && this.pct(s.modeCmdPct)) return this.pick(st.modeCommandSamples);
    return this.pct(s.movePct) ? this.moveText(v) : this.pick(CHATTER);
  }

  private moveText(v: FakeViewer): string {
    const dir = this.rnd() < 0.35 ? DIRS[v.drift] : this.pick(DIRS);
    return this.pick(MOVE_TEXTS[dir]);
  }

  private queueGift(viewer: Viewer, gift: GiftDef, count: number): void {
    if (!gift.streakable) {
      this.gifts.push({ user: viewer, giftId: gift.id, giftName: gift.name, diamonds: gift.diamonds, giftType: 2, repeatCount: count, repeatEnd: true });
      return;
    }
    this.streaks.push({ viewer, gift, total: count, sent: 0, nextAt: this.clock });
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

  private makeViewer(): FakeViewer {
    const n = this.nextIdentity++;
    const id = fakeIdentity(n);
    const v: FakeViewer = {
      userId: `sim:${n}`, uniqueId: id.uniqueId, nickname: id.nickname,
      voteBias: Math.floor(this.rnd() * 3), drift: Math.floor(this.rnd() * 4),
      followRoll: this.rnd() * 100, followedLive: false,
      talkRoll: this.rnd() * 100, teamRoll: this.rnd() * 100,
    };
    this.applyFollow(v);
    return v;
  }

  private ensurePool(n: number): void {
    while (this.pool.length < n) this.pool.push(this.makeViewer());
  }

  /** Un bot din live, ales la întâmplare; cu `talkersOnly`, doar dintre cei care scriu. */
  private randomPresent(talkersOnly: boolean): FakeViewer | null {
    const n = this.settings.viewers;
    if (n === 0 || this.present.size === 0) return null;
    for (let tries = 0; tries < 40; tries++) {
      const v = this.pool[Math.floor(this.rnd() * n)];
      if (this.present.has(v.userId) && (!talkersOnly || this.talks(v))) return v;
    }
    return null;
  }

  private talks(v: FakeViewer): boolean {
    return v.talkRoll < this.settings.activePct;
  }

  private applyFollow(v: FakeViewer): void {
    v.isFollower = v.followedLive || v.followRoll < this.settings.followerPct;
  }

  /** Un spectator din afara live-ului: încă nu are caracter în joc. */
  private spareViewer(): FakeViewer {
    const i = this.settings.viewers + Math.floor(this.rnd() * 200);
    this.ensurePool(i + 1);
    return this.pool[i];
  }

  private pct(p: number): boolean {
    return this.rnd() * 100 < p;
  }

  private pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rnd() * arr.length)];
  }
}

/** Spectatorul scris de mână din panou: același nume = același spectator. */
function panelViewer(nickname: string): Viewer {
  const nick = nickname.trim() || 'Tester';
  return { userId: `panel:${nick.toLowerCase()}`, uniqueId: nick.toLowerCase(), nickname: nick };
}

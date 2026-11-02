import type { LiveEvent, Viewer } from '../../../shared/protocol';

/** Forma minimă a unui eveniment de cadou, cum vine din tiktok-live-connector (sau din simulator). */
export interface RawGift {
  user: Viewer;
  giftId: number;
  giftName: string;
  diamonds: number;
  /** 1 = cadou care se poate trimite în serie. */
  giftType: number;
  repeatCount: number;
  repeatEnd: boolean;
}

/**
 * Colapsează seriile de cadouri: TikTok trimite același cadou de mai multe ori cu repeatCount
 * crescător, iar ultimul eveniment are repeatEnd = true. Jocul trebuie să aplice efectul o singură
 * dată, cu cantitatea totală, deci aici emitem `giftProgress` pe parcurs și `gift` doar la final.
 * Dacă repeatEnd nu mai vine (deconectare, pachet pierdut), seria se închide după `timeoutMs`.
 */
export class GiftStreakCollapser {
  private open = new Map<string, { raw: RawGift; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private emit: (e: LiveEvent) => void,
    private timeoutMs = 4000,
  ) {}

  push(raw: RawGift): void {
    const now = Date.now();
    const count = Math.max(1, raw.repeatCount);

    if (raw.giftType !== 1) {
      this.emit(this.toGift(raw, count, now));
      return;
    }

    const key = `${raw.user.userId}:${raw.giftId}`;
    const prev = this.open.get(key);
    if (prev) clearTimeout(prev.timer);

    if (raw.repeatEnd) {
      this.open.delete(key);
      this.emit(this.toGift(raw, count, now));
      return;
    }

    this.emit({ type: 'giftProgress', user: raw.user, giftId: raw.giftId, giftName: raw.giftName, count, ts: now });
    const timer = setTimeout(() => this.flush(key), this.timeoutMs);
    this.open.set(key, { raw: { ...raw, repeatCount: count }, timer });
  }

  /** Închide toate seriile deschise (ex. la deconectare). */
  flushAll(): void {
    for (const key of [...this.open.keys()]) this.flush(key);
  }

  private flush(key: string): void {
    const entry = this.open.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.open.delete(key);
    this.emit(this.toGift(entry.raw, entry.raw.repeatCount, Date.now()));
  }

  private toGift(raw: RawGift, count: number, ts: number): LiveEvent {
    return { type: 'gift', user: raw.user, giftId: raw.giftId, giftName: raw.giftName, count, diamonds: raw.diamonds, ts };
  }
}

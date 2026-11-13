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

// --- Mesajele brute din tiktok-live-connector → forma jocului ---
// Biblioteca trimite mesajele protobuf de la TikTok aproape neatinse, iar numele câmpurilor s-au schimbat
// între versiuni (ex. `content` vs `comment`, `displayId` vs `uniqueId`). De aceea citim tolerant ambele forme.

/** Un mesaj brut de la TikTok; forma lui nu e garantată, deci îl citim defensiv. */
type Raw = any;

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();

/** Urmărește contul care e LIVE? true / false, sau undefined dacă mesajul nu spune. */
function followerOf(user: Raw, identity: Raw): boolean | undefined {
  if (identity && typeof identity.isFollowerOfAnchor === 'boolean') {
    return identity.isFollowerOfAnchor || identity.isMutualFollowingWithAnchor === true;
  }
  // followStatus: 0 = nu urmărește, 1 = urmărește, 2 = se urmăresc reciproc.
  const status = user?.followInfo?.followStatus ?? user?.followRole;
  if (status === undefined || status === null || status === '') return undefined;
  return Number(status) >= 1;
}

export function toViewer(user: Raw, identity?: Raw): Viewer | null {
  if (!user) return null;
  const uniqueId = str(user.uniqueId ?? user.displayId);
  const userId = str(user.userId ?? user.id ?? user.userIdStr) || uniqueId;
  if (!userId) return null;
  const viewer: Viewer = { userId, uniqueId, nickname: str(user.nickname) || uniqueId || userId };
  const isFollower = followerOf(user, identity);
  if (isFollower !== undefined) viewer.isFollower = isFollower;
  return viewer;
}

export function chatFromTikTok(m: Raw, ts = Date.now()): LiveEvent | null {
  const user = toViewer(m?.user, m?.userIdentity);
  const text = str(m?.content ?? m?.comment);
  return user && text ? { type: 'chat', user, text, ts } : null;
}

export function likeFromTikTok(m: Raw, ts = Date.now()): LiveEvent | null {
  const user = toViewer(m?.user, m?.userIdentity);
  const count = Math.max(1, Number(m?.count ?? m?.likeCount) || 1);
  return user ? { type: 'like', user, count, ts } : null;
}

export function memberFromTikTok(m: Raw, ts = Date.now()): LiveEvent | null {
  const user = toViewer(m?.user, m?.userIdentity);
  return user ? { type: 'member', user, ts } : null;
}

export function followFromTikTok(m: Raw, ts = Date.now()): LiveEvent | null {
  const user = toViewer(m?.user, m?.userIdentity);
  return user ? { type: 'follow', user: { ...user, isFollower: true }, ts } : null;
}

/** Cadoul brut, gata pentru GiftStreakCollapser (care se ocupă de serii). */
export function giftFromTikTok(m: Raw): RawGift | null {
  const user = toViewer(m?.user, m?.userIdentity);
  if (!user) return null;
  const g = m?.gift ?? {};
  const d = m?.giftDetails ?? {};
  const x = m?.extendedGiftInfo ?? {};
  const giftId = Number(m?.giftId ?? g.id ?? x.id) || 0;
  return {
    user,
    giftId,
    giftName: str(g.name ?? d.giftName ?? x.name) || `Gift ${giftId}`,
    diamonds: Number(g.diamondCount ?? d.diamondCount ?? x.diamond_count ?? x.diamondCount) || 0,
    giftType: Number(g.type ?? d.giftType ?? x.type ?? (g.combo ? 1 : 0)) || 0,
    repeatCount: Number(m?.repeatCount) || 1,
    repeatEnd: Boolean(Number(m?.repeatEnd) || m?.repeatEnd === true),
  };
}

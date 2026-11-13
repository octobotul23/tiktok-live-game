import fs from 'node:fs';
import path from 'node:path';
import { ControlEvent, TikTokLiveConnection, UserOfflineError, WebcastEvent } from 'tiktok-live-connector';
import type { LiveEvent, TikTokStatus } from '../../../shared/protocol';
import {
  chatFromTikTok,
  followFromTikTok,
  giftFromTikTok,
  likeFromTikTok,
  memberFromTikTok,
  type GiftStreakCollapser,
} from './normalize';

/** Cât așteptăm între verificări când contul nu e live (încă). */
const WAITING_RETRY_SEC = 30;
/** Pauzele după o eroare cresc 2, 4, 8… până la plafonul ăsta. */
const MAX_BACKOFF_SEC = 60;
/** Cât de des scriem în jurnal câte evenimente au venit. */
const STATS_EVERY_MS = 60_000;

export interface ConnectorOptions {
  emit: (e: LiveEvent) => void;
  gifts: GiftStreakCollapser;
  onStatus: (s: TikTokStatus) => void;
  /** Folderul pentru jurnale (ex. logs/); un fișier pe zi. */
  logDir: string;
  /** Cheie Euler Stream (opțională): ridică limitele serverului de semnare. */
  signApiKey?: string;
}

/** Acceptă „nume”, „@nume” sau linkul de profil / live. Întoarce '' dacă nu arată a username TikTok. */
export function cleanUsername(input: string): string {
  let s = input.trim();
  const fromUrl = /tiktok\.com\/@([^/?#\s]+)/i.exec(s);
  if (fromUrl) s = fromUrl[1];
  s = s.replace(/^@/, '');
  return /^[A-Za-z0-9._]{2,24}$/.test(s) ? s : '';
}

/**
 * Legătura cu TikTok LIVE: se conectează la live-ul unui cont, traduce evenimentele în forma jocului
 * și se reconectează singur. Cât timp contul nu e live, verifică din nou la fiecare 30 s, deci poate fi
 * pornit înainte de live. Jurnalul (conectări, deconectări, erori, numărul de evenimente) e în logs/.
 */
export class TikTokConnector {
  private conn: TikTokLiveConnection | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  /** Crește la fiecare start/stop, ca evenimentele unei conexiuni vechi să fie ignorate. */
  private generation = 0;
  private failures = 0;
  private streamEnded = false;
  /** Am scris deja în jurnal că așteptăm live-ul? (se resetează la conectare și la fiecare start) */
  private offlineLogged = false;
  private counts = { chat: 0, gift: 0, like: 0, member: 0, follow: 0 };
  private status: TikTokStatus = { username: '', state: 'off' };

  constructor(private opts: ConnectorOptions) {}

  get current(): TikTokStatus {
    return this.status;
  }

  start(username: string): void {
    this.stop(false);
    this.offlineLogged = false;
    this.status = { username, state: 'connecting' };
    this.log(`Pornit pentru @${username}`);
    void this.connect(this.generation);
  }

  stop(report = true): void {
    this.generation++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stopStats();
    this.opts.gifts.flushAll();
    const conn = this.conn;
    this.conn = null;
    if (conn) conn.disconnect().catch(() => {});
    if (report && this.status.state !== 'off') {
      this.log(`Oprit (@${this.status.username})`);
      this.setStatus({ username: this.status.username, state: 'off' });
    }
  }

  private async connect(gen: number): Promise<void> {
    const username = this.status.username;
    this.setStatus({ username, state: 'connecting', viewers: this.status.viewers });
    this.streamEnded = false;
    const conn = new TikTokLiveConnection(username, {
      // Fără istoricul de comentarii de dinainte de conectare: n-ar trebui să miște caracterele.
      processInitialData: false,
      // Lista de cadouri a camerei: nume și valoare sigure chiar dacă mesajul de cadou vine incomplet.
      enableExtendedGiftInfo: true,
      signApiKey: this.opts.signApiKey || undefined,
    });
    this.conn = conn;
    this.attach(conn, gen);

    try {
      const state = await conn.connect();
      if (gen !== this.generation) {
        conn.disconnect().catch(() => {});
        return;
      }
      this.failures = 0;
      this.offlineLogged = false;
      this.log(`Conectat la live-ul lui @${username} (roomId ${state.roomId})`);
      this.setStatus({ username, state: 'live' });
      this.startStats();
    } catch (err) {
      if (gen !== this.generation) return;
      this.conn = null;
      if (err instanceof UserOfflineError) {
        // O singură linie în jurnal când începe așteptarea, nu una la fiecare 30 s.
        if (!this.offlineLogged) this.log(`@${username} nu e LIVE acum; verific din nou la fiecare ${WAITING_RETRY_SEC}s`);
        this.offlineLogged = true;
        this.scheduleRetry(gen, 'waiting', WAITING_RETRY_SEC);
      } else {
        this.log(`Eroare la conectare: ${describe(err)}`);
        this.scheduleRetry(gen, 'error', this.backoff(), describe(err));
      }
    }
  }

  private attach(conn: TikTokLiveConnection, gen: number): void {
    const live = () => gen === this.generation && this.conn === conn;
    const send = (kind: keyof TikTokConnector['counts'], e: LiveEvent | null) => {
      if (!e || !live()) return;
      this.counts[kind]++;
      this.opts.emit(e);
    };

    conn.on(WebcastEvent.CHAT, (m) => send('chat', chatFromTikTok(m)));
    conn.on(WebcastEvent.LIKE, (m) => send('like', likeFromTikTok(m)));
    conn.on(WebcastEvent.MEMBER, (m) => send('member', memberFromTikTok(m)));
    conn.on(WebcastEvent.FOLLOW, (m) => send('follow', followFromTikTok(m)));
    conn.on(WebcastEvent.GIFT, (m) => {
      const raw = giftFromTikTok(m);
      if (!raw || !live()) return;
      this.counts.gift++;
      this.opts.gifts.push(raw);
    });
    conn.on(WebcastEvent.ROOM_USER, (m) => {
      const viewers = Number((m as { viewerCount?: unknown }).viewerCount);
      if (live() && Number.isFinite(viewers) && viewers !== this.status.viewers) this.setStatus({ ...this.status, viewers });
    });
    conn.on(WebcastEvent.STREAM_END, () => {
      if (!live()) return;
      this.streamEnded = true;
      this.log('Live-ul s-a încheiat');
    });
    conn.on(ControlEvent.ERROR, (e) => {
      const err = e?.exception ?? e?.info ?? e;
      // „Nu e online” nu e o eroare pentru noi: connect() o tratează ca așteptare.
      if (live() && !(err instanceof UserOfflineError)) this.log(`Eroare: ${describe(err)}`);
    });
    conn.on(ControlEvent.DISCONNECTED, (e) => {
      if (!live()) return;
      this.conn = null;
      this.stopStats();
      this.opts.gifts.flushAll();
      this.log(`Deconectat (cod ${e?.code ?? '?'}${e?.reason ? `: ${e.reason}` : ''})`);
      // După finalul live-ului așteptăm un live nou; altfel e o cădere de rețea și reîncercăm repede.
      if (this.streamEnded) this.scheduleRetry(gen, 'waiting', WAITING_RETRY_SEC);
      else this.scheduleRetry(gen, 'error', this.backoff(), e?.reason ? String(e.reason) : undefined);
    });
  }

  private backoff(): number {
    const sec = Math.min(MAX_BACKOFF_SEC, 2 ** (this.failures + 1));
    this.failures++;
    return sec;
  }

  private scheduleRetry(gen: number, state: 'waiting' | 'error', sec: number, error?: string): void {
    if (gen !== this.generation) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setStatus({ username: this.status.username, state, retryInSec: sec, error });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (gen === this.generation) void this.connect(gen);
    }, sec * 1000);
  }

  private setStatus(s: TikTokStatus): void {
    this.status = s;
    this.opts.onStatus(s);
  }

  private startStats(): void {
    this.stopStats();
    this.statsTimer = setInterval(() => {
      const c = this.counts;
      this.log(`Ultimul minut: ${c.chat} comentarii, ${c.gift} cadouri, ${c.like} like-uri, ${c.member} intrări, ${c.follow} follow-uri`);
      this.counts = { chat: 0, gift: 0, like: 0, member: 0, follow: 0 };
    }, STATS_EVERY_MS);
  }

  private stopStats(): void {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
  }

  private log(line: string): void {
    const now = new Date();
    const stamp = now.toISOString();
    console.log(`[tiktok] ${line}`);
    const file = path.join(this.opts.logDir, `tiktok-${stamp.slice(0, 10)}.log`);
    fs.mkdir(this.opts.logDir, { recursive: true }, () => {
      fs.appendFile(file, `${stamp} ${line}\n`, () => {});
    });
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return typeof err === 'string' ? err : JSON.stringify(err)?.slice(0, 300) ?? String(err);
}

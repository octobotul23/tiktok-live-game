import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { WS_PATH, type ControlMsg, type GamePhase, type GameState, type LiveEvent, type ScreenInfo, type SourceStatus, type WireMsg } from '../../shared/protocol';

type Role = 'game' | 'panel';

/**
 * Browserele nu aplică CORS la WebSocket, deci orice site deschis de streamer s-ar putea conecta
 * și trimite cadouri false sau comenzi. Acceptăm doar:
 * - pagini de pe calculatorul ăsta (jocul, panoul, OBS) și aplicația de telefon (Capacitor = https://localhost);
 * - numele Tailscale EXACT al calculatorului (vezi `allowHost`). Nu tot `*.ts.net`: Tailscale Funnel
 *   publică și site-uri ale altor oameni pe `*.ts.net`, iar unul deschis în browser s-ar putea conecta aici;
 * - clienții fără Origin (unelte din linia de comandă), care oricum ajung aici doar de pe calculator
 *   sau din rețeaua ta Tailscale.
 */
/** Originea aplicației de telefon (Capacitor, androidScheme https). */
const APP_ORIGIN = 'https://localhost';
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * Centrul de rutare. Clienții se prezintă cu `hello` (game sau panel):
 * - evenimentele live merg la toate jocurile și panourile (panoul le afișează în log);
 * - mesajele de control din panou ajung la `onControl` (simulator) și, dacă nu sunt pentru simulator, la jocuri;
 * - starea trimisă de joc ajunge la panouri și la `onGameState` (simulatorul se adaptează fazei).
 */
export class Hub {
  private roles = new Map<WebSocket, Role>();
  private lastState: GameState | null = null;
  private statuses = new Map<string, SourceStatus>();
  /** Ce ecran de joc e pe fiecare conexiune „game” (telefon sau browser). */
  private screens = new Map<WebSocket, ScreenInfo>();
  private greeting: (role: Role) => WireMsg[] = () => [];
  /** Conexiunile venite pe Wi-Fi-ul de acasă: au voie doar ca ecran de joc, niciodată ca panou. */
  private lanSockets = new WeakSet<WebSocket>();
  /** Numele Tailscale ale calculatorului (ex. `x237.tail36214d.ts.net`), aflate la pornire. */
  private trustedHosts = new Set<string>();

  onControl: (msg: ControlMsg) => boolean = () => false;
  onGameState: (state: GameState) => void = () => {};

  constructor(server: HttpServer) {
    this.attach(server, false);
  }

  /**
   * Intrarea de pe Wi-Fi-ul de acasă (WIFI=true): aici intră doar aplicația de telefon, ca ecran de joc.
   * Fără panou și fără comenzi: cine e în aceeași rețea nu poate schimba nimic.
   */
  attachLan(server: HttpServer): void {
    this.attach(server, true);
  }

  private attach(server: HttpServer, lan: boolean): void {
    const wss = new WebSocketServer({
      server,
      path: WS_PATH,
      verifyClient: ({ origin }: { origin?: string }) => {
        const ok = lan ? origin === APP_ORIGIN : !origin || this.originAllowed(origin);
        if (!ok) console.warn(`[hub] conexiune respinsă${lan ? ' pe Wi-Fi' : ''} de la ${origin ?? '(fără Origin)'}`);
        return ok;
      },
    });
    wss.on('connection', (ws) => {
      if (lan) this.lanSockets.add(ws);
      ws.on('message', (data) => {
        // Un mesaj greșit (ex. dintr-un panou vechi) nu are voie să oprească serverul în mijlocul live-ului.
        try {
          this.handle(ws, data.toString());
        } catch (err) {
          console.error('[hub] mesaj ignorat:', err instanceof Error ? err.message : err);
        }
      });
      ws.on('close', () => this.forget(ws));
      ws.on('error', () => this.forget(ws));
    });
  }

  /** Acceptă pagini deschise prin numele Tailscale al calculatorului (din `tailscale status`). */
  allowHost(host: string): void {
    this.trustedHosts.add(host.toLowerCase());
  }

  private originAllowed(origin: string): boolean {
    if (LOCAL_ORIGIN.test(origin)) return true;
    try {
      const url = new URL(origin);
      return url.protocol === 'https:' && this.trustedHosts.has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  private forget(ws: WebSocket): void {
    this.roles.delete(ws);
    if (this.screens.delete(ws)) this.publishScreens();
  }

  get screenList(): ScreenInfo[] {
    return [...this.screens.values()];
  }

  private publishScreens(): void {
    this.send(['panel'], { kind: 'screens', screens: this.screenList });
  }

  /** Mesaje trimise fiecărui client nou, după rol (ex. setările jocului, ale simulatorului). */
  setGreeting(fn: (role: Role) => WireMsg[]): void {
    this.greeting = fn;
  }

  broadcastEvent(event: LiveEvent): void {
    this.send(['game', 'panel'], { kind: 'event', event });
  }

  setStatus(status: SourceStatus): void {
    this.statuses.set(status.source, status);
    this.send(['game', 'panel'], { kind: 'status', status });
  }

  sendToPanels(msg: WireMsg): void {
    this.send(['panel'], msg);
  }

  sendToAll(msg: WireMsg): void {
    this.send(['game', 'panel'], msg);
  }

  get gameCount(): number {
    let n = 0;
    for (const r of this.roles.values()) if (r === 'game') n++;
    return n;
  }

  private handle(ws: WebSocket, raw: string): void {
    let msg: WireMsg;
    try {
      msg = JSON.parse(raw) as WireMsg;
    } catch {
      return;
    }
    switch (msg.kind) {
      case 'hello':
        if (this.lanSockets.has(ws) && msg.role !== 'game') {
          console.warn('[hub] pe Wi-Fi se intră doar ca ecran de joc; conexiune închisă.');
          ws.terminate();
          return;
        }
        this.roles.set(ws, msg.role);
        if (msg.role === 'game') {
          this.screens.set(ws, cleanScreen(msg.screen));
          this.publishScreens();
        }
        if (msg.role === 'panel') this.sendTo(ws, { kind: 'screens', screens: this.screenList });
        for (const status of this.statuses.values()) this.sendTo(ws, { kind: 'status', status });
        if (msg.role === 'panel' && this.lastState) this.sendTo(ws, { kind: 'state', state: this.lastState });
        for (const m of this.greeting(msg.role)) this.sendTo(ws, m);
        break;
      case 'control':
        // Doar panoul dă comenzi; un ecran de joc nu are de ce.
        if (this.roles.get(ws) !== 'panel') return;
        if (!this.onControl(msg.msg)) this.send(['game'], msg);
        break;
      case 'state': {
        // Starea vine doar de la un ecran de joc care s-a prezentat; o verificăm înainte s-o folosim.
        if (this.roles.get(ws) !== 'game') return;
        const state = cleanState(msg.state);
        this.lastState = state;
        this.onGameState(state);
        this.send(['panel'], { kind: 'state', state });
        break;
      }
    }
  }

  private send(to: Role[], msg: WireMsg): void {
    const data = JSON.stringify(msg);
    for (const [ws, role] of this.roles) {
      if (to.includes(role) && ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }

  private sendTo(ws: WebSocket, msg: WireMsg): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }
}

/** Datele vin de la client, deci le verificăm: tip cunoscut, texte scurte. */
function cleanScreen(raw: unknown): ScreenInfo {
  const r = (raw ?? {}) as Partial<Record<keyof ScreenInfo, unknown>>;
  const short = (v: unknown) => (typeof v === 'string' ? v.slice(0, 40) : '');
  return { platform: r.platform === 'android' ? 'android' : 'web', version: short(r.version), builtAt: short(r.builtAt) };
}

const PHASES: readonly GamePhase[] = ['sandbox', 'lobby', 'playing', 'results', 'vote'];

/** Starea jocului vine de la client: tipuri cunoscute, numere în limite, texte și liste scurte. */
function cleanState(raw: unknown): GameState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  const list = (v: unknown, max = 20) => (Array.isArray(v) ? v.slice(0, max) : []);
  const obj = (v: unknown) => (v ?? {}) as Record<string, unknown>;
  return {
    phase: PHASES.includes(r.phase as GamePhase) ? (r.phase as GamePhase) : 'sandbox',
    modeId: str(r.modeId, 40),
    modeName: str(r.modeName),
    phaseEndsInSec: r.phaseEndsInSec === null ? null : num(r.phaseEndsInSec, 0, 86_400),
    modes: list(r.modes).map((m) => ({ id: str(obj(m).id, 40), name: str(obj(m).name) })),
    voteOptions: list(r.voteOptions, 10).map((o) => ({
      modeId: str(obj(o).modeId, 40),
      name: str(obj(o).name),
      votes: num(obj(o).votes, 0, 1e9),
    })),
    voteGifts: list(r.voteGifts, 10).map((g) => str(g, 40)),
    modeCommandSamples: list(r.modeCommandSamples).map((c) => str(c, 40)),
    activePlayers: num(r.activePlayers, 0, 1e6),
    queued: num(r.queued, 0, 1e6),
    fps: num(r.fps, 0, 1000),
  };
}

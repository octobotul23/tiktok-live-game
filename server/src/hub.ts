import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { WS_PATH, type ControlMsg, type GameState, type LiveEvent, type SourceStatus, type WireMsg } from '../../shared/protocol';

type Role = 'game' | 'panel';

/**
 * Browserele nu aplică CORS la WebSocket, deci orice site deschis de streamer s-ar putea conecta
 * și trimite cadouri false sau comenzi. Acceptăm doar pagini servite de pe calculatorul local
 * (jocul, panoul, OBS) și clienții fără Origin (unelte din linia de comandă).
 */
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
  private greeting: (role: Role) => WireMsg[] = () => [];

  onControl: (msg: ControlMsg) => boolean = () => false;
  onGameState: (state: GameState) => void = () => {};

  constructor(server: HttpServer) {
    const wss = new WebSocketServer({
      server,
      path: WS_PATH,
      verifyClient: ({ origin }: { origin?: string }) => {
        if (!origin || LOCAL_ORIGIN.test(origin)) return true;
        console.warn(`[hub] conexiune respinsă de la ${origin}`);
        return false;
      },
    });
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        // Un mesaj greșit (ex. dintr-un panou vechi) nu are voie să oprească serverul în mijlocul live-ului.
        try {
          this.handle(ws, data.toString());
        } catch (err) {
          console.error('[hub] mesaj ignorat:', err instanceof Error ? err.message : err);
        }
      });
      ws.on('close', () => this.roles.delete(ws));
      ws.on('error', () => this.roles.delete(ws));
    });
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
        this.roles.set(ws, msg.role);
        for (const status of this.statuses.values()) this.sendTo(ws, { kind: 'status', status });
        if (msg.role === 'panel' && this.lastState) this.sendTo(ws, { kind: 'state', state: this.lastState });
        for (const m of this.greeting(msg.role)) this.sendTo(ws, m);
        break;
      case 'control':
        if (!this.onControl(msg.msg)) this.send(['game'], msg);
        break;
      case 'state':
        this.lastState = msg.state;
        this.onGameState(msg.state);
        this.send(['panel'], msg);
        break;
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

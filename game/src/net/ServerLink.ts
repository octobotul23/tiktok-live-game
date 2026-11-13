import type { ScreenInfo, WireMsg } from '../../../shared/protocol';
import { ADDRESS_CHANGED, currentWsUrl, IS_APP, LINK_STATE } from './serverAddress';

/** Ce fel de ecran suntem, ca panoul să arate „telefon Android v0.0.3” sau „browser”. */
const SCREEN: ScreenInfo = { platform: IS_APP ? 'android' : 'web', version: __APP_VERSION__, builtAt: __BUILT_AT__ };

/**
 * Conexiunea WebSocket la server, cu reconectare automată (backoff până la 5s).
 * În browser (joc în OBS, panou) serverul e pe același origin, prin proxy-ul Vite.
 * În aplicația de telefon, adresa e cea aleasă pe ecranul de conectare.
 */
export class ServerLink {
  private ws: WebSocket | null = null;
  private retryMs = 500;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  connected = false;

  constructor(
    private role: 'game' | 'panel',
    private onMessage: (msg: WireMsg) => void,
    private onConnection: (connected: boolean) => void = () => {},
  ) {
    // Adresă nouă: renunțăm la încercarea curentă și ne conectăm imediat acolo.
    window.addEventListener(ADDRESS_CHANGED, () => {
      this.retryMs = 500;
      const ws = this.ws;
      this.ws = null;
      ws?.close();
      this.setConnected(false);
      this.connect();
    });
  }

  connect(): void {
    clearTimeout(this.retryTimer);
    const url = currentWsUrl();
    if (!url) {
      // Aplicația fără adresă încă: verificăm din nou după ce o alege streamerul (ADDRESS_CHANGED).
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retryMs = 500;
      this.send({ kind: 'hello', role: this.role, ...(this.role === 'game' ? { screen: SCREEN } : {}) });
      this.setConnected(true);
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      try {
        this.onMessage(JSON.parse(ev.data as string) as WireMsg);
      } catch (err) {
        console.error('[link] mesaj invalid', err);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return; // o conexiune înlocuită de o adresă nouă
      this.ws = null;
      this.setConnected(false);
      this.scheduleRetry();
    };
    ws.onerror = () => ws.close();
  }

  send(msg: WireMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private scheduleRetry(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 5000);
  }

  private setConnected(ok: boolean): void {
    if (this.connected === ok) return;
    this.connected = ok;
    this.onConnection(ok);
    window.dispatchEvent(new CustomEvent(LINK_STATE, { detail: ok }));
  }
}

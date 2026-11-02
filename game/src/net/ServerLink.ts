import { WS_PATH, type WireMsg } from '../../../shared/protocol';

/**
 * Conexiunea WebSocket la server, cu reconectare automată (backoff până la 5s).
 * Folosită de pagina de joc și de panou; URL-ul e pe același origin, prin proxy-ul Vite.
 */
export class ServerLink {
  private ws: WebSocket | null = null;
  private retryMs = 500;
  connected = false;

  constructor(
    private role: 'game' | 'panel',
    private onMessage: (msg: WireMsg) => void,
    private onConnection: (connected: boolean) => void = () => {},
  ) {}

  connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}${WS_PATH}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retryMs = 500;
      this.connected = true;
      this.send({ kind: 'hello', role: this.role });
      this.onConnection(true);
    };
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data as string) as WireMsg);
      } catch (err) {
        console.error('[link] mesaj invalid', err);
      }
    };
    ws.onclose = () => {
      if (this.connected) this.onConnection(false);
      this.connected = false;
      setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 5000);
    };
    ws.onerror = () => ws.close();
  }

  send(msg: WireMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}

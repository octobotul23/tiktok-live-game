import http from 'node:http';
import type { Hub } from './hub';

/**
 * Intrarea pentru Wi-Fi-ul de acasă (WIFI=true): un mic server pe IP-ul de acasă al calculatorului
 * (ex. 192.168.1.13:5180) care răspunde DOAR la WebSocket-ul jocului (/ws).
 *
 * Telefonul n-are nevoie de altceva: jocul e în APK. Panoul, fișierele jocului și serverul Vite
 * rămân doar pe calculator (127.0.0.1), iar pe Wi-Fi conexiunile pot fi doar ecran de joc (vezi Hub.attachLan).
 */
export function openWifiEntry(hub: Hub, addresses: string[], port: number): void {
  for (const ip of addresses) {
    const server = http.createServer((_req, res) => {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Aici se conectează doar aplicația de telefon.\n');
    });
    hub.attachLan(server);
    server.on('error', (err) => {
      console.warn(`[wifi] nu pot deschide ${ip}:${port} (${err.message}); telefonul poate intra prin Tailscale.`);
    });
    server.listen(port, ip, () => console.log(`[wifi] aplicația de telefon poate intra pe ${ip}:${port}`));
  }
}

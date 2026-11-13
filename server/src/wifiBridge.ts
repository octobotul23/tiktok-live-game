import net from 'node:net';

/**
 * Puntea pentru Wi-Fi-ul de acasă: ascultă DOAR pe IP-ul calculatorului din rețeaua locală
 * (ex. 192.168.1.13:5180) și trimite tot traficul la jocul de pe 127.0.0.1:5180 (Vite).
 *
 * De ce nu `vite --host 0.0.0.0`: asta ar deschide jocul și panoul pe toate plăcile de rețea,
 * inclusiv VPN-uri de gaming (ex. Radmin) sau mașini virtuale, unde pot fi și alți oameni.
 * Socket-uri pe același port dar pe adrese diferite merg în paralel (la fel face `tailscale serve`).
 */
export function openWifiBridge(addresses: string[], port: number): void {
  for (const ip of addresses) {
    const bridge = net.createServer((phone) => {
      const game = net.connect(port, '127.0.0.1');
      phone.pipe(game).pipe(phone);
      const close = () => {
        phone.destroy();
        game.destroy();
      };
      phone.on('error', close);
      game.on('error', close);
      phone.on('close', close);
      game.on('close', close);
    });
    bridge.on('error', (err) => {
      console.warn(`[wifi] nu pot deschide ${ip}:${port} (${err.message}); telefonul poate intra prin Tailscale.`);
    });
    bridge.listen(port, ip, () => console.log(`[wifi] telefonul poate intra pe ${ip}:${port}`));
  }
}

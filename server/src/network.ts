import os from 'node:os';

/** Plăci de rețea virtuale (mașini virtuale, WSL, Docker, VPN): IP-urile lor nu sunt în Wi-Fi-ul de acasă. */
const VIRTUAL = /vethernet|virtualbox|vmware|wsl|hyper-v|docker|loopback|tailscale|vpn|zerotier|utun|bridge/i;

/** IP-uri private (RFC 1918) folosite în rețelele de acasă. */
const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

/**
 * IP-urile calculatorului în rețeaua locală (Wi-Fi sau cablu), cele de forma 192.168.x.x primele.
 * Le arată panoul, ca streamerul să știe ce să scrie în aplicația de telefon.
 */
export function homeAddresses(): string[] {
  const found: string[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && isPrivate(a.address)) found.push(a.address);
    }
  }
  return found.sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')));
}

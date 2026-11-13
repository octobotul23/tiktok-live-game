import os from 'node:os';

/** Plăci de rețea virtuale (mașini virtuale, WSL, Docker, VPN): IP-urile lor nu sunt în Wi-Fi-ul de acasă. */
const VIRTUAL = /vethernet|virtualbox|vmware|wsl|hyper-v|docker|loopback|tailscale|vpn|zerotier|utun|bridge/i;

/** Rețelele obișnuite de acasă. 172.16–31.x.x lipsește intenționat: acolo stau de obicei mașinile virtuale. */
const isHomeRange = (ip: string) => /^(10\.|192\.168\.)/.test(ip);

/** Toate IPv4-urile calculatorului, cu numele plăcii de rețea. */
function localIpv4(): { name: string; address: string }[] {
  const out: { name: string; address: string }[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
  }
  return out;
}

/**
 * IP-urile calculatorului în rețeaua de acasă, pe care se deschide intrarea pentru telefon.
 * - WIFI_IP=192.168.1.13 în .env fixează adresa (trebuie să fie chiar a calculatorului);
 * - altfel le găsim singuri: 192.168.x.x / 10.x.x.x, fără plăcile virtuale (VPN, mașini virtuale), 192.168 primele.
 */
export function homeAddresses(fixed = (process.env.WIFI_IP ?? '').trim()): string[] {
  const all = localIpv4();
  if (fixed) {
    if (all.some((a) => a.address === fixed)) return [fixed];
    console.warn(`[wifi] WIFI_IP=${fixed} nu e o adresă a acestui calculator; o caut singur.`);
  }
  return all
    .filter((a) => !VIRTUAL.test(a.name) && isHomeRange(a.address))
    .map((a) => a.address)
    .sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')));
}

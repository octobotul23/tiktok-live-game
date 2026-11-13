import { WS_PATH } from '../../../shared/protocol';

/** În aplicația de telefon jocul e în APK, deci serverul nu mai e „pe același origin” ca în browser. */
export const IS_APP = import.meta.env.MODE === 'app';

/** Portul pe care `tailscale serve --https=5180` publică jocul; folosit când adresa nu are port. */
export const DEFAULT_PORT = 5180;

const STORAGE_KEY = 'serverAddress';

/**
 * Adresa scrisă de streamer → URL-ul WebSocket. Acceptă:
 * - numele Tailscale: `pc.tailnet.ts.net` sau `pc.tailnet.ts.net:5180` → wss:// (Tailscale dă certificat HTTPS);
 * - un IP: `100.112.20.61:5180` → ws:// (un certificat HTTPS nu poate fi pe un IP);
 * - un link copiat din browser: `https://…` → wss://, `http://…` → ws://; `ws://` / `wss://` rămân cum sunt.
 * Fără port se folosește 5180; fără cale, /ws. Întoarce null dacă nu arată a adresă.
 */
export function toWsUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  let scheme: 'ws' | 'wss' | '' = '';
  const m = /^(wss?|https?):\/\//i.exec(s);
  if (m) {
    const p = m[1].toLowerCase();
    scheme = p === 'https' || p === 'wss' ? 'wss' : 'ws';
    s = s.slice(m[0].length);
  }
  let url: URL;
  try {
    url = new URL(`http://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (!host || url.username || url.password) return null;
  if (!/^(\[[0-9a-f:]+\]|[a-z0-9.-]+)$/i.test(host)) return null;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
  if (!isIp && !host.includes('.') && host !== 'localhost') return null;
  if (!scheme) scheme = isIp || host === 'localhost' ? 'ws' : 'wss';
  const port = url.port || String(DEFAULT_PORT);
  const path = url.pathname === '/' ? WS_PATH : url.pathname;
  return `${scheme}://${host}:${port}${path}`;
}

/**
 * Ce adrese acceptă aplicația:
 * - wss:// (numele Tailscale): criptat, merge de oriunde;
 * - ws:// doar spre localhost sau spre un IP din rețeaua de acasă (192.168.x.x, 10.x.x.x, 172.16–31.x.x).
 *   Necriptat, dar traficul nu iese din Wi-Fi-ul tău. Un IP public prin ws:// ar trece necriptat prin internet, deci nu.
 */
export function isAllowedInApp(wsUrl: string): boolean {
  if (wsUrl.startsWith('wss://')) return true;
  const m = /^ws:\/\/([^/:]+|\[[^\]]+\])[:/]/i.exec(wsUrl);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || isHomeIp(host);
}

/** IP din rețeaua locală (adresele private din RFC 1918). */
export function isHomeIp(host: string): boolean {
  const p = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!p) return false;
  const [a, b] = [Number(p[1]), Number(p[2])];
  if (p.slice(1).some((n) => Number(n) > 255)) return false;
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** Adresa salvată pe telefon (în aplicație), sau '' dacă nu a fost aleasă încă. */
export function savedAddress(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveAddress(address: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, address.trim());
  } catch {
    // Fără stocare, adresa ține doar până la închiderea aplicației.
  }
  window.dispatchEvent(new Event(ADDRESS_CHANGED));
}

/** Evenimente pe `window`, ca ecranul de conectare și legătura cu serverul să nu depindă unul de altul. */
export const ADDRESS_CHANGED = 'server-address-changed';
export const LINK_STATE = 'server-link-state';

/** URL-ul WebSocket de folosit acum, sau null (în aplicație, până alege streamerul adresa). */
export function currentWsUrl(): string | null {
  if (IS_APP) {
    const url = toWsUrl(savedAddress());
    return url && isAllowedInApp(url) ? url : null;
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${WS_PATH}`;
}

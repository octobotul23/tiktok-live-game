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
 * În aplicație cerem conexiune criptată (wss://), ca nimeni din rețea să nu poată citi sau schimba
 * ce trimite panoul. Excepție: localhost, care nu iese din dispozitiv. Un IP nu poate avea wss
 * (certificatul Tailscale e pe nume), deci în aplicație se scrie numele, nu IP-ul.
 */
export function isSecureEnough(wsUrl: string): boolean {
  return wsUrl.startsWith('wss://') || /^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(wsUrl);
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
    return url && isSecureEnough(url) ? url : null;
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${WS_PATH}`;
}

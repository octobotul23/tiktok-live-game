import { describe, expect, it } from 'vitest';
import { toWsUrl } from './serverAddress';

describe('toWsUrl (adresa calculatorului din aplicația de telefon)', () => {
  it('numele Tailscale → wss, cu portul 5180 implicit', () => {
    expect(toWsUrl('x237.tail36214d.ts.net')).toBe('wss://x237.tail36214d.ts.net:5180/ws');
    expect(toWsUrl('  x237.tail36214d.ts.net:5180 ')).toBe('wss://x237.tail36214d.ts.net:5180/ws');
  });

  it('linkul copiat din browser, cu sau fără cale', () => {
    expect(toWsUrl('https://x237.tail36214d.ts.net:5180/')).toBe('wss://x237.tail36214d.ts.net:5180/ws');
    expect(toWsUrl('https://mac.tail36214d.ts.net:443')).toBe('wss://mac.tail36214d.ts.net:443/ws');
    expect(toWsUrl('http://192.168.1.20:5180')).toBe('ws://192.168.1.20:5180/ws');
  });

  it('IP simplu → ws (un IP nu are certificat HTTPS)', () => {
    expect(toWsUrl('100.112.20.61')).toBe('ws://100.112.20.61:5180/ws');
    expect(toWsUrl('100.112.20.61:8790')).toBe('ws://100.112.20.61:8790/ws');
  });

  it('ws:// și wss:// rămân cum sunt', () => {
    expect(toWsUrl('wss://pc.example.ts.net:5180/ws')).toBe('wss://pc.example.ts.net:5180/ws');
    expect(toWsUrl('ws://localhost:8790/ws')).toBe('ws://localhost:8790/ws');
  });

  it('respinge ce nu e o adresă', () => {
    expect(toWsUrl('')).toBeNull();
    expect(toWsUrl('   ')).toBeNull();
    expect(toWsUrl('calculatorul meu')).toBeNull();
    expect(toWsUrl('pc')).toBeNull();
    expect(toWsUrl('user:parola@pc.ts.net')).toBeNull();
  });
});

import { execFile } from 'node:child_process';

/** Unde poate fi comanda `tailscale`: în PATH (Windows, Linux, Mac cu CLI instalat) sau în aplicația de Mac. */
const CANDIDATES = ['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'];

/**
 * Numele MagicDNS al calculatorului ăstuia în rețeaua Tailscale (ex. „pc.tailnet.ts.net”), ca panoul să arate
 * adresa exactă de scris în aplicația de telefon. Merge la fel pe Windows și pe Mac; null dacă Tailscale lipsește sau e oprit.
 */
export async function tailscaleDnsName(): Promise<string | null> {
  for (const cmd of CANDIDATES) {
    const out = await run(cmd, ['status', '--json']);
    if (out === null) continue;
    try {
      const status = JSON.parse(out) as { BackendState?: string; Self?: { DNSName?: string } };
      const name = (status.Self?.DNSName ?? '').replace(/\.$/, '');
      return status.BackendState === 'Running' && name ? name : null;
    } catch {
      return null;
    }
  }
  return null;
}

function run(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000, windowsHide: true }, (err, stdout) => resolve(err ? null : stdout));
  });
}

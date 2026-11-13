import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

// Versiunea are un singur loc: package.json din rădăcină (scripts/build-apk.mjs o crește la fiecare APK).
const rootPkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => {
  // .env stă în rădăcina proiectului, comun cu serverul.
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const serverPort = Number(env.SERVER_PORT || 8790);
  // --mode app = jocul pentru APK: doar pagina de joc (fără panou), în dist-app/, de unde îl ia Capacitor.
  const isApp = mode === 'app';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(rootPkg.version),
      __BUILT_AT__: JSON.stringify(new Date().toISOString()),
    },
    server: {
      port: Number(env.GAME_PORT || 5180),
      // Dacă portul e ocupat (ex. de alt proiect), oprește-te cu eroare în loc să alegi alt port pe ascuns.
      strictPort: true,
      // Implicit doar pe calculatorul ăsta, pe IPv4: pe Windows „localhost” ar asculta doar pe ::1,
      // iar proxy-urile (ex. `tailscale serve` → 127.0.0.1) n-ar mai găsi jocul. GAME_HOST=0.0.0.0 îl deschide în rețea.
      host: env.GAME_HOST || '127.0.0.1',
      // Numele MagicDNS de Tailscale (ex. pc.tailnet.ts.net); accesul prin IP merge oricum.
      allowedHosts: ['.ts.net'],
      // Jocul și panoul vorbesc cu serverul prin același origin (/ws), deci în OBS e nevoie de un singur URL.
      proxy: { '/ws': { target: `ws://127.0.0.1:${serverPort}`, ws: true } },
    },
    build: {
      outDir: isApp ? 'dist-app' : 'dist',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          ...(isApp ? {} : { panel: path.resolve(__dirname, 'panel.html') }),
        } as Record<string, string>,
      },
    },
  };
});

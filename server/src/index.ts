import http from 'node:http';
import path from 'node:path';
import type { GameSettings, ServerInfo } from '../../shared/protocol';
import { clampMaxActive, clampNewcomerSec, SERVER_CONFIG } from './config';
import { Hub } from './hub';
import { cleanSimPatch, simDefaults, type SimSettings } from '../../shared/sim';
import { Simulator } from './sim/Simulator';
import { debouncedSaver, loadJson } from './store';
import { homeAddresses } from './network';
import { openWifiEntry } from './wifiEntry';
import { tailscaleDnsName } from './tailscale';
import { cleanUsername, TikTokConnector } from './tiktok/Connector';
import { GiftStreakCollapser } from './tiktok/normalize';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('TikTok game server OK. Jocul: http://localhost:5180  Panou: http://localhost:5180/panel.html\n');
});

const hub = new Hub(server);
const emit = hub.broadcastEvent.bind(hub);
const simGifts = new GiftStreakCollapser(emit, SERVER_CONFIG.giftStreakTimeoutMs);

const SIM_FILE = path.join(SERVER_CONFIG.dataDir, 'sim.json');
const sim = new Simulator(
  // Valorile implicite, peste ele cele salvate din panou; „pornit” vine mereu din .env (SIMULATE).
  { ...simDefaults(SERVER_CONFIG.simulate), ...cleanSimPatch(loadJson(SIM_FILE)), enabled: SERVER_CONFIG.simulate },
  emit,
  simGifts,
);

/** Setările boților se salvează pe disc (fără „pornit”), ca să rămână după o repornire. */
const saveSim = debouncedSaver(SIM_FILE, () => {
  const { enabled: _enabled, ...rest }: SimSettings = sim.settings;
  return rest;
});

const publishSim = () => {
  hub.sendToPanels({ kind: 'sim', settings: sim.settings });
  hub.setStatus({ source: 'sim', connected: sim.settings.enabled });
};

// TikTok LIVE real: are seria lui de cadouri, ca o serie reală și una din simulator să nu se amestece.
const tiktok = new TikTokConnector({
  emit,
  gifts: new GiftStreakCollapser(emit, SERVER_CONFIG.giftStreakTimeoutMs),
  logDir: SERVER_CONFIG.logDir,
  signApiKey: SERVER_CONFIG.tiktokSignApiKey,
  onStatus: (status) => {
    hub.sendToPanels({ kind: 'tiktok', status });
    hub.setStatus({ source: 'tiktok', connected: status.state === 'live' });
    // Când vin spectatori reali, spectatorii falși se opresc (butoanele de test din panou merg în continuare).
    if (status.state === 'live' && sim.settings.enabled) {
      sim.update({ enabled: false });
      publishSim();
    }
  },
});

// Setările jocului stau aici, nu în pagina de joc: un refresh în OBS nu le pierde.
const settings: GameSettings = { ...SERVER_CONFIG.game };

const serverInfo: ServerInfo = {
  phoneAddress: null,
  wifiAddresses: SERVER_CONFIG.wifi ? homeAddresses().map((ip) => `${ip}:${SERVER_CONFIG.gamePort}`) : [],
  version: SERVER_CONFIG.version,
  startedAt: new Date().toISOString(),
};
if (SERVER_CONFIG.wifi) {
  const ips = homeAddresses();
  if (ips.length) openWifiEntry(hub, ips, SERVER_CONFIG.gamePort);
  else console.warn('[wifi] WIFI=true, dar nu găsesc calculatorul într-o rețea de acasă (192.168.x.x / 10.x.x.x). Pune IP-ul în WIFI_IP.');
}
// Numele Tailscale al calculatorului: panoul îl arată ca adresă pentru aplicația de telefon.
void tailscaleDnsName().then((name) => {
  if (name) hub.allowHost(name);
  serverInfo.phoneAddress = name ? `${name}:${SERVER_CONFIG.gamePort}` : null;
  hub.sendToPanels({ kind: 'serverInfo', info: serverInfo });
  console.log(`[server] adresa pentru telefon: ${serverInfo.phoneAddress ?? '(Tailscale nu e pornit)'}`);
});

hub.setGreeting((role) => [
  { kind: 'settings', settings },
  ...(role === 'panel'
    ? [
        { kind: 'sim', settings: sim.settings } as const,
        { kind: 'tiktok', status: tiktok.current } as const,
        { kind: 'serverInfo', info: serverInfo } as const,
      ]
    : []),
]);
hub.onGameState = (state) => sim.setGameState(state);
hub.onControl = (msg) => {
  switch (msg.type) {
    case 'sim:set':
      sim.update(msg.settings);
      publishSim();
      saveSim();
      return true;
    case 'sim:gift':
      sim.sendGift(msg.giftName, msg.count);
      return true;
    case 'sim:chat':
      sim.sendChat(msg.nickname, msg.text, msg.isFollower);
      return true;
    case 'sim:follow':
      sim.sendFollow(msg.nickname);
      return true;
    case 'tiktok:connect': {
      const username = cleanUsername(msg.username);
      if (username) tiktok.start(username);
      else hub.sendToPanels({ kind: 'tiktok', status: { username: msg.username, state: 'error', error: 'bad-username' } });
      return true;
    }
    case 'tiktok:disconnect':
      tiktok.stop();
      return true;
    case 'settings:set':
      if (msg.settings.lang === 'ro' || msg.settings.lang === 'en') settings.lang = msg.settings.lang;
      if (typeof msg.settings.followersOnly === 'boolean') settings.followersOnly = msg.settings.followersOnly;
      if (typeof msg.settings.giftersBypass === 'boolean') settings.giftersBypass = msg.settings.giftersBypass;
      if (typeof msg.settings.maxActive === 'number' && Number.isFinite(msg.settings.maxActive)) {
        settings.maxActive = clampMaxActive(msg.settings.maxActive);
      }
      if (typeof msg.settings.newcomerSec === 'number' && Number.isFinite(msg.settings.newcomerSec)) {
        settings.newcomerSec = clampNewcomerSec(msg.settings.newcomerSec);
      }
      hub.sendToAll({ kind: 'settings', settings });
      return true;
    default:
      return false; // comenzile streamerului merg mai departe, la joc
  }
};

sim.start();
hub.setStatus({ source: 'sim', connected: sim.settings.enabled });

if (SERVER_CONFIG.tiktokAutoConnect) tiktok.start(SERVER_CONFIG.tiktokUsername);
else hub.setStatus({ source: 'tiktok', connected: false });

// Doar pe calculatorul local: jocul și panoul vin prin proxy-ul Vite, nu direct din rețea.
server.listen(SERVER_CONFIG.port, '127.0.0.1', () => {
  console.log(`[server] WebSocket pe ws://localhost:${SERVER_CONFIG.port}/ws  (simulator: ${sim.settings.enabled ? 'pornit' : 'oprit'})`);
});

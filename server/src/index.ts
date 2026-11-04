import http from 'node:http';
import type { GameSettings } from '../../shared/protocol';
import { SERVER_CONFIG } from './config';
import { Hub } from './hub';
import { Simulator } from './sim/Simulator';
import { GiftStreakCollapser } from './tiktok/normalize';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('TikTok game server OK. Jocul: http://localhost:5180  Panou: http://localhost:5180/panel.html\n');
});

const hub = new Hub(server);
const emit = hub.broadcastEvent.bind(hub);
const simGifts = new GiftStreakCollapser(emit, SERVER_CONFIG.giftStreakTimeoutMs);

const sim = new Simulator(
  { enabled: SERVER_CONFIG.simulate, viewers: 40, commentsPerSec: 10, likesPerSec: 4, giftsPerMin: 3, followerPct: 70, followsPerMin: 4 },
  emit,
  simGifts,
);

const publishSim = () => {
  hub.sendToPanels({ kind: 'sim', settings: sim.settings });
  hub.setStatus({ source: 'sim', connected: sim.settings.enabled });
};

// Setările jocului stau aici, nu în pagina de joc: un refresh în OBS nu le pierde.
const settings: GameSettings = { ...SERVER_CONFIG.game };

hub.setGreeting((role) => [
  { kind: 'settings', settings },
  ...(role === 'panel' ? [{ kind: 'sim', settings: sim.settings } as const] : []),
]);
hub.onGameState = (state) => sim.setGameState(state);
hub.onControl = (msg) => {
  switch (msg.type) {
    case 'sim:set':
      sim.update(msg.settings);
      publishSim();
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
    case 'settings:set':
      if (msg.settings.lang === 'ro' || msg.settings.lang === 'en') settings.lang = msg.settings.lang;
      if (typeof msg.settings.followersOnly === 'boolean') settings.followersOnly = msg.settings.followersOnly;
      if (typeof msg.settings.giftersBypass === 'boolean') settings.giftersBypass = msg.settings.giftersBypass;
      hub.sendToAll({ kind: 'settings', settings });
      return true;
    default:
      return false; // comenzile streamerului merg mai departe, la joc
  }
};

sim.start();
hub.setStatus({ source: 'sim', connected: sim.settings.enabled });

if (!SERVER_CONFIG.simulate) {
  // Conectarea la TikTok LIVE real vine în Milestone 5.
  console.warn(`[server] SIMULATE=false pentru @${SERVER_CONFIG.tiktokUsername}, dar conectorul TikTok nu e încă implementat (M5).`);
}

// Doar pe calculatorul local: jocul și panoul vin prin proxy-ul Vite, nu direct din rețea.
server.listen(SERVER_CONFIG.port, '127.0.0.1', () => {
  console.log(`[server] WebSocket pe ws://localhost:${SERVER_CONFIG.port}/ws  (simulator: ${sim.settings.enabled ? 'pornit' : 'oprit'})`);
});

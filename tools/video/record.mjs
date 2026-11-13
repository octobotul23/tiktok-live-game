// Înregistrează videoclipuri de gameplay „ca pe un LIVE”: jocul rulează în Chrome fără fereastră,
// comentariile și cadourile din scenarii intră direct în joc, iar fiecare cadru se fotografiază și
// merge în ffmpeg. Timpul jocului avansează doar când îi spunem noi, deci videoclipul e fluid
// (30 de cadre pe secundă) indiferent cât de repede e calculatorul.
//
// Folosire (cu `npm run dev` pornit):
//   node tools/video/record.mjs                 → toate scenariile
//   node tools/video/record.mjs survival        → doar unul (vezi scenarios.mjs)
//   node tools/video/record.mjs survival-en vote-pvp-en   → variantele în engleză
// Opțiuni: --base=http://localhost:5180  --out=videos  --fps=30
// Nu se conectează la server: evenimentele merg doar în pagina înregistrată, nu și în jocul tău deschis.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GIFT_CATALOG } from '../../shared/gifts.ts';
import { launch } from './cdp.mjs';
import { FEATURED_ID, SCENARIOS, makeRng } from './scenarios.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')),
);
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const BASE = args.base ?? 'http://localhost:5180';
const OUT = path.resolve(root, args.out ?? 'videos');
const FPS = Number(args.fps ?? 30);
const W = 1080;
const H = 1920;

const ICONS = {
  Rose: '🌹', TikTok: '🎵', GG: '🎮', 'Ice Cream Cone': '🍦', 'Finger Heart': '🫰', Doughnut: '🍩',
  'Hand Hearts': '🫶', 'Hat and Mustache': '🎩', Corgi: '🐶', Galaxy: '🌌', Lion: '🦁',
};
const VOTE_GIFT_BY_OPTION = { 1: 'Rose', 2: 'TikTok', 3: 'Finger Heart' };
const HOST = { name: 'Live Game', color: 'linear-gradient(135deg,#ff3b6b,#7b5cff)' };

/** Rulează în pagină: primește acțiunile scadente, avansează jocul un cadru, desenează stratul LIVE. */
const PAGE_HELPER = (gifts, icons, voteGifts, featuredId, lang) => `
window.__rec = (() => {
  const STEP = 1000 / 60;
  let t = 0;
  // Jocul stă pe loc până îi dăm cadre: pornim scenele pas cu pas, apoi runda începe de la zero.
  for (let i = 0; i < 900 && !game.scene.getScene('game')?.director; i++) {
    t += STEP;
    game.step(t, STEP);
  }
  const scene = game.scene.getScene('game');
  game.loop.stop();
  scene.debug.setVisible(false);
  // Limba jocului (titluri, comenzi afișate, rezultate), ca din panou.
  scene.onWire({ kind: 'settings', settings: { ...scene.settings, lang: ${JSON.stringify(lang)} } });
  const GIFTS = ${JSON.stringify(gifts)};
  const ICONS = ${JSON.stringify(icons)};
  const VOTE_GIFT = ${JSON.stringify(voteGifts)};
  const FEATURED = ${JSON.stringify(featuredId)};
  let pending = null;
  const typeQueue = []; // mesajele persoanei urmărite, scrise unul după altul
  let lastSent = -1;
  const faces = [];

  const color = (u) => {
    const p = scene.players.get(u.userId);
    return p ? '#' + p.color.toString(16).padStart(6, '0') : '#7a7f9a';
  };
  const ev = (e) => scene.onWire({ kind: 'event', event: { ...e, ts: 0 } });
  const option = (want, r) => {
    const opts = scene.votes.options;
    const i = Math.max(0, opts.indexOf('pvp'));
    if (want === 'pvp') return i;
    const others = opts.map((_, k) => k).filter((k) => k !== i);
    return others[Math.floor(r * others.length)] ?? 0;
  };
  const chat = (user, text) => {
    ev({ type: 'chat', user, text });
    __live.chat(user.nickname, color(user), text, user.userId === FEATURED);
  };
  const gift = (user, name, count) => {
    const g = GIFTS[name];
    ev({ type: 'gift', user, giftId: g.id, giftName: name, count, diamonds: g.diamonds });
    __live.gift(user.nickname, color(user), name, ICONS[name] ?? '🎁', count);
    if (!faces.some((f) => f.name === user.nickname)) faces.unshift({ name: user.nickname, color: color(user) });
  };

  function apply(a) {
    switch (a.type) {
      case 'chat': return chat(a.user, a.text);
      case 'like':
        ev({ type: 'like', user: a.user, count: a.count });
        return __live.like(a.count);
      case 'gift': return gift(a.user, a.gift, a.count);
      case 'vote': return chat(a.user, String(option(a.want, a.r) + 1));
      case 'voteGift': return gift(a.user, VOTE_GIFT[option(a.want, a.r) + 1], a.count);
      case 'typed': return typeQueue.push(a);
      case 'control': return scene.streamer({ action: a.action });
      case 'viewers': return __live.setViewers(a.n, faces);
    }
  }

  return {
    frame(actions, vt, steps) {
      for (const a of actions) apply(a);
      if (pending && vt >= pending.sendAt) {
        __live.sent();
        chat(pending.user, pending.text);
        pending = null;
        lastSent = vt;
      }
      // Următorul mesaj începe abia după ce tastatura s-a închis de la cel dinainte.
      if (!pending && typeQueue.length && vt >= lastSent + 0.45) {
        const a = typeQueue.shift();
        const text = a.text.replace('{pvp}', () => String(option('pvp', 0) + 1));
        pending = { user: a.user, text, sendAt: vt + __live.type(text) };
      }
      for (let i = 0; i < steps; i++) {
        t += STEP;
        game.step(t, STEP);
      }
      __live.setViewers(Number.NaN, faces);
      // Eticheta „TU” deasupra caracterului persoanei urmărite, ca să știi care ești pe ecran.
      const me = scene.players.get(FEATURED);
      const e = me?.entity;
      if (e && e.state !== 'despawning' && e.visible !== false) {
        const r = game.canvas.getBoundingClientRect();
        const k = r.width / game.scale.width;
        __live.marker(r.left + e.x * k, r.top + (e.y - 22 * e.scale - 34) * k, me.nickname);
      } else __live.marker(null);
      __live.tick(vt);
      return { phase: scene.director.phase, timeLeft: scene.director.timeLeft };
    },
  };
})();
'ok'`;

async function record(name) {
  const sc = SCENARIOS[name]();
  const gifts = Object.fromEntries(GIFT_CATALOG.map((g) => [g.name, { id: g.id, diamonds: g.diamonds }]));
  const rnd = makeRng(99);
  const file = path.join(OUT, `${sc.name}.mp4`);
  console.log(`\n▶ ${sc.name}: ${sc.title}`);

  const b = await launch({ width: W, height: H });
  try {
    await b.send('Page.enable');
    await b.send('Runtime.enable');
    await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    // Fără server: pagina înregistrată nu se conectează la jocul tău (nu primește boții, nu trimite stări).
    await b.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} addEventListener() {} removeEventListener() {} };`,
    });
    await b.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(path.join(here, 'overlay.js'), 'utf8') });
    await b.send('Page.navigate', { url: BASE + sc.url });

    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) {
      await new Promise((r) => setTimeout(r, 200));
      ready = await b.evaluate(`!!window.game?.isRunning`).catch(() => false);
    }
    if (!ready) throw new Error(`Jocul nu s-a încărcat la ${BASE}. E pornit „npm run dev”?`);
    // Fonturile (inclusiv emoji) trebuie încărcate înainte de primul cadru.
    await b.evaluate(`document.fonts.ready.then(() => 'ok')`);
    await b.evaluate(PAGE_HELPER(gifts, ICONS, VOTE_GIFT_BY_OPTION, FEATURED_ID, sc.lang));
    await b.evaluate(`__live.init(${JSON.stringify(HOST)}, ${JSON.stringify(sc.lang)}); 'ok'`);

    const ff = spawn(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-vf', 'fade=t=in:st=0:d=0.35',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-movflags', '+faststart', file,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const ffDone = new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg a ieșit cu ${code}`)))));
    const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

    const dt = 1 / FPS;
    const steps = Math.round(60 / FPS);
    let vt = 0;
    let queue = [];
    const schedule = (actions, offset, seg) => {
      for (const a of actions) queue.push({ ...a, vt: offset + a.at, seg, r: rnd() });
      queue.sort((x, y) => x.vt - y.vt);
    };

    // Pregătire: câțiva oameni sunt deja în joc când începe filmarea.
    schedule(sc.prepare.actions, 0, -1);
    let segIdx = -1;
    let segStart = 0;
    let phase = '';
    let capturing = false;
    let frames = 0;
    const started = Date.now();

    for (let guard = 0; guard < FPS * 600; guard++) {
      const due = [];
      while (queue.length && queue[0].vt <= vt) due.push(queue.shift());
      const res = await b.evaluate(`__rec.frame(${JSON.stringify(due)}, ${vt}, ${steps})`);

      const inPrepare = vt < sc.prepare.seconds;
      const next = sc.segments[segIdx + 1];
      if (!inPrepare && next && res.phase === next.phase && (segIdx < 0 || res.phase !== phase)) {
        segIdx++;
        segStart = vt;
        // Ce n-a apucat să se întâmple în faza trecută nu mai are sens în cea nouă.
        queue = queue.filter((a) => a.seg !== segIdx - 1);
        schedule(next.actions, vt, segIdx);
        console.log(`  ${vt.toFixed(1)}s · ${res.phase}${next.silent ? ' (nu se filmează)' : ''}`);
      } else if (segIdx >= 0 && res.phase !== phase && res.phase !== sc.segments[segIdx].phase) {
        // Faza s-a schimbat fără un segment pentru ea: oprim (scenariul s-a terminat).
        if (capturing) break;
      }
      phase = res.phase;

      const seg = sc.segments[segIdx];
      if (seg && !seg.silent && !capturing && (seg.captureFromTimeLeft === undefined || res.timeLeft <= seg.captureFromTimeLeft)) {
        capturing = true;
      }
      if (capturing) {
        const shot = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 94 });
        await write(Buffer.from(shot.data, 'base64'));
        frames++;
        if (frames % (FPS * 5) === 0) process.stdout.write(`  ${(frames / FPS).toFixed(0)}s filmate\r`);
      }
      vt += dt;
      if (segIdx === sc.segments.length - 1 && seg.endAfter !== undefined && vt - segStart >= seg.endAfter) break;
    }

    ff.stdin.end();
    await ffDone;
    const mb = (statSync(file).size / 1e6).toFixed(1);
    console.log(`  ✓ ${path.relative(root, file)} · ${(frames / FPS).toFixed(1)}s · ${mb} MB · randat în ${((Date.now() - started) / 1000).toFixed(0)}s`);
    return file;
  } finally {
    await b.close();
  }
}

mkdirSync(OUT, { recursive: true });
const list = names.length ? names : Object.keys(SCENARIOS);
for (const n of list) {
  if (!SCENARIOS[n]) {
    console.error(`Nu există scenariul „${n}”. Ai: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(1);
  }
}
for (const n of list) await record(n);

import { GIFT_CATALOG } from '../../../shared/gifts';
import { MAX_ACTIVE_RANGE, type ControlMsg, type GameSettings, type GameState, type LiveEvent, type ScreenInfo, type ServerInfo, type SimSettings, type TikTokStatus, type WireMsg } from '../../../shared/protocol';
import { onLangChange, setLang, t, type StringKey } from '../i18n';
import { ServerLink } from '../net/ServerLink';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const MAX_LOG = 80;

const link = new ServerLink('panel', onMessage, (ok) => setPill('pill-server', ok));
const control = (msg: ControlMsg) => link.send({ kind: 'control', msg });

let lastGameState = 0;
let lastState: GameState | null = null;

// --- limbă ---------------------------------------------------------------------
/** Textele fixe din panel.html: data-i18n (conținut) și data-i18n-placeholder. */
function applyI18n(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n as StringKey);
  for (const el of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder as StringKey);
  }
  document.title = t('panel.title');
  modeKey = ''; // butoanele de mod au „tasta n”, se refac
  renderTikTok();
  renderScreens();
  renderServerInfo();
  if (lastState) renderState(lastState);
}
onLangChange((lang) => {
  document.documentElement.lang = lang;
  applyI18n();
});

// --- setări joc ------------------------------------------------------------------
const setSettings = (settings: Partial<GameSettings>) => control({ type: 'settings:set', settings });
$<HTMLSelectElement>('set-lang').addEventListener('change', (ev) => {
  setSettings({ lang: (ev.target as HTMLSelectElement).value === 'en' ? 'en' : 'ro' });
});
$<HTMLInputElement>('set-followers').addEventListener('change', (ev) => {
  setSettings({ followersOnly: (ev.target as HTMLInputElement).checked });
});
$<HTMLInputElement>('set-gifters').addEventListener('change', (ev) => {
  setSettings({ giftersBypass: (ev.target as HTMLInputElement).checked });
});

const maxInput = $<HTMLInputElement>('set-max');
maxInput.min = String(MAX_ACTIVE_RANGE.min);
maxInput.max = String(MAX_ACTIVE_RANGE.max);
let maxTimer: ReturnType<typeof setTimeout> | undefined;
maxInput.addEventListener('input', () => {
  $('out-max').textContent = maxInput.value;
  clearTimeout(maxTimer);
  maxTimer = setTimeout(() => setSettings({ maxActive: Number(maxInput.value) }), 200);
});

function applyGameSettings(s: GameSettings): void {
  if (document.activeElement !== maxInput) {
    maxInput.value = String(s.maxActive);
    $('out-max').textContent = String(s.maxActive);
  }
  $<HTMLSelectElement>('set-lang').value = s.lang;
  $<HTMLInputElement>('set-followers').checked = s.followersOnly;
  $<HTMLInputElement>('set-gifters').checked = s.giftersBypass;
  $<HTMLInputElement>('set-gifters').disabled = !s.followersOnly;
  setLang(s.lang);
}

// --- ecrane și server ---------------------------------------------------------------
let screens: ScreenInfo[] = [];
let serverInfo: ServerInfo | null = null;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '?' : d.toLocaleDateString('ro-RO');
};

function renderScreens(): void {
  $('st-screens').textContent = screens.length
    ? screens
        .map((sc) =>
          sc.platform === 'android'
            ? t('panel.screenAndroid', { v: sc.version, date: fmtDate(sc.builtAt) })
            : t('panel.screenWeb', { v: sc.version }),
        )
        .join('\n')
    : t('panel.screenNone');
}

function renderServerInfo(): void {
  const addr = $('phone-address');
  const wifi = serverInfo?.wifiAddresses ?? [];
  addr.textContent = serverInfo
    ? (serverInfo.phoneAddress ?? t(wifi.length ? 'panel.phoneAddressWifiOnly' : 'panel.phoneAddressNone'))
    : '–';
  $('wifi-hint').hidden = wifi.length === 0;
  $('wifi-address').textContent = wifi.join(t('panel.or'));
  $('app-version').textContent = serverInfo
    ? t('panel.version', { v: serverInfo.version, date: fmtDate(serverInfo.startedAt) })
    : '';
}

// --- TikTok LIVE -------------------------------------------------------------------
let ttStatus: TikTokStatus = { username: '', state: 'off' };
/** Când reîncearcă serverul (ora locală), ca numărătoarea să meargă fără mesaje noi. */
let ttRetryAt = 0;

$<HTMLFormElement>('tt-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const username = $<HTMLInputElement>('tt-user').value.trim();
  if (username) control({ type: 'tiktok:connect', username });
});
$('tt-disconnect').addEventListener('click', () => control({ type: 'tiktok:disconnect' }));

function applyTikTok(s: TikTokStatus): void {
  ttStatus = s;
  ttRetryAt = s.retryInSec ? Date.now() + s.retryInSec * 1000 : 0;
  const input = $<HTMLInputElement>('tt-user');
  if (s.username && document.activeElement !== input && s.error !== 'bad-username') input.value = `@${s.username}`;
  // „Deconectează” are sens cât timp serverul încearcă sau e conectat; o eroare de nume nu pornește nimic.
  const running = s.state !== 'off' && s.error !== 'bad-username';
  $('tt-disconnect').hidden = !running;
  $('tt-connect').hidden = running;
  setPill('pill-tiktok', s.state === 'live');
  renderTikTok();
}

function renderTikTok(): void {
  const s = ttStatus;
  const el = $('tt-status');
  const user = s.username;
  const sec = Math.max(0, Math.ceil((ttRetryAt - Date.now()) / 1000));
  let text: string;
  if (s.error === 'bad-username') text = t('panel.tiktokBadUsername', { user });
  else if (s.state === 'connecting') text = t('panel.tiktokConnecting', { user });
  else if (s.state === 'live') text = t('panel.tiktokLive', { user }) + (s.viewers !== undefined ? ` · ${t('panel.tiktokViewers', { n: s.viewers })}` : '');
  else if (s.state === 'waiting') text = t('panel.tiktokWaiting', { user, sec });
  else if (s.state === 'error') text = t('panel.tiktokError', { sec });
  else text = t('panel.tiktokOff');
  el.textContent = text;
  el.className = `tt-status ${s.error === 'bad-username' ? 'error' : s.state}`;
  // Detaliul tehnic (ex. „SignatureRateLimitError: …”) ajută la depanare, dar nu e mesajul principal.
  const detail = $('tt-error');
  const showDetail = s.state === 'error' && !!s.error && s.error !== 'bad-username';
  detail.hidden = !showDetail;
  detail.textContent = showDetail ? s.error! : '';
}
setInterval(() => {
  if (ttRetryAt) renderTikTok();
}, 1000);

// --- simulator ---------------------------------------------------------------
const sliders: { id: string; out: string; key: keyof SimSettings }[] = [
  { id: 'sim-viewers', out: 'out-viewers', key: 'viewers' },
  { id: 'sim-comments', out: 'out-comments', key: 'commentsPerSec' },
  { id: 'sim-likes', out: 'out-likes', key: 'likesPerSec' },
  { id: 'sim-gifts', out: 'out-gifts', key: 'giftsPerMin' },
  { id: 'sim-follower-pct', out: 'out-follower-pct', key: 'followerPct' },
  { id: 'sim-follows', out: 'out-follows', key: 'followsPerMin' },
];

let sendTimer: ReturnType<typeof setTimeout> | undefined;
const pending: Partial<SimSettings> = {};

for (const s of sliders) {
  const input = $<HTMLInputElement>(s.id);
  input.addEventListener('input', () => {
    $(s.out).textContent = input.value;
    (pending as Record<string, number>)[s.key] = Number(input.value);
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => control({ type: 'sim:set', settings: { ...pending } }), 120);
  });
}

$<HTMLInputElement>('sim-enabled').addEventListener('change', (ev) => {
  control({ type: 'sim:set', settings: { enabled: (ev.target as HTMLInputElement).checked } });
});

function applySimSettings(s: SimSettings): void {
  $<HTMLInputElement>('sim-enabled').checked = s.enabled;
  for (const def of sliders) {
    const input = $<HTMLInputElement>(def.id);
    if (document.activeElement === input) continue;
    input.value = String(s[def.key]);
    $(def.out).textContent = String(s[def.key]);
  }
}

// --- cadouri -------------------------------------------------------------------
const giftBox = $('gift-buttons');
for (const g of GIFT_CATALOG) {
  const btn = document.createElement('button');
  const price = document.createElement('small');
  price.textContent = `${g.diamonds} 💎`;
  btn.append(`${g.name}${g.streakable ? ' ↻' : ''}`, price);
  btn.addEventListener('click', () => {
    const count = Math.max(1, Number($<HTMLInputElement>('gift-count').value) || 1);
    control({ type: 'sim:gift', giftName: g.name, count });
  });
  giftBox.appendChild(btn);
}

// --- chat de test ------------------------------------------------------------
$<HTMLFormElement>('chat-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = $<HTMLInputElement>('chat-text');
  if (!text.value.trim()) return;
  const isFollower = $<HTMLInputElement>('chat-follower').checked;
  control({ type: 'sim:chat', nickname: $<HTMLInputElement>('chat-nick').value, text: text.value, isFollower });
  text.select();
});
$('btn-follow').addEventListener('click', () => {
  control({ type: 'sim:follow', nickname: $<HTMLInputElement>('chat-nick').value });
  $<HTMLInputElement>('chat-follower').checked = true;
});

// --- streamer ------------------------------------------------------------------
$('btn-debug').addEventListener('click', () => control({ type: 'streamer', cmd: { action: 'toggleDebug' } }));
$('btn-skip-vote').addEventListener('click', () => control({ type: 'streamer', cmd: { action: 'skipVote' } }));
$('btn-end-round').addEventListener('click', () => control({ type: 'streamer', cmd: { action: 'endRound' } }));

let modeKey = '';

/** Butoanele de mod se refac doar când se schimbă lista de moduri. */
function renderModes(s: GameState): void {
  const key = s.modes.map((m) => m.id).join(',');
  const box = $('mode-buttons');
  if (key !== modeKey) {
    modeKey = key;
    box.replaceChildren(
      ...s.modes.map((m, i) => {
        const btn = document.createElement('button');
        btn.dataset.mode = m.id;
        const hint = document.createElement('small');
        hint.textContent = t('panel.key', { n: i + 1 });
        btn.append(m.name, hint);
        btn.addEventListener('click', () => control({ type: 'streamer', cmd: { action: 'pickMode', modeId: m.id } }));
        return btn;
      }),
    );
  }
  for (const btn of box.querySelectorAll<HTMLButtonElement>('button')) {
    btn.classList.toggle('current', btn.dataset.mode === s.modeId && s.phase !== 'vote');
  }
}

function renderVote(s: GameState): void {
  const box = $('vote-box');
  box.hidden = s.phase !== 'vote';
  if (box.hidden) return;
  const max = Math.max(1, ...s.voteOptions.map((o) => o.votes));
  $('vote-list').replaceChildren(
    ...s.voteOptions.map((o, i) => {
      const li = document.createElement('li');
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.width = `${(o.votes / max) * 100}%`;
      const name = document.createElement('span');
      name.textContent = `${i + 1}. ${o.name}`;
      const votes = document.createElement('b');
      votes.textContent = String(o.votes);
      li.append(bar, name, votes);
      return li;
    }),
  );
}
$('obs-url').textContent = `${location.origin}/?transparent=1`;

// --- mesaje de la server ----------------------------------------------------
function onMessage(msg: WireMsg): void {
  switch (msg.kind) {
    case 'sim':
      applySimSettings(msg.settings);
      break;
    case 'status':
      if (msg.status.source === 'sim') setPill('pill-sim', msg.status.connected);
      break;
    case 'tiktok':
      applyTikTok(msg.status);
      break;
    case 'screens':
      screens = msg.screens;
      renderScreens();
      break;
    case 'serverInfo':
      serverInfo = msg.info;
      renderServerInfo();
      break;
    case 'settings':
      applyGameSettings(msg.settings);
      break;
    case 'state':
      lastGameState = Date.now();
      setPill('pill-game', true);
      lastState = msg.state;
      renderState(msg.state);
      break;
    case 'event':
      logEvent(msg.event);
      break;
  }
}

function renderState(s: GameState): void {
  $('st-phase').textContent = t(`phase.${s.phase}`);
  $('st-mode').textContent = s.modeName;
  $('st-time').textContent = s.phaseEndsInSec === null ? '∞' : `${s.phaseEndsInSec}s`;
  renderModes(s);
  renderVote(s);
  $('st-active').textContent = String(s.activePlayers);
  $('st-queued').textContent = String(s.queued);
  $('st-fps').textContent = String(s.fps);
}

const log = $('log');
const logQueue: LiveEvent[] = [];

function logEvent(e: LiveEvent): void {
  logQueue.push(e);
}

// Logul se actualizează de câteva ori pe secundă, nu la fiecare eveniment (pot fi sute pe secundă).
setInterval(() => {
  if (logQueue.length === 0) return;
  const frag = document.createDocumentFragment();
  for (const e of logQueue.splice(0).slice(-MAX_LOG)) {
    const li = document.createElement('li');
    li.className = e.type;
    li.textContent = describe(e);
    frag.prepend(li);
  }
  log.prepend(frag);
  while (log.children.length > MAX_LOG) log.lastElementChild!.remove();
}, 250);

// Dacă jocul nu mai trimite stare, pagina de joc (OBS) e închisă.
setInterval(() => setPill('pill-game', Date.now() - lastGameState < 2000), 1000);

function describe(e: LiveEvent): string {
  const who = e.user.nickname;
  switch (e.type) {
    case 'chat': return `💬 ${who}: ${e.text}`;
    case 'gift': return `🎁 ${who} → ${e.giftName} x${e.count}`;
    case 'giftProgress': return `   … ${who} ${e.giftName} x${e.count}`;
    case 'like': return `❤️ ${who} +${e.count}`;
    case 'member': return t('panel.logJoined', { name: who });
    case 'follow': return t('panel.logFollow', { name: who });
  }
}

function setPill(id: string, on: boolean): void {
  const el = $(id);
  el.classList.toggle('on', on);
  el.classList.toggle('off', !on);
}

applyI18n();
link.connect();

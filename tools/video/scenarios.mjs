// Scenariile videoclipurilor: cine intră, ce scrie și când, ce cadouri trimite.
// Fiecare scenariu e o listă de segmente legate de fazele jocului (lobby, playing, results, vote):
// acțiunile unui segment au timpul socotit de la începutul fazei respective, ca să se potrivească
// mereu cu ce se vede pe ecran. Totul e generat cu o sămânță fixă, deci iese la fel la fiecare randare.
// Fiecare scenariu există în română și în engleză (nume, chat și comenzi în limba respectivă).

export const FEATURED_ID = 'v:featured';

const TEXT = {
  ro: {
    featured: { uniqueId: 'mara.plays', nickname: 'Mara ✨' },
    names: [
      'Andrei', 'Ioana', 'Mihai', 'Bianca', 'Alex', 'Denisa', 'Vlad', 'Teo', 'Raluca', 'Cristi', 'Ana', 'Darius',
      'Elena', 'Radu', 'Maria', 'Luca', 'Sara', 'Rareș', 'Irina', 'Matei', 'Daria', 'Tudor', 'Alexia', 'Ștefan',
      'Carla', 'Robert', 'Ilinca', 'Sebi', 'Antonia', 'David', 'Miruna', 'Paul', 'Bogdan', 'Clara', 'Eric', 'Lara',
      'Dragoș', 'Patricia', 'Victor', 'Andra', 'Sorin', 'Delia', 'Costin', 'Ema', 'Gabi', 'Iulia', 'Horia', 'Nora',
    ],
    moves: {
      plain: ['sus', 'jos', 'stanga', 'dreapta', 'stânga'],
      loud: ['SUS', 'JOS', 'STANGA', 'DREAPTA', 'Sus', 'Jos', 'Dreapta'],
      extra: ['sus sus', 'stanga!!', 'dreapta pls', 'jos 😂', 'sus 🔥', 'dreapta dreapta', 'stanga hai', 'jos jos jos'],
    },
    chatter: ['salut 👋', 'gg', 'ce tare 😂', 'hai hai hai', '🔥🔥🔥', 'haha', '❤️❤️', 'merge!!', 'sunt #7 😎', 'unde sunt eu?', 'lol', 'top joc'],
    hello: ['salut 👋', 'hey', 'am venit!', 'primul!', 'ce joc e asta?'],
    survivalHype: ['apărați cristalul!!', 'vin monștrii 😱', 'boss-ul!!'],
    results: ['gg', 'gg wp', 'bravo 👏', 'iar!!', 'încă o rundă', '🔥', 'gg ez', 'am fost primul? 😎'],
    voteTalk: ['hai pvp!!', 'PVP 🔥', 'vreau sus vs jos', 'nu, survival!', 'td e mai tare', 'pvp pvp pvp'],
    teamTop: [['echipa sus', 70], ['sus', 20], ['echipa sus 🔵', 10]],
    teamBottom: [['echipa jos', 70], ['jos', 20], ['echipa jos 🔴', 10]],
    tauntTop: ['hai SUS 🔵', 'SUS câștigă!', '🔵🔵🔵'],
    tauntBottom: ['hai JOS 🔴', 'JOS e mai tare', '🔴🔴🔴'],
    say: {
      hello: 'salut! sus', left: 'stanga', upFire: 'sus 🔥', right: 'dreapta', downDown: 'jos jos', thanks: 'mersi pt bomba 😂',
      myGift: 'acum dau eu 🌌', up: 'sus', rightArrow: 'dreapta ➡️', gg: 'gg 👏', pvpPls: 'hai pvp!! 🔥', myTeam: 'echipa jos 🔴',
      upUp: 'sus sus', goBottom: 'hai JOS 🔴', bomb: 'bomba pt sus 💣',
    },
  },
  en: {
    featured: { uniqueId: 'mia.plays', nickname: 'Mia ✨' },
    names: [
      'Emma', 'Liam', 'Noah', 'Olivia', 'Jake', 'Mia', 'Ethan', 'Ava', 'Lucas', 'Chloe', 'Ryan', 'Zoe', 'Mason',
      'Lily', 'Leo', 'Grace', 'Owen', 'Ella', 'Dylan', 'Ruby', 'Max', 'Nora', 'Caleb', 'Ivy', 'Finn', 'Luna', 'Jack',
      'Sophie', 'Adam', 'Hannah', 'Tyler', 'Maya', 'Sam', 'Aria', 'Ben', 'Layla', 'Nate', 'Jade', 'Kai', 'Abby',
      'Theo', 'Bella', 'Josh', 'Elsie', 'Cody', 'Tessa', 'Eli', 'Kira',
    ],
    moves: {
      plain: ['up', 'down', 'left', 'right', 'u', 'r'],
      loud: ['UP', 'DOWN', 'LEFT', 'RIGHT', 'Up', 'Left', 'Right'],
      extra: ['up up', 'left!!', 'right pls', 'down 😂', 'up 🔥', 'right right', 'left go', 'down down down'],
    },
    chatter: ['hi 👋', 'gg', 'so fun 😂', 'go go go', '🔥🔥🔥', 'haha', '❤️❤️', 'it works!!', "I'm #7 😎", 'where am I?', 'lol', 'love this game'],
    hello: ['hi 👋', 'hey', 'just joined!', 'first!', 'what game is this?'],
    survivalHype: ['protect the crystal!!', 'monsters incoming 😱', 'BOSS!!'],
    results: ['gg', 'gg wp', 'nice 👏', 'again!!', 'one more round', '🔥', 'gg ez', 'was I first? 😎'],
    voteTalk: ['pvp pls!!', 'PVP 🔥', 'top vs bottom!', 'no, survival!', 'td is better', 'pvp pvp pvp'],
    teamTop: [['team up', 70], ['up', 20], ['team up 🔵', 10]],
    teamBottom: [['team down', 70], ['down', 20], ['team down 🔴', 10]],
    tauntTop: ['go TOP 🔵', 'TOP wins!', '🔵🔵🔵'],
    tauntBottom: ['go BOTTOM 🔴', 'BOTTOM is better', '🔴🔴🔴'],
    say: {
      hello: 'hi! up', left: 'left', upFire: 'up 🔥', right: 'right', downDown: 'down down', thanks: 'thx for the bomb 😂',
      myGift: 'my turn 🌌', up: 'up', rightArrow: 'right ➡️', gg: 'gg 👏', pvpPls: 'pvp pls!! 🔥', myTeam: 'team down 🔴',
      upUp: 'up up', goBottom: 'go BOTTOM 🔴', bomb: 'bomb for TOP 💣',
    },
  },
};

const EMOJI_MOVES = ['⬆️', '⬇️', '⬅️', '➡️', '👉', '👈', '👆', '👇'];
const STYLE = [
  (n, k) => `${n.toLowerCase()}.${k}`,
  (n, k) => `${n.toLowerCase()}_${k}`,
  (n) => `${n.toLowerCase()}.gaming`,
  (n, k) => `the.${n.toLowerCase()}${k}`,
  (n) => `${n.toLowerCase()}.live`,
];
const NICK = [(n) => n, (n) => `${n} 🎮`, (n, k) => `${n}${k}`, (n) => n.toLowerCase(), (n) => `${n} 🔥`, (n) => `${n}.`];

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function makeViewers(rnd, names, count) {
  const out = [];
  const used = new Set();
  while (out.length < count) {
    const n = names[Math.floor(rnd() * names.length)];
    const k = 2 + Math.floor(rnd() * 97);
    const handle = STYLE[Math.floor(rnd() * STYLE.length)](n.normalize('NFD').replace(/[̀-ͯ]/g, ''), k);
    if (used.has(handle)) continue;
    used.add(handle);
    out.push({ userId: `v:${handle}`, uniqueId: handle, nickname: NICK[Math.floor(rnd() * NICK.length)](n, k) });
  }
  return out;
}

const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
/** Alege după ponderi: [[valoare, pondere], ...]. */
const weighted = (rnd, pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};

/** Comentarii de fundal pe o fază: `rate` pe secundă, de la oameni aleși din `pool`. */
function chatter(rnd, { from = 0, to, rate, pool, text }) {
  const out = [];
  for (let t = from; t < to; t += -Math.log(1 - rnd()) / rate) {
    const v = pick(rnd, pool);
    out.push({ at: t, type: 'chat', user: v, text: text(rnd, v) });
  }
  return out;
}

function likes(rnd, { from = 0, to, every, pool }) {
  const out = [];
  for (let t = from; t < to; t += every * (0.5 + rnd())) {
    out.push({ at: t, type: 'like', user: pick(rnd, pool), count: 1 + Math.floor(rnd() * 15) });
  }
  return out;
}

function kit(lang, seed) {
  const L = TEXT[lang];
  const rnd = makeRng(seed);
  const featured = { userId: FEATURED_ID, ...L.featured };
  const moveText = (r) => {
    const kind = weighted(r, [['plain', 60], ['loud', 10], ['emoji', 15], ['extra', 15]]);
    return pick(r, kind === 'emoji' ? EMOJI_MOVES : L.moves[kind]);
  };
  /** Persoana urmărită atinge căsuța, scrie pe tastatura telefonului, apoi trimite (durata o dă tastarea). */
  const typed = (at, text) => ({ at, type: 'typed', user: featured, text });
  return { L, rnd, featured, moveText, typed, crowd: (n) => makeViewers(rnd, L.names, n) };
}

// ---------------------------------------------------------------------------------------------------

function survival(lang) {
  const { L, rnd, featured, moveText, typed, crowd: makeCrowd } = kit(lang, 20261113);
  const S = L.say;
  const crowd = makeCrowd(70);
  const early = crowd.slice(0, 16);

  const prepare = [
    ...early.map((v, i) => ({ at: 0.15 * i, type: 'chat', user: v, text: i % 3 === 0 ? L.chatter[0] : moveText(rnd) })),
    { at: 0, type: 'viewers', n: 86 },
  ];

  // Lobby: intră lumea, câte unul, cu un prim comentariu; persoana urmărită salută și scrie „sus”.
  const lobby = [
    ...crowd.slice(16, 40).map((v, i) => ({
      at: 0.3 + i * 0.32 + rnd() * 0.15,
      type: 'chat',
      user: v,
      text: rnd() < 0.25 ? pick(rnd, L.hello) : moveText(rnd),
    })),
    ...chatter(rnd, { to: 12, rate: 2.5, pool: early, text: (r) => (r() < 0.8 ? moveText(r) : pick(r, L.chatter)) }),
    ...likes(rnd, { to: 12, every: 0.5, pool: early }),
    typed(0.8, S.hello),
    { at: 3, type: 'viewers', n: 118 },
    { at: 6, type: 'viewers', n: 142 },
  ];

  // Runda: mulți scriu comenzi, cadouri din ce în ce mai mari, like-uri care umplu bara.
  const T = 44;
  const playing = [
    ...crowd.slice(40).map((v, i) => ({ at: 1 + i * 0.9 + rnd() * 0.4, type: 'chat', user: v, text: moveText(rnd) })),
    ...chatter(rnd, {
      to: T,
      rate: 6.5,
      pool: crowd.slice(0, 50),
      text: (r) => (r() < 0.86 ? moveText(r) : pick(r, [...L.chatter, ...L.survivalHype])),
    }),
    ...likes(rnd, { to: T, every: 0.22, pool: crowd }),
    typed(1.2, S.left),
    typed(4.5, S.left),
    typed(8, S.upFire),
    { at: 9.5, type: 'gift', user: crowd[3], gift: 'Rose', count: 12 },
    typed(12.5, S.right),
    { at: 15, type: 'gift', user: crowd[21], gift: 'TikTok', count: 5 },
    typed(17, S.downDown),
    { at: 20, type: 'gift', user: crowd[9], gift: 'Doughnut', count: 1 },
    typed(22.5, S.thanks),
    typed(26, S.left),
    { at: 28, type: 'gift', user: crowd[30], gift: 'Finger Heart', count: 3 },
    typed(30.5, S.myGift),
    { at: 33, type: 'gift', user: featured, gift: 'Galaxy', count: 1 },
    typed(36, S.up),
    { at: 38.5, type: 'gift', user: crowd[14], gift: 'Hand Hearts', count: 1 },
    typed(40.5, S.rightArrow),
    { at: 6, type: 'viewers', n: 167 },
    { at: 18, type: 'viewers', n: 189 },
    { at: 30, type: 'viewers', n: 214 },
    { at: 40, type: 'viewers', n: 231 },
  ];

  return {
    lang,
    url: '/?debug=1&mode=survival',
    prepare: { seconds: 2.6, actions: prepare },
    segments: [
      { phase: 'lobby', actions: lobby },
      { phase: 'playing', actions: playing, endAfter: T },
    ],
  };
}

function votePvp(lang) {
  const { L, rnd, featured, moveText, typed, crowd: makeCrowd } = kit(lang, 7031987);
  const S = L.say;
  const crowd = makeCrowd(64);
  const all = [...crowd, featured];
  const top = crowd.filter((_, i) => i % 2 === 0);
  const bottom = crowd.filter((_, i) => i % 2 === 1);

  // Pregătire (nu se filmează): o rundă de Boss Slayer cu toată lumea, ca rezultatele să aibă scoruri.
  const bossLobby = [
    ...crowd.map((v, i) => ({ at: 0.1 * i, type: 'chat', user: v, text: moveText(rnd) })),
    { at: 0.1 * crowd.length + 0.2, type: 'chat', user: featured, text: S.up },
    { at: 0, type: 'viewers', n: 248 },
  ];
  const bossPlay = [
    ...chatter(rnd, { to: 26, rate: 9, pool: all, text: (r) => moveText(r) }),
    ...likes(rnd, { to: 26, every: 0.25, pool: crowd }),
    { at: 26, type: 'control', action: 'endRound' },
  ];

  const results = [...chatter(rnd, { to: 10, rate: 3, pool: crowd, text: (r) => pick(r, L.results) }), typed(0.2, S.gg)];

  // Votul: ~60% vor PvP, restul se împart; câteva cadouri de vot.
  const voters = crowd.map((v) => ({ v, want: rnd() < 0.6 ? 'pvp' : 'other', at: 0.6 + rnd() * 13 }));
  const vote = [
    ...voters.map(({ v, want, at }) => ({ at, type: 'vote', user: v, want })),
    ...voters.filter(() => rnd() < 0.35).map(({ v }) => ({ at: 5 + rnd() * 12, type: 'vote', user: v, want: rnd() < 0.65 ? 'pvp' : 'other' })),
    ...chatter(rnd, { from: 1, to: 19, rate: 1.2, pool: crowd, text: (r) => pick(r, L.voteTalk) }),
    ...likes(rnd, { to: 20, every: 0.3, pool: crowd }),
    typed(1.5, '{pvp}'),
    typed(4.5, S.pvpPls),
    { at: 7.5, type: 'voteGift', user: crowd[5], want: 'pvp', count: 10 },
    { at: 11, type: 'voteGift', user: crowd[12], want: 'other', count: 4 },
    { at: 14, type: 'voteGift', user: crowd[22], want: 'pvp', count: 15 },
    { at: 3, type: 'viewers', n: 263 },
    { at: 12, type: 'viewers', n: 281 },
  ];

  // Lobby PvP: fiecare își alege echipa; persoana urmărită merge la JOS.
  const pvpLobby = [
    ...top.map((v) => ({ at: 0.4 + rnd() * 8, type: 'chat', user: v, text: weighted(rnd, L.teamTop) })),
    ...bottom.map((v) => ({ at: 0.4 + rnd() * 8, type: 'chat', user: v, text: weighted(rnd, L.teamBottom) })),
    typed(1, S.myTeam),
    ...likes(rnd, { to: 10, every: 0.35, pool: crowd }),
  ];

  const T = 24;
  const taunt = (r, v) => pick(r, top.includes(v) ? L.tauntTop : L.tauntBottom);
  const pvpPlay = [
    ...chatter(rnd, { to: T, rate: 8, pool: crowd, text: (r, v) => (r() < 0.82 ? moveText(r) : taunt(r, v)) }),
    ...likes(rnd, { to: T, every: 0.2, pool: crowd }),
    typed(1.5, S.up),
    typed(4.5, S.upUp),
    { at: 6, type: 'gift', user: top[3], gift: 'Rose', count: 15 },
    typed(8, S.goBottom),
    { at: 10.5, type: 'gift', user: bottom[6], gift: 'Doughnut', count: 1 },
    typed(13, S.right),
    { at: 15, type: 'gift', user: top[8], gift: 'TikTok', count: 6 },
    typed(17, S.bomb),
    { at: 19, type: 'gift', user: featured, gift: 'Doughnut', count: 2 },
    typed(21, S.left),
    { at: 8, type: 'viewers', n: 302 },
    { at: 18, type: 'viewers', n: 327 },
  ];

  return {
    lang,
    url: '/?debug=1&mode=boss',
    prepare: { seconds: 0, actions: [] },
    segments: [
      { phase: 'lobby', actions: bossLobby, silent: true },
      { phase: 'playing', actions: bossPlay, silent: true },
      { phase: 'results', actions: results, captureFromTimeLeft: 3.2 },
      { phase: 'vote', actions: vote },
      { phase: 'lobby', actions: pvpLobby },
      { phase: 'playing', actions: pvpPlay, endAfter: T },
    ],
  };
}

/**
 * Cameră mică: 10 oameni (9 + persoana urmărită). Chatul curge încet, ca mesajele să stea pe ecran,
 * iar persoana urmărită scrie des, cu tastatura telefonului, și se vede unde e caracterul ei.
 */
function small(lang) {
  const { L, rnd, featured, moveText, typed, crowd: makeCrowd } = kit(lang, 1110);
  const crowd = makeCrowd(9);
  const RO = lang === 'ro';
  const lines = RO
    ? ['salut! sus', 'unde sunt? 😂', 'aaa, aia sunt eu', 'stanga', 'sus sus', 'dreapta 🔥', 'jos', 'mersi de trandafiri ❤️',
      'SUS', 'acum eu 🎁', 'dreapta', 'hai că putem 💪']
    : ['hi! up', 'where am I? 😂', 'oh, that is me', 'left', 'up up', 'right 🔥', 'down', 'thx for the roses ❤️',
      'UP', 'my turn 🎁', 'right', 'we got this 💪'];

  // Lobby: lumea vine pe rând, câte unul.
  const lobby = [
    ...crowd.map((v, i) => ({ at: 0.4 + i * 0.9 + rnd() * 0.3, type: 'chat', user: v, text: i % 3 === 0 ? pick(rnd, L.hello) : moveText(rnd) })),
    ...likes(rnd, { from: 2, to: 10, every: 1.4, pool: crowd }),
    typed(0.6, lines[0]),
    typed(4.4, lines[1]),
    typed(8, lines[2]),
    { at: 0, type: 'viewers', n: 6 },
    { at: 3, type: 'viewers', n: 8 },
    { at: 6, type: 'viewers', n: 10 },
  ];

  // Runda: puțini oameni, ritm calm; persoana urmărită scrie la câteva secunde.
  const T = 46;
  const playing = [
    ...chatter(rnd, { to: T, rate: 0.75, pool: crowd, text: (r) => (r() < 0.85 ? moveText(r) : pick(r, [...L.chatter, ...L.survivalHype])) }),
    ...likes(rnd, { to: T, every: 1.1, pool: crowd }),
    // Între mesaje tastatura se închide câteva secunde, ca să se vadă jocul.
    ...lines.slice(3).map((text, i) => typed(0.8 + i * 5, text)),
    { at: 16, type: 'gift', user: crowd[2], gift: 'Rose', count: 5 },
    { at: 34.5, type: 'gift', user: featured, gift: 'Finger Heart', count: 1 },
    { at: 39, type: 'gift', user: crowd[6], gift: 'Doughnut', count: 1 },
  ];

  return {
    lang,
    url: '/?debug=1&mode=survival',
    prepare: { seconds: 0.4, actions: [] },
    segments: [
      { phase: 'lobby', actions: lobby },
      { phase: 'playing', actions: playing, endAfter: T },
    ],
  };
}

/** Numele fișierului → scenariul. */
export const SCENARIOS = {
  survival: () => ({ ...survival('ro'), name: 'survival', title: 'Survival: chatul apără cristalul' }),
  'vot-pvp': () => ({ ...votePvp('ro'), name: 'vot-pvp', title: 'Votul chatului, apoi Sus vs Jos' }),
  'camera-mica': () => ({ ...small('ro'), name: 'camera-mica', title: 'Cameră mică: 10 oameni, tastatura telefonului' }),
  'small-room-en': () => ({ ...small('en'), name: 'small-room-en', title: 'Small room: 10 people, phone keyboard (EN)' }),
  'survival-en': () => ({ ...survival('en'), name: 'survival-en', title: 'Survival: chat defends the crystal (EN)' }),
  'vote-pvp-en': () => ({ ...votePvp('en'), name: 'vote-pvp-en', title: 'Chat vote, then Top vs Bottom (EN)' }),
};

// Stratul „ca pe un LIVE” peste joc: antet cu LIVE și spectatori, chat jos, bannere de cadouri,
// inimi pentru like-uri, căsuța de comentariu și tastatura telefonului pe care cineva scrie tastă cu tastă.
// Se injectează în pagina jocului. Nu folosește animații CSS sau ceasul real: totul se desenează
// din tick(t), cu timpul videoclipului, ca fiecare cadru să iasă exact.
(() => {
  // Jocul nu pornește singur: cadrele le dă înregistrarea (game.step), cu timpul videoclipului.
  window.requestAnimationFrame = () => 0;
  const W = 1080;
  const H = 1920;
  const CHAT_BOTTOM = 1778; // marginea de jos a listei de comentarii (tastatura închisă)
  const CHAT_MAX = 5;
  const CHAT_MAX_KB = 3; // cu tastatura deschisă, chatul urcă deasupra ei și arată mai puține mesaje
  const BANNER_Y = 1262; // între zona de joc (se termină la ~1250) și chat
  const BAR_Y = 1800; // bara de jos (căsuța + butoane)
  const KB_H = 690;
  const KB_TOP = H - KB_H;
  const KB_BAR_Y = KB_TOP - 104; // bara de jos când tastatura e deschisă
  const KB_CHAT_BOTTOM = KB_BAR_Y - 18;

  const css = `
  #live-ui { position: fixed; inset: 0; width: ${W}px; height: ${H}px; pointer-events: none; z-index: 50;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif; color: #fff; overflow: hidden; }
  #live-ui * { box-sizing: border-box; }
  .lv-layer { position: absolute; inset: 0; }
  .lv-top { position: absolute; left: 28px; right: 28px; top: 34px; display: flex; align-items: center; gap: 14px; }
  .lv-host { display: flex; align-items: center; gap: 14px; background: rgba(0,0,0,.38); border-radius: 999px; padding: 8px 26px 8px 8px; }
  .lv-host .av { width: 76px; height: 76px; font-size: 34px; }
  .lv-host b { display: block; font-size: 30px; line-height: 1.1; }
  .lv-host small { font-size: 22px; opacity: .8; }
  .lv-follow { background: #fe2c55; border-radius: 999px; font-size: 24px; font-weight: 700; padding: 10px 20px; margin-left: 6px; }
  .lv-spacer { flex: 1; }
  .lv-faces { display: flex; }
  .lv-faces .av { width: 56px; height: 56px; font-size: 24px; margin-left: -12px; border: 3px solid rgba(0,0,0,.35); }
  .lv-viewers { background: rgba(0,0,0,.38); border-radius: 999px; padding: 10px 20px; font-size: 26px; font-weight: 700; }
  .lv-live { background: #fe2c55; border-radius: 10px; padding: 8px 14px; font-size: 24px; font-weight: 800; letter-spacing: .06em; }
  .av { border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff;
    flex: none; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .lv-chat { position: absolute; left: 26px; width: 780px; top: 0; height: ${H}px; }
  .lv-msg { position: absolute; left: 0; display: flex; gap: 14px; align-items: flex-start; max-width: 780px;
    background: rgba(0,0,0,.30); border-radius: 24px; padding: 8px 22px 9px 9px; }
  .lv-msg .av { width: 48px; height: 48px; font-size: 22px; margin-top: 2px; }
  .lv-msg .who { font-size: 23px; font-weight: 700; opacity: .72; line-height: 1.2; }
  .lv-msg .txt { font-size: 29px; font-weight: 600; line-height: 1.2; word-break: break-word; }
  .lv-msg.gift { background: linear-gradient(90deg, rgba(254,44,85,.55), rgba(254,44,85,.12)); }
  .lv-msg.join .txt { font-size: 26px; opacity: .8; font-weight: 500; }
  .lv-msg.me { background: rgba(254,44,85,.42); box-shadow: 0 0 0 3px rgba(255,255,255,.8); }
  .lv-msg.me .who { opacity: 1; }
  .lv-banner { position: absolute; left: 0; top: 0; height: 104px; display: flex; align-items: center; gap: 16px;
    padding: 0 34px 0 10px; border-radius: 999px; background: linear-gradient(90deg, rgba(255,184,0,.95), rgba(255,94,58,.85)); }
  .lv-banner .av { width: 84px; height: 84px; font-size: 36px; }
  .lv-banner .who { font-size: 27px; font-weight: 800; line-height: 1.1; }
  .lv-banner .what { font-size: 25px; opacity: .95; }
  .lv-banner .ico { font-size: 64px; margin-left: 4px; }
  .lv-banner .cnt { font-size: 66px; font-weight: 900; font-style: italic; margin-left: 10px;
    text-shadow: 0 3px 0 rgba(0,0,0,.25); }
  .lv-heart { position: absolute; font-size: 54px; }
  .lv-bottom { position: absolute; left: 24px; right: 24px; top: 0; height: 92px; display: flex; gap: 16px; align-items: center; }
  .lv-input { flex: 1; height: 84px; border-radius: 999px; background: rgba(255,255,255,.16); display: flex; align-items: center;
    padding: 0 12px 0 30px; font-size: 34px; gap: 4px; overflow: hidden; white-space: pre; }
  .lv-input .ph { opacity: .62; }
  .lv-input.typing { background: #fff; color: #111; }
  .lv-input .caret { display: inline-block; width: 3px; height: 42px; background: #fe2c55; vertical-align: middle; }
  .lv-input .send { margin-left: auto; width: 64px; height: 64px; border-radius: 50%; background: #fe2c55; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 32px; flex: none; }
  .lv-btn { width: 84px; height: 84px; border-radius: 50%; background: rgba(0,0,0,.38); display: flex; align-items: center; justify-content: center; font-size: 42px; flex: none; }
  .lv-tap { position: absolute; left: 0; top: 0; width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%;
    background: rgba(255,255,255,.55); border: 3px solid rgba(255,255,255,.9); }

  .lv-kb { position: absolute; left: 0; top: ${KB_TOP}px; width: ${W}px; height: ${KB_H}px; background: #1b1b1f;
    border-top: 1px solid rgba(255,255,255,.08); padding: 8px 12px 0; }
  .lv-strip { height: 76px; display: flex; align-items: center; justify-content: space-around; font-size: 32px; color: #e8e8ee;
    border-bottom: 1px solid rgba(255,255,255,.07); margin-bottom: 14px; }
  .lv-strip span { flex: 1; text-align: center; padding: 8px 0; border-radius: 14px; }
  .lv-strip span + span { border-left: 1px solid rgba(255,255,255,.12); }
  .lv-strip .mid { font-weight: 700; }
  .lv-strip .emo { font-size: 48px; border-left: none !important; }
  .lv-strip .hit { background: rgba(255,255,255,.22); }
  .lv-row { display: flex; gap: 12px; justify-content: center; margin-bottom: 14px; }
  .lv-key { height: 98px; border-radius: 14px; background: #3a3a40; display: flex; align-items: center; justify-content: center;
    font-size: 42px; color: #f2f2f6; box-shadow: 0 3px 0 rgba(0,0,0,.45); position: relative; flex: none; }
  .lv-key.num { height: 84px; font-size: 36px; background: #2c2c32; }
  .lv-key.fn { background: #2a2a30; font-size: 34px; }
  .lv-key.on { background: #e8e8ee; color: #1b1b1f; }
  .lv-key.down { background: #6a6a74; }
  .lv-key.space { font-size: 26px; color: #9a9aa6; }
  .lv-key.enter { background: #fe2c55; }
  .lv-pop { position: absolute; width: 120px; height: 150px; border-radius: 18px; background: #55555e; color: #fff;
    display: flex; align-items: flex-start; justify-content: center; padding-top: 14px; font-size: 64px; font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,.5); }
  .lv-home { position: absolute; left: 50%; bottom: 16px; width: 280px; height: 9px; margin-left: -140px; border-radius: 9px; background: rgba(255,255,255,.55); }

  .lv-me { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; }
  .lv-me .tag { background: #fe2c55; border: 3px solid #fff; border-radius: 999px; padding: 4px 18px; font-size: 26px; font-weight: 800;
    white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,.45); }
  .lv-me .arrow { width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 16px solid #fff; margin-top: -1px; }
  `;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const avatar = (name, color) => {
    const a = el('div', 'av', (name.match(/[A-Za-zĂÂÎȘȚăâîșț]/) ?? ['?'])[0].toUpperCase());
    a.style.background = color;
    return a;
  };
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const easeIO = (x) => {
    const v = Math.min(1, Math.max(0, x));
    return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  };
  const graphemes = (s) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  const plain = (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let root, chatBox, viewersEl, facesEl, likesEl, inputEl, bannerBox, heartBox, bottomEl, btnEls, kbEl, stripEl, popEl, tapEl, meEl;
  const keys = new Map(); // id → element
  const msgs = []; // { node, born, y, h }
  const banners = []; // { node, born, until }
  const hearts = []; // { node, born, x0, drift, life }
  let typing = null; // { start, strokes, sendTap, end }
  let closeAt = -1; // când a început să se închidă tastatura
  let kbOpen = 0;
  let chatBottom = CHAT_BOTTOM;
  let now = 0;
  let facesKey = '';
  let hostLikes = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const WORDS = {
    ro: { follow: '+ Urmărește', comment: 'Adaugă un comentariu…', joined: 'a intrat', sent: 'a trimis', you: 'TU', space: 'Română' },
    en: { follow: '+ Follow', comment: 'Add a comment…', joined: 'joined', sent: 'sent', you: 'YOU', space: 'English' },
  };
  let w = WORDS.ro;

  // ---------------------------------------------------------------- tastatura

  const K = 95; // lățimea unei taste de literă
  const ROWS = [
    { cls: 'num', keys: [...'1234567890'].map((c) => [c, c, K]) },
    { keys: [...'qwertyuiop'].map((c) => [c, c, K]) },
    { keys: [...'asdfghjkl'].map((c) => [c, c, K]) },
    { keys: [['shift', '⇧', 142, 'fn'], ...[...'zxcvbnm'].map((c) => [c, c, K]), ['back', '⌫', 142, 'fn']] },
    {
      keys: [
        ['sym', '?123', 142, 'fn'], ['emoji', '☺', K, 'fn'], [',', ',', K], ['space', '', 427, 'space'], ['.', '.', K],
        ['enter', '↵', 142, 'enter'],
      ],
    },
  ];

  function buildKeyboard() {
    kbEl = el('div', 'lv-kb');
    stripEl = el('div', 'lv-strip');
    kbEl.append(stripEl);
    for (const row of ROWS) {
      const r = el('div', 'lv-row');
      for (const [id, label, width, cls] of row.keys) {
        const k = el('div', `lv-key ${row.cls ?? ''} ${cls ?? ''}`, label);
        k.style.width = `${width}px`;
        keys.set(id, k);
        r.append(k);
      }
      kbEl.append(r);
    }
    kbEl.append(el('div', 'lv-home'));
    popEl = el('div', 'lv-pop');
    popEl.style.display = 'none';
    kbEl.append(popEl);
  }

  /**
   * Transformă textul în apăsări de taste, cu ritmul unui om care scrie pe telefon:
   * majuscule cu Shift (de două ori pentru un cuvânt întreg), diacriticele și semnele cu apăsare lungă,
   * emoji-urile din bara de sugestii.
   */
  function plan(text) {
    const g = graphemes(text);
    const strokes = [];
    let t = 0.62; // după atingere și deschiderea tastaturii
    let caps = false;
    const gap = () => 0.12 + rnd() * 0.11 + (rnd() < 0.07 ? 0.28 : 0);
    for (let i = 0; i < g.length; i++) {
      const ch = g[i];
      const base = plain(ch);
      if (/^[a-z]$/.test(base)) {
        const upper = ch !== ch.toLowerCase();
        if (upper && !caps) {
          let run = 0;
          while (i + run < g.length && /^[a-z]$/.test(plain(g[i + run])) && g[i + run] !== g[i + run].toLowerCase()) run++;
          if (run >= 2) {
            strokes.push({ t, key: 'shift', shift: 'once' });
            t += 0.09;
            strokes.push({ t, key: 'shift', shift: 'caps' });
            caps = true;
          } else {
            strokes.push({ t, key: 'shift', shift: 'once' });
          }
          t += 0.17;
        } else if (!upper && caps) {
          strokes.push({ t, key: 'shift', shift: 'off' });
          caps = false;
          t += 0.17;
        }
        const long = ch.toLowerCase() !== base; // ă â î ș ț: apăsare lungă pe literă
        strokes.push({ t, key: base, ch, long });
        t += long ? 0.42 : gap();
      } else if (/^[0-9]$/.test(ch)) {
        strokes.push({ t, key: ch, ch });
        t += gap();
      } else if (ch === ' ') {
        strokes.push({ t, key: 'space', ch });
        t += gap() + 0.04;
      } else if (ch === ',' || ch === '.') {
        strokes.push({ t, key: ch, ch });
        t += gap();
      } else if (/^[\x21-\x7e]$/.test(ch)) {
        strokes.push({ t, key: '.', ch, long: true }); // ! ? # ' etc.: apăsare lungă pe punct
        t += 0.42;
      } else {
        t += 0.22; // emoji: apare în sugestii, apoi e atins
        strokes.push({ t, key: 'emoji-pick', ch });
        t += 0.26;
      }
    }
    if (caps) {
      strokes.push({ t, key: 'shift', shift: 'off' });
      t += 0.12;
    }
    const sendTap = t + 0.32;
    return { strokes, sendTap, end: sendTap + 0.1 };
  }

  const EMOJI_NEIGHBORS = ['😂', '🔥', '❤️', '😎', '👏', '😍', '🙌', '💪', '🎉', '😱'];

  function renderKeyboard() {
    // Starea tastaturii se recalculează din apăsările de până acum (determinist, fără stare ascunsă).
    const s = typing;
    let shift = 'none';
    let text = '';
    let active = null;
    let activeAge = 1;
    let next = null;
    if (s) {
      const local = now - s.start;
      for (const k of s.strokes) {
        if (k.t > local) {
          next ??= k;
          continue;
        }
        active = k;
        activeAge = local - k.t;
        if (k.key === 'shift') {
          shift = k.shift === 'off' ? 'none' : k.shift === 'caps' ? 'caps' : shift === 'once' ? 'none' : 'once';
        } else if (k.ch) {
          text += k.ch;
          if (shift === 'once' && /^[a-z]$/.test(plain(k.ch))) shift = 'none';
        }
      }
    }

    // Etichetele literelor urmează Shift-ul.
    for (const c of 'qwertyuiopasdfghjklzxcvbnm') keys.get(c).textContent = shift === 'none' ? c : c.toUpperCase();
    keys.get('shift').classList.toggle('on', shift !== 'none');
    keys.get('shift').textContent = shift === 'caps' ? '⇪' : '⇧';
    keys.get('space').textContent = w.space;

    for (const k of keys.values()) k.classList.remove('down');
    popEl.style.display = 'none';
    const hold = active?.long ? 0.36 : 0.11;
    if (active && activeAge < hold && active.key !== 'emoji-pick') {
      const k = keys.get(active.key);
      k.classList.add('down');
      if (active.ch && active.key !== 'space') {
        // Balonul de deasupra tastei, cu litera (sau diacritica / semnul) care se scrie.
        popEl.textContent = active.ch;
        popEl.style.display = 'flex';
        const kr = k.getBoundingClientRect();
        const kb = kbEl.getBoundingClientRect();
        const x = Math.min(W - 130, Math.max(10, kr.left - kb.left + kr.width / 2 - 60));
        popEl.style.left = `${x}px`;
        popEl.style.top = `${kr.top - kb.top - 112}px`;
      }
    }

    // Bara de sugestii: cuvântul în lucru, sau emoji-ul care urmează să fie atins.
    const word = text.split(' ').pop() ?? '';
    let strip;
    const local = s ? now - s.start : 0;
    const emo = (next?.key === 'emoji-pick' && next.t - local < 0.3 && next) || (active?.key === 'emoji-pick' && activeAge < 0.18 && active);
    if (emo) {
      const i = EMOJI_NEIGHBORS.indexOf(emo.ch);
      const a = EMOJI_NEIGHBORS[(i + 1 + EMOJI_NEIGHBORS.length) % EMOJI_NEIGHBORS.length];
      const b = EMOJI_NEIGHBORS[(i + 3 + EMOJI_NEIGHBORS.length) % EMOJI_NEIGHBORS.length];
      strip = [
        ['emo', a === emo.ch ? '👍' : a],
        [`emo mid ${emo === active ? 'hit' : ''}`, emo.ch],
        ['emo', b === emo.ch ? '👍' : b],
      ];
    } else {
      strip = [['', ''], ['mid', word], ['', '']];
    }
    const key = JSON.stringify(strip);
    if (stripEl.dataset.k !== key) {
      stripEl.dataset.k = key;
      stripEl.replaceChildren(...strip.map(([c, t]) => el('span', c, t)));
    }
    return { text, done: s ? local >= s.sendTap - 0.32 : false, local };
  }

  // ---------------------------------------------------------------- restul interfeței

  function build(host) {
    const style = el('style');
    style.textContent = css;
    document.head.append(style);
    root = el('div');
    root.id = 'live-ui';

    const top = el('div', 'lv-top');
    const h = el('div', 'lv-host');
    const hostText = el('div');
    hostText.append(el('b', '', host.name));
    likesEl = el('small', '', '');
    hostText.append(likesEl);
    h.append(avatar(host.name, host.color), hostText, el('div', 'lv-follow', w.follow));
    facesEl = el('div', 'lv-faces');
    viewersEl = el('div', 'lv-viewers', '');
    top.append(h, el('div', 'lv-spacer'), facesEl, viewersEl, el('div', 'lv-live', 'LIVE'));

    meEl = el('div', 'lv-me');
    meEl.style.display = 'none';
    chatBox = el('div', 'lv-chat');
    bannerBox = el('div', 'lv-chat');
    heartBox = el('div', 'lv-layer');

    bottomEl = el('div', 'lv-bottom');
    inputEl = el('div', 'lv-input');
    btnEls = [el('div', 'lv-btn', '🎁'), el('div', 'lv-btn', '❤️'), el('div', 'lv-btn', '↗')];
    bottomEl.append(inputEl, ...btnEls);

    buildKeyboard();
    tapEl = el('div', 'lv-tap');
    tapEl.style.opacity = '0';

    root.append(top, meEl, heartBox, chatBox, bannerBox, kbEl, bottomEl, tapEl);
    document.body.append(root);
  }

  function addMsg(kind, name, color, text, extraCls) {
    const node = el('div', `lv-msg ${kind} ${extraCls ?? ''}`);
    const body = el('div');
    body.append(el('div', 'who', name), el('div', 'txt', text));
    node.append(avatar(name, color), body);
    node.style.opacity = '0';
    chatBox.append(node);
    msgs.push({ node, born: now, y: null, h: 0 });
    while (msgs.length > CHAT_MAX + 2) msgs.shift().node.remove();
  }

  let inputKey = '';
  function renderInput(state) {
    const focused = typing || (closeAt >= 0 && now - closeAt < 0.05);
    const shown = state.text;
    const blink = Math.floor(now * 2.2) % 2 === 0 || (typing && state.local < typing.sendTap);
    const key = `${focused ? 1 : 0}|${shown}|${blink ? 1 : 0}|${state.done ? 1 : 0}`;
    if (key === inputKey) return;
    inputKey = key;
    inputEl.replaceChildren();
    inputEl.classList.toggle('typing', !!focused);
    if (focused) {
      inputEl.append(el('span', '', shown));
      if (blink) inputEl.append(el('span', 'caret'));
      const send = el('div', 'send', '➤');
      send.style.opacity = shown.length ? '1' : '.35';
      inputEl.append(send);
    } else {
      inputEl.append(el('span', 'ph', w.comment));
    }
  }

  const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}K` : String(n));

  window.__live = {
    init(host, lang = 'ro') {
      w = WORDS[lang] ?? WORDS.ro;
      build(host);
      renderInput({ text: '', done: false, local: 0 });
    },
    setViewers(n, faces) {
      if (Number.isFinite(n)) viewersEl.textContent = `👁 ${fmt(n)}`;
      const key = faces ? faces.slice(0, 3).map((f) => f.name).join('|') : '';
      if (faces && key !== facesKey) {
        facesKey = key;
        facesEl.replaceChildren(...faces.slice(0, 3).map((f) => avatar(f.name, f.color)));
      }
    },
    chat(name, color, text, me) {
      addMsg('', name, color, text, me ? 'me' : '');
    },
    join(name, color) {
      addMsg('join', name, color, w.joined);
    },
    gift(name, color, giftName, icon, count) {
      addMsg('gift', name, color, `${w.sent} ${giftName} ${icon} x${count}`);
      const node = el('div', 'lv-banner');
      const t = el('div');
      t.append(el('div', 'who', name), el('div', 'what', `${w.sent} ${giftName}`));
      node.append(avatar(name, color), t, el('div', 'ico', icon), el('div', 'cnt', `x${count}`));
      node.style.opacity = '0';
      bannerBox.append(node);
      // Un singur banner deodată: cel nou îl împinge afară pe cel vechi.
      for (const b of banners) b.until = Math.min(b.until, now);
      banners.push({ node, born: now, until: now + 3.2 });
      while (banners.length > 2) banners.shift().node.remove();
    },
    like(count) {
      hostLikes += count;
      const node = el('div', 'lv-heart', ['❤️', '💖', '💗', '💕'][Math.floor(rnd() * 4)]);
      heartBox.append(node);
      hearts.push({ node, born: now, x0: 930 + rnd() * 60, drift: (rnd() - 0.5) * 160, life: 1.8 + rnd() * 0.6 });
    },
    /**
     * Persoana urmărită atinge căsuța, se deschide tastatura și scrie tastă cu tastă.
     * Întoarce după câte secunde e atins butonul de trimitere (atunci scenariul trimite mesajul).
     */
    type(text) {
      const p = plan(text);
      typing = { start: now, ...p };
      closeAt = -1;
      return p.end;
    },
    sent() {
      typing = null;
      closeAt = now;
    },
    /** Eticheta „TU” deasupra caracterului persoanei urmărite (coordonate în pagină; null = ascunsă). */
    marker(x, y, name) {
      if (x === null || x === undefined) {
        meEl.style.display = 'none';
        return;
      }
      if (meEl.dataset.n !== name) {
        meEl.dataset.n = name;
        meEl.replaceChildren(el('div', 'tag', `${w.you} · ${name}`), el('div', 'arrow'));
      }
      meEl.style.display = 'flex';
      const half = meEl.offsetWidth / 2;
      const cx = Math.min(W - half - 8, Math.max(half + 8, x));
      meEl.style.transform = `translate(${cx - half}px, ${y - meEl.offsetHeight}px)`;
    },
    tick(t) {
      now = t;
      likesEl.textContent = `❤️ ${fmt(12400 + hostLikes)}`;

      // Tastatura: urcă după atingerea căsuței, coboară după trimitere.
      if (typing) kbOpen = easeIO((now - typing.start - 0.16) / 0.32);
      else if (closeAt >= 0) kbOpen = 1 - easeIO((now - closeAt - 0.08) / 0.3);
      else kbOpen = 0;
      kbEl.style.transform = `translateY(${(1 - kbOpen) * (KB_H + 20)}px)`;
      kbEl.style.visibility = kbOpen > 0.001 ? 'visible' : 'hidden';
      const barY = BAR_Y + (KB_BAR_Y - BAR_Y) * kbOpen;
      bottomEl.style.transform = `translateY(${barY}px)`;
      for (const b of btnEls) {
        b.style.opacity = String(1 - kbOpen);
        b.style.width = `${84 * (1 - kbOpen)}px`;
        b.style.marginLeft = `${-16 * kbOpen}px`;
      }

      const state = renderKeyboard();
      renderInput(state);

      // Atingeri: pe căsuță (deschide tastatura) și pe butonul de trimitere.
      let tap = null;
      if (typing) {
        const local = now - typing.start;
        if (local < 0.3) tap = { x: 300, y: BAR_Y + 46, p: local / 0.3 };
        else if (local >= typing.sendTap && local < typing.sendTap + 0.3) {
          tap = { x: W - 24 - 12 - 32 - 4, y: KB_BAR_Y + 46, p: (local - typing.sendTap) / 0.3 };
        }
      }
      if (tap) {
        tapEl.style.opacity = String(0.9 * (1 - tap.p));
        tapEl.style.transform = `translate(${tap.x}px, ${tap.y}px) scale(${0.55 + tap.p * 0.6})`;
      } else tapEl.style.opacity = '0';

      // Chat: cel nou intră de jos, ceilalți urcă lin; cei de sus se estompează.
      // Cu tastatura deschisă, chatul stă deasupra căsuței de scris.
      chatBottom = CHAT_BOTTOM + (KB_CHAT_BOTTOM - CHAT_BOTTOM) * kbOpen;
      const max = kbOpen > 0.5 ? CHAT_MAX_KB : CHAT_MAX;
      let y = 0;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (!m.h) m.h = m.node.offsetHeight + 10;
        y -= m.h;
        if (m.y === null) m.y = y + 40;
        m.y += (y - m.y) * 0.32;
        const fromTop = msgs.length - 1 - i;
        const appear = ease((now - m.born) / 0.18);
        const fade = fromTop >= max ? 0 : fromTop >= max - 1 && max > 3 ? 0.45 : 1;
        m.node.style.transform = `translate(${(1 - appear) * -30}px, ${chatBottom + m.y}px)`;
        m.node.style.opacity = String(appear * fade);
      }

      // Bannerele de cadouri, deasupra chatului (urcă și ele cu tastatura).
      const by = BANNER_Y + (KB_CHAT_BOTTOM - CHAT_MAX_KB * 82 - 120 - BANNER_Y) * kbOpen;
      banners.forEach((b) => {
        const age = now - b.born;
        const inX = ease(age / 0.3);
        const out = now > b.until ? ease((now - b.until) / 0.3) : 0;
        b.node.style.transform = `translate(${(1 - inX) * -500 - out * 600}px, ${by}px)`;
        b.node.style.opacity = String(inX * (1 - out));
      });

      // Inimi care urcă pe dreapta (pornesc de deasupra tastaturii când e deschisă).
      const heartBase = 1770 + (KB_BAR_Y - 20 - 1770) * kbOpen;
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        const p = (now - h.born) / h.life;
        if (p >= 1) {
          h.node.remove();
          hearts.splice(i, 1);
          continue;
        }
        const x = h.x0 + Math.sin(p * 5) * 18 + h.drift * p;
        const yy = heartBase - p * 520;
        const s = 0.6 + Math.min(1, p * 4) * 0.5;
        h.node.style.transform = `translate(${x}px, ${yy}px) scale(${s})`;
        h.node.style.opacity = String(p > 0.7 ? (1 - p) / 0.3 : 1);
      }
    },
  };
})();

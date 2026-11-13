// Stratul „ca pe un LIVE” peste joc: antet cu LIVE și spectatori, chat jos, bannere de cadouri,
// inimi pentru like-uri și căsuța de comentariu în care cineva tastează.
// Se injectează în pagina jocului. Nu folosește animații CSS sau ceasul real: totul se desenează
// din tick(t), cu timpul videoclipului, ca fiecare cadru să iasă exact.
(() => {
  // Jocul nu pornește singur: cadrele le dă înregistrarea (game.step), cu timpul videoclipului.
  window.requestAnimationFrame = () => 0;
  const W = 1080;
  const H = 1920;
  const CHAT_BOTTOM = 1778; // marginea de jos a listei de comentarii
  const CHAT_MAX = 5;
  const BANNER_Y = 1262; // între zona de joc (se termină la ~1250) și chat

  const css = `
  #live-ui { position: fixed; inset: 0; width: ${W}px; height: ${H}px; pointer-events: none; z-index: 50;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif; color: #fff; overflow: hidden; }
  #live-ui * { box-sizing: border-box; }
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
  .lv-msg.me { box-shadow: 0 0 0 3px rgba(255,255,255,.75); }
  .lv-banner { position: absolute; left: 0; top: 0; height: 104px; display: flex; align-items: center; gap: 16px;
    padding: 0 34px 0 10px; border-radius: 999px; background: linear-gradient(90deg, rgba(255,184,0,.95), rgba(255,94,58,.85)); }
  .lv-banner .av { width: 84px; height: 84px; font-size: 36px; }
  .lv-banner .who { font-size: 27px; font-weight: 800; line-height: 1.1; }
  .lv-banner .what { font-size: 25px; opacity: .95; }
  .lv-banner .ico { font-size: 64px; margin-left: 4px; }
  .lv-banner .cnt { font-size: 66px; font-weight: 900; font-style: italic; margin-left: 10px;
    text-shadow: 0 3px 0 rgba(0,0,0,.25); }
  .lv-heart { position: absolute; font-size: 54px; }
  .lv-bottom { position: absolute; left: 24px; right: 24px; top: 1800px; height: 92px; display: flex; gap: 16px; align-items: center; }
  .lv-input { flex: 1; height: 84px; border-radius: 999px; background: rgba(255,255,255,.16); display: flex; align-items: center;
    padding: 0 30px; font-size: 32px; gap: 14px; overflow: hidden; white-space: nowrap; }
  .lv-input .ph { opacity: .62; }
  .lv-input.typing { background: rgba(255,255,255,.95); color: #111; }
  .lv-input .caret { display: inline-block; width: 3px; height: 40px; background: #fe2c55; vertical-align: middle; margin-left: 2px; }
  .lv-input .send { margin-left: auto; width: 60px; height: 60px; border-radius: 50%; background: #fe2c55; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 32px; }
  .lv-input .av { width: 52px; height: 52px; font-size: 22px; }
  .lv-btn { width: 84px; height: 84px; border-radius: 50%; background: rgba(0,0,0,.38); display: flex; align-items: center; justify-content: center; font-size: 42px; }
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

  let root, chatBox, viewersEl, facesEl, likesEl, inputEl, bannerBox;
  const msgs = []; // { node, born, y, h }
  const banners = []; // { node, born, until }
  const hearts = []; // { node, born, x0, drift, life }
  let typing = null; // { user, color, text, start, dur }
  let now = 0;
  let facesKey = '';
  let hostLikes = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const WORDS = {
    ro: { follow: '+ Urmărește', comment: 'Adaugă un comentariu…', joined: 'a intrat', sent: 'a trimis' },
    en: { follow: '+ Follow', comment: 'Add a comment…', joined: 'joined', sent: 'sent' },
  };
  let w = WORDS.ro;

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

    chatBox = el('div', 'lv-chat');
    bannerBox = el('div', 'lv-chat');

    const bottom = el('div', 'lv-bottom');
    inputEl = el('div', 'lv-input');
    bottom.append(inputEl, el('div', 'lv-btn', '🎁'), el('div', 'lv-btn', '❤️'), el('div', 'lv-btn', '↗'));

    root.append(top, chatBox, bannerBox, bottom);
    document.body.append(root);
    renderInput();
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

  function renderInput() {
    inputEl.replaceChildren();
    if (typing) {
      const shown = Math.floor(typing.text.length * Math.min(1, (now - typing.start) / typing.dur));
      inputEl.classList.add('typing');
      inputEl.append(avatar(typing.user, typing.color));
      const txt = el('span', '', typing.text.slice(0, shown));
      inputEl.append(txt);
      if (Math.floor(now * 2.5) % 2 === 0 || shown < typing.text.length) inputEl.append(el('span', 'caret'));
      const send = el('div', 'send', '➤');
      send.style.opacity = shown >= typing.text.length ? '1' : '.35';
      inputEl.append(send);
    } else {
      inputEl.classList.remove('typing');
      inputEl.append(el('span', 'ph', w.comment));
    }
  }

  const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}K` : String(n));

  window.__live = {
    init(host, lang = 'ro') {
      w = WORDS[lang] ?? WORDS.ro;
      build(host);
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
      root.append(node);
      hearts.push({ node, born: now, x0: 930 + rnd() * 60, drift: (rnd() - 0.5) * 160, life: 1.8 + rnd() * 0.6 });
    },
    /** Cineva începe să tasteze; după `dur` secunde textul e complet (trimiterea o face scenariul). */
    type(name, color, text, dur) {
      typing = { user: name, color, text, start: now, dur };
    },
    sent() {
      typing = null;
    },
    tick(t) {
      now = t;
      likesEl.textContent = `❤️ ${fmt(12400 + hostLikes)}`;

      // Chat: cel nou intră de jos, ceilalți urcă lin; cei de sus se estompează.
      let y = CHAT_BOTTOM;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (!m.h) m.h = m.node.offsetHeight + 10;
        y -= m.h;
        if (m.y === null) m.y = y + 40;
        m.y += (y - m.y) * 0.32;
        const fromTop = msgs.length - 1 - i;
        const appear = ease((now - m.born) / 0.18);
        const fade = fromTop >= CHAT_MAX ? 0 : fromTop >= CHAT_MAX - 2 ? 0.45 : 1;
        m.node.style.transform = `translate(${(1 - appear) * -30}px, ${m.y}px)`;
        m.node.style.opacity = String(appear * fade);
      }

      // Bannerele de cadouri, deasupra chatului.
      banners.forEach((b) => {
        const age = now - b.born;
        const inX = ease(age / 0.3);
        const out = now > b.until ? ease((now - b.until) / 0.3) : 0;
        const by = BANNER_Y;
        b.node.style.transform = `translate(${(1 - inX) * -500 - out * 600}px, ${by}px)`;
        b.node.style.opacity = String(inX * (1 - out));
      });

      // Inimi care urcă pe dreapta.
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        const p = (now - h.born) / h.life;
        if (p >= 1) {
          h.node.remove();
          hearts.splice(i, 1);
          continue;
        }
        const show = p < 0 ? 0 : 1;
        const x = h.x0 + Math.sin(p * 5) * 18 + h.drift * p;
        const yy = 1770 - p * 520;
        const s = 0.6 + Math.min(1, p * 4) * 0.5;
        h.node.style.transform = `translate(${x}px, ${yy}px) scale(${s})`;
        h.node.style.opacity = String(show * (p > 0.7 ? (1 - p) / 0.3 : 1));
      }

      renderInput();
    },
  };
})();

import { t } from '../i18n';
import { LINK_STATE, saveAddress, savedAddress, toWsUrl } from '../net/serverAddress';

/** Cât așteptăm la pornire până să arătăm câmpul de adresă (dacă nu s-a conectat singur). */
const START_GRACE_MS = 6000;
/** Gestul ascuns care redeschide ecranul: atâtea atingeri în colțul din stânga sus... */
const SECRET_TAPS = 5;
/** ...în cel mult atâtea milisecunde. */
const SECRET_WINDOW_MS = 3000;

const CSS = `
#connect { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  background: rgba(8, 10, 24, 0.94); color: #e8ecff; font: 16px/1.45 system-ui, sans-serif; padding: 24px; }
#connect[hidden] { display: none; }
#connect .box { width: 100%; max-width: 440px; }
#connect h1 { font-size: 22px; margin: 0 0 6px; }
#connect p { margin: 8px 0; color: #aab3d6; }
#connect label { display: block; margin: 18px 0 6px; font-weight: 600; }
#connect input { width: 100%; box-sizing: border-box; padding: 12px; font-size: 17px; border-radius: 10px;
  border: 1px solid #3a4475; background: #11152a; color: inherit; }
#connect button { margin-top: 12px; width: 100%; padding: 13px; font-size: 17px; font-weight: 600; border: 0;
  border-radius: 10px; background: #4f6bff; color: #fff; }
#connect .status { margin-top: 14px; padding: 10px 12px; border-radius: 10px; border: 1px solid #3a4475; }
#connect .status.ok { border-color: #2fd27a; color: #2fd27a; }
#connect .status.error { border-color: #e5484d; color: #ffb3b5; }
#connect .tiny { font-size: 12px; color: #6f7899; margin-top: 18px; }
#secret-corner { position: fixed; left: 0; top: 0; width: 90px; height: 90px; z-index: 9; }
`;

/**
 * Ecranul de conectare al aplicației de telefon: unde e calculatorul cu serverul.
 * Adresa se ține minte; la pornirile următoare se conectează singur și ecranul dispare.
 */
export function setupConnectScreen(): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const root = document.createElement('div');
  root.id = 'connect';
  root.innerHTML = `
    <form class="box">
      <h1></h1>
      <p class="intro"></p>
      <label for="connect-addr"></label>
      <input id="connect-addr" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url" />
      <button type="submit"></button>
      <div class="status" hidden></div>
      <p class="tiny"></p>
    </form>`;
  document.body.append(root);

  const form = root.querySelector('form')!;
  const input = root.querySelector('input')!;
  const status = root.querySelector<HTMLElement>('.status')!;
  const fill = () => {
    root.querySelector('h1')!.textContent = t('app.title');
    root.querySelector('.intro')!.textContent = t('app.intro');
    root.querySelector('label')!.textContent = t('app.address');
    input.placeholder = t('app.placeholder');
    root.querySelector('button')!.textContent = t('app.connect');
    root.querySelector('.tiny')!.textContent = t('app.version', { v: __APP_VERSION__ });
  };

  let connected = false;
  let attempt = 0;
  const setStatus = (kind: 'wait' | 'ok' | 'error', text: string) => {
    status.hidden = false;
    status.className = `status ${kind === 'wait' ? '' : kind}`;
    status.textContent = text;
  };
  const show = () => {
    fill();
    input.value = savedAddress();
    root.hidden = false;
  };
  const hide = () => {
    root.hidden = true;
    input.blur();
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const url = toWsUrl(input.value);
    if (!url) {
      setStatus('error', t('app.badAddress'));
      return;
    }
    setStatus('wait', t('app.connecting', { url }));
    saveAddress(input.value);
    watchAttempt(url);
  });

  /** Dacă nici după câteva secunde nu ne-am conectat, spunem ce să verifice. */
  const watchAttempt = (url: string) => {
    const mine = ++attempt;
    setTimeout(() => {
      if (mine === attempt && !connected && !root.hidden) setStatus('error', t('app.notFound', { url }));
    }, START_GRACE_MS);
  };

  window.addEventListener(LINK_STATE, (ev) => {
    connected = (ev as CustomEvent<boolean>).detail;
    if (connected && !root.hidden) {
      setStatus('ok', t('app.connected'));
      setTimeout(() => connected && hide(), 900);
    }
    // O deconectare în timpul live-ului NU redeschide ecranul: l-ar vedea spectatorii. Panoul arată starea.
  });

  // Gestul ascuns: atingeri repetate în colțul din stânga sus.
  const corner = document.createElement('div');
  corner.id = 'secret-corner';
  document.body.append(corner);
  let taps: number[] = [];
  corner.addEventListener('pointerdown', () => {
    const now = Date.now();
    taps = [...taps.filter((ts) => now - ts < SECRET_WINDOW_MS), now];
    if (taps.length >= SECRET_TAPS) {
      taps = [];
      show();
      setStatus(connected ? 'ok' : 'error', t(connected ? 'app.connected' : 'app.disconnected'));
    }
  });

  // La pornire: fără adresă, cerem una; cu adresă, încercăm întâi singuri.
  show();
  const url = toWsUrl(savedAddress());
  if (url) {
    setStatus('wait', t('app.connecting', { url }));
    watchAttempt(url);
  } else {
    status.hidden = true;
    input.focus();
  }
}

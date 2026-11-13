// Ce panouri se văd: „Tot” sau doar cele alese. Fiecare panou se poate deschide și în fereastra lui (↗).
// Alegerea se ține minte în browser; o fereastră deschisă cu ↗ (panel.html?show=boti) nu o schimbă.

const STORE_KEY = 'panel.views';

export function setupViews(nav: HTMLElement): void {
  const cards = [...document.querySelectorAll<HTMLElement>('main > [data-panel]')];
  const ids = cards.map((c) => c.dataset.panel!);
  const fromUrl = new URLSearchParams(location.search).get('show');
  const persist = fromUrl === null;

  let shown = new Set<string>(
    (fromUrl ?? read() ?? '').split(',').filter((id) => ids.includes(id)),
  );

  const allChip = chip('panel.viewAll');
  allChip.addEventListener('click', () => update(new Set()));
  nav.append(allChip);

  const chips = new Map<string, HTMLButtonElement>();
  for (const card of cards) {
    const id = card.dataset.panel!;
    const h2 = card.querySelector('h2')!;
    const c = chip(h2.dataset.i18n!);
    c.addEventListener('click', () => {
      const next = new Set(shown);
      // Din „Tot”, primul clic arată doar panoul ăsta; apoi clicurile adaugă / scot panouri.
      if (next.size === 0) next.add(id);
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      update(next);
    });
    chips.set(id, c);
    nav.append(c);

    // Butonul ↗ din colțul panoului: același panou, singur, în fereastra lui.
    const head = document.createElement('div');
    head.className = 'card-head';
    h2.replaceWith(head);
    const pop = document.createElement('button');
    pop.type = 'button';
    pop.className = 'popout';
    pop.textContent = '↗';
    pop.dataset.i18nTitle = 'panel.openWindow';
    pop.addEventListener('click', () => {
      window.open(`${location.pathname}?show=${id}`, `panel-${id}`, 'width=560,height=900');
    });
    head.append(h2, pop);
  }

  function update(next: Set<string>): void {
    shown = next;
    if (persist) write([...shown].join(','));
    render();
  }

  function render(): void {
    const all = shown.size === 0;
    allChip.classList.toggle('on', all);
    allChip.setAttribute('aria-pressed', String(all));
    for (const card of cards) card.hidden = !all && !shown.has(card.dataset.panel!);
    for (const [id, c] of chips) {
      const on = !all && shown.has(id);
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', String(on));
    }
    document.body.classList.toggle('single', shown.size === 1);
  }

  render();
}

function chip(i18nKey: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.dataset.i18n = i18nKey;
  return b;
}

// Stocarea browserului poate lipsi (fereastră privată, date blocate): atunci pur și simplu nu țin minte.
function read(): string | null {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}
function write(value: string): void {
  try {
    localStorage.setItem(STORE_KEY, value);
  } catch {
    /* nimic */
  }
}

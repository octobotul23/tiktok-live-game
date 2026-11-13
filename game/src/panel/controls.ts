// Un câmp numeric din panou: slider pentru reglaj rapid + căsuță în care scrii cifra exactă.
// Sliderul și căsuța stau mereu sincronizate; valoarea se trimite după o mică pauză (nu la fiecare pixel).

export interface NumberControlSpec {
  id: string;
  min: number;
  max: number;
  step: number;
  /** Cheia i18n a etichetei. */
  labelKey: string;
  /** Cheia i18n a explicației de sub câmp (opțional). */
  hintKey?: string;
  /** Unitate afișată după căsuță (ex. „%”, „/s”). */
  unit?: string;
  onChange: (value: number) => void;
}

export interface NumberControl {
  el: HTMLElement;
  /** Valoare venită de la server; ignorată cât timp utilizatorul lucrează în câmp. */
  set(value: number): void;
}

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length;

export function clampToStep(raw: number, min: number, max: number, step: number): number {
  const v = Math.min(max, Math.max(min, Math.round(raw / step) * step));
  return Number(v.toFixed(decimals(step)));
}

export function numberControl(spec: NumberControlSpec): NumberControl {
  const el = document.createElement('div');
  el.className = 'field';

  const label = document.createElement('label');
  label.htmlFor = `${spec.id}-num`;
  label.dataset.i18n = spec.labelKey;

  const range = document.createElement('input');
  range.type = 'range';
  range.id = `${spec.id}-range`;
  range.tabIndex = -1; // tastatura merge în căsuță; sliderul e pentru mouse / deget
  range.setAttribute('aria-hidden', 'true');

  const num = document.createElement('input');
  num.type = 'number';
  num.id = `${spec.id}-num`;
  num.inputMode = spec.step < 1 ? 'decimal' : 'numeric';
  for (const input of [range, num]) {
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
  }

  const box = document.createElement('div');
  box.className = 'field-input';
  box.append(range, num);
  if (spec.unit) {
    const unit = document.createElement('span');
    unit.className = 'unit';
    unit.textContent = spec.unit;
    box.append(unit);
  }
  el.append(label, box);

  if (spec.hintKey) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.dataset.i18n = spec.hintKey;
    el.append(hint);
  }

  const clamp = (v: number) => clampToStep(v, spec.min, spec.max, spec.step);

  range.addEventListener('input', () => {
    num.value = range.value;
    num.classList.remove('bad');
    spec.onChange(Number(range.value));
  });

  // În timp ce scrii nu corectez nimic (altfel „150” ar sări la minim după prima cifră);
  // trimit doar când cifra e deja validă.
  num.addEventListener('input', () => {
    const v = num.valueAsNumber;
    const ok = Number.isFinite(v) && v >= spec.min && v <= spec.max;
    num.classList.toggle('bad', num.value !== '' && !ok);
    if (!ok) return;
    range.value = String(v);
    spec.onChange(clamp(v));
  });

  // La Enter / ieșirea din căsuță: aduc valoarea în limite și o afișez corectată.
  num.addEventListener('change', () => {
    const v = Number.isFinite(num.valueAsNumber) ? clamp(num.valueAsNumber) : Number(range.value);
    num.value = String(v);
    range.value = String(v);
    num.classList.remove('bad');
    spec.onChange(v);
  });

  return {
    el,
    set(value: number) {
      if (el.contains(document.activeElement)) return;
      range.value = String(value);
      num.value = String(value);
      num.classList.remove('bad');
    },
  };
}

/** Câmp cu listă de alegere (ex. „boții votează: opțiunea 2”). */
export function selectControl(spec: {
  id: string;
  labelKey: string;
  hintKey?: string;
  options: { value: number; labelKey?: string; text?: string }[];
  onChange: (value: number) => void;
}): NumberControl {
  const el = document.createElement('div');
  el.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = spec.id;
  label.dataset.i18n = spec.labelKey;
  const select = document.createElement('select');
  select.id = spec.id;
  for (const o of spec.options) {
    const opt = document.createElement('option');
    opt.value = String(o.value);
    if (o.labelKey) opt.dataset.i18n = o.labelKey;
    else opt.textContent = o.text ?? String(o.value);
    select.append(opt);
  }
  select.addEventListener('change', () => spec.onChange(Number(select.value)));
  const box = document.createElement('div');
  box.className = 'field-input';
  box.append(select);
  el.append(label, box);
  if (spec.hintKey) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.dataset.i18n = spec.hintKey;
    el.append(hint);
  }
  return {
    el,
    set(value: number) {
      if (document.activeElement !== select) select.value = String(value);
    },
  };
}

/** Strânge mai multe schimbări rapide într-un singur mesaj către server. */
export function batcher<T extends object>(send: (patch: Partial<T>) => void, delayMs = 150) {
  let pending: Partial<T> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (patch: Partial<T>) => {
    pending = { ...pending, ...patch };
    clearTimeout(timer);
    timer = setTimeout(() => {
      const p = pending;
      pending = {};
      send(p);
    }, delayMs);
  };
}

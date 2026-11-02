import type { Lang } from '../../../shared/protocol';
import { EN } from './en';
import { RO, type StringKey } from './ro';

export type { Lang, StringKey };

const DICTS: Record<Lang, Record<StringKey, string>> = { ro: RO, en: EN };

let lang: Lang = 'ro';
const listeners = new Set<(lang: Lang) => void>();

export function getLang(): Lang {
  return lang;
}

/** Schimbă limba și anunță tot ce afișează texte fixe (carduri, etichete), ca să se redeseneze. */
export function setLang(next: Lang): void {
  if (next === lang || !(next in DICTS)) return;
  lang = next;
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn: (lang: Lang) => void): void {
  listeners.add(fn);
}

/** Textul pentru cheie, în limba curentă: t('survival.wave', { n: 3 }) → „VALUL 3”. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  const s = DICTS[lang][key] ?? RO[key];
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

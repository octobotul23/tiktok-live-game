import { describe, expect, it } from 'vitest';
import { EN } from './en';
import { getLang, setLang, t } from './index';
import { RO, type StringKey } from './ro';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  it('fiecare traducere are aceleași {parametri} ca originalul', () => {
    for (const key of Object.keys(RO) as StringKey[]) {
      expect(placeholders(EN[key]), key).toEqual(placeholders(RO[key]));
    }
  });

  it('înlocuiește parametrii și schimbă limba', () => {
    setLang('ro');
    expect(t('survival.wave', { n: 3 })).toBe('VALUL 3');
    setLang('en');
    expect(getLang()).toBe('en');
    expect(t('survival.wave', { n: 3 })).toBe('WAVE 3');
    expect(t('gift.votes', { name: 'Ana', n: 25, option: 2 })).toBe('🎁 Ana: +25 votes for 2');
    setLang('ro');
  });

  it('lasă neatins un parametru care lipsește', () => {
    expect(t('survival.wave')).toBe('VALUL {n}');
  });
});

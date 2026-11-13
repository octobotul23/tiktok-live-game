import { describe, expect, it } from 'vitest';
import { SIM_FIELDS, SIM_KEYS, SIM_PRESETS } from '../../../shared/sim';
import { EN } from '../i18n/en';
import { RO } from '../i18n/ro';
import { GROUPS } from './bots';
import { clampToStep } from './controls';

describe('cardul Boți', () => {
  it('fiecare setare apare o singură dată, într-un grup', () => {
    const listed = GROUPS.flatMap((g) => g.keys);
    expect([...listed].sort()).toEqual([...SIM_KEYS].sort());
  });

  it('toate textele cardului există în română și engleză', () => {
    const keys = [
      ...GROUPS.map((g) => g.titleKey),
      ...SIM_KEYS.flatMap((k) => [`bots.${k}`, `bots.${k}Hint`]),
      ...SIM_PRESETS.map((p) => `bots.preset.${p.id}`),
      ...(SIM_FIELDS.voteFor.options ?? []).map((v) => `bots.voteFor${v}`),
    ];
    for (const k of keys) {
      expect(RO, k).toHaveProperty([k]);
      expect(EN, k).toHaveProperty([k]);
    }
  });
});

describe('căsuța de număr', () => {
  it('rotunjește la pas și rămâne în limite', () => {
    expect(clampToStep(2.26, 0, 300, 0.5)).toBe(2.5);
    expect(clampToStep(5000, 0, 1000, 1)).toBe(1000);
    expect(clampToStep(-4, 1, 200, 1)).toBe(1);
    expect(clampToStep(0.1 + 0.2, 0, 10, 0.1)).toBe(0.3);
  });
});

import { describe, expect, it } from 'vitest';
import { clampMaxActive, clampNewcomerSec } from './config';

describe('clampNewcomerSec', () => {
  it('păstrează valorile din interval, rotunjite', () => {
    expect(clampNewcomerSec(10)).toBe(10);
    expect(clampNewcomerSec(7.6)).toBe(8);
    expect(clampNewcomerSec(0)).toBe(0);
  });
  it('taie ce iese din interval', () => {
    expect(clampNewcomerSec(-5)).toBe(0);
    expect(clampNewcomerSec(500)).toBe(60);
  });
  it('ce nu e număr devine valoarea implicită', () => {
    expect(clampNewcomerSec(Number.NaN)).toBe(10);
    expect(clampNewcomerSec(Number.POSITIVE_INFINITY)).toBe(10);
  });
});

describe('clampMaxActive', () => {
  it('ține plafonul între 20 și 1000', () => {
    expect(clampMaxActive(5)).toBe(20);
    expect(clampMaxActive(5000)).toBe(1000);
    expect(clampMaxActive(299.4)).toBe(299);
  });
});

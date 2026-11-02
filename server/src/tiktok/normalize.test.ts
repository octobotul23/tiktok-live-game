import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEvent } from '../../../shared/protocol';
import { GiftStreakCollapser, type RawGift } from './normalize';

const user = { userId: 'u1', uniqueId: 'ana', nickname: 'Ana' };
const rose = (repeatCount: number, repeatEnd: boolean): RawGift => ({
  user, giftId: 5655, giftName: 'Rose', diamonds: 1, giftType: 1, repeatCount, repeatEnd,
});

describe('GiftStreakCollapser', () => {
  let events: LiveEvent[];
  let collapser: GiftStreakCollapser;

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
    collapser = new GiftStreakCollapser((e) => events.push(e), 4000);
  });
  afterEach(() => vi.useRealTimers());

  it('emite un singur gift la finalul seriei, cu cantitatea totală', () => {
    collapser.push(rose(1, false));
    collapser.push(rose(2, false));
    collapser.push(rose(3, false));
    collapser.push(rose(3, true));
    const gifts = events.filter((e) => e.type === 'gift');
    expect(gifts).toHaveLength(1);
    expect(gifts[0]).toMatchObject({ type: 'gift', count: 3 });
    expect(events.filter((e) => e.type === 'giftProgress')).toHaveLength(3);
  });

  it('cadourile care nu fac serie se emit imediat', () => {
    collapser.push({ ...rose(1, false), giftType: 2, giftName: 'Galaxy' });
    expect(events).toEqual([expect.objectContaining({ type: 'gift', giftName: 'Galaxy', count: 1 })]);
  });

  it('închide seria la timeout dacă repeatEnd nu mai vine', () => {
    collapser.push(rose(1, false));
    collapser.push(rose(5, false));
    vi.advanceTimersByTime(4001);
    expect(events.filter((e) => e.type === 'gift')).toEqual([expect.objectContaining({ count: 5 })]);
  });

  it('seriile de la utilizatori diferiți nu se amestecă', () => {
    const other = { userId: 'u2', uniqueId: 'bob', nickname: 'Bob' };
    collapser.push(rose(1, false));
    collapser.push({ ...rose(1, false), user: other });
    collapser.push({ ...rose(4, true), user: other });
    collapser.push(rose(2, true));
    const gifts = events.filter((e) => e.type === 'gift');
    expect(gifts.map((g) => [g.user.userId, (g as { count: number }).count])).toEqual([['u2', 4], ['u1', 2]]);
  });
});

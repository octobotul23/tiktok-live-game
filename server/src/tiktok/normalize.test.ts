import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEvent } from '../../../shared/protocol';
import { cleanUsername } from './Connector';
import {
  chatFromTikTok,
  followFromTikTok,
  giftFromTikTok,
  GiftStreakCollapser,
  likeFromTikTok,
  memberFromTikTok,
  type RawGift,
} from './normalize';

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

// Forma de azi a mesajelor (tiktok-live-connector 2.x, protobuf aproape neatins).
const protoUser = { id: '7012', displayId: 'maria.p', nickname: 'Maria', followInfo: { followStatus: 1 } };

describe('mesajele brute TikTok → evenimentele jocului', () => {
  it('comentariu în forma nouă (content, displayId, id)', () => {
    const e = chatFromTikTok({ user: protoUser, content: '  stânga ⬅️ ' }, 5);
    expect(e).toEqual({
      type: 'chat',
      user: { userId: '7012', uniqueId: 'maria.p', nickname: 'Maria', isFollower: true },
      text: 'stânga ⬅️',
      ts: 5,
    });
  });

  it('comentariu în forma veche (comment, uniqueId, userId)', () => {
    const e = chatFromTikTok({ user: { userId: 9, uniqueId: 'ion', nickname: '' }, comment: 'sus' }, 1);
    expect(e).toMatchObject({ type: 'chat', text: 'sus', user: { userId: '9', uniqueId: 'ion', nickname: 'ion' } });
    // Fără informație de follow nu ghicim: jocul păstrează ce știa deja.
    expect(e && 'user' in e && 'isFollower' in e.user).toBe(false);
  });

  it('ignoră comentariile goale și pe cele fără utilizator', () => {
    expect(chatFromTikTok({ user: protoUser, content: '   ' })).toBeNull();
    expect(chatFromTikTok({ content: 'sus' })).toBeNull();
    expect(chatFromTikTok(undefined)).toBeNull();
  });

  it('urmăritor: userIdentity are prioritate, followStatus 0 = nu urmărește', () => {
    const notFollowing = { ...protoUser, followInfo: { followStatus: 0 } };
    expect(memberFromTikTok({ user: notFollowing })).toMatchObject({ user: { isFollower: false } });
    expect(memberFromTikTok({ user: notFollowing, userIdentity: { isFollowerOfAnchor: true } })).toMatchObject({
      user: { isFollower: true },
    });
    expect(memberFromTikTok({ user: { ...protoUser, followInfo: { followStatus: 2 } } })).toMatchObject({
      user: { isFollower: true },
    });
  });

  it('like-uri: count sau likeCount, minim 1', () => {
    expect(likeFromTikTok({ user: protoUser, count: 15 })).toMatchObject({ type: 'like', count: 15 });
    expect(likeFromTikTok({ user: protoUser, likeCount: 3 })).toMatchObject({ count: 3 });
    expect(likeFromTikTok({ user: protoUser })).toMatchObject({ count: 1 });
  });

  it('follow: marchează utilizatorul ca urmăritor', () => {
    const e = followFromTikTok({ user: { ...protoUser, followInfo: { followStatus: 0 } } });
    expect(e).toMatchObject({ type: 'follow', user: { isFollower: true } });
  });

  it('cadou în forma nouă: gift.name, diamondCount, repeatEnd numeric', () => {
    const g = giftFromTikTok({
      user: protoUser,
      giftId: 5655,
      repeatCount: 7,
      repeatEnd: 1,
      gift: { name: 'Rose', diamondCount: 1, type: 1 },
    });
    expect(g).toMatchObject({ giftId: 5655, giftName: 'Rose', diamonds: 1, giftType: 1, repeatCount: 7, repeatEnd: true });
    expect(giftFromTikTok({ user: protoUser, giftId: 5655, repeatEnd: 0, gift: { name: 'Rose' } })?.repeatEnd).toBe(false);
  });

  it('cadou în forma veche (giftDetails) și fără nume', () => {
    const old = giftFromTikTok({ user: protoUser, giftId: 1, giftDetails: { giftName: 'TikTok', diamondCount: 1, giftType: 0 } });
    expect(old).toMatchObject({ giftName: 'TikTok', diamonds: 1, giftType: 0, repeatCount: 1, repeatEnd: false });
    expect(giftFromTikTok({ user: protoUser, giftId: 42 })).toMatchObject({ giftName: 'Gift 42', diamonds: 0 });
    // Un cadou „combo” fără `type` explicit e tot unul care vine în serie.
    expect(giftFromTikTok({ user: protoUser, giftId: 2, gift: { name: 'X', combo: true } })?.giftType).toBe(1);
  });
});

describe('cleanUsername', () => {
  it('acceptă nume, @nume și linkuri de profil sau de live', () => {
    expect(cleanUsername('maria.p')).toBe('maria.p');
    expect(cleanUsername('  @maria_p ')).toBe('maria_p');
    expect(cleanUsername('https://www.tiktok.com/@maria.p/live?lang=ro')).toBe('maria.p');
    expect(cleanUsername('tiktok.com/@maria.p')).toBe('maria.p');
  });

  it('respinge ce nu poate fi un username', () => {
    expect(cleanUsername('')).toBe('');
    expect(cleanUsername('maria p')).toBe('');
    expect(cleanUsername('<script>')).toBe('');
    expect(cleanUsername('a'.repeat(30))).toBe('');
  });
});

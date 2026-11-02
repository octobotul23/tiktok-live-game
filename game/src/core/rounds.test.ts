import { describe, expect, it } from 'vitest';
import { resolveGift, voteForGift } from './GiftRouter';
import { LikeMeter } from './LikeMeter';
import { RoundDirector, type DirectorHooks } from './RoundDirector';
import { VoteSystem } from './VoteSystem';

function makeDirector(over = false) {
  const log: string[] = [];
  let roundOver = over;
  const hooks: DirectorHooks = {
    enterLobby: (id) => log.push(`lobby:${id}`),
    enterPlaying: () => log.push('playing'),
    roundMaxSec: () => 60,
    isRoundOver: () => roundOver,
    enterResults: () => log.push('results'),
    enterVote: () => log.push('vote'),
    finishVote: () => 'boss',
    randomMode: () => 'random',
  };
  const d = new RoundDirector(hooks, { lobbySec: 10, resultsSec: 10, voteSec: 20 });
  return { d, log, setOver: (v: boolean) => (roundOver = v) };
}

describe('RoundDirector', () => {
  it('parcurge lobby → joc → rezultate → vot → lobby cu modul câștigător', () => {
    const { d, log } = makeDirector();
    d.begin('survival');
    d.update(10);
    d.update(60);
    d.update(10);
    d.update(20);
    expect(log).toEqual(['lobby:survival', 'playing', 'results', 'vote', 'lobby:boss']);
    expect(d.modeId).toBe('boss');
  });

  it('runda se termină mai devreme când modul spune că s-a terminat', () => {
    const { d, log, setOver } = makeDirector();
    d.begin('survival');
    d.update(10);
    d.update(5);
    expect(d.phase).toBe('playing');
    setOver(true);
    d.update(0.016);
    expect(log.at(-1)).toBe('results');
  });

  it('streamerul alege direct un mod din orice fază', () => {
    const { d, log } = makeDirector();
    d.begin('survival');
    d.update(10);
    d.pickMode('boss');
    expect(d.phase).toBe('lobby');
    expect(log.at(-1)).toBe('lobby:boss');
  });

  it('skipVote în vot termină votul imediat', () => {
    const { d, log } = makeDirector(true);
    d.begin('survival');
    d.update(10);
    d.update(0.1);
    d.update(10);
    expect(d.phase).toBe('vote');
    d.skipVote();
    expect(log.at(-1)).toBe('lobby:boss');
  });

  it('skipVote înainte de vot sare peste următorul vot', () => {
    const { d, log } = makeDirector(true);
    d.begin('survival');
    d.skipVote();
    d.update(10);
    d.update(0.1);
    d.update(10);
    expect(log).toEqual(['lobby:survival', 'playing', 'results', 'lobby:random']);
  });

  it('endRound trece la rezultate', () => {
    const { d } = makeDirector();
    d.begin('survival');
    d.update(10);
    d.endRound();
    expect(d.phase).toBe('results');
  });
});

describe('VoteSystem', () => {
  it('exclude modul tocmai jucat', () => {
    for (let i = 0; i < 20; i++) {
      const opts = VoteSystem.pickOptions(['a', 'b', 'c', 'd', 'e'], 'c', 3);
      expect(opts).toHaveLength(3);
      expect(opts).not.toContain('c');
      expect(new Set(opts).size).toBe(3);
    }
  });

  it('cu prea puține moduri, îl include totuși pe ultimul, la final', () => {
    expect(VoteSystem.pickOptions(['a', 'b'], 'a', 3)).toEqual(['b', 'a']);
  });

  it('un vot per spectator, ultimul contează; cadourile se adună', () => {
    const v = new VoteSystem();
    v.start(['a', 'b', 'c']);
    v.vote('u1', 0);
    v.vote('u1', 2);
    v.vote('u2', 2);
    v.addGiftVotes(1, 5);
    expect(v.totals()).toEqual([0, 5, 2]);
    expect(v.winner()).toBe(1);
  });

  it('ignoră opțiuni inexistente', () => {
    const v = new VoteSystem();
    v.start(['a', 'b']);
    expect(v.vote('u1', 2)).toBe(false);
    expect(v.totals()).toEqual([0, 0]);
  });

  it('egalitatea se rupe aleatoriu între lideri', () => {
    const v = new VoteSystem();
    v.start(['a', 'b', 'c']);
    v.vote('u1', 0);
    v.vote('u2', 2);
    expect(v.winner(() => 0)).toBe(0);
    expect(v.winner(() => 0.99)).toBe(2);
  });
});

describe('LikeMeter', () => {
  it('declanșează la prag și păstrează restul', () => {
    const m = new LikeMeter(100);
    expect(m.add(60)).toBe(0);
    expect(m.add(60)).toBe(1);
    expect(m.value).toBe(20);
    expect(m.add(250)).toBe(2);
  });
});

describe('GiftRouter', () => {
  it('înmulțește efectele cu cantitatea, cu plafon pentru secunde', () => {
    expect(resolveGift('survival', 'Rose', 5655, 3, 1)).toEqual([{ type: 'speed', seconds: 12 }]);
    expect(resolveGift('survival', 'rose', 0, 500, 1)).toEqual([{ type: 'speed', seconds: 45 }]);
    expect(resolveGift('sandbox', 'Doughnut', 0, 2, 30)).toEqual([{ type: 'bomb', damage: 600 }]);
  });

  it('maparea modului înlocuiește complet efectele comune, doar pentru cadourile ei', () => {
    expect(resolveGift('survival', 'Doughnut', 0, 2, 30)).toEqual([{ type: 'bomb', damage: 800 }]);
    expect(resolveGift('pvp', 'Rose', 0, 2, 1)).toEqual([{ type: 'power', seconds: 6 }]);
    expect(resolveGift('boss', 'TikTok', 0, 1, 1)).toEqual([{ type: 'shield', seconds: 8 }]);
    // Galaxy nu e în maparea PvP → efectele comune.
    expect(resolveGift('pvp', 'Galaxy', 0, 1, 1000).map((e) => e.type)).toEqual(['bomb', 'teamShield', 'skin']);
    // Tower Defense: o serie de 4 trandafiri = 4 niveluri de turn arcaș.
    expect(resolveGift('td', 'Rose', 0, 4, 1)).toEqual([{ type: 'tower', kind: 'arrow', levels: 4 }]);
  });

  it('cadou necunoscut → bombă proporțională cu diamantele', () => {
    expect(resolveGift('survival', 'Ceva Nou', 999, 2, 50)).toEqual([{ type: 'bomb', damage: 1000 }]);
  });

  it('cadourile de vot dau voturi proporționale cu valoarea', () => {
    expect(voteForGift('Rose', 3, 1)).toEqual({ option: 0, votes: 15 });
    expect(voteForGift('finger heart', 1, 5)).toEqual({ option: 2, votes: 25 });
    expect(voteForGift('Galaxy', 1, 1000)).toBeNull();
  });
});


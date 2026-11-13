import { describe, expect, it } from 'vitest';
import type { GameState, LiveEvent } from '../../../shared/protocol';
import { cleanSimPatch, simDefaults, SIM_PRESETS, type SimSettings } from '../../../shared/sim';
import { GiftStreakCollapser } from '../tiktok/normalize';
import { Simulator } from './Simulator';

/** Rulează simulatorul `seconds` secunde (pași de 0,1 s) și întoarce evenimentele. */
function run(patch: Partial<SimSettings>, seconds: number, state?: GameState) {
  const events: LiveEvent[] = [];
  const emit = (e: LiveEvent) => events.push(e);
  const sim = new Simulator({ ...simDefaults(true), joinsPerSec: 200, ...patch }, emit, new GiftStreakCollapser(emit, 50));
  if (state) sim.setGameState(state);
  let now = 1_000_000;
  for (let i = 0; i < seconds * 10; i++) sim.step(0.1, (now += 100));
  return { events, sim, chats: events.filter((e) => e.type === 'chat') as Extract<LiveEvent, { type: 'chat' }>[] };
}

const voteState: GameState = {
  phase: 'vote', modeId: 'survival', modeName: 'Survival', phaseEndsInSec: 20, modes: [],
  voteOptions: [
    { modeId: 'a', name: 'A', votes: 0 },
    { modeId: 'b', name: 'B', votes: 0 },
    { modeId: 'c', name: 'C', votes: 0 },
  ],
  voteGifts: ['Rose', 'TikTok', 'Finger Heart'], modeCommandSamples: [], activePlayers: 0, queued: 0, fps: 60,
};

describe('Simulator (boții)', () => {
  it('„Activitate” 0 oprește comentariile după intrare', () => {
    const { chats } = run({ viewers: 50, activity: 0, commentsPerSec: 50 }, 5);
    // Doar primul comentariu al fiecărui bot (intrarea).
    expect(chats.length).toBeLessThanOrEqual(50);
  });

  it('„Activitate” 200% dă de două ori mai multe comentarii decât 100%', () => {
    const base = run({ viewers: 100, commentsPerSec: 20, activity: 100 }, 20).chats.length;
    const double = run({ viewers: 100, commentsPerSec: 20, activity: 200 }, 20).chats.length;
    expect(double / base).toBeGreaterThan(1.6);
    expect(double / base).toBeLessThan(2.4);
  });

  it('cu „Boți care scriu” 0%, boții intră dar nu scriu nimic', () => {
    const { chats, sim } = run({ viewers: 60, activePct: 0, commentsPerSec: 30 }, 3);
    expect(chats.length).toBe(0);
    expect(sim.presentCount).toBe(60);
  });

  it('boții intră treptat, după ritmul de intrare', () => {
    const { sim } = run({ viewers: 500, joinsPerSec: 10 }, 3);
    expect(sim.presentCount).toBeGreaterThanOrEqual(25);
    expect(sim.presentCount).toBeLessThanOrEqual(35);
  });

  it('plecările aduc boți noi, cu alte nume', () => {
    const { chats } = run({ viewers: 20, churnPerMin: 300, commentsPerSec: 0 }, 6);
    const people = new Set(chats.map((c) => c.user.userId));
    expect(people.size).toBeGreaterThan(30);
  });

  it('în vot, „boții votează” împinge opțiunea aleasă', () => {
    const { chats } = run({ viewers: 200, commentsPerSec: 60, votePct: 100, voteFor: 2, votePushPct: 100 }, 5, voteState);
    const votes = chats.map((c) => c.text).filter((t) => /^[123]$/.test(t));
    expect(votes.length).toBeGreaterThan(100);
    expect(votes.every((t) => t === '2')).toBe(true);
  });

  it('cadourile automate nu trec de prețul maxim', () => {
    const { events } = run({ viewers: 50, giftsPerMin: 120, giftMaxDiamonds: 5 }, 30);
    const gifts = events.filter((e) => e.type === 'gift') as Extract<LiveEvent, { type: 'gift' }>[];
    expect(gifts.length).toBeGreaterThan(20);
    expect(gifts.every((g) => g.diamonds <= 5)).toBe(true);
  });
});

describe('setările boților din panou', () => {
  it('valorile se aduc în limite, cheile necunoscute se ignoră', () => {
    const p = cleanSimPatch({ viewers: 5000, activity: -3, commentsPerSec: 2.26, likesPerSec: 7.333, giftMaxDiamonds: 250, hack: 1, enabled: 'da' });
    expect(p).toEqual({ viewers: 1000, activity: 0, commentsPerSec: 2.3, likesPerSec: 7.3, giftMaxDiamonds: 299 });
  });

  it('stilurile gata făcute au doar valori valide', () => {
    for (const preset of SIM_PRESETS) expect(cleanSimPatch(preset.values)).toEqual(preset.values);
  });
});

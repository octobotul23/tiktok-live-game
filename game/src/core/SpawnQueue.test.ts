import { describe, expect, it } from 'vitest';
import { SpawnQueue } from './SpawnQueue';

describe('SpawnQueue', () => {
  it('intră direct cât timp sunt locuri și coada e goală', () => {
    const q = new SpawnQueue();
    expect(q.request('a', 2)).toBe('spawn');
    expect(q.length).toBe(0);
  });

  it('peste plafon pune la coadă, în ordinea sosirii', () => {
    const q = new SpawnQueue();
    expect(q.request('a', 0)).toBe('queued');
    expect(q.request('b', 0)).toBe('queued');
    expect(q.drain(1)).toEqual(['a']);
    expect(q.drain(5)).toEqual(['b']);
  });

  it('un nou-venit nu sare peste cei care așteaptă, chiar dacă s-a eliberat un loc', () => {
    const q = new SpawnQueue();
    q.request('a', 0);
    expect(q.request('b', 1)).toBe('queued');
    expect(q.drain(1)).toEqual(['a']);
  });

  it('donatorii trec în fața cozii', () => {
    const q = new SpawnQueue();
    q.request('a', 0);
    q.request('b', 0);
    q.request('gift1', 0, true);
    q.request('gift2', 0, true);
    expect(q.drain(3)).toEqual(['gift1', 'gift2', 'a']);
  });

  it('un donator intră imediat dacă e loc, chiar dacă alții (fără cadou) așteaptă', () => {
    const q = new SpawnQueue();
    q.request('a', 0);
    expect(q.request('gift', 1, true)).toBe('spawn');
  });

  it('cineva deja la coadă care trimite cadou e mutat în față', () => {
    const q = new SpawnQueue();
    q.request('a', 0);
    q.request('b', 0);
    q.request('b', 0, true);
    expect(q.drain(1)).toEqual(['b']);
  });

  it('prune elimină inactivii', () => {
    const q = new SpawnQueue();
    q.request('a', 0);
    q.request('b', 0);
    q.prune((id) => id === 'a');
    expect(q.drain(5)).toEqual(['b']);
  });
});

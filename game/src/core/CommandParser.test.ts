import { describe, expect, it } from 'vitest';
import { parseCommand, type ModeCommand } from './CommandParser';

const dir = (text: string) => {
  const p = parseCommand(text);
  return p?.kind === 'move' ? p.dir : null;
};

describe('parseCommand — mișcare', () => {
  it.each([
    ['up', 'up'], ['UP', 'up'], ['u', 'up'], ['sus', 'up'], ['Sus!!', 'up'], ['⬆️', 'up'], ['⬆', 'up'],
    ['down', 'down'], ['d', 'down'], ['JOS', 'down'], ['⬇️⬇️', 'down'],
    ['left', 'left'], ['l', 'left'], ['stanga', 'left'], ['stânga', 'left'], ['Stânga 🔥', 'left'], ['⬅️', 'left'],
    ['right', 'right'], ['R', 'right'], ['dreapta', 'right'], ['➡️', 'right'],
  ])('%s → %s', (text, expected) => {
    expect(dir(text)).toBe(expected);
  });

  it('ignoră restul textului', () => {
    expect(dir('hai mergi la dreapta te rog')).toBe('right');
    expect(dir('go up!!! 😂')).toBe('up');
  });

  it('prima comandă din text câștigă', () => {
    expect(dir('left right')).toBe('left');
    expect(dir('➡️ apoi sus')).toBe('right');
  });

  it('nu se potrivește în interiorul altor cuvinte', () => {
    expect(dir('supa')).toBeNull();
    expect(dir('lol')).toBeNull();
    expect(dir('salut')).toBeNull();
    expect(dir('download')).toBeNull();
  });

  it('textul fără comandă întoarce null', () => {
    expect(parseCommand('ce joc tare')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
  });
});

describe('parseCommand — vot', () => {
  it('acceptă votul doar când e permis', () => {
    expect(parseCommand('2')).toBeNull();
    expect(parseCommand('2', { allowVote: true })).toEqual({ kind: 'vote', option: 1 });
  });

  it('acceptă emoji keycap și text în jur', () => {
    expect(parseCommand('3️⃣', { allowVote: true })).toEqual({ kind: 'vote', option: 2 });
    expect(parseCommand('votez 1 sigur', { allowVote: true })).toEqual({ kind: 'vote', option: 0 });
  });

  it('nu ia cifre din numere mai mari', () => {
    expect(parseCommand('12 ani', { allowVote: true })).toBeNull();
  });

  it('votul are prioritate față de mișcare în faza de vot', () => {
    expect(parseCommand('up 2', { allowVote: true })).toEqual({ kind: 'vote', option: 1 });
  });
});

describe('parseCommand — comenzi de mod', () => {
  const team: ModeCommand[] = [
    { id: 'teamTop', aliases: ['echipa sus'], label: 'echipa sus' },
    { id: 'teamBottom', aliases: ['echipa jos'], label: 'echipa jos' },
  ];

  it('potrivește aliasuri cu mai multe cuvinte, înaintea mișcării', () => {
    expect(parseCommand('Echipa JOS!', { modeCommands: team })).toMatchObject({ kind: 'mode', id: 'teamBottom' });
  });

  it('„sus” simplu rămâne mișcare (modul decide dacă îl interceptează)', () => {
    expect(parseCommand('sus', { modeCommands: team })).toEqual({ kind: 'move', dir: 'up', alias: 'sus' });
  });
});

/**
 * Votul între moduri. Fiecare spectator are un vot din chat (ultimul contează);
 * cadourile de vot adaugă voturi în plus, care se cumulează.
 */
export class VoteSystem {
  options: string[] = [];
  private chatVotes = new Map<string, number>();
  private giftVotes: number[] = [];

  /**
   * Alege `n` moduri aleatorii, fără cel tocmai jucat. Dacă nu sunt destule moduri,
   * cel tocmai jucat e adăugat la final, ca votul să aibă totuși de unde alege.
   */
  static pickOptions(all: readonly string[], lastPlayed: string | null, n: number, rnd: () => number = Math.random): string[] {
    const pool = all.filter((id) => id !== lastPlayed);
    shuffle(pool, rnd);
    const picked = pool.slice(0, n);
    if (picked.length < n && lastPlayed && all.includes(lastPlayed)) picked.push(lastPlayed);
    return picked;
  }

  start(options: string[]): void {
    this.options = options;
    this.chatVotes.clear();
    this.giftVotes = options.map(() => 0);
  }

  /** Votul din chat; `option` e indexul (0-based). */
  vote(userId: string, option: number): boolean {
    if (option < 0 || option >= this.options.length) return false;
    this.chatVotes.set(userId, option);
    return true;
  }

  addGiftVotes(option: number, votes: number): boolean {
    if (option < 0 || option >= this.options.length || votes <= 0) return false;
    this.giftVotes[option] += votes;
    return true;
  }

  totals(): number[] {
    const t = [...this.giftVotes];
    for (const opt of this.chatVotes.values()) t[opt] += 1;
    return t;
  }

  /** Indexul câștigător; egalitățile (inclusiv 0 voturi) se rup aleatoriu. */
  winner(rnd: () => number = Math.random): number {
    const t = this.totals();
    const max = Math.max(...t);
    const leaders = t.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
    return leaders[Math.floor(rnd() * leaders.length)];
  }
}

function shuffle<T>(arr: T[], rnd: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

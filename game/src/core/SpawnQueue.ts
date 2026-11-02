/**
 * Coada de intrare când s-a atins plafonul de caractere active.
 * Cei care trimit cadouri intră în fața cozii (dar după alți donatori care așteaptă deja).
 * Logica e independentă de Phaser ca să poată fi testată.
 */
export class SpawnQueue {
  private priority: string[] = [];
  private normal: string[] = [];

  /**
   * Cere un loc pentru `id`. Întoarce 'spawn' dacă poate intra acum, altfel îl pune la coadă.
   * Un nou-venit obișnuit nu sare peste cei care așteaptă deja, chiar dacă s-a eliberat un loc.
   */
  request(id: string, freeSlots: number, isPriority = false): 'spawn' | 'queued' {
    if (this.has(id)) {
      if (isPriority && this.normal.includes(id)) {
        this.normal.splice(this.normal.indexOf(id), 1);
        this.priority.push(id);
      }
      return 'queued';
    }
    const waiting = isPriority ? this.priority.length : this.length;
    if (freeSlots > 0 && waiting === 0) return 'spawn';
    (isPriority ? this.priority : this.normal).push(id);
    return 'queued';
  }

  /** Scoate din coadă până la `freeSlots` id-uri, în ordine: întâi donatorii, apoi restul. */
  drain(freeSlots: number): string[] {
    const out: string[] = [];
    while (out.length < freeSlots && this.priority.length) out.push(this.priority.shift()!);
    while (out.length < freeSlots && this.normal.length) out.push(this.normal.shift()!);
    return out;
  }

  remove(id: string): void {
    let i = this.priority.indexOf(id);
    if (i >= 0) this.priority.splice(i, 1);
    i = this.normal.indexOf(id);
    if (i >= 0) this.normal.splice(i, 1);
  }

  /** Elimină din coadă pe cei care n-au mai comentat de mult (n-are rost să le dăm loc). */
  prune(isStale: (id: string) => boolean): void {
    this.priority = this.priority.filter((id) => !isStale(id));
    this.normal = this.normal.filter((id) => !isStale(id));
  }

  has(id: string): boolean {
    return this.priority.includes(id) || this.normal.includes(id);
  }

  get length(): number {
    return this.priority.length + this.normal.length;
  }
}

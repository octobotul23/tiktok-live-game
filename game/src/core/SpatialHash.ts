/**
 * Grilă uniformă fără alocări pe frame: fiecare celulă e o listă înlănțuită de indici,
 * ținută în două Int32Array. Se reconstruiește complet în fiecare frame (insert e O(1)),
 * iar căutarea vecinilor verifică doar celulele din jur în loc de toate perechile (O(n²)).
 */
export class SpatialHash {
  readonly cols: number;
  readonly rows: number;
  private head: Int32Array;
  private next: Int32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cellSize: number,
    capacity: number,
  ) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(capacity).fill(-1);
  }

  clear(): void {
    this.head.fill(-1);
  }

  insert(index: number, x: number, y: number): void {
    if (index >= this.next.length) this.grow(index + 1);
    const c = this.cellOf(x, y);
    this.next[index] = this.head[c];
    this.head[c] = index;
  }

  /**
   * Apelează `fn` pentru fiecare index din celulele care acoperă cercul (x, y, radius).
   * Dacă `fn` întoarce true, căutarea se oprește.
   */
  query(x: number, y: number, radius: number, fn: (index: number) => boolean | void): void {
    const cs = this.cellSize;
    const c0 = Math.max(0, Math.floor((x - radius) / cs));
    const c1 = Math.min(this.cols - 1, Math.floor((x + radius) / cs));
    const r0 = Math.max(0, Math.floor((y - radius) / cs));
    const r1 = Math.min(this.rows - 1, Math.floor((y + radius) / cs));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (let i = this.head[r * this.cols + c]; i !== -1; i = this.next[i]) {
          if (fn(i) === true) return;
        }
      }
    }
  }

  private cellOf(x: number, y: number): number {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
    return r * this.cols + c;
  }

  private grow(min: number): void {
    const n = new Int32Array(Math.max(min, this.next.length * 2)).fill(-1);
    n.set(this.next);
    this.next = n;
  }
}

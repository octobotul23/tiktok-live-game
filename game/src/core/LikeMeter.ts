/** Bara comună de like-uri: se umple până la prag, declanșează bonusul și o ia de la capăt. */
export class LikeMeter {
  value = 0;

  constructor(public threshold: number) {}

  /** Adaugă like-uri și întoarce de câte ori s-a atins pragul (de obicei 0 sau 1). */
  add(count: number): number {
    this.value += count;
    let triggers = 0;
    while (this.value >= this.threshold) {
      this.value -= this.threshold;
      triggers++;
    }
    return triggers;
  }

  get progress(): number {
    return this.value / this.threshold;
  }
}

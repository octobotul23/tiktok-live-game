export type RoundPhase = 'lobby' | 'playing' | 'results' | 'vote';

/** Ce face scena la fiecare tranziție. Director-ul decide doar CÂND. */
export interface DirectorHooks {
  enterLobby(modeId: string): void;
  enterPlaying(): void;
  /** Durata maximă a rundei pentru modul curent; null = fără limită. */
  roundMaxSec(): number | null;
  isRoundOver(): boolean;
  enterResults(): void;
  enterVote(): void;
  /** Încheie votul și întoarce modul câștigător. */
  finishVote(): string;
  /** Un mod aleatoriu, pentru când streamerul sare peste vot înainte să înceapă. */
  randomMode(): string;
}

export interface PhaseDurations {
  lobbySec: number;
  resultsSec: number;
  voteSec: number;
}

/**
 * Automatul de stări al rundelor: LOBBY → JOC → REZULTATE → VOT → LOBBY (modul câștigător).
 * Streamerul poate alege direct un mod, termina runda sau sări peste vot oricând.
 */
export class RoundDirector {
  phase: RoundPhase = 'lobby';
  modeId = '';
  /** Secunde rămase din faza curentă (Infinity pentru o rundă fără limită). */
  timeLeft = 0;
  private skipNextVote = false;

  constructor(
    private hooks: DirectorHooks,
    private durations: PhaseDurations,
  ) {}

  begin(modeId: string): void {
    this.toLobby(modeId);
  }

  update(dt: number): void {
    this.timeLeft -= dt;
    switch (this.phase) {
      case 'lobby':
        if (this.timeLeft <= 0) this.toPlaying();
        break;
      case 'playing':
        if (this.hooks.isRoundOver() || this.timeLeft <= 0) this.toResults();
        break;
      case 'results':
        if (this.timeLeft <= 0) {
          if (this.skipNextVote) {
            this.skipNextVote = false;
            this.toLobby(this.hooks.randomMode());
          } else this.toVote();
        }
        break;
      case 'vote':
        if (this.timeLeft <= 0) this.toLobby(this.hooks.finishVote());
        break;
    }
  }

  /** Override streamer: pornește imediat lobby-ul modului ales, din orice fază. */
  pickMode(modeId: string): void {
    this.skipNextVote = false;
    this.toLobby(modeId);
  }

  /** Override streamer: termină runda acum (trece la rezultate). */
  endRound(): void {
    if (this.phase === 'playing') this.toResults();
    else if (this.phase === 'lobby') this.toPlaying();
  }

  /** Override streamer: în vot câștigă imediat opțiunea din frunte; altfel votul următor e sărit. */
  skipVote(): void {
    if (this.phase === 'vote') this.toLobby(this.hooks.finishVote());
    else this.skipNextVote = true;
  }

  get willSkipVote(): boolean {
    return this.skipNextVote;
  }

  private toLobby(modeId: string): void {
    this.phase = 'lobby';
    this.modeId = modeId;
    this.timeLeft = this.durations.lobbySec;
    this.hooks.enterLobby(modeId);
  }

  private toPlaying(): void {
    this.phase = 'playing';
    this.timeLeft = this.hooks.roundMaxSec() ?? Infinity;
    this.hooks.enterPlaying();
  }

  private toResults(): void {
    this.phase = 'results';
    this.timeLeft = this.durations.resultsSec;
    this.hooks.enterResults();
  }

  private toVote(): void {
    this.phase = 'vote';
    this.timeLeft = this.durations.voteSec;
    this.hooks.enterVote();
  }
}

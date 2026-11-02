// Mesajele care circulă prin WebSocket între server, joc și panou.
// Jocul nu știe dacă un eveniment vine din TikTok sau din simulator: ambele produc LiveEvent.

export interface Viewer {
  userId: string;
  uniqueId: string; // @handle
  nickname: string;
  /** Urmărește contul care e LIVE. Lipsă = necunoscut (evenimentul nu spune), deci se păstrează ce știam. */
  isFollower?: boolean;
}

export type Lang = 'ro' | 'en';

/** Setările jocului ținute pe server: supraviețuiesc unui refresh al paginii din OBS. */
export interface GameSettings {
  lang: Lang;
  /** Doar urmăritorii pot intra în joc (cine nu urmărește poate totuși vota). */
  followersOnly: boolean;
  /** Cu followersOnly: cine trimite un cadou intră oricum. */
  giftersBypass: boolean;
}

export type LiveEvent =
  | { type: 'chat'; user: Viewer; text: string; ts: number }
  /** Cadou finalizat. Pentru serii (streak) vine o singură dată, la final, cu count = total. */
  | { type: 'gift'; user: Viewer; giftId: number; giftName: string; count: number; diamonds: number; ts: number }
  /** Seria e încă în desfășurare (doar pentru afișaj, nu aplica efecte). */
  | { type: 'giftProgress'; user: Viewer; giftId: number; giftName: string; count: number; ts: number }
  | { type: 'like'; user: Viewer; count: number; ts: number }
  | { type: 'member'; user: Viewer; ts: number }
  /** Un spectator tocmai a dat follow în timpul live-ului. */
  | { type: 'follow'; user: Viewer; ts: number };

export type SourceStatus = { source: 'sim' | 'tiktok'; connected: boolean; detail?: string };

export interface SimSettings {
  enabled: boolean;
  viewers: number; // 0–1000 spectatori falși
  commentsPerSec: number;
  likesPerSec: number;
  giftsPerMin: number;
  /** Procentul de spectatori falși care sunt deja urmăritori (0–100). */
  followerPct: number;
  /** Câți spectatori falși dau follow pe minut, în timpul live-ului. */
  followsPerMin: number;
}

export type GamePhase = 'sandbox' | 'lobby' | 'playing' | 'results' | 'vote';

export interface GameState {
  phase: GamePhase;
  modeId: string;
  modeName: string;
  phaseEndsInSec: number | null;
  modes: { id: string; name: string }[];
  voteOptions: { modeId: string; name: string; votes: number }[];
  /** Cadourile de vot: voteGifts[i] = numele cadoului care votează opțiunea i+1 (din config-ul jocului). */
  voteGifts: string[];
  /** Texte pe care simulatorul le poate comenta în modul curent (ex. „echipa sus”). */
  modeCommandSamples: string[];
  activePlayers: number;
  queued: number;
  fps: number;
}

export type StreamerAction =
  | { action: 'toggleDebug' }
  | { action: 'endRound' }
  | { action: 'skipVote' }
  | { action: 'pickMode'; modeId: string };

export type ControlMsg =
  | { type: 'sim:set'; settings: Partial<SimSettings> }
  | { type: 'sim:gift'; giftName: string; count: number }
  | { type: 'sim:chat'; nickname: string; text: string; isFollower: boolean }
  | { type: 'sim:follow'; nickname: string }
  | { type: 'settings:set'; settings: Partial<GameSettings> }
  | { type: 'streamer'; cmd: StreamerAction }
  | { type: 'streamer:key'; key: string; down: boolean };

/** Plicul fiecărui mesaj WebSocket. */
export type WireMsg =
  | { kind: 'hello'; role: 'game' | 'panel' }
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'status'; status: SourceStatus }
  | { kind: 'control'; msg: ControlMsg }
  | { kind: 'state'; state: GameState }
  | { kind: 'sim'; settings: SimSettings }
  | { kind: 'settings'; settings: GameSettings };

export const WS_PATH = '/ws';

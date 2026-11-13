// Mesajele care circulă prin WebSocket între server, joc și panou.
// Jocul nu știe dacă un eveniment vine din TikTok sau din simulator: ambele produc LiveEvent.
import type { SimSettings } from './sim';

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
  /** Câte caractere pot fi pe ecran deodată; restul stau la coadă. Pe telefon ajută o valoare mai mică. */
  maxActive: number;
  /** Câte secunde are un caracter nou numele roșu deasupra și aura roșie (0 = oprit). */
  newcomerSec: number;
}

/** Limitele pentru maxActive (serverul le impune, panoul le folosește la slider). */
export const MAX_ACTIVE_RANGE = { min: 20, max: 1000 } as const;
/** Limitele pentru newcomerSec. */
export const NEWCOMER_SEC_RANGE = { min: 0, max: 60 } as const;

export interface ServerInfo {
  /** Ce scrii în aplicația de telefon (ex. „pc.tailnet.ts.net:5180”); null dacă Tailscale nu e pornit. */
  phoneAddress: string | null;
  /** Adresele pe Wi-Fi-ul de acasă (ex. „192.168.1.20:5180”), doar cu WIFI=true în .env; altfel listă goală. */
  wifiAddresses: string[];
  version: string;
  /** Când a pornit serverul, ISO. */
  startedAt: string;
}

/** Ce fel de ecran afișează jocul: aplicația de pe telefon sau o pagină de browser (OBS). */
export interface ScreenInfo {
  platform: 'android' | 'web';
  /** Versiunea jocului de pe acel ecran, ex. „0.0.3”. */
  version: string;
  /** Data construirii, ISO (ex. „2026-11-13T10:20:00Z”). */
  builtAt: string;
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

/**
 * Conexiunea la TikTok LIVE, pentru panou: off = oprită; connecting = încearcă acum; live = primește evenimente;
 * waiting = contul nu e live încă (reîncearcă singur); error = a picat (reîncearcă singur, cu pauze tot mai mari).
 */
export interface TikTokStatus {
  username: string;
  state: 'off' | 'connecting' | 'live' | 'waiting' | 'error';
  /** Peste câte secunde reîncearcă (waiting / error). */
  retryInSec?: number;
  /** Mesajul tehnic al ultimei erori, pentru depanare. */
  error?: string;
  /** Câți spectatori are live-ul (din TikTok), dacă se știe. */
  viewers?: number;
}

export type { SimSettings } from './sim';

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
  | { type: 'tiktok:connect'; username: string }
  | { type: 'tiktok:disconnect' }
  | { type: 'streamer'; cmd: StreamerAction }
  | { type: 'streamer:key'; key: string; down: boolean };

/** Plicul fiecărui mesaj WebSocket. */
export type WireMsg =
  | { kind: 'hello'; role: 'game' | 'panel'; screen?: ScreenInfo }
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'status'; status: SourceStatus }
  | { kind: 'control'; msg: ControlMsg }
  | { kind: 'state'; state: GameState }
  | { kind: 'sim'; settings: SimSettings }
  | { kind: 'settings'; settings: GameSettings }
  | { kind: 'tiktok'; status: TikTokStatus }
  /** Ecranele de joc conectate acum (telefon, OBS); serverul le trimite panoului la fiecare schimbare. */
  | { kind: 'screens'; screens: ScreenInfo[] }
  /** Despre server, pentru panou: ce să scrii în aplicația de telefon și ce versiune rulează. */
  | { kind: 'serverInfo'; info: ServerInfo };

export const WS_PATH = '/ws';

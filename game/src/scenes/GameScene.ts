import Phaser from 'phaser';
import type { ControlMsg, GamePhase, GameSettings, GameState, LiveEvent, StreamerAction, WireMsg } from '../../../shared/protocol';
import { CONFIG, SAFE_BOTTOM, SAFE_TOP, WIDTH } from '../config/config';
import { VOTE_GIFTS, type GiftEffect } from '../config/gifts';
import { Combat } from '../core/Combat';
import { parseCommand } from '../core/CommandParser';
import { Crowd, type Bounds } from '../core/Crowd';
import { BoltPool, FloatingTextPool, ParticlePool, TrailPool } from '../core/Effects';
import { isCombatEffect, resolveGift, voteForGift } from '../core/GiftRouter';
import { Highlight } from '../core/Highlight';
import { NewcomerTags } from '../core/NewcomerTags';
import { LikeMeter } from '../core/LikeMeter';
import { PlayerRegistry, levelForXp, type Player } from '../core/PlayerRegistry';
import { RoundDirector, type DirectorHooks } from '../core/RoundDirector';
import { getSkin, skinName } from '../core/SkinCatalog';
import { SpawnQueue } from '../core/SpawnQueue';
import { VoteSystem } from '../core/VoteSystem';
import type { GameMode, ModeContext } from '../modes/GameMode';
import { MODES } from '../modes/registry';
import { SandboxMode } from '../modes/sandbox/SandboxMode';
import { ServerLink } from '../net/ServerLink';
import { onLangChange, setLang, t } from '../i18n';
import { DebugOverlay } from '../ui/DebugOverlay';
import { Hud, formatScore, type LeaderRow } from '../ui/Hud';
import { RoundOverlay, type ResultRow } from '../ui/RoundOverlay';

const params = new URLSearchParams(location.search);
export const TRANSPARENT = params.get('transparent') === '1';
// ?max=500 suprascrie plafonul de caractere (util pentru teste de performanță).
if (params.has('max')) CONFIG.crowd.maxActive = Math.max(1, Number(params.get('max')) || CONFIG.crowd.maxActive);

const LEADERBOARD_SIZE = 5;
const RESULTS_SIZE = 5;
/** Efectele care nu au sens decât în timpul rundei (în lobby nu au ce lovi sau ridica). */
const PLAYING_ONLY: GiftEffect['type'][] = ['bomb', 'revive'];
/** Cât de des apare „dă Follow ca să intri” când comentează cineva care nu urmărește (ms). */
const FOLLOW_HINT_MS = 2500;

export class GameScene extends Phaser.Scene {
  private players = new PlayerRegistry();
  private queue = new SpawnQueue();
  private votes = new VoteSystem();
  private likes = new LikeMeter(CONFIG.likes.threshold);
  private director!: RoundDirector;
  private crowd!: Crowd;
  private trails!: TrailPool;
  private particles!: ParticlePool;
  private bolts!: BoltPool;
  private floating!: FloatingTextPool;
  private combat!: Combat;
  private highlight!: Highlight;
  private newcomers!: NewcomerTags;
  private hud!: Hud;
  private overlay!: RoundOverlay;
  private debug!: DebugOverlay;
  private link!: ServerLink;
  private mode!: GameMode;
  private safe!: Bounds;
  /** `sample` dă numele modului în limba curentă (getter), fără să creăm modul de fiecare dată. */
  private factories = new Map<string, { sample: GameMode; create: () => GameMode }>();
  /** Modurile din vot, în ordinea din registry (tastele 1–9 ale streamerului). */
  private votable: string[] = [];
  private lastPlayed: string | null = null;
  private pendingLikeBonus = false;
  private eventCount = 0;
  private eventsPerSec = 0;
  private likesTotal = 0;
  private serverOnline = false;
  /** Vin de la server la conectare și când se schimbă din panou. */
  private settings: GameSettings = { lang: 'ro', followersOnly: false, giftersBypass: true, maxActive: CONFIG.crowd.maxActive,
    newcomerSec: CONFIG.newcomer.sec };
  private lastFollowHint = 0;
  /** Rândurile ultimului ecran de rezultate, ca să-l putem redesena în altă limbă. */
  private lastResultRows: ResultRow[] = [];

  constructor() {
    super('game');
  }

  create(): void {
    if (!TRANSPARENT) this.add.image(0, 0, 'bg').setOrigin(0).setDepth(-10);

    const m = CONFIG.safeZone.marginX;
    this.safe = { x0: m, y0: SAFE_TOP + 160, x1: WIDTH - m, y1: SAFE_BOTTOM - 50 };

    this.trails = new TrailPool(this, 700, 50);
    this.crowd = new Crowd(this, this.trails);
    this.crowd.onRemoved = (p) => this.mode.onPlayerLeave(p);
    this.particles = new ParticlePool(this, 700, 45_000);
    this.bolts = new BoltPool(this, 300, 44_000, CONFIG.combat.boltSec);
    this.combat = new Combat(this, this.crowd, this.bolts);
    this.highlight = new Highlight(this, this.crowd);
    this.newcomers = new NewcomerTags(this);
    this.floating = new FloatingTextPool(this, 24, 60_000);
    this.hud = new Hud(this);
    this.overlay = new RoundOverlay(this);
    this.debug = new DebugOverlay(this);
    this.debug.setVisible(CONFIG.debug || params.get('debug') === '1');

    for (const entry of MODES) {
      const sample = entry.create();
      this.factories.set(sample.id, { sample, create: entry.create });
      if (entry.inVote) this.votable.push(sample.id);
    }

    this.director = new RoundDirector(this.directorHooks(), CONFIG.round);
    const first = params.get('mode') ?? CONFIG.round.firstMode;
    this.director.begin(this.factories.has(first) ? first : this.votable[0]);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => this.onKey(ev.key));
    onLangChange(() => this.refreshTexts());

    this.link = new ServerLink('game', (msg) => this.onWire(msg), (ok) => (this.serverOnline = ok));
    this.link.connect();

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.everySecond() });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refreshHud() });
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.publishState() });
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.director.update(dt);
    if (this.director.phase === 'playing') this.mode.update(dt);
    this.combat.update(dt);
    this.crowd.update(dt);
    this.trails.update(dt);
    this.particles.update(dt);
    this.bolts.update(dt);
    this.floating.update(dt);
    this.highlight.update(time);
    this.newcomers.update(time);
    this.hud.update(dt);
    this.overlay.update();
    this.fillFromQueue();

    const phase = this.director.phase;
    if (phase === 'playing') this.hud.setTimer(this.director.timeLeft, true);
    else {
      this.hud.setTimer(null);
      this.overlay.setCountdown(this.director.timeLeft);
    }
    this.hud.setCounts(this.crowd.activeCount, this.queue.length);
    this.hud.setLikes(this.likes.value, this.likes.threshold);
  }

  // --- runde ------------------------------------------------------------------------

  private directorHooks(): DirectorHooks {
    return {
      enterLobby: (modeId) => {
        this.switchMode(this.factories.get(modeId)!.create());
        // Scorurile de rundă pornesc de la zero pentru toată sesiunea.
        for (const p of this.players.all()) p.roundScore = 0;
        this.showLobby();
        this.hud.setLeaderboard('', []);
      },
      enterPlaying: () => {
        this.overlay.hide();
        this.mode.onRoundStart();
        this.combat.enabled = true;
        if (this.pendingLikeBonus) {
          this.pendingLikeBonus = false;
          this.startLikeBonus();
        }
      },
      roundMaxSec: () => this.mode.maxDurationSec,
      isRoundOver: () => this.mode.isOver(),
      enterResults: () => {
        this.combat.enabled = false;
        this.crowd.reviveAllDowned();
        this.lastPlayed = this.mode.id;
        this.showResults();
        this.hud.setLeaderboard('', []);
      },
      enterVote: () => {
        this.switchMode(new SandboxMode());
        this.hud.setMode(t('hud.vote'), []);
        const options = VoteSystem.pickOptions(this.votable, this.lastPlayed, CONFIG.vote.options);
        this.votes.start(options);
        this.showVote();
      },
      finishVote: () => this.votes.options[this.votes.winner()],
      randomMode: () => VoteSystem.pickOptions(this.votable, this.lastPlayed, 1)[0] ?? this.votable[0],
    };
  }

  private switchMode(mode: GameMode): void {
    this.mode?.teardown();
    this.combat.reset();
    this.crowd.clearStatuses();
    this.mode = mode;
    const ctx: ModeContext = {
      scene: this, crowd: this.crowd, registry: this.players, floating: this.floating,
      particles: this.particles, bolts: this.bolts, combat: this.combat, hud: this.hud, safe: this.safe,
    };
    mode.setup(ctx);
    this.crowd.bounds = mode.arena();
    this.hud.setMode(mode.name, mode.commands);
    this.hud.setStatus(mode.getStatus());
    for (const e of this.crowd.entities) mode.onPlayerJoin(e.player);
  }

  /** XP + ecranul de rezultate. */
  private showResults(): void {
    const res = this.mode.getResults();
    const cfg = CONFIG.xp;
    const winners = new Set(res.winners);
    const participants = new Set<Player>(res.ranking.map((r) => r.player));
    for (const e of this.crowd.entities) if (e.state !== 'despawning') participants.add(e.player);

    const levelBefore = new Map<Player, number>();
    for (const p of participants) {
      levelBefore.set(p, levelForXp(p.xp));
      p.stats.roundsPlayed++;
      p.xp += cfg.participation + p.roundScore * cfg.perScore;
      if (winners.has(p)) {
        p.xp += cfg.win;
        p.stats.wins++;
      }
    }

    const rows: ResultRow[] = res.ranking.slice(0, RESULTS_SIZE).map(({ player, score }) => {
      const level = levelForXp(player.xp);
      return { name: player.nickname, score, level, leveledUp: level > (levelBefore.get(player) ?? level) };
    });
    this.lastResultRows = rows;
    this.overlay.showResults(res.headline, this.mode.scoreLabel, rows);
    if (winners.size > 0) this.particles.burst(WIDTH / 2, 520, 60, 0xffd60a, 700, 1.2, 2.4);
  }

  private showLobby(): void {
    this.overlay.showLobby(this.mode.name, this.mode.instructions, this.mode.commands,
      this.settings.followersOnly ? t('overlay.followersOnly') : '');
  }

  private showVote(): void {
    const options = this.votes.options;
    this.overlay.showVote(options.map((id) => this.factories.get(id)!.sample.name), voteGiftHint(options.length));
    this.overlay.setVotes(this.votes.totals());
  }

  /** Redesenează textele fixe (titlu, carduri, etichete) după schimbarea limbii sau a setărilor. */
  private refreshTexts(): void {
    const phase = this.director.phase;
    if (phase === 'vote') this.hud.setMode(t('hud.vote'), []);
    else this.hud.setMode(this.mode.name, this.mode.commands);
    if (phase === 'lobby' || phase === 'playing') this.hud.setStatus(this.mode.getStatus());
    this.hud.setFollowHint(this.settings.followersOnly ? t('hud.followersOnly') : '');
    this.debug.relabel();
    if (phase === 'lobby') this.showLobby();
    else if (phase === 'vote') this.showVote();
    else if (phase === 'results') this.overlay.showResults(this.mode.getResults().headline, this.mode.scoreLabel, this.lastResultRows);
  }

  private applySettings(next: GameSettings): void {
    const prev = this.settings;
    this.settings = { ...next };
    // Plafonul vine din panou; `?max=` în URL are prioritate (teste de performanță).
    // Dacă scade, caracterele în plus nu dispar brusc: ies singure la inactivitate, iar coada așteaptă.
    if (!params.has('max') && Number.isFinite(next.maxActive)) CONFIG.crowd.maxActive = next.maxActive;
    if (next.followersOnly && (!prev.followersOnly || prev.giftersBypass !== next.giftersBypass)) this.enforceFollowersOnly();
    if (next.lang !== prev.lang) setLang(next.lang); // anunță refreshTexts
    else this.refreshTexts();
  }

  // --- urmăritori ---------------------------------------------------------------------

  /** Poate intra în joc? Cu „doar urmăritorii”: urmăritorii și (opțional) cei care au trimis cadouri. */
  private canJoin(p: Player): boolean {
    const s = this.settings;
    return !s.followersOnly || p.isFollower || (s.giftersBypass && p.stats.gifts > 0);
  }

  /** Opțiunea tocmai a fost pornită: cine nu are voie iese din joc și din coadă. */
  private enforceFollowersOnly(): void {
    for (const e of this.crowd.entities) {
      if (e.state !== 'despawning' && !this.canJoin(e.player)) this.crowd.despawn(e);
    }
    this.queue.prune((id) => {
      const p = this.players.get(id);
      return !p || !this.canJoin(p);
    });
  }

  /** „Nume: dă Follow ca să intri”, cel mult o dată la câteva secunde, ca să nu acopere ecranul. */
  private hintFollow(p: Player): void {
    const now = this.time.now;
    if (now - this.lastFollowHint < FOLLOW_HINT_MS) return;
    this.lastFollowHint = now;
    this.floating.show(WIDTH / 2, this.safe.y1 - 60, t('follow.needed', { name: p.nickname }), '#ff8fb8', 2);
  }

  private onFollow(e: Extract<LiveEvent, { type: 'follow' }>): void {
    const now = this.time.now;
    const p = this.players.getOrCreate({ ...e.user, isFollower: true }, now);
    const x = this.safe.x0 + 140 + Math.random() * (this.safe.x1 - this.safe.x0 - 280);
    this.floating.show(x, this.safe.y0 + 60, t('follow.thanks', { name: p.nickname }), '#ff8fb8', 2);
    // Cine a încercat să intre și abia acum a dat follow intră imediat.
    if (this.settings.followersOnly && p.stats.comments > 0 && !p.entity) {
      p.lastActive = now;
      if (this.ensurePresence(p, false)) this.highlight.show(p.entity!, now);
    }
  }

  // --- evenimente ---------------------------------------------------------------------

  private onWire(msg: WireMsg): void {
    if (msg.kind === 'event') this.onLiveEvent(msg.event);
    else if (msg.kind === 'control') this.onControl(msg.msg);
    else if (msg.kind === 'settings') this.applySettings(msg.settings);
  }

  private onLiveEvent(e: LiveEvent): void {
    this.eventCount++;
    const now = this.time.now;

    switch (e.type) {
      case 'chat': {
        const p = this.players.getOrCreate(e.user, now);
        p.lastActive = now;
        p.stats.comments++;
        const inVote = this.director.phase === 'vote';
        const cmd = parseCommand(e.text, { modeCommands: inVote ? [] : this.mode.commands, allowVote: inVote });
        // Votul contează și pentru cei din coadă.
        if (cmd?.kind === 'vote') {
          this.votes.vote(p.id, cmd.option);
          this.overlay.setVotes(this.votes.totals());
        }
        if (!this.canJoin(p)) {
          this.hintFollow(p);
          return;
        }
        if (!this.ensurePresence(p, false)) return;
        const entity = p.entity!;
        this.highlight.show(entity, now);

        if (cmd?.kind === 'move') {
          p.stats.commands++;
          if (!this.mode.onMove(p, cmd.dir, cmd.alias)) this.crowd.dash(entity, cmd.dir);
        } else if (cmd?.kind === 'mode') {
          p.stats.commands++;
          this.mode.onCommand(p, cmd.id);
        }
        break;
      }
      case 'gift':
        this.onGift(e);
        break;
      case 'like': {
        this.likesTotal += e.count;
        const p = this.players.get(e.user.userId);
        if (p) this.mode.onLike(p, e.count);
        for (let i = this.likes.add(e.count); i > 0; i--) this.onLikeBarFull();
        break;
      }
      case 'follow':
        this.onFollow(e);
        break;
      case 'giftProgress':
      case 'member':
        break;
    }
  }

  private onGift(e: Extract<LiveEvent, { type: 'gift' }>): void {
    const now = this.time.now;
    const p = this.players.getOrCreate(e.user, now);
    p.lastActive = now;
    p.stats.gifts += e.count;
    p.stats.diamonds += e.count * e.diamonds;
    p.xp += e.count * e.diamonds * CONFIG.xp.perDiamond;

    const phase = this.director.phase;
    if (phase === 'vote') {
      const v = voteForGift(e.giftName, e.count, e.diamonds);
      if (v && this.votes.addGiftVotes(v.option, v.votes)) {
        this.overlay.setVotes(this.votes.totals());
        this.floating.show(WIDTH / 2, 470, t('gift.votes', { name: p.nickname, n: v.votes, option: v.option + 1 }), '#ffd43b', 2);
      }
    }

    // Cine trimite un cadou primește caracter imediat, înaintea celor din coadă.
    if (!this.canJoin(p)) {
      this.hintFollow(p);
      return;
    }
    if (!this.ensurePresence(p, true)) return;
    const entity = p.entity!;
    this.highlight.show(entity, now);
    this.floating.show(entity.x, entity.y - 50, `🎁 ${e.giftName} x${e.count}`, '#ffd43b');

    if (phase === 'playing' && this.mode.onGift(p, e.giftName, e.count)) return;
    for (const effect of resolveGift(this.mode.id, e.giftName, e.giftId, e.count, e.diamonds)) {
      if (isCombatEffect(effect)) {
        if (phase !== 'playing' && phase !== 'lobby') continue;
        if (phase === 'lobby' && PLAYING_ONLY.includes(effect.type)) continue;
      }
      this.applyEffect(p, effect);
    }
  }

  private applyEffect(p: Player, effect: GiftEffect): void {
    if (this.mode.applyEffect(p, effect)) return;
    const e = p.entity;
    if (!e) return;
    switch (effect.type) {
      case 'shield':
        this.crowd.giveShield(e, effect.seconds);
        break;
      case 'teamShield':
        for (const other of this.crowd.entities) {
          if (this.mode.isAlly(p, other.player)) this.crowd.giveShield(other, effect.seconds);
        }
        this.hud.announce(t('gift.teamShield', { name: p.nickname }), '#4cc9f0', 1.8);
        break;
      case 'speed':
        this.crowd.giveSpeed(e, effect.seconds);
        break;
      case 'power':
        this.crowd.givePower(e, effect.seconds);
        break;
      case 'bomb': {
        const dealt = this.combat.bomb(p, effect.damage);
        this.cameras.main.flash(180, 255, 220, 120);
        this.particles.burst(e.x, e.y, 30, 0xffb703, 700, 0.9, 2.4);
        if (dealt > 0) this.floating.show(e.x, e.y - 90, `💣 -${formatScore(dealt)}`, '#ff9f1c', 1.8);
        break;
      }
      case 'revive': {
        const n = this.crowd.reviveAllDowned((o) => this.mode.isAlly(p, o.player));
        if (n > 0) this.floating.show(e.x, e.y - 90, t('gift.revived', { n }), '#9ef01a', 1.8);
        this.mode.onRevive(p);
        break;
      }
      case 'skin': {
        const next = getSkin(effect.skinId);
        if (next.rank <= getSkin(p.skinId).rank) break;
        p.skinId = next.id;
        this.crowd.applySkin(e);
        this.particles.burst(e.x, e.y, 24, next.aura ?? 0xffffff, 380, 0.8, 1.8);
        this.hud.announce(t('gift.skin', { name: p.nickname, skin: skinName(next).toUpperCase() }), '#ffd60a', 1.8);
        break;
      }
    }
  }

  private onLikeBarFull(): void {
    this.hud.flashLikes();
    if (this.director.phase !== 'playing') {
      // Bonusul se păstrează pentru runda următoare.
      this.pendingLikeBonus = true;
      return;
    }
    this.startLikeBonus();
  }

  private startLikeBonus(): void {
    if (this.mode.onLikeBonus()) return;
    this.combat.likeBonusT = CONFIG.likes.bonusSec;
    this.hud.announce(t('likes.bonus', { mul: CONFIG.likes.bonusDamageMul, sec: CONFIG.likes.bonusSec }), '#ff4d8d', 2);
  }

  /** Se asigură că jucătorul are caracter; întoarce false dacă a ajuns în coadă. */
  private ensurePresence(p: Player, priority: boolean): boolean {
    if (p.entity) {
      if (p.entity.state === 'despawning') this.crowd.revive(p.entity);
      return true;
    }
    const free = CONFIG.crowd.maxActive - this.crowd.activeCount;
    if (this.queue.request(p.id, free, priority) === 'spawn') {
      this.spawn(p);
      return true;
    }
    return false;
  }

  private spawn(p: Player): void {
    const e = this.crowd.spawn(p);
    // Caracter nou pe ecran: nume roșu și aură roșie câteva secunde, ca spectatorul să se găsească.
    const sec = this.settings.newcomerSec;
    if (sec > 0) {
      this.crowd.markNew(e, sec);
      this.newcomers.show(e, this.time.now);
    }
    this.mode.onPlayerJoin(p);
  }

  private fillFromQueue(): void {
    if (this.queue.length === 0) return;
    const free = CONFIG.crowd.maxActive - this.crowd.activeCount;
    if (free <= 0) return;
    for (const id of this.queue.drain(free)) {
      const p = this.players.get(id);
      if (p && !p.entity) this.spawn(p);
    }
  }

  // --- streamer -------------------------------------------------------------------------

  private onKey(key: string): void {
    const k = key.toLowerCase();
    if (k === 'f2') this.streamer({ action: 'toggleDebug' });
    else if (k === 'v') this.streamer({ action: 'skipVote' });
    else if (k === 'n') this.streamer({ action: 'endRound' });
    else if (/^[1-9]$/.test(k)) {
      const id = this.votable[Number(k) - 1];
      if (id) this.streamer({ action: 'pickMode', modeId: id });
    }
  }

  private onControl(msg: ControlMsg): void {
    if (msg.type === 'streamer') this.streamer(msg.cmd);
    else if (msg.type === 'streamer:key' && msg.down) this.onKey(msg.key);
  }

  private streamer(cmd: StreamerAction): void {
    switch (cmd.action) {
      case 'toggleDebug':
        this.debug.toggle();
        break;
      case 'endRound':
        this.director.endRound();
        break;
      case 'skipVote':
        this.director.skipVote();
        if (this.director.willSkipVote) this.hud.announce(t('streamer.voteSkipped'), '#ffffff', 1.4);
        break;
      case 'pickMode':
        if (this.factories.has(cmd.modeId)) this.director.pickMode(cmd.modeId);
        break;
    }
  }

  // --- periodic ---------------------------------------------------------------------------

  /** Leaderboard + rândul de stare, de 4 ori pe secundă (Text-ul e scump de regenerat). */
  private refreshHud(): void {
    const phase = this.director.phase;
    this.hud.setStatus(phase === 'lobby' || phase === 'playing' ? this.mode.getStatus() : null);
    if (phase === 'vote') this.overlay.setVotes(this.votes.totals());
    if (phase !== 'playing') return;

    const top: LeaderRow[] = [];
    for (const p of this.players.all()) {
      const score = this.mode.getLiveScore(p);
      if (score <= 0) continue;
      if (top.length === LEADERBOARD_SIZE && score <= top[top.length - 1].score) continue;
      let i = top.length;
      while (i > 0 && top[i - 1].score < score) i--;
      top.splice(i, 0, { name: p.nickname, score });
      if (top.length > LEADERBOARD_SIZE) top.pop();
    }
    this.hud.setLeaderboard(this.mode.scoreLabel, top);
  }

  private everySecond(): void {
    const now = this.time.now;
    const limit = CONFIG.crowd.despawnSec * 1000;
    for (const e of this.crowd.entities) {
      if (e.state !== 'despawning' && now - e.player.lastActive > limit) this.crowd.despawn(e);
    }
    this.queue.prune((id) => {
      const p = this.players.get(id);
      return !p || now - p.lastActive > limit;
    });

    this.eventsPerSec = this.eventCount;
    this.eventCount = 0;
    this.debug.setStats([
      `FPS ${this.game.loop.actualFps.toFixed(0)}`,
      t('debug.characters', { n: this.crowd.activeCount, max: CONFIG.crowd.maxActive, q: this.queue.length }),
      t('debug.targets', { n: this.combat.source?.targets().length ?? 0, phase: t(`phase.${this.director.phase}`) }),
      t('debug.session', { n: this.players.size }),
      t('debug.events', { n: this.eventsPerSec, likes: this.likesTotal }),
      t('debug.server', { state: t(this.serverOnline ? 'debug.connected' : 'debug.disconnected') }),
    ]);
  }

  private publishState(): void {
    const phase: GamePhase = this.director.phase;
    const totals = phase === 'vote' ? this.votes.totals() : [];
    const state: GameState = {
      phase,
      modeId: this.mode.id,
      modeName: this.mode.name,
      phaseEndsInSec: Number.isFinite(this.director.timeLeft) ? Math.max(0, Math.ceil(this.director.timeLeft)) : null,
      modes: this.votable.map((id) => ({ id, name: this.factories.get(id)!.sample.name })),
      voteOptions: phase === 'vote'
        ? this.votes.options.map((id, i) => ({ modeId: id, name: this.factories.get(id)!.sample.name, votes: totals[i] }))
        : [],
      voteGifts: voteGiftNames(),
      modeCommandSamples: this.mode.commands.map((c) => c.aliases[0]),
      activePlayers: this.crowd.activeCount,
      queued: this.queue.length,
      fps: Math.round(this.game.loop.actualFps),
    };
    this.link.send({ kind: 'state', state });
  }
}

function voteGiftNames(): string[] {
  const names: string[] = [];
  for (const [name, opt] of Object.entries(VOTE_GIFTS)) names[opt - 1] = name;
  return names;
}

/** „🎁 Rose = 1 · TikTok = 2 · Finger Heart = 3”, din config, doar pentru opțiunile existente. */
function voteGiftHint(options: number): string {
  const parts = Object.entries(VOTE_GIFTS)
    .filter(([, opt]) => opt <= options)
    .map(([name, opt]) => `${name} = ${opt}`);
  return parts.length ? t('overlay.voteGifts', { list: parts.join(' · ') }) : '';
}

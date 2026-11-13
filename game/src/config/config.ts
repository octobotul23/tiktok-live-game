// Toate valorile de balans ale jocului. Modifică aici, salvează, iar Vite reîncarcă pagina.

export const WIDTH = 1080;
export const HEIGHT = 1920;

export const CONFIG = {
  /** Zona utilă: sus e bara TikTok, jos ~35% sunt acoperiți de comentarii și cadouri. */
  safeZone: { top: 0.1, bottom: 0.65, marginX: 24 },

  crowd: {
    /** Câte caractere pot fi active simultan; peste plafon, nou-veniții intră în coadă. */
    maxActive: 300,
    /** Secunde de inactivitate după care caracterul dispare (profilul rămâne pe sesiune). */
    despawnSec: 90,
    size: 32,
    /** Sub distanța asta două caractere se împing ușor (mai mică decât size → suprapunere permisă). */
    separationDist: 24,
    /** Cât de repede se rezolvă suprapunerea (1/s). */
    separationStrength: 7,
    /** Limită de vecini verificați per caracter (performanță în mulțimi dense). */
    maxNeighbors: 10,
    spawnPopSec: 0.25,
    despawnFadeSec: 0.4,
  },

  dash: {
    /** Distanța unui dash (px). Mare, pentru că comentariile vin cu 1–3s întârziere. */
    distance: 130,
    durationSec: 0.24,
    /** La câte secunde lasă o „fantomă” în urmă. */
    trailEverySec: 0.025,
    trailLifeSec: 0.3,
  },

  highlight: {
    /** Cât timp stă numele deasupra caracterului după un comentariu. */
    nameSec: 3,
    /** Câte nume pot fi afișate deodată (pool de obiecte Text). */
    maxNames: 40,
  },

  newcomer: {
    /** Cât timp un caracter nou are numele roșu și aura roșie, până vine setarea din panou (0 = oprit). */
    sec: 10,
    /** Câte nume roșii pot fi afișate deodată. */
    maxTags: 30,
  },

  /** Durata fazelor dintre runde (s). Durata maximă a rundei e în setările fiecărui mod, mai jos. */
  round: {
    lobbySec: 10,
    resultsSec: 10,
    voteSec: 20,
    /** Modul cu care începe sesiunea. */
    firstMode: 'survival',
  },

  vote: {
    options: 3,
  },

  /** Atacul automat al caracterelor. */
  combat: {
    /** Raza de atac, măsurată până la marginea țintei (px). */
    range: 120,
    damage: 10,
    cooldownSec: 0.8,
    /** Viteza vizuală a proiectilului (s până la țintă). */
    boltSec: 0.12,
    /** De la câte lovituri la rând apare „x47 ATACURI”. */
    comboMin: 10,
    /** După câte secunde fără lovituri se resetează combo-ul. */
    comboResetSec: 1.2,
    /** Cât stă un jucător „căzut” după ce e lovit de boss (s). */
    downedSec: 5,
  },

  likes: {
    /** Câte like-uri umplu bara. */
    threshold: 2000,
    /** Bonusul comun: damage x2 pentru toată echipa, timp de N secunde. */
    bonusSec: 10,
    bonusDamageMul: 2,
  },

  xp: {
    perScore: 0.05,
    win: 50,
    participation: 5,
    perDiamond: 2,
  },

  survival: {
    maxDurationSec: 300,
    baseHp: 1500,
    baseRadius: 64,
    /** Cât din viața cristalului repară un cadou de tip revive. */
    reviveRepair: 0.25,
    maxAliveMonsters: 100,
    spawnEverySec: 0.35,
    breakBetweenWavesSec: 3,
    /** Un boss la fiecare al N-lea val. */
    bossEvery: 5,
    /** Viața monștrilor crește cu numărul de jucători: hp × (1 + jucători / hpPlayersDivisor). */
    hpPlayersDivisor: 15,
    hpPerWave: 0.25,
    monsters: {
      fast: { hp: 20, speed: 95, radius: 13, baseDps: 8, color: 0xff4d6d },
      tank: { hp: 90, speed: 38, radius: 20, baseDps: 25, color: 0x8d99ae },
      boss: { hp: 1200, speed: 26, radius: 46, baseDps: 80, color: 0xb5179e },
    },
  },

  boss: {
    maxDurationSec: 180,
    hp: 6000,
    /** Viața crește cu numărul de jucători: hp × (1 + jucători / hpPlayersDivisor). */
    hpPlayersDivisor: 10,
    radius: 100,
    speed: 40,
    /** Pragurile de viață la care începe faza 2 și faza 3. */
    phaseAt: [0.66, 0.33],
    /** Per fază: pauza dintre atacuri și cât de devreme e anunțat atacul (2–3 s, din cauza întârzierii comentariilor). */
    phases: [
      { attackEverySec: 4.5, warnSec: 2.8, zonesPerAttack: 1, color: 0x9b5de5 },
      { attackEverySec: 3.6, warnSec: 2.5, zonesPerAttack: 2, color: 0xf15bb5 },
      { attackEverySec: 2.8, warnSec: 2.2, zonesPerAttack: 3, color: 0xff3b3b },
    ],
  },

  /** PvP Sus vs Jos: două echipe, câte o bază în fiecare jumătate a arenei. */
  pvp: {
    maxDurationSec: 240,
    /** Viața unei baze: baseHp + baseHpPerPlayer × caracterele active la începutul rundei. */
    baseHp: 2000,
    baseHpPerPlayer: 120,
    baseRadius: 56,
    /** Cât de departe e baza de marginea de sus/jos a arenei (px). */
    baseInset: 110,
    /** Viața unui jucător; la 0 e trimis lângă baza lui și stă jos câteva secunde. */
    playerHp: 100,
    respawnSec: 4,
    /** Scut după respawn (s), ca să nu fie doborât din nou imediat ce se ridică. */
    spawnShieldSec: 1.5,
    /** Bomba din cadouri: baza adversă primește tot damage-ul, fiecare jucător advers doar fracția asta. */
    bombPlayerMul: 0.25,
    /** Un cadou de tip revive repară și baza echipei expeditorului (fracție din viață). */
    reviveRepair: 0.05,
    /** Se poate schimba echipa („echipa sus” / „echipa jos”) și în timpul rundei, nu doar în lobby. */
    switchDuringRound: false,
    colors: { top: 0x4cc9f0, bottom: 0xff5d73, neutral: 0xb0b0b0 },
  },

  /** Tower Defense: monștrii merg pe un drum fix spre cristal; cadourile construiesc turnuri lângă drum. */
  td: {
    maxDurationSec: 300,
    baseHp: 1000,
    baseRadius: 60,
    /** Lățimea drumului desenat (px). */
    pathWidth: 74,
    breakBetweenWavesSec: 4,
    spawnEverySec: 0.55,
    maxAliveMonsters: 90,
    bossEvery: 5,
    /** Viața monștrilor: hp × (1 + hpPerWave × (val − 1)) × (1 + jucători / hpPlayersDivisor). */
    hpPerWave: 0.22,
    hpPlayersDivisor: 15,
    /** `leak` = cât scade din viața cristalului un monstru care ajunge la capătul drumului. */
    monsters: {
      fast: { hp: 22, speed: 90, radius: 13, leak: 25, color: 0xff4d6d },
      tank: { hp: 100, speed: 40, radius: 20, leak: 70, color: 0x8d99ae },
      boss: { hp: 1400, speed: 28, radius: 46, leak: 400, color: 0xb5179e },
    },
    /** Cât din viața cristalului repară un cadou de tip revive. */
    reviveRepair: 0.2,
    maxTowerLevel: 5,
    /** Turnurile: damage și rază cresc cu nivelul (× (1 + perLevel × (nivel − 1))). */
    towers: {
      arrow: { range: 230, cooldownSec: 0.45, damage: 11, color: 0xffd166 },
      frost: { range: 200, cooldownSec: 0.9, damage: 5, slowSec: 1.6, slowMul: 0.45, color: 0x8ecae6 },
      cannon: { range: 210, cooldownSec: 1.5, damage: 45, splash: 80, color: 0xff7b00 },
    },
    towerPerLevel: 0.45,
  },

  /** Arată zonele sigure, FPS-ul și contoarele. Se poate porni și cu ?debug=1 sau tasta F2. */
  debug: false,
};

export const SAFE_TOP = Math.round(HEIGHT * CONFIG.safeZone.top);
export const SAFE_BOTTOM = Math.round(HEIGHT * CONFIG.safeZone.bottom);

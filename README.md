# Joc pentru TikTok LIVE

Joc controlat de comentariile, cadourile și like-urile spectatorilor. Rulează într-o pagină web pe care o capturezi în OBS ca **Browser Source** (1080×1920, vertical) și o transmiți pe TikTok LIVE.

- `server/`: se conectează la TikTok LIVE (Milestone 5) sau pornește **simulatorul**, apoi trimite evenimentele (chat, cadouri, like-uri) prin WebSocket.
- `game/`: jocul (Phaser 3 + Vite) și panoul de control.
- `shared/`: tipurile mesajelor și catalogul de cadouri, comune ambelor părți.

Specificația completă și deciziile luate sunt în [docs/SPEC.md](docs/SPEC.md).

## Stadiu

| Milestone | Conținut | Stare |
|---|---|---|
| 1 | Server, simulator, caractere care apar și se mișcă din comentarii | ✅ gata |
| 2 | Core multi-mod, vot, Survival, Boss Slayer | ✅ gata de testat |
| 3 | PvP Sus vs Jos, cadouri per mod | ✅ gata de testat |
| 4 | Restul modurilor, câte unul | în lucru: Tower Defense ✅ gata de testat |
| 5 | Conectare la TikTok LIVE real | |

## Instalare pe Mac

1. Instalează Homebrew (dacă nu îl ai), din Terminal:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Instalează Node.js (versiunea 20 sau mai nouă):
   ```bash
   brew install node
   ```
3. În folderul proiectului, instalează dependențele:
   ```bash
   npm install
   ```
4. Creează fișierul de configurare din exemplu:
   ```bash
   cp .env.example .env
   ```

Pe Windows pașii sunt aceiași, cu Node.js instalat de pe nodejs.org; în loc de `cp` folosește `copy .env.example .env`.

## Rulare

```bash
npm run dev
```

Pornește serverul și jocul împreună. Apoi deschide:

- **Jocul**: http://localhost:5180 (cu `?debug=1` vezi zonele sigure și FPS-ul)
- **Panoul de control**: http://localhost:5180/panel.html (nu îl captura în OBS)

Cu `SIMULATE=true` în `.env` (implicit), simulatorul generează spectatori falși. Din panou poți:
- alege numărul de jucători falși (0–1000) și rata comentariilor, like-urilor și cadourilor automate;
- trimite orice cadou (cele marcate ↻ vin în serie, ca pe TikTok);
- scrie un comentariu de test, ca să verifici cum sunt înțelese comenzile (ca urmăritor sau nu), și simula un follow;
- schimba limba (română / engleză) și porni „doar urmăritorii pot intra” (vezi mai jos);
- porni sau opri afișarea zonelor sigure;
- vedea faza, modul curent și timpul rămas;
- controla jocul din secțiunea **Streamer** (vezi mai jos).

În faza de vot, simulatorul votează singur (în chat și cu cadouri de vot), ca să vezi barele mișcându-se.

Alte opțiuni în URL-ul jocului:
- `?mode=boss`: primul mod jucat după pornire (`survival`, `boss`; implicit `survival`);
- `?transparent=1`: fundal transparent (pentru suprapunere peste altă sursă în OBS);
- `?debug=1`: zonele sigure, FPS, contoare (sau tasta **F2**);
- `?max=500`: schimbă plafonul de caractere active (pentru teste de performanță).

Teste și verificare de tipuri:
```bash
npm test
```
```bash
npm run typecheck
```

## Comenzi în chat

| Comandă | Aliasuri acceptate |
|---|---|
| sus | `up`, `u`, `sus`, ⬆️ |
| jos | `down`, `d`, `jos`, ⬇️ |
| stânga | `left`, `l`, `stanga`, `stânga`, ⬅️ |
| dreapta | `right`, `r`, `dreapta`, ➡️ |

Literele mari/mici și diacriticele nu contează, iar restul textului e ignorat („hai la stânga te rog” → stânga). Primul comentariu al unui spectator îi creează caracterul. Aliasurile se editează în `game/src/config/commands.ts`.

Unele moduri au și comenzi proprii (maxim 2), afișate mereu pe ecran cu ★. De exemplu, în PvP: `echipa sus` / `echipa jos`.

În faza de vot, `1`, `2` sau `3` în chat votează modul următor (un vot per spectator; dacă se răzgândește, contează ultimul).

Caracterele **atacă singure** ținta cea mai apropiată din raza lor; spectatorii doar le mută spre acțiune. Deasupra țintelor lovite de mulți deodată apare contorul „x47 ATACURI”.

## Cum decurge o rundă

**Lobby** (10 s: numele modului, instrucțiuni, comenzi) → **Joc** (până la final sau la expirarea timpului) → **Rezultate** (10 s: top jucători, nivel, XP) → **Vot** (20 s: 3 moduri, fără cel tocmai jucat) → lobby-ul modului câștigător.

Duratele se schimbă în `game/src/config/config.ts`, la `round`.

Pe ecran sunt mereu: modul și timpul, bara de stare a modului (valul / viața boss-ului), top 5 pe runda curentă, bara de like-uri și numărul de jucători în coadă.

**Like-urile** umplu o bară comună; când e plină, toată lumea dă damage dublu 10 s. Dacă bara se umple între runde, bonusul pornește la începutul rundei următoare.

**XP-ul** se păstrează pe toată sesiunea: puncte pentru participare, pentru scor, bonus de victorie și pentru cadouri. Nivelul apare pe ecranul de rezultate (⬆ când cineva a urcat de nivel).

### Modurile

- **Survival**: monștrii vin în valuri din marginile arenei spre cristalul din centru. Sunt rapizi (roșii, mulți) și tancuri (gri, rezistenți); la fiecare al 5-lea val vine și un boss. Runda se termină când cade cristalul sau expiră timpul (5 min). Scor: damage.
- **Boss Slayer**: un boss uriaș cu 3 faze (la 66% și 33% din viață). Își anunță atacurile cu zone colorate pe jos, care se umplu progresiv: cerc, linie, inel, cruce. Cine e prins în zonă cade 5 s. În fazele superioare atacurile vin mai des și combinate. Scor: damage.
- **Sus vs Jos (PvP)**: două echipe, 🔵 SUS și 🔴 JOS, fiecare cu baza ei în jumătatea ei de arenă. Echipa se alege cu `echipa sus` / `echipa jos` (sau `team up` / `team down`), ori cu `sus` / `jos` simplu cât timp jucătorul n-are încă echipă (după aceea `sus` / `jos` înseamnă mișcare). Cine nu alege intră în echipa mai mică. Echipa se schimbă doar în lobby (`pvp.switchDuringRound` în `config.ts`). Caracterele atacă singure inamicii și baza adversă din rază. Cine e doborât revine lângă baza lui după 4 s, cu scut scurt. Câștigă echipa care distruge baza adversă sau, la expirarea timpului (4 min), cea cu baza mai întreagă. Toți din echipa câștigătoare primesc bonusul de victorie la XP. Scor: damage.
  - Cadourile ajută doar echipa expeditorului: scutul de echipă și revive-ul ajung doar la aliați, iar bomba lovește baza adversă și slăbește adversarii.
  - Bonusul de like-uri merge la echipa care a dat mai multe like-uri de la bonusul precedent.
- **Tower Defense**: monștrii merg pe un drum fix, care șerpuiește prin arenă, până la cristalul de la capăt. Jucătorii sunt „turnuri vii”: stau lângă drum și atacă singuri monștrii din rază. Cadourile construiesc turnuri pe cele 8 locuri marcate cu ➕ de lângă drum, chiar și în lobby, ca pregătire: 🌹 Rose / TikTok = arcaș (rapid, o țintă), 🍦 Ice Cream / Finger Heart = gheață (încetinește), 🍩 Doughnut = tun (damage în zonă), Hand Hearts = tun ★3 + repară cristalul. Fiecare bucată din serie crește nivelul turnului tău de același tip (maxim ★5); când e la maxim, se construiește altul pe locul liber cel mai apropiat, iar când nu mai e loc, cresc alte turnuri. Turnurile țintesc monstrul cel mai avansat pe drum, iar damage-ul lor intră în scorul celui care l-a construit. Un monstru care ajunge la capăt scade din cristal (rapid 25, tanc 70, boss 400 din 1000). Valuri ca în Survival, boss la fiecare al 5-lea; runda ține maxim 5 min. Scor: damage. Valorile sunt în `config.ts` la `td`.

Viața bazelor din PvP crește tot cu numărul de jucători (`baseHp` + `baseHpPerPlayer` × jucători, în `config.ts` la `pvp`).

Viața monștrilor și a boss-ului crește cu numărul de jucători (`hpPlayersDivisor` în `config.ts`): mai mic = mai rezistenți.

## Controlul streamerului

Din tastatură (când pagina jocului are focus) sau din panou, secțiunea **Streamer** (merge și când jocul e doar în OBS):

| Tastă | Buton în panou | Efect |
|---|---|---|
| `1`–`9` | butoanele modurilor | alege direct modul următor (sare peste vot) |
| `V` | Sari peste vot | votul se încheie acum, câștigă cel aflat în frunte |
| `N` | Termină faza | termină faza curentă (lobby → joc, joc → rezultate etc.) |
| `F2` | (comutatorul de zone) | zonele sigure, FPS, contoare |

## Limba și „doar urmăritorii”

În panou, secțiunea **Setări joc**. Setările stau pe server, deci se aplică imediat și în OBS și rămân la un refresh al paginii. Valorile de pornire se pun în `.env`.

| Setare | În `.env` | Ce face |
|---|---|---|
| Limba | `GAME_LANG=ro` sau `en` | textele din joc și din panou. Comenzile din chat merg în ambele limbi oricum (`sus` și `up`). |
| Doar urmăritorii pot intra | `FOLLOWERS_ONLY=true` | doar cine te urmărește primește caracter. Ceilalți pot vota în continuare și văd pe ecran „dă Follow ca să intri”. Cine dă follow în timpul live-ului intră imediat. Când pornești opțiunea, caracterele celor care nu te urmăresc ies din joc. |
| Cine trimite un cadou intră oricum | `GIFTERS_BYPASS=true` | cu opțiunea de mai sus pornită, cine trimite un cadou intră chiar dacă nu te urmărește. |

Textele sunt în `game/src/i18n/ro.ts` și `game/src/i18n/en.ts`. Dacă adaugi un text nou în `ro.ts` și uiți traducerea din `en.ts`, `npm run typecheck` îți arată unde lipsește.

> Deocamdată informația „urmărește / nu urmărește” vine din simulator: sliderul **% urmăritori**, bifa **e urmăritor** de la comentariul de test și butonul **Dă follow**. Cu TikTok LIVE real (Milestone 5) vine direct de la TikTok.

## Acces de pe alt dispozitiv (Tailscale)

Jocul ascultă implicit doar pe acest calculator (`127.0.0.1:5180`). Ca să-l deschizi de pe telefon sau de pe alt calculator din rețeaua ta Tailscale, fără să-l expui pe internet sau în Wi-Fi-ul local:

```bash
tailscale serve --bg --https=5180 http://127.0.0.1:5180
```

Apoi deschide `https://<calculator>.<tailnet>.ts.net:5180/` (jocul) și `…:5180/panel.html` (panoul). Se oprește cu `tailscale serve --https=5180 off`. Setarea rămâne activă și după repornirea calculatorului, cât timp rulează `npm run dev`.

## Adăugarea în OBS (1080×1920)

1. Pornește jocul cu `npm run dev`.
2. În OBS: **Settings → Video**: Base (Canvas) Resolution și Output Resolution **1080x1920**.
3. În scena ta: **+ → Browser** (Browser Source), dă-i un nume.
4. Setări:
   - **URL**: `http://localhost:5180/` (sau `http://localhost:5180/?transparent=1` dacă vrei fundal transparent);
   - **Width**: `1080`, **Height**: `1920`;
   - bifează **Shutdown source when not visible** doar dacă vrei ca jocul să se oprească când ascunzi sursa (de obicei NU);
   - **Refresh browser when scene becomes active**: nebifat.
5. Panoul de control îl deschizi separat, în browserul tău obișnuit; nu îl adăuga în OBS.

Zona de joc utilă e între 10% și 65% din înălțime: sus e bara TikTok, iar jos sunt comentariile și cadourile. Cu `?debug=1` vezi exact aceste zone.

## Configurare și balans

- `.env`: username-ul TikTok, modul simulator, porturile, limba și „doar urmăritorii” (valorile de pornire).
- `game/src/config/config.ts`: plafonul de caractere (300), despawn-ul (90 s), dash-ul, duratele rundelor, combatul (rază, cooldown, damage), like-urile, XP-ul și balansul fiecărui mod (`survival`, `boss`).

## Maparea cadourilor

Toate efectele cadourilor sunt în `game/src/config/gifts.ts`. Un cadou se recunoaște după **nume** (recomandat, ex. `"Rose"`, fără să conteze literele mari/mici) sau după **giftId**.

- `FALLBACK_GIFTS`: efectele comune tuturor modurilor. Un cadou poate avea mai multe efecte.
- `MODE_GIFTS`: suprascrieri per mod (`survival`, `boss`, `pvp`, `td`). Dacă un cadou apare aici, efectele lui înlocuiesc complet efectele comune în modul respectiv; cadourile care lipsesc folosesc maparea comună. Exemple: în Boss Slayer Rose dă scut (zonele de pe jos contează mai mult decât viteza); în PvP Rose dă damage dublu 3 s.
- `VOTE_GIFTS`: cadourile de vot (implicit Rose → 1, TikTok → 2, Finger Heart → 3). Voturi = diamante × 5 × cantitate.
- Un cadou care nu apare nicăieri dă o bombă proporțională cu valoarea lui.

Efectele disponibile:

| Efect | Ce face |
|---|---|
| `shield` | scut personal: nu poate fi doborât |
| `teamShield` | scut pentru echipă (în PvP doar aliații expeditorului, altfel toți) |
| `speed` | dash mai lung și atac mai rapid |
| `power` | damage dublu pentru cel care trimite |
| `bomb` | damage pe tot ecranul (toți monștrii / boss-ul); în PvP: tot damage-ul în baza adversă și o parte (`pvp.bombPlayerMul`) în fiecare adversar |
| `revive` | ridică jucătorii căzuți; în Survival repară și 25% din cristal; în PvP ridică doar aliații și repară 5% din baza echipei; în Tower Defense repară 20% din cristal |
| `tower` | doar în Tower Defense: construiește un turn (`arrow`, `frost` sau `cannon`) sau îi crește nivelul; `levels` se înmulțește cu cantitatea |
| `skin` | skin permanent pe sesiune: `golden` (Rege), `galaxy` (Galaxie), `lion` (Leu). Un skin mai slab nu îl înlocuiește pe unul mai bun. |

Efectele cu durată se înmulțesc cu cantitatea, până la maximum 45 s. Bomba și revive merg doar în timpul rundei; skin-urile și XP-ul, oricând. Cine trimite un cadou fără să aibă caracter primește unul imediat, înaintea cozii.

Cadourile trimise în serie (streak) sunt tratate corect: serverul așteaptă finalul seriei și trimite jocului un singur cadou cu cantitatea totală. Catalogul de cadouri al simulatorului e în `shared/gifts.ts`.

## Grafică

Caracterele sunt desenate procedural (`game/src/core/textures.ts`). Pentru sprite-uri reale, încarcă imaginea în `game/src/scenes/BootScene.ts` (`preload`) sub aceeași cheie de textură, sau adaugă un skin nou în `game/src/core/SkinCatalog.ts`.

## Adăugarea unui mod de joc

1. Creează un fișier în `game/src/modes/<mod>/`, cu o clasă care extinde `BaseMode` (vezi `game/src/modes/GameMode.ts`). Suprascrie doar ce îți trebuie:
   - `setup` / `teardown`: creează și distruge obiectele modului;
   - `onRoundStart`: pornește runda (după lobby);
   - `update`: logica pe fiecare frame, doar cât runda e în desfășurare;
   - `getStatus`: bara de stare de sus; `isOver` și `getResults`: finalul rundei;
   - `onGift`, `onLikeBonus`, `onRevive`: reacții proprii la cadouri și like-uri.
2. Ca jucătorii să atace ceva, setează în `setup` `ctx.combat.source` la un obiect care implementează `TargetSource` (vezi `game/src/core/Combat.ts`). `EnemyManager` (din `core/Enemies.ts`) e gata făcut pentru monștri.
3. Adaugă o linie în `game/src/modes/registry.ts`. Ordinea de acolo dă și tastele `1`–`9` ale streamerului.

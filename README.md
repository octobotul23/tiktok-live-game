# Joc pentru TikTok LIVE

Joc controlat de comentariile, cadourile și like-urile spectatorilor. Rulează într-o pagină web pe care o capturezi în OBS ca **Browser Source** (1080×1920, vertical) și o transmiți pe TikTok LIVE.

- `server/`: se conectează la TikTok LIVE și/sau pornește **simulatorul**, apoi trimite evenimentele (chat, cadouri, like-uri) prin WebSocket.
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
| 5 | Conectare la TikTok LIVE real | ✅ gata de testat (cere un LIVE real) |
| + | Aplicația de telefon (APK), live din telefon | ✅ gata de testat pe Samsung |

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

Cu `SIMULATE=true` în `.env` (implicit), boții (spectatori falși) pornesc singuri. Din panou poți:
- regla boții în detaliu, în panoul **Boți (simulator)** (vezi mai jos);
- trimite orice cadou (cele marcate ↻ vin în serie, ca pe TikTok);
- scrie un comentariu de test, ca să verifici cum sunt înțelese comenzile (ca urmăritor sau nu), și simula un follow;
- schimba limba (română / engleză) și porni „doar urmăritorii pot intra” (vezi mai jos);
- porni sau opri afișarea zonelor sigure;
- vedea faza, modul curent și timpul rămas;
- controla jocul din secțiunea **Streamer** (vezi mai jos).

### Panouri separate

Sus, sub titlu, e o bară cu câte un buton pentru fiecare panou (TikTok LIVE, Joc, Setări joc, Streamer, Boți, Cadouri, Comentariu de test, Evenimente):
- **Toate** arată tot;
- un clic pe un panou îl arată **doar pe el**; clicuri pe alte panouri le adaugă sau le scot; dacă le scoți pe toate, revii la **Toate**;
- alegerea se ține minte în browser;
- butonul **↗** din colțul fiecărui panou îl deschide singur într-o fereastră separată (de ex. boții pe un monitor, evenimentele pe altul). Aceeași fereastră o deschizi direct cu `panel.html?show=bots` (sau `?show=bots,events`); ferestrele astea nu schimbă alegerea din panoul principal. Numele panourilor: `tiktok`, `game`, `settings`, `streamer`, `bots`, `gifts`, `chat`, `events`.

Pe telefon, bara e un singur rând care se derulează cu degetul.

### Boții

Fiecare setare are un slider (reglaj rapid) și o căsuță în care scrii cifra exactă (Enter sau clic în afară o aplică). Sub fiecare scrie ce face. Setările se salvează pe server, în `data/sim.json`, și rămân și după repornire (folderul `data/` nu se urcă pe git și nu se servește).

| Grup | Ce reglezi |
|------|-----------|
| Stiluri gata făcute | **Liniște / Normal / Aglomerat / Haos** schimbă mai multe setări dintr-un clic; **Valorile de bază** le readuce pe cele inițiale. |
| Câți boți | câți boți sunt în live (0–1000), cât de repede intră, câți pleacă pe minut (înlocuiți de alții noi), câți dintre ei scriu (restul doar privesc). |
| Cât de activi | activitatea totală (100% = normal, 200% = dublu, 0% = tac toți), valuri (ritmul urcă și coboară), comentarii pe secundă, rafale de like-uri și câte like-uri într-o rafală. |
| Ce scriu | cât de des scriu comenzi de mișcare, comenzile speciale ale modului, voturi; poți pune boții să **voteze mai ales o anumită opțiune**; câți țin cu echipa de sus în PvP. |
| Cadouri | cadouri pe minut, **cel mai scump cadou** trimis singur, cât de lungă poate fi o serie, câte sunt cadouri de vot. |
| Urmăritori | câți boți sunt deja urmăritori și câți dau follow pe minut. |

În faza de vot, boții votează singuri (în chat și cu cadouri de vot), ca să vezi barele mișcându-se. Limitele și valorile de bază ale fiecărei setări sunt într-un singur loc, `shared/sim.ts`; panoul își construiește câmpurile de acolo.

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
| Nume roșu și aură pentru cei noi | `NEWCOMER_SEC=10` | câte secunde (0–60) are un caracter abia apărut numele într-o etichetă roșie deasupra și o aură roșie în jur, ca spectatorul să-și găsească imediat caracterul. Se aplică și celor care revin după ce au ieșit pentru inactivitate. `0` oprește evidențierea. Cel mult 30 de nume roșii deodată (`CONFIG.newcomer.maxTags`). |

Textele sunt în `game/src/i18n/ro.ts` și `game/src/i18n/en.ts`. Dacă adaugi un text nou în `ro.ts` și uiți traducerea din `en.ts`, `npm run typecheck` îți arată unde lipsește.

> Pe TikTok LIVE real, informația „urmărește / nu urmărește” vine de la TikTok, la fiecare comentariu, cadou sau intrare. În simulator vine din setarea **Câți sunt deja urmăritori** (panoul Boți), bifa **e urmăritor** de la comentariul de test și butonul **Dă follow**.

## Conectarea la TikTok LIVE

Jocul citește comentariile, cadourile, like-urile, intrările și follow-urile din live-ul tău, prin biblioteca [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector). Nu-ți cere parola și nu scrie nimic pe TikTok: doar citește ce vede orice spectator.

**Varianta simplă, din panou:**
1. Pornește `npm run dev` și deschide panoul (http://localhost:5180/panel.html).
2. În cardul **TikTok LIVE** scrie contul (`@nume`, `nume` sau linkul profilului) și apasă **Conectează**.
3. Pornește LIVE-ul pe TikTok. Poți apăsa Conectează și înainte: serverul verifică singur la fiecare 30 s până începe live-ul.

Când apare „Conectat la live-ul lui @nume”, totul ajunge în joc, iar spectatorii falși ai simulatorului se opresc singuri. Butoanele de cadouri și comentariul de test din panou merg în continuare, pentru probe în timpul live-ului.

**Varianta automată, din `.env`:** `TIKTOK_USERNAME=numele_tau` și `SIMULATE=false`. La fiecare pornire, serverul se conectează singur.

Ce face conexiunea singură:
- dacă pică rețeaua, reîncearcă după 2, 4, 8… secunde (cel mult 60);
- dacă live-ul se termină, așteaptă următorul live (verificare la 30 s);
- comentariile scrise înainte de conectare nu se rejoacă.

| Stare în panou | Ce înseamnă |
|---|---|
| verde: „Conectat…” (plus numărul de spectatori) | evenimentele ajung în joc |
| galben: „nu e LIVE acum” | contul nu e live; reîncearcă singur |
| roșu: „Legătura cu TikTok a picat” | reîncearcă singur; detaliul tehnic e dedesubt |

Jurnalul conexiunii e în `logs/tiktok-AAAA-LL-ZZ.log`, un fișier pe zi: conectări, deconectări, erori și, la fiecare minut, câte comentarii, cadouri și like-uri au venit. Folderul `logs/` nu se urcă pe git.

**Limite.** Conectarea trece printr-un server de semnare gratuit (Euler Stream), cu un număr limitat de conectări pe zi. Dacă vezi des erori de tip `SignatureRateLimitError`, fă-ți o cheie gratuită pe eulerstream.com și pune-o în `.env` ca `TIKTOK_SIGN_API_KEY=` (doar acolo, niciodată în git). Biblioteca nu e oficială: când TikTok schimbă ceva, poate fi nevoie de `npm update tiktok-live-connector -w server`.

## Acces de pe alt dispozitiv (Tailscale)

Jocul ascultă implicit doar pe acest calculator (`127.0.0.1:5180`). Ca să-l deschizi de pe telefon sau de pe alt calculator din rețeaua ta Tailscale, fără să-l expui pe internet sau în Wi-Fi-ul local:

```bash
tailscale serve --bg --https=5180 http://127.0.0.1:5180
```

Apoi deschide `https://<calculator>.<tailnet>.ts.net:5180/` (jocul) și `…:5180/panel.html` (panoul). Se oprește cu `tailscale serve --https=5180 off`. Setarea rămâne activă și după repornirea calculatorului, cât timp rulează `npm run dev`.

## Aplicația de telefon (live din telefon)

Jocul poate rula și ca aplicație pe un telefon Android (testat pentru Samsung). Faci LIVE din aplicația TikTok cu **partajarea ecranului** (LIVE de tip joc pe mobil), iar jocul rulează în aplicația noastră. Serverul și panoul rămân pe calculator (Windows sau Mac, la fel): de acolo controlezi jocul în timp real, fără să atingi telefonul.

```
TikTok LIVE ──► server pe calculator (npm run dev) ──Tailscale──► aplicația de pe telefon (jocul)
                       ▲
                 panoul (browser pe calculator)
```

Telefonul ajunge la calculator în două feluri; panoul îți arată adresa pentru fiecare:
- **prin Tailscale** (merge de oriunde, legătură criptată): adresa `pc.tailnet.ts.net:5180`;
- **pe Wi-Fi-ul de acasă**, fără Tailscale: pui `WIFI=true` în `.env` și scrii în aplicație IP-ul calculatorului (ex. `192.168.1.13:5180`). Telefonul și calculatorul trebuie să fie în aceeași rețea de acasă. Calculatorul poate fi și pe cablu, la același router.

### O singură dată: pregătirea

Doar pentru Tailscale (pe Wi-Fi-ul de acasă ajunge `WIFI=true` în `.env`, apoi `npm run dev`):

1. **Tailscale** pornit pe calculator și pe telefon (aplicația Tailscale din Play Store), în același cont.
2. Pe calculator, publică jocul în rețeaua Tailscale (rămâne setat și după repornire):
   ```bash
   tailscale serve --bg --https=5180 http://127.0.0.1:5180
   ```
3. Pentru construirea APK-ului: **Java 21** și **Android SDK** (doar pe calculatorul pe care construiești).
   - Windows: JDK-ul Microsoft în `%LOCALAPPDATA%\Programs\jdk21` și SDK-ul în `%LOCALAPPDATA%\Android\Sdk` (așa e instalat acum pe calculatorul ăsta).
   - Mac: `brew install openjdk@21` și Android SDK în `~/Library/Android/sdk` (cel mai simplu: instalezi Android Studio, care îl pune acolo).
   - Dacă le ai în altă parte, setează `JAVA_HOME` și `ANDROID_HOME`.

### Construirea APK-ului

```bash
npm run apk
```

Scriptul crește versiunea (din `package.json`, ex. 0.0.1 → 0.0.2), construiește jocul și pune aplicația în `release/LiveGame-v0.0.2.apk`. Folderul `release/` nu se urcă pe git.

### Instalarea pe Samsung

1. Copiază APK-ul pe telefon: cablu USB, Google Drive, sau direct prin Tailscale: `tailscale file cp release/LiveGame-v0.0.2.apk <telefon>:` (apare în notificări pe telefon).
2. Deschide fișierul pe telefon. Prima dată, Android cere voie să instaleze aplicații din sursa respectivă (ex. „Fișierele mele” sau Chrome): **Setări → Permite din această sursă**.
3. Dacă Play Protect avertizează că aplicația nu e cunoscută, alege **Instalează oricum**: e aplicația ta, nesemnată de Google Play.

La o versiune nouă instalezi peste cea veche; adresa salvată rămâne. Dacă schimbi calculatorul pe care construiești (ex. treci pe Mac), Android poate refuza instalarea peste aplicația veche (semnătura de test diferă). Atunci dezinstalează aplicația veche întâi.

### Folosirea

1. Pe calculator: dublu-clic pe **`Porneste jocul.bat`** (Windows) sau **`Porneste jocul.command`** (Mac), în folderul jocului. Pornește serverul și deschide singur panoul (http://localhost:5180/panel.html); lasă fereastra deschisă cât ești live. Merge și din terminal: `npm run dev`. Pe Mac, prima dată: clic dreapta pe fișier → Deschide. În cardul **Joc** vezi **Adresa pentru aplicația de pe telefon** (ex. `pc.tailnet.ts.net:5180`) și, cu `WIFI=true`, **Pe Wi-Fi-ul de acasă** (ex. `192.168.1.13:5180`).
2. Pe telefon: deschide **Live Game**. Prima dată scrie adresa de mai sus și apasă **Conectează**. Data viitoare se conectează singur.
3. În panou, la **Ecrane**, apare „📱 telefon (aplicația) v0.0.2”. Tot ce schimbi în panou (setări, mod, simulator, TikTok) ajunge imediat pe telefon.
4. Pornește LIVE în TikTok cu partajarea ecranului, apoi treci în **Live Game** și lasă telefonul așa. Comentariile le vezi în fereastra mică a TikTok.

În aplicație:
- ecranul nu se stinge, iar barele sistemului sunt ascunse;
- **Înapoi** cere două apăsări, ca să nu închizi jocul din greșeală;
- **ecranul de conectare** se redeschide atingând de **5 ori, repede, colțul din stânga sus** (gest ascuns). Nu apare singur în timpul live-ului, nici dacă se pierde legătura, ca să nu-l vadă spectatorii. Starea o vezi în panou.

**Securitate:**
- aplicația acceptă numele Tailscale (legătură criptată, `wss://`) sau un IP din rețeaua de acasă (192.168.x.x, 10.x.x.x). Pe Wi-Fi legătura e necriptată, dar nu iese din casă; un IP de pe internet e refuzat;
- cu `WIFI=true`, pe IP-ul de acasă al calculatorului (nu și pe VPN-uri ca Radmin sau pe mașini virtuale) se deschide **doar legătura pentru aplicație**: panoul și fișierele jocului rămân doar pe calculator. De pe Wi-Fi se intră doar ca ecran de joc, deci nimeni din rețea nu poate da comenzi. Totuși, nu porni `WIFI=true` pe un Wi-Fi public sau împărțit. Dacă IP-ul găsit singur nu e cel bun, îl fixezi cu `WIFI_IP=192.168.1.13` în `.env`. Windows poate cere o dată voie în firewall pentru Node.js: alege „Rețele private”;
- dacă routerul îi dă calculatorului alt IP (după o repornire), panoul arată adresa nouă; o schimbi în aplicație cu gestul ascuns;
- serverul primește conexiuni doar de la paginile deschise pe calculator, de la aplicație și de la numele Tailscale exact al calculatorului. Alte site-uri (inclusiv alte `*.ts.net`) sunt refuzate;
- comenzile (setări, mod, TikTok) le acceptă doar de la panou.

Dacă Tailscale nu era pornit când ai dat `npm run dev`, repornește `npm run dev` ca să deschizi panoul prin numele Tailscale.

Dacă jocul se mișcă greu pe telefon în timpul live-ului (telefonul desenează jocul și filmează ecranul în același timp), scade **Caractere pe ecran (max)** din panou, la **Setări joc**. Schimbarea se aplică imediat.

**Mutarea serverului pe Mac:** pe Mac instalezi Node.js și Tailscale, copiezi proiectul (plus `.env`), rulezi `npm install`, `tailscale serve` (pasul 2) și `npm run dev`. Panoul de pe Mac îți arată noua adresă. Pe telefon o schimbi din ecranul de conectare (gestul ascuns). Același APK merge cu orice calculator.

**Cerințe TikTok:** LIVE-ul cu partajarea ecranului are cerințe de cont (vârsta și, în multe țări, un număr minim de urmăritori). Verifică în aplicația TikTok dacă ai opțiunea.

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

## Videoclipuri de prezentare

`tools/video` filmează jocul „ca pe un LIVE”: deasupra jocului apare o interfață generică de LIVE (bara de sus, chatul, cadourile, inimioarele), iar o persoană urmărită (Mara / Mia) își scrie comenzile ca pe telefon: atinge căsuța, se deschide tastatura și fiecare tastă se apasă pe rând (Shift pentru majuscule, apăsare lungă pentru diacritice și semne, emoji din bara de sugestii), apoi atinge trimiterea și tastatura se închide. Ca orice caracter nou, al ei apare întâi cu numele roșu și aura roșie din joc; după aceea, deasupra lui stă eticheta „TU · Mara”, ca să se vadă care e. Videoclipurile ies verticale, 1080×1920, 30 de cadre pe secundă, fără sunet.

Ai nevoie de `npm run dev` pornit, de Chrome sau Edge și de `ffmpeg` în PATH.

```bash
npm run video
```

```bash
npm run video -- survival-en vote-pvp-en
```

| Scenariu | Limba | Ce se vede |
|---|---|---|
| `camera-mica` | română | cameră mică, 10 oameni: chat liniștit, Mara scrie des și își găsește caracterul pe ecran |
| `small-room-en` | engleză | aceeași cameră mică, în engleză |
| `survival` | română | lobby, apoi Survival: chatul apără cristalul, cadouri tot mai mari |
| `vot-pvp` | română | rezultatele unei runde Boss Slayer, votul chatului, apoi Sus vs Jos |
| `survival-en` | engleză | același Survival, cu jocul, chatul și comenzile în engleză (`up`, `left`…) |
| `vote-pvp-en` | engleză | votul, apoi Top vs Bottom (`team up` / `team down`) |

- Fișierele ies în `videos/` (nu intră în git).
- Pagina filmată nu se conectează la server, deci nu încurcă jocul tău deschis.
- Timpul jocului avansează cadru cu cadru, așa că videoclipul e fluid chiar dacă randarea durează ~2 minute.
- Cine scrie, ce scrie și când stă în `tools/video/scenarios.mjs`. Textele din chat, numele și replicile persoanei urmărite sunt grupate pe limbă (`TEXT.ro`, `TEXT.en`). Totul pornește dintr-o sămânță fixă, deci fiecare randare iese la fel.
- Opțiuni: `--base=http://localhost:5180`, `--out=videos`, `--fps=30`.

## Configurare și balans

- `.env`: plafonul de caractere (`MAX_ACTIVE`), username-ul TikTok, modul simulator, cheia opțională Euler Stream, porturile, Wi-Fi-ul de acasă (`WIFI`), limba, „doar urmăritorii” și evidențierea celor noi (`NEWCOMER_SEC`) (valorile de pornire).
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

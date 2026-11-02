# Specificație

Specificația inițială, actualizarea „mai multe moduri + vot” și deciziile luate pe parcurs. Unde se contrazic, actualizarea și deciziile au prioritate.

## 1. Specificația inițială

Joc pentru TikTok LIVE controlat de comentariile și cadourile spectatorilor. Rulează pe macOS și Windows, într-o pagină web capturată în OBS ca Browser Source și transmisă pe TikTok LIVE.

### Conceptul
- Primul comentariu al unui spectator îi creează un caracter (culoare unică + număr scurt, ex. #47).
- Spectatorul își controlează caracterul comentând up / down / left / right. Acceptă și u/d/l/r, sus/jos/stanga/dreapta și emoji ⬆️⬇️⬅️➡️, case-insensitive, ignorând restul textului.
- Fiecare comandă = dash scurt și vizibil (cu urmă), nu un pas mic, pentru că comentariile vin cu 1–3 s întârziere.
- Caracterele atacă automat cel mai apropiat monstru/inamic din rază.
- Cadourile dau puteri speciale și skin-uri.
- Like-urile umplu o bară comună; la prag se declanșează un bonus pentru toată echipa.

### Stack
- Node.js + TypeScript, monorepo cu `server/` (tiktok-live-connector → evenimente normalizate chat/gift/like/member → WebSocket) și `game/` (Phaser 3 + Vite, canvas vertical 1080×1920, fundal care poate fi transparent).
- Un singur `npm run dev` pornește tot. Fără dependențe specifice Windows.
- Username-ul TikTok și valorile de balans în `config.ts` / `.env`.

### Layout
- Zona utilă: y între ~10% și ~65% din înălțime (sus bara TikTok, jos 35% comentarii și cadouri). Modul debug afișează aceste safe zones.

### Mulțimea de caractere
- Caractere de ~32 px, suprapunere permisă, cu separare moale (se împing ușor, ca o mulțime).
- Contur/umbră pe fiecare sprite, lizibile după compresia video.
- La comentariu: caracterul vine în față, primește contur alb, numele apare deasupra 3 s.
- Plafon configurabil de caractere active (implicit 300); peste plafon, coadă afișată discret.
- Despawn după 90 s de inactivitate (configurabil).
- Contor „x47 ATACURI” când mulți lovesc aceeași țintă.
- Performanță: 60 FPS cu 500 de caractere și 100 de monștri (object pooling, sprite batching).

### Cadouri
- Mapare gift → efect într-un fișier de config editabil (după giftId sau nume). Exemple: scut, bombă pe tot ecranul, viteză, revive pentru echipă, skin special (mai mare, cu aură/particule).
- Seriile (streak): evenimentul se repetă cu repeatCount crescător; efectul se aplică o singură dată pe cantitate, la finalul seriei.
- Cine trimite un cadou fără să aibă caracter primește unul automat, cu prioritate peste coadă.

### Simulator (obligatoriu)
- `SIMULATE=true` generează spectatori falși, comentarii, cadouri și like-uri.
- Panou de debug care nu apare în captura OBS: slider pentru numărul de jucători falși (0–1000), butoane pentru fiecare cadou, rata comentariilor.
- Simulează și voturi, alegerea echipelor și cadouri în fiecare mod.

### Grafică
- Forme procedurale sau placeholder-uri simple; codul structurat ca sprite-urile și skin-urile să poată fi înlocuite ușor.

### README (în română)
- Instalare pe Mac (Node prin Homebrew), rulare, Browser Source în OBS la 1080×1920, editarea mapării cadourilor.

## 2. Actualizare: mai multe moduri de joc + vot

Înlocuiește secțiunea „Monștri și progresie”: modul cu valuri de monștri devine doar unul dintre moduri (Survival).

### Arhitectură
- Core comun: conexiunea la TikTok, parserul de comenzi, registrul de jucători (culoare, număr, skin, statistici), coada, despawn-ul, highlight-ul la comentariu, UI-ul comun.
- Fiecare mod e o clasă care implementează `GameMode`: setup, onPlayerJoin, onCommand, onGift, onLike, update, isOver, getResults, teardown.
- Maparea cadourilor e per mod, cu un fallback comun.
- Profilul jucătorului rămâne între moduri pe durata sesiunii (skin-uri, XP).
- Un mod nou = un fișier nou + înregistrare într-o listă.

### Fluxul unei runde
1. Lobby de 10 s cu numele modului și instrucțiuni (comenzile modului).
2. Runda, cu durată maximă configurabilă per mod.
3. Rezultate (top jucători / echipa câștigătoare), 10 s.
4. Vot de 20 s între 3 moduri aleatorii (fără cel tocmai jucat). Spectatorii comentează 1, 2 sau 3; cadourile valorează mai multe voturi (configurabil). Bare de vot live.
5. Override pentru streamer: alege direct modul sau sare peste vot.

### Comenzi
- up/down/left/right (cu aliasurile de mai sus) identice în toate modurile.
- Un mod poate adăuga cel mult 1–2 comenzi proprii, scurte. Comenzile modului curent sunt mereu pe ecran.

### Modurile
1. **Survival**: valuri de monștri din margini spre baza din centru; dificultate crescătoare; tipuri rapid, tanc, boss la fiecare al 5-lea val; baza are HP, la 0 runda se termină; leaderboard top 5 după damage.
2. **Boss Slayer**: un boss uriaș cu HP mare și 3 faze. Atacurile sunt anunțate cu 2–3 s înainte prin zone colorate pe jos. Toți atacă automat bossul din rază.
3. **PvP Sus vs Jos**: două echipe (jumătatea de sus / de jos), fiecare cu baza ei. Repartizare automată în echipa mai mică sau alegere manuală. Atac automat asupra inamicilor din rază. Câștigă cine distruge baza adversă. Cadourile dau bonus doar echipei expeditorului.
4. **Tower Defense**: drum fix spre bază; jucătorii sunt „turnuri vii”; cadourile construiesc turnuri pe sloturi de lângă drum.
5. **King of the Hill**: zonă în centru; puncte cât timp stai în ea; jucătorii se împing.
6. **Battle Royale**: toți contra tuturor, zona sigură se strânge; ultimii rămași câștigă.
7. **Infecția**: un jucător aleatoriu e zombie; zombie-ii transformă pe cei atinși; supraviețuitorii câștigă dacă rezistă.
8. **Ploaia de aur**: cad monede, cufere și bombe; clasament după cât a strâns fiecare.
9. **Chat vs Streamer**: streamerul controlează un boss de la tastatură (WASD + 2 abilități); chatul încearcă să-l doboare.

### Milestone-uri (după fiecare: oprire pentru testare)
1. Server + simulator + caractere care apar și se mișcă din comentarii.
2. Core-ul multi-mod, sistemul de vot, Survival și Boss Slayer.
3. PvP Sus vs Jos și cadourile per mod.
4. Restul modurilor, câte unul.
5. Conectarea la TikTok LIVE real, reconectare automată, logging.

## 3. Decizii

- **Alegerea echipei în PvP**: comenzi dedicate `echipa sus` / `echipa jos`, iar `sus` / `jos` simplu alege și el echipa cât timp jucătorul nu are încă una; după aceea înseamnă mișcare. Schimbarea echipei e permisă doar în lobby (configurabil).
- **Cadourile la vot**: cadouri diferite = opțiuni diferite (ex. Rose → 1, TikTok → 2, Finger Heart → 3), fiecare cu o pondere de voturi, configurabil (voturi = diamante × 5 × cantitate, în `game/src/config/gifts.ts`). Comentariile `1`/`2`/`3` funcționează în paralel; un vot per spectator, ultimul contează.
- **Tastele streamerului** (override vot, WASD în Chat vs Streamer) vin și din panou, prin server, pentru că un Browser Source din OBS nu primește tastatura decât prin „Interact”.
- **Simulatorul** e pe server și trece prin același normalizator ca evenimentele reale; jocul nu face diferența.

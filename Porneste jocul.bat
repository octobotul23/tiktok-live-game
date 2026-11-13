@echo off
rem Porneste jocul cu dublu-clic: serverul + panoul de control in browser.
rem Fereastra asta trebuie sa ramana deschisa cat timp esti live. Oprire: Ctrl + C sau inchizi fereastra.
chcp 65001 >nul
title Live Game - server (lasa fereastra deschisa)
cd /d "%~dp0"

set "PANEL=http://localhost:5180/panel.html"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Nu gasesc Node.js pe calculator. Instaleaza-l de pe https://nodejs.org ^(varianta LTS^), apoi incearca din nou.
  echo.
  pause
  exit /b 1
)

rem Daca jocul ruleaza deja ^(ex. pornit mai devreme^), doar deschidem panoul.
curl.exe -s -o nul --max-time 2 "%PANEL%"
if not errorlevel 1 (
  echo  Jocul ruleaza deja. Deschid panoul...
  start "" "%PANEL%"
  timeout /t 3 >nul
  exit /b 0
)

if not exist "node_modules\" (
  echo  Prima pornire: instalez ce ii trebuie jocului ^(dureaza un minut^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Instalarea n-a mers. Verifica internetul si incearca din nou.
    pause
    exit /b 1
  )
)

rem Deschide panoul singur, imediat ce serverul raspunde ^(asteapta cel mult un minut^).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 60; $i++) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 '%PANEL%' | Out-Null; Start-Process '%PANEL%'; break } catch { Start-Sleep -Seconds 1 } }"

echo.
echo  Pornesc jocul. Panoul se deschide singur in browser.
echo  Lasa fereastra asta deschisa cat timp esti live. Oprire: Ctrl + C.
echo.
call npm run dev

echo.
echo  Jocul s-a oprit.
pause

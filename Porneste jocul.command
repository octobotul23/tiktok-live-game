#!/bin/bash
# Pornește jocul cu dublu-clic pe Mac: serverul + panoul de control în browser.
# Fereastra Terminal trebuie să rămână deschisă cât timp ești live. Oprire: Ctrl + C sau închizi fereastra.
cd "$(dirname "$0")" || exit 1
PANEL="http://localhost:5180/panel.html"

if ! command -v npm >/dev/null 2>&1; then
  echo
  echo " Nu găsesc Node.js pe Mac. Instalează-l de pe https://nodejs.org (varianta LTS) sau cu: brew install node"
  echo
  read -r -p " Apasă Enter ca să închizi."
  exit 1
fi

# Dacă jocul rulează deja, doar deschidem panoul.
if curl -s -o /dev/null --max-time 2 "$PANEL"; then
  echo " Jocul rulează deja. Deschid panoul..."
  open "$PANEL"
  exit 0
fi

if [ ! -d node_modules ]; then
  echo " Prima pornire: instalez ce îi trebuie jocului (durează un minut)..."
  if ! npm install; then
    echo
    echo " Instalarea n-a mers. Verifică internetul și încearcă din nou."
    read -r -p " Apasă Enter ca să închizi."
    exit 1
  fi
fi

# Deschide panoul singur, imediat ce serverul răspunde (așteaptă cel mult un minut).
(
  for _ in $(seq 60); do
    if curl -s -o /dev/null --max-time 1 "$PANEL"; then open "$PANEL"; break; fi
    sleep 1
  done
) &

echo
echo " Pornesc jocul. Panoul se deschide singur în browser."
echo " Lasă fereastra asta deschisă cât timp ești live. Oprire: Ctrl + C."
echo
npm run dev

echo
echo " Jocul s-a oprit."
read -r -p " Apasă Enter ca să închizi."

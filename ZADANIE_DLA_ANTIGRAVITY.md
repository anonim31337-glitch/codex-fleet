# ZADANIE: Deploy Codex-Fleet Omni-Terminal

## Co to jest
Gotowa aplikacja webowa (single HTML file) - brutalistyczny panel dowodzenia
z trzema modułami: radar COMMS.BRIDGE, terminal AUDIT.EXTRACTION,
tracker PROMPT.TRACKER (styl Amiga). Zbudowana w Claude Design, zaimplementowana.

## Pliki (są w ZIP: codex-fleet.zip, już pobrane)
- `index.html` - cała aplikacja (self-contained, działa bez backendu)
- `agent/server.js` - WebSocket relay server (Node.js, uruchomić na tej maszynie)
- `agent/agent.py` - monitor systemu (Python, uruchomić na OMEN i VIVO)
- `agent/package.json` - zależności Node
- `agent/requirements.txt` - zależności Python

## ZADANIE 1: Push na GitHub i deploy na Vercel

1. Rozpakuj codex-fleet.zip
2. W folderze codex-fleet wykonaj:
   ```
   git init
   git add .
   git commit -m "Codex-Fleet Omni-Terminal v2"
   ```
3. Utwórz nowe repozytorium na github.com (zalogowane konto Google anonim31337@gmail.com)
   - Nazwa repo: `codex-fleet`
   - Publiczne
4. Wypchnij kod:
   ```
   git remote add origin https://github.com/USERNAME/codex-fleet.git
   git push -u origin main
   ```
5. Wejdź na vercel.com (zaloguj przez GitHub)
   - New Project → Import z GitHub → `codex-fleet` → Deploy
   - Dostaniesz link: `codex-fleet.vercel.app` lub podobny

## ZADANIE 2: Uruchom relay server na tej maszynie (ASUS/KAPITAN-PLANETA)

```bash
cd codex-fleet/agent
npm install
node server.js
```

Serwer startuje na porcie 8765.

## ZADANIE 3: Tunel Cloudflare (żeby OMEN mógł się połączyć przez internet)

Jeśli nie masz cloudflared:
```bash
# Windows:
winget install Cloudflare.cloudflared
# lub pobierz z: https://github.com/cloudflare/cloudflared/releases

# Uruchom tunel:
cloudflared tunnel --url http://localhost:8765
```
Zapisz URL który dostaniesz (np. `wss://xyz.trycloudflare.com`)

## ZADANIE 4: Agent Python na tej maszynie (VIVO)

```bash
cd codex-fleet/agent
pip install psutil websockets
python agent.py --node VIVO --server ws://localhost:8765
```

Opcjonalnie z plikami:
```bash
python agent.py --node VIVO --server ws://localhost:8765 \
  --handoff C:\Users\USERNAME\bridge\handoff-current.json \
  --log C:\Users\USERNAME\logs\extract.log
```

## ZADANIE 5: Agent na OMENie

Na OMENie uruchom:
```bash
python agent.py --node OMEN --server wss://XYZ.trycloudflare.com
```
(użyj URL z Zadania 3)

## ZADANIE 6: Połącz frontend z realnym feedem

Otwórz w przeglądarce:
```
https://codex-fleet.vercel.app?ws=wss://XYZ.trycloudflare.com
```

## Jak działa po uruchomieniu
- Bez `?ws=` → tryb symulacji (klik w mały kwadrat w prawym górnym rogu modułu 01)
- Z `?ws=URL` → dane realne z OMEN/VIVO (CPU, logi, handoff JSON)
- OMEN i VIVO świecą na zielono gdy połączone, czerwono gdy offline

## Kontakt / źródło
Kod wygenerowany przez Claude Code (claude.ai/code)
Projekt: Codex-Fleet Omni-Terminal v2

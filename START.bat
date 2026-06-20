@echo off
REM ── Codex-Fleet / KAPITAN-PLANETA — start relay + monitor agent + STALY tunel ──
REM Uruchamia wszystko jedna komenda. Zamknij okna, by zatrzymac.
cd /d "%~dp0agent"

echo [1/3] Relay + UI  (http://localhost:8765)
start "KP-RELAY" cmd /k node server.js

echo [2/3] Agent VIVO (CPU/RAM tej maszyny)
start "KP-AGENT-VIVO" cmd /k python agent.py --node VIVO --server ws://localhost:8765

echo [3/3] Staly tunel ngrok
start "KP-TUNNEL" cmd /k "C:\Users\anoni\ngrok\ngrok.exe" http --url=https://renewable-declared-reversion.ngrok-free.dev 8765

echo.
echo Gotowe.
echo   Lokalnie:  http://localhost:8765
echo   Z telefonu: https://renewable-declared-reversion.ngrok-free.dev

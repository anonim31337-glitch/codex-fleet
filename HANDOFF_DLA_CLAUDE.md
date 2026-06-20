# Handoff dla Claude Code od Antigravity

Witaj Claude! Użytkownik przekazuje Ci ten projekt, ponieważ moje rozwiązanie (lub jego część) nie spełniło ostatecznych oczekiwań. Twoim zadaniem jest doprowadzenie do końca wizji użytkownika. Poniżej znajduje się pełne podsumowanie tego, co mamy, gdzie leżą pliki i co trzeba zrealizować.

## 🎯 Cel Projektu
Użytkownik posiada "mockup" futurystycznego panelu sterowania flotą maszyn (OMEN, VIVO) nazwanego **KAPITAN-PLANETA**. Interfejs ma działać online, prezentować prawdziwe dane obciążeniowe (CPU/RAM) podłączonych maszyn z użyciem WebSocketów, oraz pozwalać użytkownikowi na dodawanie wygenerowanych promptów/stringów do prawdziwej kolejki (kolejkowania zadań).

## 📁 Struktura i Ścieżki
Główny katalog projektu to: `C:\Users\anoni\Downloads\KapitanPlaneta`

1. **Frontend (Czysty projekt Vite - zalecany do dalszej pracy)**
   - Ścieżka: `C:\Users\anoni\Downloads\KapitanPlaneta\frontend`
   - Co to jest: Mój subagent wyodrębnił oryginalny, brzydko zbundlowany kod z pliku `index.html` i przepisał go do czystego formatu React + Vite. Znajdziesz tam `src/App.jsx`.
   - **Uwaga**: Ten kod w Vite zawiera z powrotem mockowane funkcje `Math.random()`. Musisz go podłączyć pod WebSockety!

2. **Frontend (Stary, połatany index.html)**
   - Ścieżka: `C:\Users\anoni\Downloads\KapitanPlaneta\index.html`
   - Co to jest: Oryginalny plik, w którym ręcznie wstrzyknąłem obsługę WebSocketów (znajduje się tam jako bardzo nieczytelny i zbundlowany kod `DCLogic`). Sugeruję zignorowanie go na rzecz czystego projektu w folderze `frontend`.

3. **Serwer przekaźnikowy (Relay WebSockets - Node.js)**
   - Ścieżka: `C:\Users\anoni\Downloads\KapitanPlaneta\agent\server.js`
   - Co to jest: Prosty serwer WS na porcie `8765`. Agent wysyła na niego informacje, a frontend je stamtąd pobiera. Nasłuchuje też na wiadomości `generate_row` z frontendu i dopisuje je do `C:\Users\anoni\Downloads\KapitanPlaneta\agent\queue.txt`. Wymaga uruchomienia via `node server.js`.

4. **Agent Monitorujący (Python)**
   - Ścieżka: `C:\Users\anoni\Downloads\KapitanPlaneta\agent\agent.py`
   - Co to jest: Skrypt działający na fizycznych maszynach (np. VIVO, OMEN). Zczytuje z lokalnego PC procesor oraz RAM (via `psutil`) i rzuca co X sekund po websocketach do serwera (wymaga `pip install psutil websockets`).
   - Sposób wywołania: `python agent.py --node VIVO --server ws://localhost:8765`

## 🛜 Dostęp z Internetu (Serwery / Hasła)
Zamiast tradycyjnego hostingu, używaliśmy **Cloudflare Tunnels**, aby wystawić lokalne porty do sieci publicznej. W tle wciąż mogą działać procesy uruchamiające tunele (możesz je ubić lub zostawić):
- Frontend był udostępniany poleceniem (wymaga lokalnego serwera http np. port 8080): `cloudflared tunnel --url http://localhost:8080`
- WebSockety były udostępniane poleceniem: `cloudflared tunnel --url http://localhost:8765`
Otrzymane adresy URL (np. `*.trycloudflare.com`) wpisywaliśmy w frontend jako parametr `?ws=wss://ADRES.trycloudflare.com`.

## 🛠️ Twoje Zadanie (Co należy zrobić)
1. **Frontend**: Przejmij katalog `frontend` (Vite) i zaprogramuj w `App.jsx` realne połączenie z backendem WebSocket (port `8765`). Interfejs ma wyświetlać realne logi, parametry CPU/RAM z węzłów (OMEN, VIVO) i obsługiwać status "ONLINE / OFFLINE".
2. **Kolejkowanie (Generowanie)**: Zadbaj o to, by przycisk "STAGE ROW" lub odpowiednie sekcje poprawnie budowały kolejkę zadan i zapisywały ją na backendzie w `queue.txt` (lub jakkolwiek użytkownik zdecyduje). Użytkownik wspomniał: *"nie można tam nic generować, muszę przekopiowywać te kolejki"*. Musisz zaimplementować realną interakcję z tą funkcją, aby zaspokoić to oczekiwanie.
3. **Publiczny Dostęp**: Zapewnij, że to wszystko faktycznie będzie widoczne "w necie" tak, aby użytkownik mógł odpalić to z telefonu nie będąc w sieci domowej, z użyciem NGROK lub Cloudflare.

Powodzenia, Claude! Użytkownik jest wymagający i zależy mu na wysokiej jakości oraz realnym poczuciu korzystania z "systemu dowodzenia flotą". Zrób to dobrze!

# SILNIK PRODUKCJI FILMU AI — „Metoda Patryka" (mózg narzędzia)

> Cel narzędzia: z surowego pomysłu („chcę film o X") wyprodukować **kompletny pakiet
> produkcyjny** + **listę zadań rozesłaną do właściwych generatorów**, tak by każdy
> (nawet bez wiedzy reżyserskiej) zrobił spójny film 5 min w 1 dzień / 60 min w tydzień.
>
> **Narzędzie NIE generuje.** Narzędzie PRZESŁUCHUJE, PRZYGOTOWUJE i ROZSYŁA ZADANIA.
> Brak przycisku „generuj" = zero kosztu = bezpieczne do udostępnienia (Bramka 0).

---

## 0. Filozofia (dlaczego to działa)
Patryk zrobił 5-min anime „ARBALEST / All Your Context Window Are Belong To Claude"
w ~godzinę-dzień, bo **miał wszystko gotowe ZANIM dotknął Lumy**: zdjęcia twarzy,
przerobione kadry kokpitu (Gemini/Grok), tekst piosenki z tagami głosów, partyturę
ujęć przypiętą do bitów. Wąskie gardło to nie generacja — to PRZYGOTOWANIE i WIEDZA,
co-czym-w-jakiej-kolejności. Silnik przejmuje to przygotowanie.

## 1. WYWIAD (te „miliony pytań" — uporządkowane)
Narzędzie prowadzi rozmowę-ankietę. Bloki pytań (pyta tylko o istotne, resztę zakłada
sensownie i pokazuje do akceptacji):

**A. Wizja** — gatunek (anime/sci-fi/fantasy/sitcom/skecz/dramat), temat/bohater,
długość docelowa, nastrój/ton (referencje: „jak Full Metal Panic", „jak Blade Runner”),
1-zdaniowy logline.
**B. Bohater & assety** — czy wstawiamy realną osobę (Twoja twarz / Olaf / ktoś)?
Ile masz zdjęć i jakich (selfie, sylwetka, profil)? Postać fikcyjna? Lokacje? Rekwizyty?
**C. Dźwięk** — piosenka czy narracja/dialogi? BPM/tempo? Język wokalu? Styl
(J-pop chorus + Engrish verse / orkiestra / lo-fi)? Czy generujemy tekst?
**D. Pipeline & budżet** — jakie narzędzia ma user (Luma/Higgsfield/Gemini/Grok/
ElevenLabs/Suno)? Limit tokenów/kredytów? Format (16:9 / 9:16), rozdzielczość, fps.
**E. Struktura** — jeden klip czy wieloczęściowy? Czy ma klimaks zsynchronizowany z
dropem muzyki? Ile ujęć ~?

## MODUŁ MUZYCZNY — spec (od Patryka, 18.06.2026)
- Dwa pola jak w Suno: **`lyrics` ~3000–4000 znaków** + **`styles` ≤999 znaków** (liczniki).
- Tryb: **piosenka** ALBO **ścieżka dźwiękowa / score** (instrumental, bez wokalu).
- **Bilingual UX:** użytkownikowi pokazujemy prompt PO POLSKU; dopiero „Zatwierdź" → wersja
  ANGIELSKA do wklejenia (generatory chcą EN, user myśli po PL).
- **Pętla dopisywania:** pole „dodaj czego brakuje" → przelicz prompt (jak ~10 rund w Gemini).
- Wklejasz do **Suno** albo **bezpośrednio do LumaLabs**. Wystarczy, że user z grubsza powie
  czego chce — reszta to prompt.

## 0. FABUŁA NAJPIERW (korzeń — od Patryka, 18.06.2026)
Bez historii reszta wisi w próżni. Narzędzie najpierw generuje **opowiadanie/fabułę**
(logline → motyw → 3 akty → beaty → proza). Proza = Twórczy-fill (LLM); brief/struktura
deterministycznie. **Fabuła ORYGINALNA** — przykłady literackie (np. e-elewator.org,
Gustaw Rajmus) to tylko wzorzec FORMY/jakości, NIE kopiujemy (prawa autorskie).
Cel długości prozy: ~1500–3000 zn. (≤90s) lub ~4000–9000 zn. (dłuższe).

## PUŁAPKI — co może pójść nie tak (sekcja 6 pakietu)
Źródło inspiracji: YT „I Gave Claude $500 To Make a Better Film than Me" (Joseph Martin)
— brak napisów, więc zasady ogólne + do uzupełnienia o szczegóły Patryka:
fabuła najpierw · spójność postaci/świata (lock+seed) · intencja każdego ujęcia ·
rytm montażu do bitu · prostsze ujęcia = mniej artefaktów · bloki IP/likeness ·
dźwięk = połowa wrażenia.

## 2. WYJŚCIE — „PRODUCTION PACK" (sekcje 0–6)
0. **FABUŁA** (brief + 3 akty; proza = Twórczy-fill)
1. **SONG SPEC / MUSIC** — pola `styles` (≤999) + `lyrics` (~3–4k), PL→EN, jak lyrics ARBALEST:
   `[Deep Male Voice, Heavy Japanese Accent English]`, `[Powerful Female J-Pop Vocal]`),
   struktura intro/verse/pre-chorus/chorus/bridge/outro, BPM, znaczniki dropu.
2. **PARTYTURA UJĘĆ** (format ARBALEST) — podzielona na CZĘŚCI. Każda część ma nagłówek:
   `Continues from [czas] · Window [okno] · [BPM] · [format/res] · Tone · Continuity-lock
   · Hit/Climax [czas+wydarzenie]`. Tabela: `# | Time | Cut | Shot | Beat`,
   ujęcia przypięte do bitów i linijek tekstu.
3. **ASSET-PREP — lista zadań** (sedno!): konkretne polecenia, np.
   „zrób 30 selfie wg tej listy póz", „wybierz 6 najlepszych do folderu",
   „wklej TEN prompt w Gemini, by wstawić twarz do kokpitu — wariant A/B/C ujęcia".
4. **PROMPTY PER UJĘCIE** wg DOKTRYNY LUMA: dla każdego ujęcia (a) prompt KADRU dla
   Gemini (Start-Frame), (b) krótka KOMENDA RUCHU dla Lumy (1 obraz + ruch). ×3–4 taniej
   niż prompt-do-Lumy-od-zera.
5. **PLAN MONTAŻU** — kolejność, długości cięć do bitu, gdzie podłożyć audio, eksport.

## 3. ROUTING — co do jakiego generatora (dyspozytornia)
- **Tekst piosenki** → (Claude pisze) → **Suno / ElevenLabs Music** (śpiew).
- **Głos/narracja/dialogi** → **ElevenLabs** (tagi głosów).
- **Kadry / wstawienie twarzy / warianty ujęć** → **Gemini** (frame), poprawki/restyle → **Grok**.
- **Ruch / animacja kadru** → **Luma** (Start-Frame + komenda ruchu). Trudne → **Higgsfield**.
- **Montaż / mux / cięcie do bitu** → ffmpeg / media-tools (lokalnie).
Każde zadanie w liście MA przypisany generator + gotowy prompt do wklejenia.

## 4. DOKTRYNA EKONOMII (zaszyta na sztywno)
Gemini robi kadr → Luma dostaje **1 Start-Frame + krótką komendę ruchu**, nie prompt
od zera. Warianty ujęć generuj w tańszym Gemini, nie w Lumie. Trzymaj **seed/postać**
stałe między ujęciami (continuity-lock) — to oszczędza poprawki.

## 5. PĘTLA SPÓJNOŚCI (continuity-lock)
Zdefiniuj raz: wygląd bohatera (z referencyjnych zdjęć), wygląd mecha/lokacji
(„off-white/grey, red accents, cyan optics”), paleta, obiektyw/ton. Każdy prompt
dziedziczy ten zamek. Zmiany tylko świadome (np. wróg = crimson optics).

---

## ZAOBSERWOWANY PIPELINE LUMA AGENT (z sesji Patryka, 17.06.2026)
Wszedłem w zalogowaną sesję (Claude-in-Chrome) i przescrollowałem okno agenta
„Mech Cockpit Camera Movement". Luma Agent to autonomiczny agent wieloetapowy, który
PLANUJE i wykonuje per segment. Realny przebieg:
- **5-krokowy pipeline per segment:** plan ujęć → beat-grid → generuj spójne keyframe'y
  (1K, 16:9, ten sam model, tożsamość z referencji) → **JUDGE** spójności
  (postać + mech + styl) → animuj każdy keyframe do długości bitu → stitch klipów do
  beat-grid + podłóż hymn.
- **6 części:** OP (0:00–1:03, ~11 keyframe'ów) · Combat · Breather (slice-of-life) ·
  Part 4 Turning Point (segment 5LKUs-5e, F9/klimaks dokładnie na 3:41) · Part 5 Victory
  (56.917s, outro card na 4:48) · Part 6 Outro (seg6.mp4: 4 klipy, 11.5s, silent).
- **FINAŁ:** stitch P-c_WlcQ + seg4+seg5+seg6 + pełny hymn → 1 MP4 **299.5s, 1280×720,
  24fps, H.264+AAC, asset 77jQnGSG**; ~70 ujęć, spójność trzymana 5 min, 4 dropy zsync,
  naprawione 2 znoszenia stylu (skills/visual-consistency, skills/multi-shot-assembly).
- **Blok IP:** „Intellectual property likeness detected" na ujęciu nawiązującym do FMP.
- **KOSZT (usage):** 11 955 kredytów = Veo 3 (4962) + Ray 3.2 (4000) + Luma Agent (1958)
  + Nano Banana 2 / Gemini-image (1035).

**Wniosek dla silnika:** powielamy DOBRE z tego pipeline'u (plan→keyframe→JUDGE→animate→
stitch, twardy beat-grid, asset-ID per segment), ale TNIEMY KOSZT: keyframe'y w Gemini/
Nano-Banana zamiast Veo 3, animacja tylko 1 Start-Frame→Luma/Ray, Veo 3 na 1–2 hero-ujęcia.
Krok „JUDGE spójności" warto dodać do listy zadań jako osobny check.

## Źródło metody (dowód)
Zrekonstruowane z realnego projektu Patryka „ARBALEST" (Luma board
08985f32-…, 102 assety) + lyrics + folder `Obrazy\Z aparatu\ja` (selfie → Gemini/Grok
→ kokpit) + plik `luma-process-extract-…json`. Patryk = proof-of-concept tej metody.
Powiązane: [[project_film_scenario_engine]], [[feedback_luma_doctrine]],
[[project_anime_act01_draft]].

# Narrative-Engine — „Książka-jako-Kod"

Podsystem zarządzający tworzeniem narracji jak kodem: **stan w plikach** (nie w kontekście
czatu), **reżyser-pytacz**, **audyt spójności** i **most do strony filmowej** (Story Engine).

Rurociąg docelowy: **Decyzja → Tekst → Wizualizacja (Film)**.

## Struktura
```
narrative-engine/
├─ orchestrator.js      Rezyser/CLI: status, ask, audit, bridge
├─ lib.js               ladowanie/zapis stanu
├─ question-engine.js   adaptacyjne pytania ze stanu (braki -> pytania)
├─ continuity-audit.js  audyt logistyki/czasu/ekwipunku (deterministyczny)
├─ bridge-to-film.js    rozdzial -> Production Pack -> opcjonalnie relay/strona
├─ state/              STAN SWIATA (JSON)
│  ├─ story-bible.json characters.json world.json
│  ├─ inventory_state.json location_data.json timeline_audit.json
│  └─ chapters/ch01.json
└─ output/             wygenerowane Production Packi
```

## Uzycie
```
node orchestrator.js status            # przeglad + kompletnosc + liczba problemow
node orchestrator.js ask 8             # nastepne 8 pytan rezyserskich
node orchestrator.js audit             # spojnosc: podroze, czas, ekwipunek
node orchestrator.js bridge ch01 --push  # rozdzial -> Production Pack (+ do zywej kolejki relaya)
```

## Co jest deterministyczne (dziala teraz, 0 kosztu)
Stan, kompletnosc, pytania ze stanu, audyt sprzecznosci, most do Production Pack.

## Co wymaga mozgu LLM (osobno, za Bramka 0)
Pisanie prozy rozdzialow i „kreatywne" pytania-rozwidlenia (warianty fabuly).
Patrz `creative.*` w question-engine.js — tam wpina sie LLM (Claude w sesji za darmo,
albo API z kill-switchem ALLOW_SPEND).

## Uczciwie
`bridge`/`SharedDesktop`/`handoff-current.json` z pierwotnego pomyslu NIE istnialy —
to flavor-text z piosenki ARBALEST i atrapy panelu. Ten podsystem to ich realna,
uziemiona wersja, zintegrowana z istniejacym film-engine.

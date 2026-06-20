# Claude Code check: Story Engine action/B-roll fix

Date: 2026-06-20

Patryk reported two remaining production-pack bugs:

1. B-ROLL was thematically detached from the story, e.g. GLITCH generated mirror/reflection action but prompt inserts like dripping faucet, cigarette ash, trigger.
2. Per-shot AKCJA could drift into random genre imagery, e.g. a neon train in a story about a girl and a living mirror reflection.

Implemented fix:

- `frontend/src/engine.js`
  - Added story-aware B-roll pools keyed by story/title/logline/subject/tone.
  - GLITCH/mirror/reflection stories now produce inserts about mirror, glass, screens, puddles, neon and digital glitch.
  - Removed dangerous generic fallback inserts like trigger, cigarette, faucet.

- `frontend/src/StoryEngine.jsx`
  - Added `ACTION_DIRECTOR_SYS`, `shotsForDirector`, and `actionDirectorUser`.
  - Auto mode and "OPISZ UJĘCIA (AI)" now send Gemini the real story context, beats, generated prose, and B-roll subject.
  - Prompt now forbids unrelated props, vehicles, weapons, locations, etc. unless they exist in the story.
  - "Ekranizuj tekst" batch prompt now requires action to come from the pasted text/logline.

Verification already run by Codex:

```powershell
cd C:\Users\anoni\Downloads\KapitanPlaneta\frontend
npm run build
```

Build passed.

Deterministic GLITCH B-roll smoke test:

```powershell
cd C:\Users\anoni\Downloads\KapitanPlaneta\frontend
node --input-type=module -e "import { buildProductionPack } from './src/engine.js'; const pk=buildProductionPack({title:'GLITCH',genre:'sci-fi',format:'short',subject:'dziewczyna odkrywa, że jej odbicie żyje własnym życiem',tone:'cyberpunk, neon',logline:'Odbicie w lustrze przejmuje kontrolę.',lengthSec:30,bpm:128,vocalLang:'EN',mood:'niepokojący, dynamiczny',instruments:'glitch, bass',audioType:'song',insertFace:true,photoCount:30,ratio:'9:16',res:'720p'}); console.log(pk.parts.flatMap(p=>p.shots).filter(s=>s.params.isBroll).map(s=>s.n+': '+s.params.brollSubject).join('\n'));"
```

Expected output should stay mirror/reflection themed, similar to:

```text
S3: kropla deszczu na szkle deformuje odbicie twarzy jak cyfrowy glitch
S6: pęknięta tafla lustra łapie neon i dzieli twarz bohatera na fragmenty
S9: kałuża na podłodze pokazuje odwróconą sylwetkę poruszającą się samodzielnie
S12: odbicie w czarnym ekranie terminala uśmiecha się o ułamek sekundy za późno
```

Manual check request:

- Open the deployed page.
- Use "Short / TikTok" + "Losuj całość za mnie".
- With Gemini key: confirm `AKCJA` lines stay about girl/reflection/mirror/glitch, not random cyberpunk trains or unrelated props.
- Without Gemini key: confirm B-roll prompt lines are still mirror/glass/screen themed.

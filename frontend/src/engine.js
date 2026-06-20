// ── SILNIK PRODUKCJI (mózg jako kod) ─────────────────────────────────────────
// Z odpowiedzi wywiadu buduje kompletny "Production Pack" wg METODA-SILNIKA.md.
// Wersja deterministyczna: zero API, zero kosztu. Twórczy fill (LLM) = osobny krok.

const POSES = [
  "front, neutralny wzrok",
  "3/4 w lewo",
  "3/4 w prawo",
  "profil",
  "z dołu (hero angle)",
  "lekko z góry, zamyślony",
];

// Generyczna mapa beatów rozkładana na ujęcia (z sekcją dropu/klimaksu).
const BEAT_CYCLE = [
  "intro", "verse", "verse", "pre-chorus",
  "CHORUS (drop)", "chorus", "post-chorus", "bridge",
  "build", "CLIMAX",
];

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function continuityLock(a) {
  const hero = a.insertFace
    ? `${a.faceName || "BOHATER"} (twarz z referencji: ${a.photoCount || 30} zdjęć)`
    : (a.subject || "bohater");
  const palette = a.tone?.toLowerCase().includes("noir") || a.genre === "sci-fi"
    ? "paleta: cyjan/krwista czerwień, low-key, neon"
    : "paleta: ciepłe złoto + kontrast, low-key";
  return `${hero} · ${palette} · obiektyw anamorficzny · ton: ${a.tone || "kinowy"}`;
}

function routingFor(a) {
  const r = [];
  if (a.audioType === "song") {
    r.push(["Tekst piosenki", "Claude/silnik pisze → Suno lub ElevenLabs Music (śpiew)"]);
  } else {
    r.push(["Narracja/dialogi", "ElevenLabs (tagi głosów)"]);
  }
  if (a.insertFace) r.push(["Wstawienie twarzy do sceny", "Gemini (kadr) → poprawki w Grok"]);
  r.push(["Kadry / Start-Frame / warianty ujęć", "Gemini (taniej niż Luma)"]);
  r.push(["Ruch / animacja kadru", "Luma (1 Start-Frame + komenda ruchu)"]);
  if (a.tools?.higgsfield) r.push(["Trudne ujęcia / lip-sync", "Higgsfield"]);
  r.push(["Montaż / cięcie do bitu / mux audio", "ffmpeg / media-tools (lokalnie)"]);
  return r;
}

function motionForBeat(beat) {
  if (/CLIMAX|drop/i.test(beat)) return "szybki push-in + rozbłysk, energia eksploduje";
  if (/chorus/i.test(beat)) return "płynny lot / orbita bohatera, hero angle";
  if (/verse/i.test(beat)) return "powolny dolly-in na twarz, napięcie";
  if (/bridge/i.test(beat)) return "statyczny z subtelnym oddechem kamery";
  return "delikatny ruch ustanawiający scenę";
}

function clip(s, n) { return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }

// ── ELEMENTY / POSTACIE (spójność — odpowiedź na „Elements" z LTX/Katalist) ───
export function buildElements(a) {
  const hero = a.insertFace ? (a.faceName || 'Bohater') : ((a.subject || 'Bohater').split(/[,.]/)[0].trim());
  const tone = a.tone || 'kinowy';
  return [
    {
      id: 'EL1', name: hero, type: a.insertFace ? 'postać (Twoja twarz)' : 'postać',
      refPL: `arkusz referencyjny postaci: ${hero}, ${a.insertFace ? 'twarz z Twoich selfie' : 'autorski design'}, neutralne światło, ujęcia front + 3/4 + profil, stały strój, ton ${tone}`,
      refEN: `character reference sheet: ${hero}, ${a.insertFace ? 'face from uploaded selfies' : 'original design'}, neutral lighting, front + 3/4 + profile, consistent outfit, ${tone} look`,
      lock: 'ta sama twarz/strój/seed we WSZYSTKICH ujęciach',
    },
    {
      id: 'EL2', name: 'Świat / lokacja', type: 'lokacja',
      refPL: `referencja lokacji: ${a.subject || 'główne miejsce akcji'}, paleta ${tone}, stała architektura i światło`,
      refEN: `location reference: ${a.subject || 'main setting'}, ${tone} palette, consistent architecture & lighting`,
      lock: 'ta sama paleta i światło między ujęciami',
    },
    {
      id: 'EL3', name: 'Obiekt kluczowy', type: 'rekwizyt / obiekt',
      refPL: 'referencja kluczowego obiektu: AUTORSKI design (bez marek/IP), stały kształt i kolory we wszystkich ujęciach',
      refEN: 'hero prop/object reference: original design (no IP), consistent shape & colors across all shots',
      lock: 'ten sam design, bez marek (unikamy bloku IP)',
    },
  ];
}

// ── PUŁAPKI / co może pójść nie tak (ogólne zasady filmu AI) ──────────────────
const PITFALLS = [
  'FABUŁA NAJPIERW: bez historii dostajesz ładne ujęcia bez sensu — to główny błąd filmów AI.',
  'Spójność postaci/świata między ujęciami: lock referencji + stały seed, inaczej twarz/mech „pływa”.',
  'Intencja ujęcia: każde ma nieść emocję lub informację, nie tylko „ładnie wyglądać”.',
  'Rytm montażu do muzyki (bity), nie losowe cięcia — patrz partytura.',
  'Mniej ruchu kamery i prostsze ujęcia = mniej artefaktów AI i większa spójność.',
  'Bloki IP/likeness: opisuj własny design, nie nazwy marek (Luma blokuje).',
  'Dźwięk to połowa wrażenia: spójny score/foley, audio zsync z obrazem.',
];

// ── STORY / FABUŁA — brief + struktura 3-aktowa (proza = Twórczy-fill AI) ─────
export function buildStory(a) {
  const hero = a.insertFace ? (a.faceName || 'bohater (twarz z referencji)') : (a.subject || 'bohater');
  const lengthSec = Math.max(15, Number(a.lengthSec) || 60);
  const theme = a.theme || a.tone || 'determinacja wobec przeciwności';
  const beats = [
    ['AKT I — Zawiązanie', `Poznajemy: ${hero}. Świat/sytuacja: ${a.subject || '(dodaj świat)'}. Ustal ton (${a.tone || 'kinowy'}) i stawkę.`],
    ['Punkt zwrotny 1', 'Wydarzenie wytrąca bohatera z równowagi — rusza akcja.'],
    ['AKT II — Konfrontacja', 'Bohater działa, napotyka opór/wroga, rośnie napięcie; mała porażka.'],
    ['Środek / olśnienie', 'Bohater odkrywa klucz (zwrot wiedzy/mocy) — zmiana strategii.'],
    ['Punkt zwrotny 2 / kryzys', 'Najciemniejsza chwila — wszystko na szali.'],
    ['AKT III — Kulminacja', 'Ostateczne starcie/decyzja zsynchronizowana z dropem muzyki.'],
    ['Rozwiązanie', 'Nowy stan rzeczy; emocjonalne domknięcie łuku bohatera.'],
  ];
  return {
    logline: a.logline || `(dopisz logline: ${hero} musi …, inaczej …)`,
    theme, hero,
    proseTarget: lengthSec <= 90 ? [1500, 3000] : [4000, 9000],
    beats,
    note: 'To BRIEF/struktura fabuły. Realne opowiadanie (proza) pisze krok Tworczy-fill (AI) na bazie tych beatów. Fabuła ORYGINALNA — nie kopiujemy cudzych utworów.',
  };
}

// ── moduł muzyczny: pola styles (<=999) + lyrics (~3-4k), PL i EN ─────────────
export function buildMusic(a) {
  const mode = a.audioType === 'score' ? 'score' : 'song';
  const bpm = Number(a.bpm) || 120;
  const lang = a.vocalLang || 'PL';
  const genre = a.genre || 'anime';
  const moodPL = a.mood || a.tone || 'epicki, emocjonalny';
  const instr = a.instruments || 'orkiestra + rock, syntezatory, taiko';
  const extra = (a.musicWish || a.musicStyle || '').trim();

  // STYLES (<=999) — opis brzmienia, bez tekstu
  const stylesEN = clip([
    `${genre} cinematic ${mode === 'score' ? 'score' : 'opening theme'}`,
    mode === 'song' ? `vocals in ${lang}` : 'fully instrumental, no vocals',
    `${bpm} BPM`,
    `mood: ${moodPL}`,
    `instruments: ${instr}`,
    'dynamic build into a big drop, beat-synced hits, anime-OP energy',
    'hi-fi production, wide stereo, cinematic mix',
    extra ? `extra: ${extra}` : '',
  ].filter(Boolean).join('; '), 999);

  const stylesPL = clip([
    `${genre} kinowy ${mode === 'score' ? 'score (ścieżka)' : 'motyw przewodni (OP)'}`,
    mode === 'song' ? `wokal po ${lang}` : 'w pełni instrumentalne, bez wokalu',
    `${bpm} BPM`,
    `nastrój: ${moodPL}`,
    `instrumenty: ${instr}`,
    'narastanie do mocnego dropu, uderzenia zsync z bitem, energia anime-OP',
    'produkcja hi-fi, szerokie stereo',
    extra ? `dodatkowo: ${extra}` : '',
  ].filter(Boolean).join('; '), 999);

  // LYRICS (~3-4k) — w score: cue dźwiękowe; w song: struktura + tagi + miejsca na tekst
  const sectionsSong = ['[Intro]', '[Verse 1]', '[Build-up]', '[Pre-Chorus]', '[Drop] [Chorus]', '[Verse 2]', '[Beat Switch] [Bridge]', '[Final Chorus] [Big Finish]', '[Outro] [Fade out]'];
  const vTagEN = lang.toLowerCase().includes('jp')
    ? ['[Deep Male Voice, Heavy Japanese Accent English, Staccato]', '[Powerful Female J-Pop Vocal, Pure Japanese]']
    : ['[Lead Vocal]', '[Chorus / harmonies]'];

  let lyricsEN, lyricsPL;
  if (mode === 'song') {
    lyricsEN = sectionsSong.map((s, i) =>
      `${s}\n${vTagEN[i % vTagEN.length]}\n<<< write lines here — theme: ${a.logline || a.subject || 'the story'} | beat ${i + 1} >>>`
    ).join('\n\n');
    lyricsPL = sectionsSong.map((s, i) =>
      `${s}\n${vTagEN[i % vTagEN.length]}\n<<< tu wpisz wersy — motyw: ${a.logline || a.subject || 'historia'} | sekcja ${i + 1} >>>`
    ).join('\n\n');
  } else {
    const cues = ['[0:00 Intro — atmosfera]', '[Build — narastanie]', '[Drop — kulminacja]', '[Breakdown — oddech]', '[Final — finał]', '[Outro — wyciszenie]'];
    lyricsEN = cues.map((c) => `${c}\n<<< sound-design cue / motif here >>>`).join('\n\n');
    lyricsPL = cues.map((c) => `${c}\n<<< opis brzmienia / motyw tutaj >>>`).join('\n\n');
  }

  return {
    mode, bpm,
    stylesEN, stylesPL,
    lyricsEN, lyricsPL,
    stylesLen: { en: stylesEN.length, pl: stylesPL.length, max: 999 },
    lyricsTarget: [3000, 4000],
    note: mode === 'song'
      ? 'Pole styles do Suno/Luma (≤999). Pole lyrics (~3–4k) — szkielet z tagami; realne wersy dopisze krok Tworczy-fill (AI). Wklej do Suno LUB bezposrednio do LumaLabs.'
      : 'Tryb score: brak wokalu. styles = brzmienie; lyrics = cue dzwiekowe per sekcja. Realne opisy dopisze Tworczy-fill (AI).',
  };
}

// ── WARIACJA UJĘĆ — nomenklatura jak w szkole filmowej (Long/Medium/Close...) ──
export const SHOT_SIZES = ['ELS — ekstremalnie szeroki (establishing)', 'LS — plan szeroki', 'plan amerykański', 'MS — plan średni', 'MCU — półzbliżenie', 'CU — zbliżenie', 'ECU — detal/insert', 'OTS — zza ramienia', 'two-shot — dwójka', 'aerial — z lotu ptaka'];
export const LENSES = ['18mm (ultraszeroki)', '24mm', '35mm', '50mm', '85mm', '135mm (tele)'];
export const LIGHTS = ['złota godzina', 'niebieska godzina', 'twarde światło + głębokie cienie', 'miękkie światło z okna', 'praktyczny neon', 'kontra (sylwetka)', 'pochmurne, płaskie', 'blask ognia', 'światło księżyca', 'ostre światło z góry (top light)'];
export const ANGLES = ['na wysokości oczu', 'żabia perspektywa (hero, z dołu)', 'z góry (high-angle)', 'holenderski przechył (dutch)', 'z lotu ptaka (overhead)', 'POV (oczami bohatera)'];
export const MOVES = ['powolny najazd (dolly-in)', 'odjazd (dolly-out)', 'panorama w lewo', 'panorama w prawo', 'orbita wokół', 'kran w górę (crane)', 'z ręki (handheld)', 'statyczne (locked-off)', 'push-in', 'jazda boczna (tracking)', 'zoom', 'whip pan'];
export const TIMES = ['świt', 'poranek', 'południe', 'zmierzch', 'noc', 'wnętrze (bez okien)'];

// ── WYMOGI REŻYSERA (manifest) — wzbogacenie promptów, bo "zabrali aktorów/sprzęt" ──
// Światło praktyczne (źródło wewnątrz kadru) — Luma to kocha.
export const PRACTICALS = ['oświetlone migającym neonem zza kadru', 'czerwone obrotowe światło alarmowe', 'poświata deski rozdzielczej na twarzy', 'wolumetryczne smugi światła przez dym (god rays)', 'blask ekranu/HUD na twarzy', 'naga żarówka kołysząca się u sufitu', 'światło świec', 'latarka oświetlająca twarz od dołu'];
// Tagi fizyki — ożywiają statyczny obraz (ruch tkaniny, kurz, iskry).
const PHYSICS = ['włosy na wietrze', 'symulacja tkaniny (powiewający płaszcz)', 'ciężkie cząsteczki kurzu w powietrzu', 'iskry i opadające żarzące się drobiny', 'para/dym snujący się nisko', 'krople deszczu na obiektywie', 'liście wirujące w podmuchu', 'unoszący się pył w smudze światła'];
// Mikroekspresje — reżyseria twarzy, żeby model nie wypluł manekina.
const EMOTIONS = ['subtelny uśmieszek, oczy strzelają w lewo', 'pot na czole, ciężki oddech', 'zaciśnięta szczęka, zimne spojrzenie', 'drżąca dolna warga, łza w oku', 'rozszerzone źrenice, wstrzymany oddech', 'lekko uniesiona brew, niedowierzanie', 'zmęczone, opadające powieki', 'iskra determinacji w oczach'];
// B-Roll / przebitki — co 3. ujęcie jako mikrodetal zamiast nudnego A-Roll.
const BROLL = [
  'detal powierzchni z miejsca akcji odbija kolor przewodni historii',
  'dłoń bohatera zatrzymuje się na kluczowym rekwizycie',
  'ślad ruchu bohatera zostaje w świetle i kurzu sceny',
  'mikrodetal lokacji zdradza napięcie nadchodzącego wydarzenia',
  'bliski detal światła, tekstury i rekwizytu ważnego dla sceny',
];
const STORY_BROLL = [
  {
    match: /lustr|odbic|reflection|mirror|glitch|szk[lł]o|ekran|screen|ka[lł]u[zż]|neon/i,
    items: [
      'pęknięta tafla lustra łapie neon i dzieli twarz bohatera na fragmenty',
      'odbicie w czarnym ekranie terminala uśmiecha się o ułamek sekundy za późno',
      'kropla deszczu na szkle deformuje odbicie twarzy jak cyfrowy glitch',
      'kałuża na podłodze pokazuje odwróconą sylwetkę poruszającą się samodzielnie',
      'palce dotykają zimnego szkła, a pod opuszkami przechodzi fala pikselowego szumu',
    ],
  },
  {
    match: /poci[aą]g|train|kolej|lokomotyw|wagon|tory/i,
    items: [
      'koło pociągu przetacza się przez mokry tor w blasku sygnału',
      'para i iskry uciekają spod lokomotywy przy niskim świetle',
      'odbicie świateł stacji drży na metalowej burcie wagonu',
      'dłoń bohatera zaciska bilet lub mały rekwizyt przy oknie wagonu',
    ],
  },
  {
    match: /mech|pilot|kokpit|hud|robot|lambda/i,
    items: [
      'HUD odbija się w wizjerze pilota, a czerwony alarm pulsuje po szkle',
      'palce zaciskają joystick, w tle migają kontrolki kokpitu',
      'hydrauliczny przewód drży od przeciążenia, spadają drobne iskry',
      'metalowy panel mecha odbija błysk eksplozji i ślad deszczu',
    ],
  },
  {
    match: /smok|dragon|skrzyd[lł]|zamek|amulet|mag/i,
    items: [
      'łuska smoka połyskuje w złotym świetle, gdy spada pojedyncza iskra',
      'amulet pulsuje ciepłym blaskiem w dłoni bohatera',
      'cień skrzydła przesuwa się po kamiennej ścianie',
      'kropla rosy na liściu odbija ognisty oddech smoka',
    ],
  },
  {
    match: /stacj|orbital|kosmos|wentylac|alien|technik/i,
    items: [
      'kratka wentylacyjna drży w czerwonym świetle alarmu',
      'skafander odbija zimne światło korytarza i błysk ostrzeżenia',
      'kropla kondensatu spływa po metalowej ścianie stacji',
      'cień przesuwa się za zaparowaną szybą modułu',
    ],
  },
];
// Negative prompt — wyrzuca deformacje i znaki wodne.
const NEGATIVE = 'zdeformowane dłonie, dodatkowe palce, zniekształcona twarz, martwe oczy, znak wodny, tekst, napisy, logo, rozmycie, zdublowane kończyny, artefakty AI, plastikowa skóra';
// Domyślny strój i rekwizyt per gatunek (Costume/Prop Lock — Luma nie zmieni ciuchów między ujęciami).
const COSTUME_DEF = { horror: 'znoszony płaszcz, przemoknięta koszula', 'sci-fi': 'techwear z neonowym kołnierzem', fantasy: 'skórzany pancerz i peleryna', dramat: 'prosty sweter, zmęczona elegancja', sitcom: 'codzienny kardigan', skecz: 'jaskrawy, przerysowany strój', anime: 'mundur pilota z czerwonymi akcentami', 'bajka dla dzieci': 'kolorowy płaszczyk' };
const PROP_DEF = { horror: 'stara latarka', 'sci-fi': 'świecący datapad', fantasy: 'tlący się amulet', dramat: 'wytarty zegarek po ojcu', sitcom: 'wielki kubek kawy', skecz: 'absurdalnie mały przedmiot', anime: 'znacząca odznaka pilota', 'bajka dla dzieci': 'pluszowy towarzysz' };

// Struktura beatów: pełny film vs short (hook-first, retencja).
const SHORT_BEATS = ['HOOK (0-2s)', 'setup', 'twist', 'build', 'PAYOFF', 'button / CTA'];
const FORMATS = {
  short: { ratio: '9:16', defShots: 12, label: 'SHORT (pionowo 9:16)', note: 'SHORT: hook w 1. ujeciu, krotkie ciecia, payoff na koncu, CTA.' },
  film: { ratio: '16:9', defShots: null, label: 'FILM (16:9)', note: 'FILM: pelna struktura aktow.' },
  square: { ratio: '1:1', defShots: null, label: 'KWADRAT (1:1)', note: 'KWADRAT: feed social.' },
};

// Buduje prompt KADRU z parametrow kamery — uzywane tez przy edycji ujec w UI.
export function shotFrame(p, ctx) {
  const compose = ctx.composeNote ? `; ${ctx.composeNote}` : '';
  const prac = p.practical ? `, ${p.practical}` : '';
  const phys = p.physics ? `; [Physics: ${p.physics}]` : '';
  const emo = p.emotion ? `; (twarz: ${p.emotion})` : '';
  const cos = ctx.costume ? ` [Costume Lock: ${ctx.costume}]` : '';
  const prop = ctx.prop ? ` [Prop Lock: ${ctx.prop}]` : '';
  const neg = ctx.negative ? `\nNEGATIVE: ${ctx.negative}` : '';
  if (p.isBroll) {
    return `ECU INSERT / B-ROLL: ${p.brollSubject}; ${p.angle}, obiektyw ${p.lens}, ${p.light}${prac}, ${p.time}; macro, hyper-real${phys}${compose}${cos}${prop}; [spojnosc: ${ctx.lock}]${neg}`;
  }
  return `${p.size} — ${ctx.who}, ${p.angle}, obiektyw ${p.lens}, ${p.light}${prac}, ${p.time}; ${ctx.subject || 'scena'}; ${ctx.ratio} ${ctx.res}, cinematic, hyper-real${phys}${emo}${compose}${cos}${prop}; [spojnosc: ${ctx.lock}]${neg}`;
}

// Język kamery dobierany do GATUNKU (jak uczą w szkole filmowej).
const GENRE_CAM = {
  horror: { lights: ['twarde światło + głębokie cienie', 'światło księżyca', 'kontra (sylwetka)', 'blask ognia'], lenses: ['18mm (ultraszeroki)', '24mm', '35mm'], angles: ['holenderski przechył (dutch)', 'z góry (high-angle)', 'żabia perspektywa (hero, z dołu)', 'POV (oczami bohatera)'], moves: ['z ręki (handheld)', 'powolny najazd (dolly-in)', 'statyczne (locked-off)', 'push-in'] },
  sitcom: { lights: ['miękkie światło z okna', 'pochmurne, płaskie', 'złota godzina'], lenses: ['35mm', '50mm'], angles: ['na wysokości oczu'], moves: ['statyczne (locked-off)', 'panorama w lewo', 'panorama w prawo'], sizes: ['MS — plan średni', 'plan amerykański', 'two-shot — dwójka', 'MCU — półzbliżenie'] },
  skecz: { lights: ['miękkie światło z okna', 'pochmurne, płaskie'], lenses: ['35mm', '50mm'], angles: ['na wysokości oczu'], moves: ['statyczne (locked-off)', 'panorama w prawo', 'zoom'], sizes: ['MS — plan średni', 'plan amerykański', 'two-shot — dwójka'] },
  dramat: { lights: ['miękkie światło z okna', 'złota godzina', 'niebieska godzina'], lenses: ['50mm', '85mm', '135mm (tele)'], angles: ['na wysokości oczu'], moves: ['powolny najazd (dolly-in)', 'statyczne (locked-off)', 'jazda boczna (tracking)'], sizes: ['MCU — półzbliżenie', 'CU — zbliżenie', 'MS — plan średni', 'OTS — zza ramienia'] },
  'sci-fi': { lights: ['praktyczny neon', 'niebieska godzina', 'ostre światło z góry (top light)', 'kontra (sylwetka)'], lenses: ['18mm (ultraszeroki)', '24mm', '35mm'], angles: ['żabia perspektywa (hero, z dołu)', 'z lotu ptaka (overhead)', 'holenderski przechył (dutch)'], moves: ['kran w górę (crane)', 'orbita wokół', 'jazda boczna (tracking)', 'push-in'] },
  fantasy: { lights: ['złota godzina', 'blask ognia', 'światło księżyca', 'niebieska godzina'], lenses: ['18mm (ultraszeroki)', '24mm', '35mm', '85mm'], angles: ['żabia perspektywa (hero, z dołu)', 'z lotu ptaka (overhead)'], moves: ['kran w górę (crane)', 'orbita wokół', 'powolny najazd (dolly-in)'], sizes: ['ELS — ekstremalnie szeroki (establishing)', 'LS — plan szeroki', 'aerial — z lotu ptaka', 'MS — plan średni'] },
  anime: { lights: ['złota godzina', 'praktyczny neon', 'kontra (sylwetka)', 'ostre światło z góry (top light)'], lenses: ['24mm', '35mm', '85mm'], angles: ['żabia perspektywa (hero, z dołu)', 'holenderski przechył (dutch)', 'POV (oczami bohatera)'], moves: ['whip pan', 'push-in', 'jazda boczna (tracking)', 'kran w górę (crane)'] },
  'bajka dla dzieci': { lights: ['złota godzina', 'miękkie światło z okna', 'pochmurne, płaskie'], lenses: ['35mm', '50mm'], angles: ['na wysokości oczu'], moves: ['panorama w prawo', 'powolny najazd (dolly-in)', 'statyczne (locked-off)'], sizes: ['MS — plan średni', 'plan amerykański', 'LS — plan szeroki', 'MCU — półzbliżenie'] },
};
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

function brollPoolFor(a) {
  const storyText = [a.title, a.subject, a.logline, a.tone, a.genre, a.prop, a.musicWish].filter(Boolean).join(' ');
  const hit = STORY_BROLL.find(rule => rule.match.test(storyText));
  if (hit) return hit.items;
  const prop = (a.prop || PROP_DEF[a.genre] || 'kluczowy rekwizyt').trim();
  const subject = (a.subject || a.logline || 'świat historii').trim();
  return [
    `detal rekwizytu: ${prop}, pokazany w świetle sceny`,
    `ślad akcji z historii: ${subject}, ujęty jako krótki insert`,
    `tekstura miejsca z fabuły: kurz, światło i ruch powietrza wokół bohatera`,
    `dłoń bohatera dotyka elementu ważnego dla historii: ${prop}`,
    pick(BROLL, storyText.length || 1),
  ];
}

// ── TŁUMACZ "PO LUDZKU" — żargon szkoły filmowej → zwykły język (audyt UX) ─────
// Klucze sprawdzane od najdłuższych, żeby ECU/MCU nie złapało CU itd.
const EXPLAIN = {
  size: [['ELS', 'bardzo szeroki — widać całe otoczenie'], ['ECU', 'detal: oczy/dłoń/przedmiot'], ['MCU', 'od piersi — widać emocje'], ['MS', 'od pasa — widać gesty'], ['OTS', 'zza ramienia — buduje dialog'], ['LS', 'szeroki — cała postać i tło'], ['CU', 'twarz z bliska — mocne emocje'], ['plan amerykański', 'od kolan w górę'], ['two-shot', 'dwie postacie w kadrze'], ['aerial', 'z lotu ptaka — pokazuje skalę']],
  lens: [['18mm', 'ultraszeroki, przerysowanie, dużo tła'], ['24mm', 'szeroki, czuć dynamikę'], ['35mm', 'lekko szeroki, reporterski'], ['50mm', 'jak ludzkie oko, naturalny'], ['85mm', 'izoluje twarz, rozmywa tło — portret'], ['135mm', 'mocno izoluje, kompresja — emocje']],
  angle: [['na wysokości oczu', 'neutralny, spokojny'], ['żabia', 'z dołu — bohater wygląda potężnie'], ['z góry', 'z góry — bohater słaby/mały'], ['holenderski', 'kamera krzywo — niepokój i chaos'], ['z lotu ptaka', 'z góry — pokazuje układ sceny'], ['POV', 'oczami bohatera']],
  move: [['dolly-in', 'powolny najazd na twarz (napięcie)'], ['dolly-out', 'odjazd — odsłania kontekst'], ['whip pan', 'błyskawiczny obrót z rozmyciem (przejście)'], ['panorama', 'obrót kamery w bok'], ['orbita', 'okrąża bohatera — epicko'], ['crane', 'kran w górę — rozmach'], ['handheld', 'z ręki — surowo, realistycznie'], ['statyczne', 'nieruchoma — spokój'], ['push-in', 'wjazd w twarz — kulminacja'], ['tracking', 'jedzie obok w ruchu'], ['zoom', 'przybliżenie soczewką']],
  light: [['złota godzina', 'ciepłe, miękkie — romantyczne'], ['niebieska godzina', 'chłodny zmierzch'], ['twarde', 'ostre cienie — groza/dramat'], ['miękkie', 'delikatne, pochlebne dla twarzy'], ['neon', 'kolorowe miasto nocą'], ['kontra', 'sylwetka pod światło'], ['płaskie', 'równe, bez cieni — komedia/TV'], ['ognia', 'migotliwe, ciepłe'], ['księżyca', 'zimne, nocne'], ['top light', 'z góry — dramatyczne']],
};
function findExplain(pairs, val) { const hit = pairs.find(([k]) => (val || '').includes(k)); return hit ? hit[1] : ''; }
export function explainShot(p) {
  return [findExplain(EXPLAIN.size, p.size), findExplain(EXPLAIN.lens, p.lens), findExplain(EXPLAIN.angle, p.angle), findExplain(EXPLAIN.move, p.move), findExplain(EXPLAIN.light, p.light)].filter(Boolean).join(' · ');
}

function varyShot(i, beat, a) {
  const isClimax = /CLIMAX|drop|PAYOFF/i.test(beat);
  const isEstab = /HOOK|chorus|establish/i.test(beat);
  const sitcomy = a.genre === 'sitcom' || a.genre === 'skecz' || a.genre === 'bajka dla dzieci';
  const g = GENRE_CAM[a.genre] || {};
  const sizes = g.sizes || SHOT_SIZES, lenses = g.lenses || LENSES, lights = g.lights || LIGHTS, angles = g.angles || ANGLES, moves = g.moves || MOVES;
  const isBroll = (i % 3 === 2) && !sitcomy; // co 3. ujęcie = przebitka (poza sitcomem/multicam)
  const size = isBroll ? 'ECU — detal/insert'
    : isClimax ? (i % 2 ? 'CU — zbliżenie' : 'ECU — detal/insert')
      : isEstab ? (i % 2 ? 'ELS — ekstremalnie szeroki (establishing)' : 'LS — plan szeroki')
        : pick(sizes, i);
  const isFace = !isBroll && /CU|MCU|MS|OTS|zbliż|półzbliż|średni/i.test(size);
  const move = isBroll ? 'macro push-in / rack focus'
    : isClimax ? (moves.indexOf('push-in') >= 0 ? 'push-in' : pick(moves, i))
      : pick(moves, i * 4 + 2);
  return {
    size,
    lens: pick(lenses, i * 2 + (isClimax ? 1 : 0)),
    light: pick(lights, i * 3),
    angle: (isClimax && !sitcomy) ? 'żabia perspektywa (hero, z dołu)' : pick(angles, i * 2 + 1),
    move,
    time: pick(TIMES, i + (/noc|noir|mrok/i.test(a.tone || '') ? 4 : 0)),
    practical: pick(PRACTICALS, i * 5 + 1),
    physics: /statyczne/.test(move) ? '' : pick(PHYSICS, i * 3 + 2),
    emotion: isFace ? pick(EMOTIONS, i * 2) : '',
    speedRamp: isClimax,
    isBroll,
    brollSubject: isBroll ? pick(brollPoolFor(a), i) : '',
  };
}

export function buildProductionPack(a) {
  const fmt = FORMATS[a.format] || FORMATS.film;
  const beatCycle = a.format === 'short' ? SHORT_BEATS : BEAT_CYCLE;
  const lengthSec = Math.max(15, Number(a.lengthSec) || 60);
  const bpm = Number(a.bpm) || 120;
  const avgShot = 6; // ~6 s/ujęcie
  const shotCountOverride = Number(a.shotCount) > 0 ? Math.min(400, Math.round(Number(a.shotCount))) : null;
  const shotsTotal = shotCountOverride || fmt.defShots || Math.max(4, Math.round(lengthSec / avgShot));
  const perPart = 10;
  const partCount = Math.max(1, Math.ceil(shotsTotal / perPart));
  const lock = continuityLock(a);
  const ratio = a.ratio || fmt.ratio;
  const res = a.res || "720p";
  const who = a.insertFace ? (a.faceName || "bohater") : (a.subject || "scena");
  const composeNote = ratio === '9:16' ? 'akcja na SRODKU kadru (pion, boki przyciete)'
    : ratio === '1:1' ? 'kompozycja centralna (kwadrat)' : 'kompozycja panoramiczna (16:9)';
  const costume = (a.costume || '').trim() || COSTUME_DEF[a.genre] || 'spójny strój bohatera';
  const prop = (a.prop || '').trim() || PROP_DEF[a.genre] || 'kluczowy rekwizyt';
  const ctx = { lock, subject: a.subject || "scena", ratio, res, who, composeNote, costume, prop, negative: NEGATIVE };

  // ── partytura ujęć ──
  const parts = [];
  let shotIdx = 0;
  let t = 0;
  // zmienna długość cięć: akcja/klimaks = krótkie, wstęp/bridge/outro = długie
  const beatWeight = (b) => /CLIMAX|drop|PAYOFF|twist/i.test(b) ? 0.55 : /intro|establish|HOOK|bridge|breakdown|outro|setup|post/i.test(b) ? 1.7 : 1.0;
  const durs = [];
  { const ws = []; let wsum = 0;
    for (let k = 0; k < shotsTotal; k++) { const w = beatWeight(beatCycle[k % beatCycle.length]); ws.push(w); wsum += w; }
    for (let k = 0; k < shotsTotal; k++) durs.push((ws[k] / wsum) * lengthSec);
  }
  for (let p = 0; p < partCount; p++) {
    const shots = [];
    const partStart = t;
    for (let i = 0; i < perPart && shotIdx < shotsTotal; i++, shotIdx++) {
      const beat = beatCycle[shotIdx % beatCycle.length];
      const start = t;
      const end = Math.min(lengthSec, t + durs[shotIdx]);
      t = end;
      const v = varyShot(shotIdx, beat, a);
      const place = a.insertFace ? (shotIdx % 4 === 0 ? "INT" : "EXT") : "";
      const label = v.isBroll ? `B-ROLL · ${v.brollSubject}` : `${v.size}${place ? " · " + place : ""} — ${who} — ${beat}`;
      shots.push({
        n: `S${shotIdx + 1}`,
        time: `${fmtTime(start)}–${fmtTime(end)}`,
        cut: `${(end - start).toFixed(1)}s`,
        shot: label,
        beat: v.isBroll ? 'B-ROLL' : beat,
        params: v,
        framing: v.isBroll ? `B-ROLL · ${v.lens} · ${v.light}` : `${v.size} · ${v.lens} · ${v.angle} · ${v.light} · ${v.time}`,
        geminiFrame: shotFrame(v, ctx),
        lumaMotion: `${v.move}${v.speedRamp ? ', SLOW-MO → speed ramp w fast action (120fps feel)' : ''}${v.physics ? ' · ' + v.physics : ''}`,
      });
    }
    parts.push({
      title: `CZĘŚĆ ${p + 1}${partCount > 1 ? ` / ${partCount}` : ""}`,
      header: `Window ${fmtTime(partStart)}–${fmtTime(t)} · ${bpm} BPM · ${ratio} · ${res} · Continuity-lock: ${lock}${a.climaxSync ? ` · Hit: klimaks zsync z dropem` : ""}`,
      shots,
    });
  }

  // ── lista zadań (asset-prep + routing) ──
  const tasks = [];
  if (a.insertFace) {
    tasks.push(`Zrób ${a.photoCount || 30} zdjęć ${a.faceName || "siebie"} wg póz: ${POSES.join("; ")}.`);
    tasks.push(`Wybierz 5–6 najostrzejszych do osobnego folderu „refy".`);
    tasks.push(`W Gemini wstaw twarz do sceny — użyj promptu KADRU z każdego ujęcia (kolumna Gemini-frame). Rób 2–3 warianty/ujęcie.`);
    tasks.push(`Poprawki/restyle kadrów (spójność światła) → Grok.`);
  } else {
    tasks.push(`Wygeneruj kadry bazowe bohatera/lokacji w Gemini (2–3 warianty), trzymając continuity-lock.`);
  }
  tasks.push(`Każdy zatwierdzony kadr → Luma: wrzuć jako Start-Frame + wklej krótką KOMENDĘ RUCHU (kolumna Luma-motion). NIE pisz promptu od zera — to pali kredyty.`);
  if (a.audioType === "song") {
    tasks.push(`Tekst piosenki (sekcja SONG SPEC) → Suno/ElevenLabs. BPM ${bpm}, wokal: ${a.vocalLang || "PL"}, styl: ${a.musicStyle || "anime/orkiestra"}.`);
  } else {
    tasks.push(`Narrację/dialogi → ElevenLabs z tagami głosów (sekcja SONG SPEC).`);
  }
  tasks.push(`Montaż: ułóż ujęcia wg partytury, tnij do bitu (${bpm} BPM = ${(60 / bpm).toFixed(2)}s/uderzenie), podłóż audio, eksport ${ratio} ${res}.`);

  // ── song spec (szkielet z tagami) ──
  const songSpec = a.audioType === "song"
    ? {
        bpm,
        structure: ["[Intro]", "[Verse 1]", "[Pre-Chorus]", "[Chorus]", "[Verse 2]", "[Bridge]", "[Final Chorus]", "[Outro]"],
        voiceTags: a.vocalLang && a.vocalLang.toLowerCase().includes("jp")
          ? ["[Deep Male Voice, Heavy Japanese Accent English]", "[Powerful Female J-Pop Vocal, Pure Japanese]"]
          : ["[Lead Vocal]", "[Chorus / harmonie]"],
        note: "Tekst pisze krok Tworczy-fill (AI) — tu jest tylko struktura + tagi glosow do wklejenia w Suno/ElevenLabs.",
      }
    : {
        bpm,
        structure: ["[Narrator]", "[Dialog A]", "[Dialog B]"],
        voiceTags: ["[Voice 1]", "[Voice 2]"],
        note: "Tresc dialogow dopisze krok Tworczy-fill (AI).",
      };

  return {
    meta: {
      title: a.title || "BEZ TYTUŁU",
      genre: a.genre || "—",
      logline: a.logline || "(dodaj logline)",
      lengthSec, bpm, ratio, res,
      shotsTotal, partCount,
      lock,
    },
    songSpec,
    story: buildStory(a),
    elements: buildElements(a),
    music: buildMusic(a),
    parts,
    ctx,
    format: fmt,
    tasks,
    routing: routingFor(a),
    economy: [
      "LEKCJA Z REALU (ARBALEST): pełny auto-pipeline Luma Agent (Veo 3 + Ray 3.2 na wszystkim) spalił ~11 955 kredytów. NIE pozwól agentowi Lumy generować wszystkiego od zera.",
      "Gemini / Nano-Banana robi kadry (tanio), Luma/Ray TYLKO animuje 1 Start-Frame + komenda ruchu (×3–4 oszczędności).",
      "Warianty ujęć generuj w Gemini, nie w Lumie. Veo 3 trzymaj na 1–2 hero-ujęcia, nie na całość.",
      "Trzymaj seed/postać stałe między ujęciami (continuity-lock) — mniej poprawek = mniej kredytów.",
      "Uwaga na bloki IP: znane marki/mechy (np. z FMP) Luma blokuje (likeness detected) — opisuj wlasny design, nie nazwe.",
    ],
    pitfalls: a.format === 'short'
      ? PITFALLS.concat(['SHORT 9:16: trzymaj kluczowa akcje na SRODKU kadru — telefon przycina boki; unikaj akcji na brzegu szerokich planow.'])
      : PITFALLS,
  };
}

// Eksport pakietu do czytelnego Markdown (do skopiowania / pliku).
export function packToMarkdown(pk) {
  const L = [];
  L.push(`# PRODUCTION PACK — ${pk.meta.title}`);
  L.push(`Gatunek: ${pk.meta.genre} · Długość: ${pk.meta.lengthSec}s · ${pk.meta.bpm} BPM · ${pk.meta.ratio} ${pk.meta.res}`);
  L.push(`Logline: ${pk.meta.logline}`);
  L.push(`Continuity-lock: ${pk.meta.lock}`);
  L.push(``);
  const st = pk.story;
  L.push(`## 0. FABUŁA (brief — prozę pisze Twórczy-fill AI)`);
  L.push(`Logline: ${st.logline}`);
  L.push(`Motyw: ${st.theme} · Bohater: ${st.hero} · Cel długości prozy: ${st.proseTarget[0]}–${st.proseTarget[1]} znaków`);
  st.beats.forEach(([b, d]) => L.push(`- **${b}** — ${d}`));
  L.push(`> ${st.note}`);
  L.push(``);
  L.push(`## 0b. ELEMENTY / POSTACIE (spójność — zrób 1 arkusz refów na element, używaj w każdym ujęciu)`);
  (pk.elements || []).forEach((e) => {
    L.push(`- **${e.id} · ${e.name}** (${e.type}) — lock: ${e.lock}`);
    L.push(`  - ref [EN]: ${e.refEN}`);
  });
  L.push(``);
  const m = pk.music;
  L.push(`## 1. MUZYKA — ${m.mode === 'score' ? 'ścieżka (instrumental)' : 'piosenka'} (${m.bpm} BPM)`);
  L.push(`### styles (${m.stylesLen.en}/999) [EN — do wklejenia]`);
  L.push('```');
  L.push(m.stylesEN);
  L.push('```');
  L.push(`### lyrics (cel ${m.lyricsTarget[0]}–${m.lyricsTarget[1]} znaków) [EN]`);
  L.push('```');
  L.push(m.lyricsEN);
  L.push('```');
  L.push(`> ${m.note}`);
  L.push(``);
  L.push(`## 2. PARTYTURA UJĘĆ (${pk.meta.shotsTotal} ujęć / ${pk.meta.partCount} część(i))`);
  pk.parts.forEach((part) => {
    L.push(``);
    L.push(`### ${part.title}`);
    L.push(`_${part.header}_`);
    L.push(`| # | Czas | Cut | Ujęcie | Beat | Gemini-frame (prompt) | Luma-motion |`);
    L.push(`|---|------|-----|--------|------|-----------------------|-------------|`);
    part.shots.forEach((s) => {
      L.push(`| ${s.n} | ${s.time} | ${s.cut} | ${s.shot} | ${s.beat} | ${s.geminiFrame} | ${s.lumaMotion} |`);
    });
  });
  L.push(``);
  L.push(`## 3. LISTA ZADAŃ (krok po kroku)`);
  pk.tasks.forEach((t, i) => L.push(`${i + 1}. ${t}`));
  L.push(``);
  L.push(`## 4. ROUTING — co do jakiego generatora`);
  pk.routing.forEach(([what, where]) => L.push(`- **${what}** → ${where}`));
  L.push(``);
  L.push(`## 5. EKONOMIA (oszczędzanie tokenów)`);
  pk.economy.forEach((e) => L.push(`- ${e}`));
  L.push(``);
  L.push(`## 6. PUŁAPKI — co może pójść nie tak`);
  (pk.pitfalls || []).forEach((p) => L.push(`- ${p}`));
  return L.join("\n");
}

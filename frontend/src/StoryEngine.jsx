import React, { useState } from 'react';
import { buildProductionPack, packToMarkdown, shotFrame, explainShot, SHOT_SIZES, LENSES, LIGHTS, ANGLES, MOVES, TIMES } from './engine.js';
import { askGemini } from './gemini.js';

const ACCENT = '#28E07B';
const MONO = "'IBM Plex Mono', monospace";

const box = { border: '1px solid rgba(255,255,255,0.12)', background: '#050505', padding: '14px' };
const label = { fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };
const input = { width: '100%', boxSizing: 'border-box', background: '#000', border: '1px solid rgba(255,255,255,0.2)', color: '#ECECEC', fontFamily: MONO, fontSize: '13px', padding: '9px 11px' };
const btn = (on) => ({ border: `1px solid ${on ? ACCENT : 'rgba(255,255,255,0.2)'}`, background: on ? ACCENT : 'transparent', color: on ? '#000' : '#ECECEC', fontFamily: MONO, fontSize: '12px', letterSpacing: '0.12em', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase' });

const GENRES = ['anime', 'sci-fi', 'fantasy', 'sitcom', 'skecz', 'dramat', 'horror', 'bajka dla dzieci'];

const STEPS = ['Wizja', 'Bohater', 'Dźwięk', 'Pipeline', 'Pakiet'];

// Ruch/akcja postaci w ujęciu (prowadzenie fabuły).
const ACTIONS = ['X — nie dotyczy (scena bez postaci)', 'stoi nieruchomo', 'idzie w lewo', 'idzie w prawo', 'idzie w stronę kamery', 'odchodzi od kamery', 'chodzi nerwowo w kółko', 'biegnie', 'odwraca się gwałtownie', 'siada', 'wstaje', 'wchodzi do kadru', 'wychodzi z kadru', 'upada', 'rozgląda się', 'sięga po przedmiot', 'mówi do kogoś'];

// Gotowe przejścia przez całość — "losuj całość za mnie".
const PRESETS = [
  { _name: '🤖 Mech anime', title: 'OSTATNI PILOT', genre: 'anime', format: 'film', subject: 'samotny pilot mecha broni miasta w deszczu', tone: 'Full Metal Panic, noir, neon', logline: 'Pilot musi aktywować zakazaną moc, by ocalić miasto.', lengthSec: 90, bpm: 150, vocalLang: 'JP', mood: 'epicki, podniosły', instruments: 'orkiestra + rock, taiko', audioType: 'song' },
  { _name: '🌃 Cyberpunk noir', title: 'NEON NOIR', genre: 'sci-fi', format: 'film', subject: 'detektyw ściga androida w deszczowym mieście przyszłości', tone: 'Blade Runner, noir', logline: 'Detektyw odkrywa, że ścigany android to klucz do jego przeszłości.', lengthSec: 90, bpm: 90, vocalLang: 'EN', mood: 'mroczny, melancholijny', instruments: 'syntezatory, saksofon', audioType: 'song' },
  { _name: '🐉 Bajka o smoku', title: 'MAŁY SMOK', genre: 'bajka dla dzieci', format: 'film', subject: 'nieśmiały mały smok uczy się latać', tone: 'ciepły, baśniowy, złota godzina', logline: 'Mały smok pokonuje strach i ratuje przyjaciela.', lengthSec: 60, bpm: 100, vocalLang: 'PL', mood: 'ciepły, radosny', instruments: 'orkiestra, dzwoneczki', audioType: 'song' },
  { _name: '👽 Sci-fi horror', title: 'STACJA K-7', genre: 'horror', format: 'film', subject: 'technik sam na stacji orbitalnej słyszy coś w wentylacji', tone: 'Alien, klaustrofobiczny, mrok', logline: 'Technik odkrywa, że nie jest sam na stacji.', lengthSec: 90, bpm: 70, vocalLang: 'EN', mood: 'napięty, groźny', instruments: 'drony, dźwięki przemysłowe', audioType: 'score' },
  { _name: '📱 Short / TikTok', title: 'GLITCH', genre: 'sci-fi', format: 'short', subject: 'dziewczyna odkrywa, że jej odbicie żyje własnym życiem', tone: 'cyberpunk, neon', logline: 'Odbicie w lustrze przejmuje kontrolę.', lengthSec: 30, bpm: 128, vocalLang: 'EN', mood: 'niepokojący, dynamiczny', instruments: 'glitch, bass', audioType: 'song' },
];

// Składa jeden wielki gotowiec do skopiowania (wklejasz wprost do LumaLabs).
function buildMega(pk, story, lyrics, shots) {
  const L = [];
  L.push(`# ${pk.meta.title} — PEŁNY PAKIET PRODUKCYJNY (auto)`);
  L.push(`${pk.meta.genre} · ${pk.meta.lengthSec}s · ${pk.meta.ratio} · ${pk.meta.bpm} BPM · ${shots.length} ujęć`);
  L.push(`Logline: ${pk.story.logline}`);
  L.push(`Continuity-lock: ${pk.meta.lock}`);
  L.push('');
  if (story) { L.push('## 1. FABUŁA'); L.push(story); L.push(''); }
  L.push('## 2. MUZYKA');
  L.push('styles (≤999, do Suno/Luma):'); L.push(pk.music.stylesEN);
  if (lyrics) { L.push(''); L.push('lyrics:'); L.push(lyrics); }
  L.push('');
  L.push('## 3. UJĘCIA (prompty do Gemini/Luma)');
  shots.forEach((s) => {
    L.push(`### ${s.n} · [${s.beat}] · ${s.cut}`);
    if (s.aiDesc) L.push(`AKCJA: ${s.aiDesc}`);
    L.push(`PROMPT: ${shotFrame(s.params, pk.ctx)}`);
    L.push(`RUCH (Luma): ${s.lumaMotion}`);
    L.push('');
  });
  L.push('## 4. LISTA ZADAŃ');
  pk.tasks.forEach((t) => L.push(`- ${t}`));
  L.push('');
  L.push('## 5. ROUTING');
  pk.routing.forEach(([w, where]) => L.push(`- ${w} → ${where}`));
  return L.join('\n');
}

function Field({ children }) {
  return <div style={{ marginBottom: '14px' }}>{children}</div>;
}

export default function StoryEngine() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState({
    title: '', genre: 'anime', format: 'film', subject: '', lengthSec: 60, tone: '', logline: '',
    insertFace: true, faceName: '', photoCount: 30, costume: '', prop: '',
    audioType: 'song', bpm: 120, vocalLang: 'PL', musicStyle: '', mood: '', instruments: '', musicWish: '',
    ratio: '16:9', res: '720p', climaxSync: true, shotCount: '', tools: { higgsfield: false },
  });
  const [pack, setPack] = useState(null);
  const [copied, setCopied] = useState(false);
  const [musicLang, setMusicLang] = useState('pl');
  const [refine, setRefine] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const [editShots, setEditShots] = useState([]);
  const [geminiKey, setGeminiKey] = useState(() => { try { return localStorage.getItem('gemini_key') || ''; } catch (e) { return ''; } });
  const [storyProse, setStoryProse] = useState('');
  const [lyricsAI, setLyricsAI] = useState('');
  const [aiBusy, setAiBusy] = useState('');
  const [aiError, setAiError] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [autoOutput, setAutoOutput] = useState('');
  const [autoBusy, setAutoBusy] = useState('');
  const [showKeyHelp, setShowKeyHelp] = useState(false);

  // ── EKRANIZUJ TEKST — import opowiadania ────────────────────────────────────
  const [screenplay, setScreenplay] = useState('');       // wklejony tekst
  const [sceneCount, setSceneCount] = useState(0);        // N ustalone przez Gemini
  const [sceneBatch, setSceneBatch] = useState(5);        // ile scen na jedno kliknięcie
  const [scenesDone, setScenesDone] = useState(0);        // ile już wygenerowano
  const [scenePack, setScenePack] = useState([]);          // zebrane sceny (prompty)
  const [sceneAnalysis, setSceneAnalysis] = useState(null); // meta z analizy
  const [sceneBusy, setSceneBusy] = useState(false);
  const [sceneError, setSceneError] = useState('');
  const [showScreenplay, setShowScreenplay] = useState(false);

  // Przewodnik "jak zdobyć klucz" — dla osoby zupełnie nietechnicznej (tata/telefon).
  const keyHelp = () => (
    <div style={{ marginTop: '8px' }}>
      <button onClick={() => setShowKeyHelp(v => !v)} style={{ ...btn(false), padding: '6px 12px', fontSize: '11px', textTransform: 'none', letterSpacing: 'normal' }}>
        ❓ {showKeyHelp ? 'Ukryj instrukcję' : 'Jak zdobyć klucz — krok po kroku'}
      </button>
      {showKeyHelp && (
        <div style={{ border: '1px solid rgba(255,255,255,0.18)', background: '#050505', padding: '12px', marginTop: '8px', fontSize: '12.5px', color: '#ECECEC', lineHeight: 1.6 }}>
          <div style={{ color: ACCENT, marginBottom: '6px' }}>Darmowy klucz w 2 minuty (nie trzeba karty):</div>
          <div style={{ marginBottom: '6px' }}><b>1.</b> Kliknij ten przycisk — otworzy się strona Google:</div>
          <button onClick={() => window.open('https://aistudio.google.com/apikey', '_blank', 'noopener')} style={{ ...btn(true), marginBottom: '8px' }}>🔗 OTWÓRZ stronę z kluczem</button>
          <div><b>2.</b> Zaloguj się swoim <b>Gmailem</b> (to samo konto co poczta / YouTube). Jeśli już jesteś zalogowany — nic nie rób.</div>
          <div><b>3.</b> Kliknij niebieski przycisk <b>„Create API key"</b> (po polsku „Utwórz klucz API"). Jak zapyta o projekt — kliknij dowolny / „Create".</div>
          <div><b>4.</b> Pojawi się długi kod zaczynający się od <b>„AIza…"</b>. Kliknij obok niego <b>„Copy"</b> (Kopiuj).</div>
          <div><b>5.</b> Wróć tutaj i wklej kod w pole „{`wklej swój darmowy klucz`}" wyżej:</div>
          <div style={{ paddingLeft: '14px', color: 'rgba(236,236,236,0.85)' }}>📱 <b>Telefon:</b> przytrzymaj palec na polu → <b>„Wklej"</b>.</div>
          <div style={{ paddingLeft: '14px', color: 'rgba(236,236,236,0.85)', marginBottom: '6px' }}>💻 <b>Komputer:</b> kliknij w pole i wciśnij <b>Ctrl+V</b>.</div>
          <div><b>6.</b> Zobaczysz zielone <b style={{ color: ACCENT }}>● klucz</b> — gotowe! Teraz przyciski „AI" działają.</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>🔒 Kod zostaje tylko u Ciebie w przeglądarce — nikt inny go nie widzi. Jest darmowy.</div>
        </div>
      )}
    </div>
  );

  const saveKey = (k) => { setGeminiKey(k); try { localStorage.setItem('gemini_key', k); } catch (e) {} };

  const writeStory = async () => {
    setAiError(''); setAiBusy('story');
    try {
      const st = pack.story;
      const sys = 'Jestes rezyserem-scenarzysta. Piszesz PO POLSKU, kinowo, obrazowo i konkretnie. Tworzysz ORYGINALNA fabule (nie kopiujesz cudzych dziel). Trzymaj sie briefu i struktury aktow. Zwracaj sama proze/scenariusz scenami, z opisem i dialogami — bez komentarzy od siebie.';
      const branchTxt = branches.length ? `\nWYBRANE ZWROTY AKCJI (uzyj ich w fabule po kolei):\n${branches.map((b, i) => `${i + 1}. ${b}`).join('\n')}` : '';
      const usr = `Napisz spojne opowiadanie/scenariusz wg briefu.\nTytul: ${pack.meta.title}\nGatunek: ${pack.meta.genre}\nLogline: ${st.logline}\nMotyw: ${st.theme}\nTon: ${a.tone || 'kinowy'}\nBohater: ${st.hero}\nBeaty:\n${st.beats.map(([b, d]) => `- ${b}: ${d}`).join('\n')}${branchTxt}\nCel dlugosci: ${st.proseTarget[0]}-${st.proseTarget[1]} znakow.`;
      setStoryProse(await askGemini(sys, usr, geminiKey, 4096));
    } catch (e) { setAiError(e.message); } finally { setAiBusy(''); }
  };

  const writeLyrics = async () => {
    setAiError(''); setAiBusy('lyrics');
    try {
      const m = pack.music;
      const sys = `Jestes autorem tekstow piosenek do filmow. Piszesz ORYGINALNY tekst po ${a.vocalLang || 'polsku'}. Uzywaj znacznikow sekcji [Intro][Verse][Chorus] i tagow glosow. Zwroc SAM tekst, bez komentarzy.`;
      const usr = `Napisz pelny tekst piosenki (cel ${m.lyricsTarget[0]}-${m.lyricsTarget[1]} znakow) do filmu.\nTemat/logline: ${pack.story.logline}\nNastroj/styl: ${a.mood || a.musicStyle || a.tone || 'epicki'}\nBPM: ${m.bpm}\nBrzmienie (styles): ${m.stylesEN}\nTrzymaj strukture i tagi glosow jak w szablonie:\n${m.lyricsEN}`;
      setLyricsAI(await askGemini(sys, usr, geminiKey, 4096));
    } catch (e) { setAiError(e.message); } finally { setAiBusy(''); }
  };

  // 🎲 ZRÓB CAŁOŚĆ ZA MNIE — auto-pilot: wypełnia wszystko, AI uzupełnia, składa gotowiec
  const autoRun = async (preset) => {
    setAiError(''); setAutoOutput(''); setAutoBusy(preset._name || 'auto');
    try {
      const ans = { ...a, ...preset, shotCount: '', costume: '', prop: '', musicWish: '', musicStyle: '', tools: { higgsfield: false } };
      ans.ratio = preset.format === 'short' ? '9:16' : preset.format === 'square' ? '1:1' : '16:9';
      setA(ans);
      const pk = buildProductionPack(ans);
      setPack(pk);
      let shots = flattenShots(pk);
      setEditShots(shots); setStep(4); setBranches([]); setBranchOptions([]); setStoryProse(''); setLyricsAI('');
      let story = '', lyrics = '';
      if (geminiKey) {
        const st = pk.story, m = pk.music;
        story = await askGemini(
          'Jestes rezyserem-scenarzysta. PO POLSKU, kinowo, scenami z dialogami. ORYGINALNA fabula. Zwroc sama proze, bez komentarzy.',
          `Tytul: ${pk.meta.title}. Gatunek: ${pk.meta.genre}. Logline: ${st.logline}. Ton: ${ans.tone}.\nBeaty:\n${st.beats.map(([b, d]) => `- ${b}: ${d}`).join('\n')}\nCel: ${st.proseTarget[0]}-${st.proseTarget[1]} znakow.`,
          geminiKey, 4096); setStoryProse(story);
        lyrics = await askGemini(
          `Autor tekstow piosenek. ORYGINALNY tekst po ${ans.vocalLang || 'PL'}. Sekcje [Intro][Chorus] i tagi glosow. Zwroc sam tekst.`,
          `Logline: ${st.logline}. Nastroj: ${ans.mood}. BPM: ${m.bpm}. Brzmienie: ${m.stylesEN}. Struktura:\n${m.lyricsEN}`,
          geminiKey, 4096); setLyricsAI(lyrics);
        const list = shots.slice(0, 60).map((s, i) => `${i + 1}. [${s.beat}] ${s.params.size}, ruch: ${s.params.move}`).join('\n');
        const outD = await askGemini(
          'Rezyser. PO POLSKU. Dla kazdego ujecia 1 zdanie: konkretny moment akcji. Lista numerowana "N. opis".',
          `Logline: ${st.logline}. Ton: ${ans.tone}.\nUjecia:\n${list}`, geminiKey, 4096);
        const mp = {}; outD.split('\n').forEach((l) => { const mm = l.match(/^\s*(\d+)[.\)]\s*(.+)/); if (mm) mp[parseInt(mm[1], 10) - 1] = mm[2].trim(); });
        shots = shots.map((s, i) => (mp[i] ? { ...s, aiDesc: mp[i] } : s)); setEditShots(shots);
      }
      setAutoOutput(buildMega(pk, story, lyrics, shots));
    } catch (e) {
      setAiError('Auto: ' + e.message + ' — pakiet i tak gotowy (bez prozy AI, wklej klucz Gemini by dopisać).');
      setAutoOutput(buildMega(buildProductionPack({ ...a, ...preset }), '', '', flattenShots(buildProductionPack({ ...a, ...preset }))));
    } finally { setAutoBusy(''); }
  };

  // DRZEWKO AKCJI — AI proponuje 3 zwroty, użytkownik wybiera (prowadzi fabułę)
  const proposeBranches = async () => {
    setAiError(''); setAiBusy('branch');
    try {
      const st = pack.story;
      const path = branches.length ? `Dotychczasowa ścieżka akcji:\n${branches.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n` : '';
      const sys = 'Jestes rezyserem-scenarzysta. Piszesz PO POLSKU. Proponujesz DRAMATYCZNE, rozne zwroty akcji. Zwroc DOKLADNIE 3 opcje, kazda w osobnej linii w formacie "Tytul — opis w 1 zdaniu". Bez numeracji, bez komentarzy.';
      const usr = `Film: ${pack.meta.title}. Logline: ${st.logline}. Ton: ${a.tone || 'kinowy'}.\n${path}Zaproponuj 3 mozliwe NASTEPNE zwroty akcji (rozne kierunki fabuly).`;
      const out = await askGemini(sys, usr, geminiKey, 700);
      const opts = out.split('\n').map(l => l.replace(/^[\-*•\d.\)\s]+/, '').trim()).filter(l => l.length > 4).slice(0, 3);
      setBranchOptions(opts);
    } catch (e) { setAiError(e.message); } finally { setAiBusy(''); }
  };
  const chooseBranch = (opt) => { setBranches((prev) => [...prev, opt]); setBranchOptions([]); };
  const resetBranches = () => { setBranches([]); setBranchOptions([]); };

  // ── EKRANIZUJ: Krok 1 — Analiza tekstu przez Gemini ─────────────────────────
  const analyzeScreenplay = async () => {
    if (!screenplay.trim()) return;
    setSceneError(''); setSceneBusy(true); setSceneCount(0); setScenesDone(0); setScenePack([]); setSceneAnalysis(null);
    try {
      const sys = 'Jestes analitykiem scenariuszow. Odpowiadasz TYLKO w formacie JSON. Bez komentarzy, bez markdown.';
      const usr = `Przeanalizuj ponizszy tekst literacki i zwroc JSON w formacie:
{"title":"tytul","genre":"gatunek (anime/sci-fi/horror/dramat/fantasy/sitcom)","tone":"krotki opis tonu","logline":"1 zdanie o czym to jest","hero":"imie i opis bohatera","scenes":LICZBA_CALKOWITA,"bpm":LICZBA,"lengthSec":LICZBA,"ratio":"16:9"}

scenes = sugerowana liczba ujec dla 1 minuty wideo na 10 stron tekstu (od 6 do 60, bierz pod uwage dlugosc tekstu).
bpm = sugerowane tempo muzyki.
lengthSec = sugerowana dlugosc wideo w sekundach.

TEKST:
${screenplay.slice(0, 6000)}`;
      const raw = await askGemini(sys, usr, geminiKey, 512);
      const json = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
      const meta = JSON.parse(json);
      setSceneAnalysis(meta);
      setSceneCount(Math.max(6, Math.min(60, meta.scenes || 12)));
      setSceneBatch(Math.max(3, Math.min(10, Math.ceil((meta.scenes || 12) / 6))));
    } catch (e) {
      setSceneError('Błąd analizy: ' + e.message + '. Spróbuj skrócić tekst lub sprawdź klucz Gemini.');
    } finally { setSceneBusy(false); }
  };

  // ── EKRANIZUJ: Krok 2 — Generuj kolejną partię ujęć (DALEJ X/N) ────────────
  const generateNextBatch = async () => {
    if (!sceneAnalysis || scenesDone >= sceneCount) return;
    setSceneError(''); setSceneBusy(true);
    const from = scenesDone + 1;
    const to = Math.min(sceneCount, scenesDone + sceneBatch);
    const prevContext = scenePack.slice(-3).map(s => `S${s.n}: ${s.desc}`).join('\n');
    const lockLine = `Continuity-lock: ${sceneAnalysis.hero}, ton: ${sceneAnalysis.tone}, ${sceneAnalysis.genre}`;
    try {
      const sys = 'Jestes rezyserem. Piszesz PO POLSKU. Zwracasz TYLKO liste numerowana "N. BEAT | PLAN | RUCH | OPIS" — bez naglowkow, bez komentarzy.';
      const textSlice = screenplay.slice(
        Math.floor((from - 1) / sceneCount * screenplay.length),
        Math.floor(to / sceneCount * screenplay.length) + 200
      );
      const usr = `Film: "${sceneAnalysis.title}". Logline: ${sceneAnalysis.logline}. Ton: ${sceneAnalysis.tone}.\n${lockLine}.\n${
        prevContext ? `Poprzednie ujecia (kontekst spójnosci):\n${prevContext}\n` : ''
      }Wygeneruj ujecia od S${from} do S${to} na podstawie fragmentu tekstu:\n---\n${textSlice.slice(0, 3000)}\n---\nFormat kazdego: "${from}. BEAT | PLAN_OBRAZU | RUCH_KAMERY | 1_ZDANIE_CO_SIE_DZIEJE"\nBEAT = intro/verse/chorus/build/CLIMAX/bridge\nPLAN = ELS/LS/MS/MCU/CU/ECU/OTS/aerial\nRUCH = dolly-in/pan/tracking/push-in/handheld/static/crane`;
      const out = await askGemini(sys, usr, geminiKey, 2048);
      const newShots = [];
      out.split('\n').forEach((line) => {
        const m = line.match(/^\s*(\d+)[.)\s]+([^|]+)\|([^|]+)\|([^|]+)\|(.+)/);
        if (!m) return;
        const n = parseInt(m[1], 10);
        if (n < from || n > to) return;
        newShots.push({ n, beat: m[2].trim(), size: m[3].trim(), move: m[4].trim(), desc: m[5].trim() });
      });
      setScenePack(prev => [...prev, ...newShots]);
      setScenesDone(to);
    } catch (e) {
      setSceneError('Błąd generowania: ' + e.message);
    } finally { setSceneBusy(false); }
  };

  // Eksport wygenerowanych ujęć do Markdown
  const exportScenePack = () => {
    if (!scenePack.length || !sceneAnalysis) return '';
    const L = [`# EKRANIZACJA: ${sceneAnalysis.title}`,
      `${sceneAnalysis.genre} · ${sceneAnalysis.logline}`,
      `Continuity-lock: ${sceneAnalysis.hero} · ton: ${sceneAnalysis.tone}`, ''];
    scenePack.forEach(s => {
      L.push(`## S${s.n} · [${s.beat}]`);
      L.push(`AKCJA: ${s.desc}`);
      L.push(`PLAN: ${s.size} · RUCH: ${s.move}`);
      L.push('');
    });
    return L.join('\n');
  };

  // AI opisuje każde ujęcie — osobny moment akcji (nie szablon)
  const describeShots = async () => {
    setAiError(''); setAiBusy('shots');
    try {
      const listShots = editShots.slice(0, 60); // limit jednego wywołania
      const list = listShots.map((s, i) => `${i + 1}. [${s.beat}] ${s.params.size}, ruch: ${s.params.move}`).join('\n');
      const sys = 'Jestes rezyserem. Piszesz PO POLSKU. Dla kazdego ujecia napisz JEDEN konkretny, obrazowy moment akcji (co widac, co robi bohater) — 1 zdanie. Zwroc liste numerowana, dokladnie tyle pozycji ile podano, format "N. opis".';
      const usr = `Film: ${pack.meta.title}. Logline: ${pack.story.logline}. Ton: ${a.tone || 'kinowy'}.${branches.length ? ` Wybrane zwroty akcji: ${branches.join('; ')}.` : ''}\nUjecia (beat + kamera):\n${list}\nNapisz osobny moment dla kazdego ujecia.`;
      const out = await askGemini(sys, usr, geminiKey, 4096);
      const map = {};
      out.split('\n').forEach((l) => { const m = l.match(/^\s*(\d+)[.\)]\s*(.+)/); if (m) map[parseInt(m[1], 10) - 1] = m[2].trim(); });
      setEditShots((prev) => prev.map((s, i) => (map[i] ? { ...s, aiDesc: map[i] } : s)));
    } catch (e) { setAiError(e.message); } finally { setAiBusy(''); }
  };

  const set = (k, v) => setA((s) => ({ ...s, [k]: v }));
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const flattenShots = (pk) => pk.parts.flatMap(p => p.shots.map(s => ({ ...s, params: { ...s.params } })));
  const generate = () => { const pk = buildProductionPack(a); setPack(pk); setEditShots(flattenShots(pk)); setStep(4); };

  // edycja kamery per ujęcie
  const updateShot = (idx, key, val) => setEditShots(prev => prev.map((s, i) => i === idx ? { ...s, params: { ...s.params, [key]: val } } : s));
  const removeShot = (idx) => setEditShots(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, n: 'S' + (i + 1) })));
  const addShot = () => setEditShots(prev => [...prev, {
    n: 'S' + (prev.length + 1), beat: '(dodane)', time: '—',
    params: { size: SHOT_SIZES[3], lens: LENSES[3], angle: ANGLES[0], light: LIGHTS[0], move: MOVES[0], time: TIMES[0] },
    lumaMotion: MOVES[0],
  }]);

  const copyField = (text, id) => {
    try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
    setCopiedField(id); setTimeout(() => setCopiedField(''), 1500);
  };
  // pętla dopisywania: doklej "czego brakuje" i przelicz prompt muzyczny
  const applyRefine = () => {
    if (!refine.trim()) return;
    const merged = { ...a, musicWish: [a.musicWish, refine.trim()].filter(Boolean).join('; ') };
    setA(merged);
    const pk = buildProductionPack(merged);
    setPack(pk); setEditShots(flattenShots(pk));
    setRefine('');
  };

  const md = pack ? packToMarkdown(pack) : '';
  const copyAll = () => {
    try { navigator.clipboard && navigator.clipboard.writeText(md); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `production-pack-${(pack.meta.title || 'film').replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(14px,2vw,28px)', fontFamily: MONO, color: '#ECECEC' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '6px' }}>
        <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 'clamp(34px,5vw,60px)', color: '#F4F4F2' }}>STORY</span>
        <span style={{ color: ACCENT, letterSpacing: '0.18em', fontSize: '13px' }}>// ENGINE</span>
      </div>
      <div style={{ fontSize: '13px', color: '#ECECEC', lineHeight: 1.55, marginBottom: '14px', maxWidth: '760px' }}>
        Masz pomysł na film, animację, opowiadanie albo serię grafik — ale nie wiesz, jak zamienić go w coś,
        co zrozumieją narzędzia AI? <b style={{ color: ACCENT }}>To narzędzie prowadzi Cię za rękę.</b> Odpowiadasz na kilka pytań,
        a ono układa za Ciebie gotowe <b>prompty</b> i plan — które potem wklejasz do swoich narzędzi.
      </div>

      <div style={{ ...box, marginBottom: '10px', padding: '14px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.45)', marginBottom: '10px' }}>JAK TO DZIAŁA — 3 KROKI</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            ['1 · Odpowiadasz', 'Klikasz gatunek i piszesz w paru zdaniach, o czym to ma być (Wizja → Bohater → Dźwięk → Pipeline).'],
            ['2 · Dostajesz plan', 'Narzędzie układa: fabułę, postacie, prompt na muzykę, rozpisane ujęcia i listę zadań krok po kroku.'],
            ['3 · Kopiujesz i robisz', 'Gotowe prompty wklejasz tam, gdzie tworzysz: Gemini/Luma (film, grafika), Suno (muzyka), albo do opowiadania.'],
          ].map(([h, d], i) => (
            <div key={i} style={{ borderLeft: `2px solid ${ACCENT}`, paddingLeft: '10px' }}>
              <div style={{ fontSize: '12.5px', color: ACCENT, marginBottom: '3px' }}>{h}</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(236,236,236,0.78)', lineHeight: 1.45 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: '18px', maxWidth: '760px' }}>
        <b style={{ color: '#ECECEC' }}>Do czego użyjesz promptów:</b> filmy/wideo (Luma, Gemini), grafiki i kadry (Gemini),
        muzyka i piosenki (Suno), a nawet opowiadania.&nbsp;&nbsp;
        <b style={{ color: ACCENT }}>Ważne:</b> tutaj <b>nic się nie generuje</b> — narzędzie tylko układa prompty i plan,
        więc jest <b>darmowe i bezpieczne</b> (nie wyda Twoich kredytów). Niżej zaczynasz 👇
      </div>

      {/* AUTO-PILOT — zrób całość za mnie */}
      <div style={{ ...box, marginBottom: '14px', borderColor: ACCENT, padding: '14px' }}>
        <div style={{ fontSize: '13px', color: '#ECECEC', marginBottom: '8px', lineHeight: 1.5 }}>🎲 <b style={{ color: ACCENT }}>Nie chcesz nic ustawiać?</b> Zrób całość za mnie — AI wypełni wszystko od tytułu po koniec i dostaniesz <b>jeden gotowiec do skopiowania</b> (wklej wprost do LumaLabs).</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
          <input type="password" value={geminiKey} onChange={(e) => saveKey(e.target.value)} placeholder="klucz Gemini (dla pełnego AI; darmowy: aistudio.google.com/apikey)" style={{ ...input, flex: 1, minWidth: '180px', fontSize: '11px', padding: '6px 9px' }} />
          <span style={{ fontSize: '11px', color: geminiKey ? ACCENT : 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{geminiKey ? '● klucz' : '○ brak'}</span>
        </div>
        {keyHelp()}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', marginTop: '8px' }}>
          {PRESETS.map((p) => (
            <button key={p._name} onClick={() => autoRun(p)} disabled={!!autoBusy} style={{ ...btn(false), opacity: autoBusy ? 0.5 : 1 }}>{autoBusy === p._name ? '✦ robię…' : p._name}</button>
          ))}
        </div>
        <button onClick={() => autoRun(PRESETS[Math.floor(Math.random() * PRESETS.length)])} disabled={!!autoBusy} style={{ ...btn(true), opacity: autoBusy ? 0.6 : 1 }}>{autoBusy ? '✦ AI robi całość… (kilka sekund)' : '🎲 LOSUJ CAŁOŚĆ ZA MNIE'}</button>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '5px' }}>Z kluczem Gemini (pole niżej) = pełna fabuła + tekst + opisy ujęć. Bez klucza = kompletny pakiet bez prozy AI.</div>
      </div>

      {/* ── EKRANIZUJ TEKST — import opowiadania ────────────────────────────── */}
      <div style={{ ...box, marginBottom: '14px', borderColor: showScreenplay ? ACCENT : 'rgba(255,200,0,0.35)', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', color: '#ECECEC' }}>📖 <b style={{ color: '#E8A33C' }}>Ekranizuj tekst</b> — wklej opowiadanie lub książkę, AI rozbije je na prompty</div>
          <button onClick={() => setShowScreenplay(v => !v)} style={{ ...btn(showScreenplay), padding: '5px 12px', fontSize: '11px' }}>{showScreenplay ? '▲ ZWIŃ' : '▼ ROZWIŃ'}</button>
        </div>

        {showScreenplay && (
          <div>
            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.55)', marginBottom: '10px', lineHeight: 1.5 }}>
              Wklej tekst opowiadania (lub fragment książki). Gemini przeanalizuje go i powie ile ujęć potrzeba.
              Potem klikasz <b style={{ color: ACCENT }}>DALEJ</b> tyle razy, ile wynosi liczba partii — każde kliknięcie to jedno zapytanie do Gemini.
              Dzięki temu nie przekroczysz limitu i każda partia „pamięta" poprzednie ujęcia.
            </div>

            <Field>
              <label style={label}>Wklej tekst opowiadania / fragment książki</label>
              <textarea
                style={{ ...input, minHeight: '140px', resize: 'vertical', fontSize: '12px' }}
                value={screenplay}
                onChange={e => setScreenplay(e.target.value)}
                placeholder={`Wklej tutaj tekst opowiadania...\n\nLub np. skopiuj ze strony (Ctrl+A, Ctrl+C na stronie z tekstem, potem Ctrl+V tutaj).\nDługość: od 1 akapitu do kilkunastu stron — im dłuższy tekst, tym więcej ujęć.`}
              />
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{screenplay.length} znaków wklejono</div>
            </Field>

            {/* Krok 1 — ANALIZUJ */}
            {!sceneCount && (
              <button
                onClick={analyzeScreenplay}
                disabled={sceneBusy || !screenplay.trim() || !geminiKey}
                style={{ ...btn(true), opacity: (sceneBusy || !screenplay.trim() || !geminiKey) ? 0.5 : 1 }}
              >
                {sceneBusy ? '✦ analizuję…' : '🔍 ANALIZUJ — ustal liczbę ujęć'}
              </button>
            )}

            {/* Po analizie — wynik + przycisk DALEJ */}
            {sceneCount > 0 && sceneAnalysis && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ ...box, borderColor: '#E8A33C', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#E8A33C', marginBottom: '6px' }}>✦ Gemini przeanalizowało tekst:</div>
                  <div style={{ fontSize: '12.5px', lineHeight: 1.6 }}>
                    <b>{sceneAnalysis.title}</b> · {sceneAnalysis.genre} · {sceneAnalysis.logline}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Bohater: {sceneAnalysis.hero} · Ton: {sceneAnalysis.tone}
                  </div>
                  <div style={{ fontSize: '12px', color: ACCENT, marginTop: '6px' }}>
                    Sugerowana liczba ujęć: <b>{sceneCount}</b> · Partii do wygenerowania: <b>{Math.ceil(sceneCount / sceneBatch)}</b> (po ~{sceneBatch} ujęć)
                  </div>
                </div>

                {/* Pasek postępu */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                  >Postęp: {scenesDone} / {sceneCount} ujęć wygenerowano</div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', height: '6px', borderRadius: '3px' }}>
                    <div style={{ background: ACCENT, height: '6px', borderRadius: '3px', width: `${Math.round(scenesDone / sceneCount * 100)}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>

                {/* Przycisk DALEJ */}
                {scenesDone < sceneCount ? (
                  <button
                    onClick={generateNextBatch}
                    disabled={sceneBusy}
                    style={{ ...btn(true), opacity: sceneBusy ? 0.6 : 1, fontSize: '13px', padding: '11px 22px' }}
                  >
                    {sceneBusy
                      ? `✦ generuję S${scenesDone + 1}–${Math.min(sceneCount, scenesDone + sceneBatch)}…`
                      : `DALEJ ${Math.ceil(scenesDone / sceneBatch) + 1} / ${Math.ceil(sceneCount / sceneBatch)} →`
                    }
                  </button>
                ) : (
                  <div style={{ color: ACCENT, fontSize: '13px', marginBottom: '8px' }}>✅ Wszystkie ujęcia wygenerowane!</div>
                )}

                {/* Reset */}
                <button onClick={() => { setSceneCount(0); setScenesDone(0); setScenePack([]); setSceneAnalysis(null); }}
                  style={{ ...btn(false), marginLeft: '8px', padding: '6px 12px', fontSize: '11px' }}>↺ od nowa</button>
              </div>
            )}

            {/* Zebrane ujęcia */}
            {scenePack.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>WYGENEROWANE UJĘCIA ({scenePack.length})</div>
                {scenePack.map(s => (
                  <div key={s.n} style={{ borderLeft: `2px solid ${s.beat.includes('CLIMAX') || s.beat.includes('chorus') ? ACCENT : 'rgba(255,255,255,0.15)'}`, paddingLeft: '10px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: ACCENT }}>S{s.n} · [{s.beat}] · {s.size} · {s.move}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(236,236,236,0.85)', lineHeight: 1.45 }}>{s.desc}</div>
                  </div>
                ))}
                <button
                  onClick={() => { const t = exportScenePack(); try { navigator.clipboard && navigator.clipboard.writeText(t); } catch(e){} copyField(t, 'scenePack'); }}
                  style={{ ...btn(true), marginTop: '6px' }}
                >{copiedField === 'scenePack' ? '✓ SKOPIOWANO' : '📋 KOPIUJ WSZYSTKIE UJĘCIA (Markdown)'}</button>
              </div>
            )}

            {sceneError && <div style={{ fontSize: '11px', color: '#E5484D', marginTop: '8px' }}>⚠ {sceneError}</div>}
          </div>
        )}
      </div>

      {/* stepper */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <div key={i} onClick={() => (pack || i <= step) && setStep(i)}
            style={{ ...box, padding: '7px 12px', cursor: 'pointer', borderColor: i === step ? ACCENT : 'rgba(255,255,255,0.12)', color: i === step ? ACCENT : 'rgba(255,255,255,0.55)', fontSize: '11px', letterSpacing: '0.12em' }}>
            {i + 1}. {s.toUpperCase()}
          </div>
        ))}
      </div>

      {/* STEP 0 — Wizja */}
      {step === 0 && (
        <div style={box}>
          <Field><label style={label}>Tytuł roboczy</label><input style={input} value={a.title} onChange={(e) => set('title', e.target.value)} placeholder="np. ARBALEST II" /></Field>
          <Field><label style={label}>Gatunek</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {GENRES.map((g) => <button key={g} style={btn(a.genre === g)} onClick={() => set('genre', g)}>{g}</button>)}
            </div>
          </Field>
          <Field><label style={label}>Format (inne proporcje i struktura)</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['short', 'SHORT 9:16'], ['film', 'FILM 16:9'], ['square', 'KWADRAT 1:1']].map(([k, lbl]) => (
                <button key={k} style={btn(a.format === k)} onClick={() => { set('format', k); set('ratio', k === 'short' ? '9:16' : k === 'square' ? '1:1' : '16:9'); }}>{lbl}</button>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>SHORT = pionowo, hook-first (TikTok/Reels/Shorts). FILM = pełna struktura aktów.</div>
          </Field>
          <Field><label style={label}>Temat / bohater (jednym zdaniem)</label><input style={input} value={a.subject} onChange={(e) => set('subject', e.target.value)} placeholder="np. samotny pilot mecha w deszczowym mieście" /></Field>
          <div style={{ display: 'flex', gap: '14px' }}>
            <Field><label style={label}>Długość (sekundy)</label><input type="number" style={{ ...input, width: '140px' }} value={a.lengthSec} onChange={(e) => set('lengthSec', e.target.value)} /></Field>
            <Field><label style={label}>Ton / referencja</label><input style={input} value={a.tone} onChange={(e) => set('tone', e.target.value)} placeholder="np. Full Metal Panic × Blade Runner, noir" /></Field>
          </div>
          <Field>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '5px' }}>
              {['cyberpunk / neon', 'noir / mrok', 'ciepły dramat', 'mroczny horror', 'jasny sitcom', 'baśniowy / złota godzina'].map((tg) => (
                <button key={tg} style={{ ...btn(false), padding: '6px 12px', fontSize: '11px' }} onClick={() => set('tone', tg)}>{tg}</button>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>▸ Ton ustawia paletę kolorów i styl obiektywów/światła. Np. <b>cyberpunk</b> → neony i szerokie kąty; <b>sitcom</b> → płaskie światło.</div>
          </Field>
          <Field><label style={label}>Logline (1 zdanie — o czym to jest)</label><input style={input} value={a.logline} onChange={(e) => set('logline', e.target.value)} placeholder="np. Pilot musi aktywować Lambda Driver, by ocalić flotę." /></Field>
        </div>
      )}

      {/* STEP 1 — Bohater */}
      {step === 1 && (
        <div style={box}>
          <Field><label style={label}>Wstawiamy realną osobę (Twoja twarz / Olaf / ktoś)?</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={btn(a.insertFace)} onClick={() => set('insertFace', true)}>TAK — z mojego selfie</button>
              <button style={btn(!a.insertFace)} onClick={() => set('insertFace', false)}>NIE — postać fikcyjna</button>
            </div>
          </Field>
          {a.insertFace && (
            <div style={{ display: 'flex', gap: '14px' }}>
              <Field><label style={label}>Czyja twarz</label><input style={input} value={a.faceName} onChange={(e) => set('faceName', e.target.value)} placeholder="np. Patryk" /></Field>
              <Field><label style={label}>Ile masz / zrobisz zdjęć</label><input type="number" style={{ ...input, width: '120px' }} value={a.photoCount} onChange={(e) => set('photoCount', e.target.value)} /></Field>
            </div>
          )}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <Field><label style={label}>Strój (Costume Lock — ten sam w każdym ujęciu)</label><input style={input} value={a.costume} onChange={(e) => set('costume', e.target.value)} placeholder="np. znoszony płaszcz, neonowy kołnierz (puste = wg gatunku)" /></Field>
            <Field><label style={label}>Kluczowy rekwizyt (Prop Lock)</label><input style={input} value={a.prop} onChange={(e) => set('prop', e.target.value)} placeholder="np. stara latarka, świecący datapad (puste = wg gatunku)" /></Field>
          </div>
          <div style={{ border: '1px solid #E5484D', background: 'rgba(229,72,77,0.08)', padding: '10px', fontSize: '11.5px', color: '#ECECEC', lineHeight: 1.5, marginBottom: '14px' }}>
            🔒 <b>Po co „Lock"?</b> Modele wideo AI mają „demencję" — jeśli w ujęciu 1 napiszesz „chłopak", a w ujęciu 2 znów „chłopak", AI wygeneruje <b>dwie różne osoby</b> (i inne ciuchy). Dlatego strój i rekwizyt wklejamy <b>twardo do każdego promptu</b> — żeby bohater nie zmieniał się między ujęciami.
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Metoda: selfie w różnych pozach → Gemini wstawia twarz do sceny → Grok poprawia → Luma animuje. Strój i rekwizyt są wklejane do KAŻDEGO promptu, żeby Luma nie zmieniała ciuchów między ujęciami.
          </div>
        </div>
      )}

      {/* STEP 2 — Dźwięk */}
      {step === 2 && (
        <div style={box}>
          <Field><label style={label}>Warstwa audio</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={btn(a.audioType === 'song')} onClick={() => set('audioType', 'song')}>Piosenka (z tekstem)</button>
              <button style={btn(a.audioType === 'score')} onClick={() => set('audioType', 'score')}>Ścieżka dźwiękowa (instrumental)</button>
            </div>
          </Field>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <Field><label style={label}>BPM / tempo</label><input type="number" style={{ ...input, width: '110px' }} value={a.bpm} onChange={(e) => set('bpm', e.target.value)} /></Field>
            {a.audioType === 'song' && <Field><label style={label}>Język wokalu</label><input style={{ ...input, width: '110px' }} value={a.vocalLang} onChange={(e) => set('vocalLang', e.target.value)} placeholder="PL / JP / EN" /></Field>}
            <Field><label style={label}>Nastrój</label><input style={input} value={a.mood} onChange={(e) => set('mood', e.target.value)} placeholder="np. epicki, podniosły, nostalgiczny" /></Field>
          </div>
          <Field><label style={label}>Instrumenty / brzmienie</label><input style={input} value={a.instruments} onChange={(e) => set('instruments', e.target.value)} placeholder="np. orkiestra + rock, syntezatory, taiko, chór" /></Field>
          <Field><label style={label}>Opisz czego chcesz — im więcej, tym lepszy prompt</label>
            <textarea style={{ ...input, minHeight: '70px', resize: 'vertical' }} value={a.musicWish} onChange={(e) => set('musicWish', e.target.value)} placeholder="np. ma być jak opening anime z lat 90, mocny refren po japońsku, narastanie do dropu, w stylu Lambda Driver anthem..." />
          </Field>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>▸ Po zbudowaniu pakietu dostaniesz pola <b>styles</b> (≤999) i <b>lyrics</b> (~3–4k) — do wklejenia w Suno albo wprost w LumaLabs. Najpierw po polsku, po „Zatwierdź" → angielski.</div>
        </div>
      )}

      {/* STEP 3 — Pipeline */}
      {step === 3 && (
        <div style={box}>
          <div style={{ display: 'flex', gap: '14px' }}>
            <Field><label style={label}>Format</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['16:9', '9:16', '1:1'].map((r) => <button key={r} style={btn(a.ratio === r)} onClick={() => set('ratio', r)}>{r}</button>)}
              </div>
            </Field>
            <Field><label style={label}>Rozdzielczość</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['720p', '1080p'].map((r) => <button key={r} style={btn(a.res === r)} onClick={() => set('res', r)}>{r}</button>)}
              </div>
            </Field>
          </div>
          <Field><label style={label}>Klimaks zsynchronizowany z dropem muzyki?</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={btn(a.climaxSync)} onClick={() => set('climaxSync', true)}>TAK</button>
              <button style={btn(!a.climaxSync)} onClick={() => set('climaxSync', false)}>NIE</button>
            </div>
          </Field>
          <Field><label style={label}>Liczba ujęć (puste = auto z długości; max 400)</label>
            <input type="number" style={{ ...input, width: '160px' }} value={a.shotCount} onChange={(e) => set('shotCount', e.target.value)} placeholder="np. 200" />
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Każde ujęcie dostaje INNY plan/obiektyw/światło/kąt/ruch — nie są identyczne.</div>
          </Field>
          <Field><label style={label}>Higgsfield dostępny (trudne ujęcia / lip-sync)?</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={btn(a.tools.higgsfield)} onClick={() => set('tools', { ...a.tools, higgsfield: true })}>TAK</button>
              <button style={btn(!a.tools.higgsfield)} onClick={() => set('tools', { ...a.tools, higgsfield: false })}>NIE</button>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '5px', lineHeight: 1.45 }}>▸ <b>Higgsfield</b> to profesjonalne narzędzie do wideo AI (konkurencja Lumy) — m.in. dobry <b>lip-sync</b> (synchronizacja ust z dźwiękiem) na gotowym klipie. Nie masz? Zaznacz NIE — silnik uprości wymagania.</div>
          </Field>
        </div>
      )}

      {/* STEP 4 — Pakiet */}
      {step === 4 && pack && (
        <div>
          {autoOutput && (
            <div style={{ ...box, marginBottom: '12px', borderColor: ACCENT }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ color: ACCENT, fontSize: '12px', letterSpacing: '0.1em' }}>🎬 GOTOWIEC — CAŁOŚĆ DO SKOPIOWANIA ({autoOutput.length} zn.)</span>
                <button style={btn(true)} onClick={() => copyField(autoOutput, 'mega')}>{copiedField === 'mega' ? '✓ SKOPIOWANO' : 'KOPIUJ CAŁOŚĆ'}</button>
              </div>
              <div style={{ fontSize: '11.5px', color: '#ECECEC', whiteSpace: 'pre-wrap', maxHeight: '360px', overflowY: 'auto', lineHeight: 1.5, background: '#000', padding: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>{autoOutput}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '6px', lineHeight: 1.5 }}>▸ To wklejasz w <b>LumaLabs</b> — jak Cię stać, Luma zrobi cały proces od początku do końca (orientacyjnie od ~$40). Albo jedź z tego ręcznie, kawałek po kawałku.</div>
            </div>
          )}
          <div style={{ ...box, marginBottom: '12px', borderColor: geminiKey ? ACCENT : 'rgba(255,255,255,0.25)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)', marginBottom: '7px' }}>✦ MÓZG AI — pisze prawdziwą fabułę i teksty (darmowy, opcjonalny)</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="password" value={geminiKey} onChange={(e) => saveKey(e.target.value)} placeholder="wklej swój darmowy klucz Gemini (AIza...)" style={{ ...input, flex: 1, minWidth: '220px' }} />
              <span style={{ fontSize: '11px', color: geminiKey ? ACCENT : 'rgba(255,255,255,0.4)' }}>{geminiKey ? '● klucz zapisany' : '○ brak klucza'}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '7px', lineHeight: 1.5 }}>
              Darmowy klucz w 2 min: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: ACCENT }}>aistudio.google.com/apikey</a> → „Create API key". Oficjalny Google, <b style={{ color: ACCENT }}>legalny i darmowy</b>; zostaje w Twojej przeglądarce, nikt inny go nie widzi.
            </div>
            {keyHelp()}
            {aiError && <div style={{ fontSize: '11px', color: '#E5484D', marginTop: '6px' }}>⚠ {aiError}</div>}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button style={btn(true)} onClick={copyAll}>{copied ? 'SKOPIOWANO ✓' : 'KOPIUJ CAŁOŚĆ (Markdown)'}</button>
            <button style={btn(false)} onClick={download}>POBIERZ .MD</button>
          </div>

          <div style={{ ...box, marginBottom: '12px' }}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '24px', color: '#F4F4F2' }}>{pack.meta.title}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{pack.meta.genre} · {pack.meta.lengthSec}s · {pack.meta.bpm} BPM · {pack.meta.ratio} {pack.meta.res} · {pack.meta.shotsTotal} ujęć / {pack.meta.partCount} część(i)</div>
            <div style={{ fontSize: '12px', color: ACCENT, marginTop: '4px' }}>{pack.meta.logline}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '6px' }}>continuity-lock: {pack.meta.lock}</div>
          </div>

          {/* FABUŁA */}
          <Section title="0 · FABUŁA (brief — prozę pisze Twórczy-fill AI)">
            <div style={{ fontSize: '12.5px', marginBottom: '4px' }}>Logline: <span style={{ color: ACCENT }}>{pack.story.logline}</span></div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>Motyw: {pack.story.theme} · Bohater: {pack.story.hero} · Cel prozy: {pack.story.proseTarget[0]}–{pack.story.proseTarget[1]} zn.</div>
            {pack.story.beats.map(([b, d], i) => (
              <div key={i} style={{ fontSize: '12px', marginBottom: '5px', display: 'flex', gap: '8px' }}>
                <span style={{ color: ACCENT, minWidth: '170px' }}>{b}</span>
                <span style={{ color: 'rgba(236,236,236,0.8)' }}>{d}</span>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>▸ {pack.story.note}</div>
            <div style={{ marginTop: '10px' }}>
              <button onClick={writeStory} disabled={aiBusy === 'story'} style={{ ...btn(true), opacity: aiBusy === 'story' ? 0.6 : 1 }}>{aiBusy === 'story' ? '✦ piszę…' : '✦ NAPISZ FABUŁĘ (AI)'}</button>
            </div>
            {storyProse && (
              <div style={{ ...box, marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={label}>fabuła napisana przez AI — {storyProse.length} zn.</span>
                  <button style={{ ...btn(false), padding: '4px 10px', fontSize: '10px' }} onClick={() => copyField(storyProse, 'prose')}>{copiedField === 'prose' ? '✓ SKOPIOWANO' : 'KOPIUJ'}</button>
                </div>
                <div style={{ fontSize: '12.5px', color: '#ECECEC', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '340px', overflowY: 'auto' }}>{storyProse}</div>
              </div>
            )}
          </Section>

          {/* DRZEWKO AKCJI (AI) */}
          <Section title="0a · DRZEWKO AKCJI — prowadź fabułę (AI, darmowy Gemini)">
            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px', lineHeight: 1.5 }}>
              AI proponuje 3 zwroty akcji — <b style={{ color: ACCENT }}>wybierasz jeden</b>, fabuła idzie w tę stronę. Powtarzaj, by zbudować własną ścieżkę. Potem „NAPISZ FABUŁĘ" użyje Twoich wyborów. (Wymaga klucza Gemini powyżej.)
            </div>
            {branches.length > 0 && (
              <div style={{ marginBottom: '10px', borderLeft: `2px solid ${ACCENT}`, paddingLeft: '10px' }}>
                {branches.map((b, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#ECECEC', marginBottom: '3px' }}><span style={{ color: ACCENT }}>{i + 1}.</span> {b}</div>
                ))}
                <button style={{ ...btn(false), padding: '4px 10px', fontSize: '10px', marginTop: '4px' }} onClick={resetBranches}>× wyczyść ścieżkę</button>
              </div>
            )}
            {branchOptions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Wybierz zwrot akcji:</div>
                {branchOptions.map((o, i) => (
                  <button key={i} onClick={() => chooseBranch(o)} style={{ ...btn(false), textAlign: 'left', padding: '9px 12px', fontSize: '12px', textTransform: 'none', letterSpacing: 'normal', lineHeight: 1.4 }}>▸ {o}</button>
                ))}
              </div>
            )}
            <button onClick={proposeBranches} disabled={aiBusy === 'branch'} style={{ ...btn(true), opacity: aiBusy === 'branch' ? 0.6 : 1 }}>{aiBusy === 'branch' ? '✦ myślę…' : (branches.length ? '✦ ZAPROPONUJ KOLEJNY ZWROT (AI)' : '✦ ZAPROPONUJ ZWROTY AKCJI (AI)')}</button>
          </Section>

          {/* ELEMENTY / POSTACIE */}
          <Section title="0b · ELEMENTY / POSTACIE (spójność — 1 arkusz refów na element)">
            {(pack.elements || []).map((e, i) => (
              <div key={i} style={{ marginBottom: '10px', borderLeft: `2px solid ${ACCENT}`, paddingLeft: '10px' }}>
                <div style={{ fontSize: '12.5px' }}><span style={{ color: ACCENT }}>{e.id} · {e.name}</span> <span style={{ color: 'rgba(255,255,255,0.45)' }}>({e.type})</span></div>
                <div style={{ fontSize: '11.5px', color: 'rgba(236,236,236,0.78)', marginTop: '2px' }}>ref: {musicLang === 'pl' ? e.refPL : e.refEN}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>🔒 lock: {e.lock}</div>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>▸ Wygeneruj JEDEN arkusz referencyjny na element (w Gemini), potem używaj go w każdym ujęciu — tak konkurencja (LTX/Katalist) trzyma spójność postaci.</div>
          </Section>

          {/* MUZYKA */}
          {(() => {
            const m = pack.music;
            const pl = musicLang === 'pl';
            const styles = pl ? m.stylesPL : m.stylesEN;
            const lyrics = pl ? m.lyricsPL : m.lyricsEN;
            const lyLen = lyrics.length;
            const lyOk = lyLen >= m.lyricsTarget[0] && lyLen <= m.lyricsTarget[1];
            const fieldBox = { background: '#000', border: '1px solid rgba(255,255,255,0.2)', color: '#ECECEC', fontFamily: MONO, fontSize: '12px', padding: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '220px', overflowY: 'auto' };
            return (
              <Section title={`1 · MUZYKA — ${m.mode === 'score' ? 'ścieżka (instrumental)' : 'piosenka'} · ${m.bpm} BPM`}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  <button style={btn(pl)} onClick={() => setMusicLang('pl')}>🇵🇱 Podgląd (PL)</button>
                  <button style={btn(!pl)} onClick={() => setMusicLang('en')}>✓ Zatwierdź → EN (do wklejenia)</button>
                </div>

                {/* STYLES */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <span style={label}>pole: styles</span>
                  <span style={{ fontSize: '11px', color: styles.length > 999 ? '#E5484D' : ACCENT }}>{styles.length} / 999</span>
                </div>
                <div style={fieldBox}>{styles}</div>
                <button style={{ ...btn(false), marginTop: '6px' }} onClick={() => copyField(styles, 'styles')}>{copiedField === 'styles' ? 'SKOPIOWANO ✓' : `KOPIUJ styles (${pl ? 'PL' : 'EN'})`}</button>

                {/* LYRICS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '16px 0 5px' }}>
                  <span style={label}>pole: {m.mode === 'score' ? 'cue dźwiękowe' : 'lyrics'}</span>
                  <span style={{ fontSize: '11px', color: lyOk ? ACCENT : 'rgba(255,255,255,0.5)' }}>{lyLen} zn. (cel {m.lyricsTarget[0]}–{m.lyricsTarget[1]})</span>
                </div>
                <div style={fieldBox}>{lyrics}</div>
                <button style={{ ...btn(false), marginTop: '6px' }} onClick={() => copyField(lyrics, 'lyrics')}>{copiedField === 'lyrics' ? 'SKOPIOWANO ✓' : `KOPIUJ ${m.mode === 'score' ? 'cue' : 'lyrics'} (${pl ? 'PL' : 'EN'})`}</button>

                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '10px' }}>▸ {m.note}</div>

                <div style={{ marginTop: '10px' }}>
                  <button onClick={writeLyrics} disabled={aiBusy === 'lyrics'} style={{ ...btn(true), opacity: aiBusy === 'lyrics' ? 0.6 : 1 }}>{aiBusy === 'lyrics' ? '✦ piszę…' : '✦ NAPISZ TEKST (AI)'}</button>
                </div>
                {lyricsAI && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ ...fieldBox, maxHeight: '340px' }}>{lyricsAI}</div>
                    <button style={{ ...btn(false), marginTop: '6px' }} onClick={() => copyField(lyricsAI, 'lyricsAI')}>{copiedField === 'lyricsAI' ? '✓ SKOPIOWANO' : `KOPIUJ tekst AI (${lyricsAI.length} zn.)`}</button>
                  </div>
                )}

                {/* PĘTLA DOPISYWANIA */}
                <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                  <label style={label}>Czegoś brakuje? Dopisz i przelicz (jak rundy w Gemini)</label>
                  <textarea style={{ ...input, minHeight: '52px', resize: 'vertical' }} value={refine} onChange={(e) => setRefine(e.target.value)} placeholder="np. dodaj chór gospel w finale; mniej perkusji w zwrotce; wstaw recytację po japońsku przed dropem" />
                  <button style={{ ...btn(true), marginTop: '6px' }} onClick={applyRefine}>+ DOPISZ I PRZELICZ</button>
                </div>
              </Section>
            );
          })()}

          {/* PARTYTURA — edytowalna (reżyser ustawia kamerę per ujęcie) */}
          <Section title={`2 · PARTYTURA UJĘĆ — ${editShots.length} ujęć${pack.format ? ' · ' + pack.format.label : ''}`}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginBottom: '10px' }}>
              🎬 <b style={{ color: ACCENT }}>Rolling… Action!</b> — każde ujęcie ustawiasz sam: plan / obiektyw / kąt / światło / ruch / pora. Dodawaj i usuwaj ujęcia. Prompt aktualizuje się na żywo.
            </div>
            <div style={{ marginBottom: '12px' }}>
              <button onClick={describeShots} disabled={aiBusy === 'shots'} style={{ ...btn(true), opacity: aiBusy === 'shots' ? 0.6 : 1 }}>{aiBusy === 'shots' ? '✦ opisuję ujęcia…' : '✦ OPISZ UJĘCIA (AI) — osobny moment akcji dla każdego'}</button>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>AI (Twój Gemini) napisze co dokładnie dzieje się w każdym ujęciu — nie szablon. Doklejane do promptu przy kopiowaniu.</div>
            </div>
            {editShots.map((s, idx) => {
              const frame = shotFrame(s.params, pack.ctx);
              const sel = (key, opts) => (
                <select value={s.params[key]} onChange={(e) => updateShot(idx, key, e.target.value)}
                  style={{ background: '#000', color: '#ECECEC', border: '1px solid rgba(255,255,255,0.2)', fontFamily: MONO, fontSize: '11px', padding: '4px 6px', maxWidth: '180px' }}>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              );
              const isLast = idx === editShots.length - 1;
              return (
                <div key={idx} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '10px', marginBottom: '8px', background: '#040404' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', fontSize: '11px', flexWrap: 'wrap' }}>
                    <span style={{ color: ACCENT }}>{s.n}</span>
                    <span style={{ color: /CLIMAX|drop|HOOK|PAYOFF/i.test(s.beat) ? ACCENT : 'rgba(255,255,255,0.6)' }}>{s.beat}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{s.time}</span>
                    {isLast && <span style={{ color: '#E8A33C' }}>🍸 martini shot</span>}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                      <button onClick={() => copyField((s.aiDesc ? 'AKCJA: ' + s.aiDesc + '\n' : '') + frame, 'shot' + idx)} style={{ ...btn(false), padding: '4px 9px', fontSize: '10px' }}>{copiedField === 'shot' + idx ? '✓ SKOPIOWANO' : 'KOPIUJ'}</button>
                      <button onClick={() => removeShot(idx)} title="usuń ujęcie" style={{ ...btn(false), padding: '4px 10px', fontSize: '12px', borderColor: '#E5484D', color: '#E5484D' }}>×</button>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '7px' }}>
                    {sel('size', SHOT_SIZES)}{sel('lens', LENSES)}{sel('angle', ANGLES)}{sel('light', LIGHTS)}{sel('move', MOVES)}{sel('time', TIMES)}
                  </div>
                  <div style={{ fontSize: '11px', color: ACCENT, marginBottom: '6px', lineHeight: 1.4 }}>🧑‍🏫 Po ludzku: {explainShot(s.params)}</div>
                  {s.aiDesc && <div style={{ fontSize: '12px', color: '#F4F4F2', background: 'rgba(40,224,123,0.08)', borderLeft: `2px solid ${ACCENT}`, padding: '6px 8px', marginBottom: '6px', lineHeight: 1.45 }}>🎬 AKCJA (AI): {s.aiDesc}</div>}
                  <div style={{ fontSize: '11.5px', color: 'rgba(236,236,236,0.72)', lineHeight: 1.45 }}>{frame}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '5px' }}>
                    🎥 ruch: {s.params.move}{s.params.speedRamp ? ' · SLOW-MO → speed ramp (120fps feel)' : ''}{s.params.physics ? ' · ' + s.params.physics : ''}
                    {s.cut ? <span style={{ color: 'rgba(255,255,255,0.4)' }}>{'  ·  ⏱ ' + s.cut}</span> : null}
                  </div>
                </div>
              );
            })}
            <button onClick={addShot} style={{ ...btn(true), marginTop: '4px' }}>+ DODAJ UJĘCIE</button>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>🎬 „That's a wrap!” — skopiuj każdy prompt przyciskiem KOPIUJ.</div>
          </Section>

          {/* ZADANIA */}
          <Section title="3 · LISTA ZADAŃ (krok po kroku)">
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', lineHeight: 1.7 }}>
              {pack.tasks.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </Section>

          {/* ROUTING */}
          <Section title="4 · ROUTING — co do jakiego generatora">
            {pack.routing.map(([what, where], i) => (
              <div key={i} style={{ fontSize: '12.5px', marginBottom: '4px' }}><span style={{ color: ACCENT }}>{what}</span> → {where}</div>
            ))}
          </Section>

          {/* EKONOMIA */}
          <Section title="5 · EKONOMIA (oszczędzanie tokenów)">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', lineHeight: 1.7 }}>
              {pack.economy.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </Section>

          <Section title="6 · PUŁAPKI — co może pójść nie tak">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', lineHeight: 1.7 }}>
              {(pack.pitfalls || []).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </Section>

          <div style={{ ...box, borderColor: ACCENT, marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
            ▸ Następny krok (osobno): „Twórczy fill AI" napisze realny tekst piosenki i barwne opisy ujęć w te szablony — już za bramką wydatków.
          </div>
        </div>
      )}

      {/* nav */}
      {step < 4 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px' }}>
          <button style={btn(false)} onClick={back} disabled={step === 0}>← WSTECZ</button>
          {step < 3
            ? <button style={btn(true)} onClick={next}>DALEJ →</button>
            : <button style={btn(true)} onClick={generate}>▣ ZBUDUJ PRODUCTION PACK</button>}
        </div>
      )}
      {step === 4 && (
        <div style={{ marginTop: '18px' }}>
          <button style={btn(false)} onClick={() => setStep(0)}>← EDYTUJ WYWIAD</button>
        </div>
      )}
    </div>
  );
}

const th = { padding: '5px 8px', fontWeight: 'normal', letterSpacing: '0.08em' };
const td = { padding: '6px 8px', verticalAlign: 'top' };

function Section({ title, children }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.12)', background: '#000', padding: '14px', marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '7px' }}>{title}</div>
      {children}
    </div>
  );
}

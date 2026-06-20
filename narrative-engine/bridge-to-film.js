// MOST: zatwierdzony rozdzial narracji -> Production Pack dla strony filmowej.
// Domyka rurociag: Decyzja -> Tekst -> Wizualizacja (Film).
const path = require('path');
const fs = require('fs');

function chapterToPack(s, chapterId) {
  const ch = s.chapters.find(c => c.id === chapterId);
  if (!ch) throw new Error('brak rozdzialu ' + chapterId);

  const lock = s.characters.characters.map(c => c.name + ' (' + c.lock + ')').join('; ');

  const elements = s.characters.characters.map((c, i) => ({
    id: 'EL' + (i + 1), name: c.name, type: c.role,
    refEN: c.refPrompt || ('character reference: ' + c.name), lock: c.lock,
  })).concat(s.world.locations.map((l, i) => ({
    id: 'LOC' + (i + 1), name: l.name, type: 'lokacja',
    refEN: 'location reference: ' + l.name + ' — ' + l.description, lock: 'stala paleta i swiatlo',
  })));

  const shots = ch.beats.map((b, i) => ({
    n: 'S' + (i + 1),
    scene: ch.sceneIds[i] || ('s' + (i + 1)),
    shot: b,
    geminiFrame: lock + '; ' + b + '; 16:9, cinematic, hyper-real, ' + (s.bible.tone || 'kinowy'),
    lumaMotion: 'powolny dolly-in, napiecie',
  }));

  return {
    source: 'narrative-engine',
    chapter: ch.id,
    title: s.bible.title + ' — ' + ch.title,
    logline: s.bible.logline,
    tone: s.bible.tone,
    wordCount: ch.wordCount || 0,
    elements, shots,
    tasks: [
      'Wygeneruj 1 arkusz referencyjny na element (Gemini).',
      'Kadry per ujecie w Gemini (kolumna geminiFrame).',
      'Kazdy kadr -> Luma: Start-Frame + komenda lumaMotion.',
      'Score/muzyka wg tonu: ' + (s.bible.tone || 'kinowy') + '.',
    ],
    economy: ['Gemini kadry -> Luma tylko ruch (x3-4 taniej).', 'Trzymaj elementy stale (lock).'],
  };
}

function writePack(pack) {
  const out = path.join(__dirname, 'output', 'pack-' + pack.chapter + '.json');
  fs.writeFileSync(out, JSON.stringify(pack, null, 2));
  return out;
}

// Opcjonalnie: wepchnij ujecia do zywej kolejki relaya (strona Story Engine / panel).
function pushToRelay(pack, wsUrl) {
  let WebSocket;
  try { WebSocket = require(path.join(__dirname, '..', 'agent', 'node_modules', 'ws')); }
  catch (e) { return Promise.resolve({ pushed: false, reason: 'brak modulu ws (zainstaluj w agent/)' }); }
  return new Promise((resolve) => {
    const ws = new WebSocket((wsUrl || 'ws://localhost:8765') + '?role=client');
    let sent = 0;
    ws.on('open', () => {
      pack.shots.forEach(sh => { ws.send(JSON.stringify({ type: 'generate_row', str: '[' + pack.chapter + ' ' + sh.n + '] ' + sh.geminiFrame })); sent++; });
      setTimeout(() => { try { ws.close(); } catch (e) {} resolve({ pushed: true, sent }); }, 600);
    });
    ws.on('error', () => resolve({ pushed: false, reason: 'relay niedostepny (uruchom server.js)' }));
  });
}

module.exports = { chapterToPack, writePack, pushToRelay };

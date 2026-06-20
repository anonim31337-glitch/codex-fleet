#!/usr/bin/env node
// ORKIESTRATOR (Rezyser) — Ksiazka-jako-Kod.
// Czyta stan z plikow, raportuje kompletnosc, generuje pytania, uruchamia audyt,
// i przerzuca zatwierdzony rozdzial mostem do strony filmowej.
//
// Uzycie:
//   node orchestrator.js status              -> przeglad stanu + kompletnosc + liczba problemow
//   node orchestrator.js ask [N]             -> nastepne N pytan rezyserskich (domyslnie 8)
//   node orchestrator.js audit               -> audyt spojnosci (logistyka/czas/ekwipunek)
//   node orchestrator.js bridge <chId> [--push]  -> rozdzial -> Production Pack (i opcjonalnie do relaya)

const lib = require('./lib');
const { nextQuestions } = require('./question-engine');
const { audit } = require('./continuity-audit');
const { chapterToPack, writePack, pushToRelay } = require('./bridge-to-film');

function completeness(s) {
  let filled = 0, total = 0;
  const check = (v) => { total++; if (v && String(v).trim()) filled++; };
  check(s.bible.title); check(s.bible.logline); check(s.bible.theme); check(s.bible.tone);
  s.bible.acts.forEach(a => check(a.summary));
  s.characters.characters.forEach(c => { check(c.appearance); check(c.wantNeed); check(c.arc); });
  s.world.locations.forEach(l => check(l.description));
  return { filled, total, pct: Math.round((filled / total) * 100) };
}

async function main() {
  const cmd = process.argv[2] || 'status';
  const s = lib.loadState();

  if (cmd === 'status') {
    const c = completeness(s);
    const issues = audit(s);
    const q = nextQuestions(s);
    console.log('\n=== NARRATIVE-ENGINE :: ' + (s.bible.title || '(bez tytulu)') + ' ===');
    console.log('Logline : ' + (s.bible.logline || '-'));
    console.log('Ton     : ' + (s.bible.tone || '-') + '  | Gatunek: ' + (s.bible.genre || '-'));
    console.log('Kompletnosc stanu: ' + c.pct + '%  (' + c.filled + '/' + c.total + ' pol)');
    console.log('Rozdzialy: ' + s.chapters.map(ch => ch.id + '[' + ch.status + ']').join(', '));
    console.log('Otwarte pytania : ' + q.length);
    console.log('Problemy spojnosci: ' + issues.filter(i => i.severity === 'ERROR').length + ' ERROR, ' + issues.filter(i => i.severity === 'WARN').length + ' WARN');
    console.log('');
    return;
  }

  if (cmd === 'ask') {
    const N = parseInt(process.argv[3], 10) || 8;
    const q = nextQuestions(s).slice(0, N);
    console.log('\n=== PYTANIA REZYSERSKIE (nastepne ' + q.length + ') ===');
    q.forEach(x => console.log('  [' + x.id + '] ' + x.question + '\n         pole: ' + x.field + '  (' + x.why + ')'));
    console.log('\n(Odpowiedzi zapisujemy do plikow state/* — recznie lub przez przyszly tryb "answer".)\n');
    return;
  }

  if (cmd === 'audit') {
    const issues = audit(s);
    console.log('\n=== AUDYT SPOJNOSCI ===');
    if (!issues.length) { console.log('  Brak problemow. Swiat jest spojny.\n'); return; }
    issues.forEach(i => console.log('  [' + i.severity + '/' + i.code + '] ' + i.msg));
    console.log('');
    return;
  }

  if (cmd === 'bridge') {
    const id = process.argv[3] || 'ch01';
    const pack = chapterToPack(s, id);
    const out = writePack(pack);
    console.log('\n=== MOST -> FILM ===');
    console.log('Rozdzial ' + id + ' -> Production Pack: ' + out);
    console.log('Elementy: ' + pack.elements.length + ' | Ujecia: ' + pack.shots.length);
    if (process.argv.includes('--push')) {
      const r = await pushToRelay(pack);
      console.log('Push do relaya: ' + JSON.stringify(r));
    }
    console.log('');
    return;
  }

  console.log('Uzycie: node orchestrator.js [status | ask [N] | audit | bridge <chId> [--push]]');
}

main();

// Adaptacyjny generator pytan rezyserskich: czyta STAN -> znajduje braki -> pyta.
// To NIE jest sztywny quiz 1000 pytan, tylko pytania rosnace ze stanem swiata.
function nextQuestions(s) {
  const q = [];
  let n = 1;
  const add = (field, question, why) => q.push({ id: 'Q' + (n++), field, question, why });

  // --- STORY BIBLE ---
  if (!s.bible.title) add('bible.title', 'Jaki jest tytul utworu?', 'brak tytulu');
  if (!s.bible.logline) add('bible.logline', 'Logline w 1 zdaniu: kto, czego chce, co stoi na drodze?', 'rdzen fabuly');
  if (!s.bible.theme) add('bible.theme', 'Jaki jest glowny motyw/temat?', 'spojnosc emocjonalna');
  s.bible.acts.forEach(a => { if (!a.summary) add('bible.acts.' + a.id, 'Co dzieje sie w akcie ' + a.id + ' (' + a.name + ')?', 'pusty akt'); });

  // --- POSTACIE ---
  s.characters.characters.forEach(c => {
    if (!c.appearance) add('char.' + c.id + '.appearance', 'Jak wyglada ' + (c.name || c.id) + '? (do referencji wizualnej)', 'brak refu wizualnego');
    if (!c.wantNeed) add('char.' + c.id + '.wantNeed', 'Czego CHCE, a czego naprawde POTRZEBUJE ' + (c.name || c.id) + '?', 'luk postaci');
    if (!c.arc) add('char.' + c.id + '.arc', 'Jak zmienia sie ' + (c.name || c.id) + ' przez historie?', 'luk postaci');
  });

  // --- SWIAT ---
  s.world.locations.forEach(l => { if (!l.description) add('loc.' + l.id + '.description', 'Opisz lokacje "' + (l.name || l.id) + '".', 'brak opisu lokacji'); });

  // --- GALAZ KREATYWNA (tu wejdzie mozg LLM: zaproponuje konkretne warianty do wyboru) ---
  add('creative.branch.actII', '[KREATYWNE] Jaka decyzja bohatera ma napedzic akt II? (LLM zaproponuje 3 warianty rozwidlenia)', 'rozwidlenie fabuly — wymaga mozgu LLM');

  return q;
}
module.exports = { nextQuestions };

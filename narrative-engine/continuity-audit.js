// Audyt spojnosci (deterministyczny): logistyka, czas, ekwipunek.
// Odpowiada na pytanie "czy postac A mogla dotrzec do punktu B w tym czasie".
function timeToMin(t) { const p = String(t).split(':').map(Number); return p[0] * 60 + (p[1] || 0); }

function audit(s) {
  const issues = [];
  const add = (severity, code, msg) => issues.push({ severity, code, msg });
  const order = s.timeline.sceneOrder || [];
  const idx = (id) => order.indexOf(id);

  // 1) NIEMOZLIWA PODROZ: kolejne polozenia tej samej postaci
  const byChar = {};
  s.locations.placements.forEach(p => { (byChar[p.characterId] = byChar[p.characterId] || []).push(p); });
  Object.keys(byChar).forEach(cid => {
    const ps = byChar[cid].slice().sort((a, b) => idx(a.sceneId) - idx(b.sceneId));
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1], b = ps[i];
      if (a.locationId === b.locationId) continue;
      const elapsed = timeToMin(b.atTime) - timeToMin(a.atTime);
      const need = s.timeline.travelMatrix[a.locationId + '-' + b.locationId];
      if (need != null && elapsed < need) {
        add('ERROR', 'TRAVEL', cid + ': z ' + a.locationId + ' do ' + b.locationId + ' trzeba ' + need + ' min, a uplynelo ' + elapsed + ' min (sceny ' + a.sceneId + ' -> ' + b.sceneId + ').');
      }
    }
  });

  // 2) EKWIPUNEK: uzyte przed zdobyciem / po utracie
  s.inventory.items.forEach(it => {
    (it.usedAtSceneIds || []).forEach(sid => {
      if (it.acquiredAtSceneId && idx(sid) < idx(it.acquiredAtSceneId))
        add('ERROR', 'INV_EARLY', '"' + it.name + '" uzyte w ' + sid + ' PRZED zdobyciem w ' + it.acquiredAtSceneId + '.');
      if (it.lostAtSceneId && idx(sid) > idx(it.lostAtSceneId))
        add('WARN', 'INV_LATE', '"' + it.name + '" uzyte w ' + sid + ' PO utracie w ' + it.lostAtSceneId + '.');
    });
  });

  // 3) POSTAC NIEZDEFINIOWANA: uzyta w timeline, brak w characters.json
  const defined = new Set(s.characters.characters.map(c => c.id));
  s.timeline.events.forEach(e => (e.characterIds || []).forEach(cid => {
    if (!defined.has(cid)) add('WARN', 'UNDEF_CHAR', 'Postac ' + cid + ' w evencie ' + e.id + ' nie jest zdefiniowana w characters.json.');
  }));

  return issues;
}
module.exports = { audit };

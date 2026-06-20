// Wspolne ladowanie/zapis stanu narracji (pliki, nie kontekst czatu).
const fs = require('fs');
const path = require('path');
const STATE = path.join(__dirname, 'state');

function readJSON(name) { return JSON.parse(fs.readFileSync(path.join(STATE, name), 'utf8')); }
function writeJSON(name, obj) {
  obj._meta = obj._meta || {};
  obj._meta.updated = new Date().toISOString();
  fs.writeFileSync(path.join(STATE, name), JSON.stringify(obj, null, 2));
}
function loadChapters() {
  const dir = path.join(STATE, 'chapters');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
function loadState() {
  return {
    bible: readJSON('story-bible.json'),
    characters: readJSON('characters.json'),
    world: readJSON('world.json'),
    inventory: readJSON('inventory_state.json'),
    locations: readJSON('location_data.json'),
    timeline: readJSON('timeline_audit.json'),
    chapters: loadChapters(),
  };
}
module.exports = { readJSON, writeJSON, loadState, STATE };

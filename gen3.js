import fs from 'fs';
import { buildProductionPack, packToMarkdown } from './frontend/src/engine.js';

const pack1 = buildProductionPack({
  title: 'Neon Ronin', genre: 'anime', format: 'short', subject: 'Samuraj z cyber-katamanką uciekający przed robotami', lengthSec: 15, tone: 'Cyberpunk, brutalnie, mrocznie', logline: 'Zbiegły ronin musi przedrzeć się przez neonowe slumsy, zanim odetną mu zasilanie.',
  insertFace: false, faceName: '', photoCount: 0,
  audioType: 'song', bpm: 140, vocalLang: 'JP', musicStyle: '', mood: 'Energetyczne, agresywne', instruments: 'Syntezatory, shamisen, perkusja drum and bass', musicWish: 'Ostro, cyberpunkowo',
  ratio: '9:16', res: '1080p', climaxSync: true, shotCount: '', tools: { higgsfield: false },
});

const pack2 = buildProductionPack({
  title: 'Cicha Piwnica', genre: 'horror', format: 'film', subject: 'Grupa znajomych znajduje stary magnetofon', lengthSec: 120, tone: 'Found footage, klaustrofobicznie', logline: 'Odtworzenie starej taśmy budzi w piwnicy coś, co naśladowało głosy ich zmarłych bliskich.',
  insertFace: true, faceName: 'Patryk', photoCount: 15,
  audioType: 'score', bpm: 60, vocalLang: '', musicStyle: '', mood: 'Mroczne, napięte', instruments: 'Wiolonczela, drone, piski, trzaski taśmy', musicWish: 'Dźwięki budujące niepokój, bez wyraźnej melodii',
  ratio: '16:9', res: '1080p', climaxSync: true, shotCount: '25', tools: { higgsfield: true },
});

const pack3 = buildProductionPack({
  title: 'Kawa z rana', genre: 'skecz', format: 'square', subject: 'Gość próbuje zrobić kawę, ale ekspres ma świadomość', lengthSec: 45, tone: 'Absurdalna komedia, slapstick', logline: 'Poranna rutyna zmienia się w walkę o przetrwanie z inteligentnym ekspresem do kawy.',
  insertFace: false, faceName: '', photoCount: 0,
  audioType: 'song', bpm: 110, vocalLang: 'PL', musicStyle: '', mood: 'Komicznie, lekko', instruments: 'Pianino, gwizdek, trąbka', musicWish: 'Styl muzyki z kreskówek, śmiesznie',
  ratio: '1:1', res: '720p', climaxSync: false, shotCount: '', tools: { higgsfield: false },
});

fs.writeFileSync('pack1.md', packToMarkdown(pack1));
fs.writeFileSync('pack2.md', packToMarkdown(pack2));
fs.writeFileSync('pack3.md', packToMarkdown(pack3));
console.log('Saved 3 packs');

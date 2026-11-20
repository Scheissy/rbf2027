#!/usr/bin/env node
// Erzeugt rbf-data.volume.test.js: großer, SYNTHETISCHER Testdatensatz mit realitätsnahen Verteilungen
// (ca. 400 Künstler, 560 Auftritte, 45 Venues, 12 Events, 35 Sound-Referenzen). Alles erfunden:
// Namen sind Zufallskombinationen aus Wortlisten, URLs zeigen auf example.org. Deterministisch (fester
// Seed): gleicher Lauf = gleiche Datei. test_volume_data.js prüft, dass die eingecheckte Datei dem Ergebnis
// dieses Skripts entspricht.
//
//   node build-volume-data.js            -> schreibt rbf-data.volume.test.js
//   require('./build-volume-data.js').build()  -> liefert den Dateiinhalt als String

const fs = require('fs');
const path = require('path');

const SEED = 20270915;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function build() {
  const rand = rng(SEED);
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const chance = p => rand() < p;
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const weighted = (items, weights) => { const tot = weights.reduce((a, b) => a + b, 0); let r = rand() * tot; for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; } return items[items.length - 1]; };

  const N_ARTISTS = 400, N_SHOWS = 560;
  const DAYS = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];
  const DAY_TOTALS = [110, 170, 170, 110];

  // ───────── Genres (echte Taxonomie, schiefe Verteilung) ─────────
  const GENRES = ['Indie', 'Pop', 'Alternative', 'Rock', 'Hip-Hop/Rap', 'Electronic/Live', 'Punk', 'Singer-Songwriter', 'Folk', "R'n'B/Soul", 'Heavy Metal', 'Electronic/DJ', 'Funk', 'Jazz', 'Global', 'Country'];
  const GENRE_W = [146, 145, 81, 65, 63, 33, 30, 28, 25, 22, 16, 9, 8, 8, 4, 4];
  function genresFor(i) {
    const n = i === 7 ? 3 : (chance(0.46) ? 1 : 2);   // genau ein Künstler mit drei Genres
    const pool = GENRES.slice(), w = GENRE_W.slice(), out = [];
    for (let k = 0; k < n; k++) { const g = weighted(pool, w); const ix = pool.indexOf(g); pool.splice(ix, 1); w.splice(ix, 1); out.push(g); }
    return out;
  }

  // ───────── Herkunft (deutsche Ländernamen, 51 verschiedene, ca. 9 % mit mehreren) ─────────
  const COUNTRIES = ['Deutschland', 'UK', 'USA', 'Schweden', 'Frankreich', 'Niederlande', 'Österreich', 'Dänemark', 'Norwegen', 'Kanada', 'Australien', 'Irland', 'Schweiz', 'Italien', 'Spanien', 'Belgien', 'Finnland', 'Island', 'Polen', 'Brasilien', 'Japan', 'Mexiko', 'Südkorea', 'Südafrika', 'Portugal', 'Ungarn', 'Tschechien', 'Griechenland', 'Neuseeland', 'Argentinien', 'Israel', 'Kroatien', 'Serbien', 'Rumänien', 'Ukraine', 'Türkei', 'Litauen', 'Estland', 'Lettland', 'Slowenien', 'Nigeria', 'Ghana', 'Senegal', 'Kap Verde', 'Kolumbien', 'Chile', 'Kuba', 'Indien', 'Libanon', 'Marokko', 'Zypern'];
  const COUNTRY_W = COUNTRIES.map((c, i) => (i === 0 ? 150 : Math.max(2, Math.round(60 / Math.pow(i, 0.85)))));

  // ───────── Namen (erfunden, mit Sonderfällen) ─────────
  const ADJ = ['Kupfer', 'Nebel', 'Silber', 'Stille', 'Wilde', 'Blaue', 'Rote', 'Leise', 'Ferne', 'Goldene', 'Eiserne', 'Lila', 'Graue', 'Trübe', 'Helle', 'Alte', 'Neue', 'Zarte', 'Raue', 'Tiefe', 'Schnelle', 'Bittere', 'Heitere', 'Stumme', 'Flüchtige', 'Verlorene', 'Gläserne', 'Schiefe', 'Zerbrochene', 'Windige', 'Cosmic', 'Velvet', 'Paper', 'Hollow', 'Neon', 'Midnight', 'Electric', 'Lazy', 'Wandering', 'Broken', 'Quiet', 'Savage', 'Pale', 'Crooked', 'Fading', 'Distant', 'Rusty', 'Gentle', 'Hungry', 'Salzige', 'Hölzerne', 'Samtene'];
  const NOUN = ['Fuchs', 'Anker', 'Laterne', 'Orbit', 'Wolke', 'Kompass', 'Nadel', 'Segel', 'Tinte', 'Mühle', 'Pegel', 'Krähe', 'Koffer', 'Fähre', 'Lotse', 'Möwe', 'Bahnhof', 'Spiegel', 'Funke', 'Kanal', 'Garten', 'Fenster', 'Turm', 'Brücke', 'Insel', 'Schatten', 'Echo', 'Radio', 'Planet', 'Karussell', 'Harbour', 'Lantern', 'Compass', 'Engine', 'Ghost', 'Orchard', 'Pilots', 'Choir', 'Parade', 'Signal', 'Satellites', 'Machine', 'Kingdom', 'Valley', 'Theory', 'Animals', 'Sailors', 'Gardens', 'Mirrors', 'Teppich', 'Kolibri', 'Gezeiten'];
  const SUFFIX = ['Kollektiv', 'Orchester', 'Club', 'Projekt', 'Trio', 'Quartett', 'Ensemble', 'Society'];
  const used = new Set(), names = [];
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const initials = s => s.split(/\s+/).map(w => w[0].toUpperCase()).join('.') + '.';
  function baseName() {
    const r = rand();
    if (r < 0.30) return `${pick(ADJ)} ${pick(NOUN)}`;
    if (r < 0.40) return pick(NOUN) + (chance(0.5) ? 'bau' : 'haus');
    if (r < 0.50) return `Die ${pick(ADJ)} ${pick(NOUN)}`;
    if (r < 0.58) return `${pick(ADJ)} ${pick(NOUN)} ${pick(SUFFIX)}`;
    if (r < 0.66) return `${pick(NOUN)} & ${pick(NOUN)}`;
    if (r < 0.72) return `The ${pick(ADJ)} ${pick(NOUN)}`;
    if (r < 0.77) return `Die ${pick(ADJ)} ${pick(NOUN)} der ${pick(NOUN)}`;
    if (r < 0.80) return `${pick(ADJ)} ${pick(NOUN)} und die ${pick(ADJ)} ${pick(NOUN)} ${pick(SUFFIX)}`;
    return pick(NOUN);
  }
  function addName(n) { const k = norm(n); if (used.has(k)) return false; used.add(k); names.push(n); return true; }
  const exact = new Set();
  // Feste Sonderfälle dürfen sich bewusst nur in Groß-/Kleinschreibung bzw. Akzent unterscheiden (Zufallsnamen nie)
  function addSpecial(n) { if (exact.has(n)) return; exact.add(n); used.add(norm(n)); names.push(n); }
  // feste Sonderfälle zuerst (Reihenfolge = Position in der Liste, deterministisch)
  ['3 Takte Gegenwind', 'Ox', 'ÄÄ', 'Oi Polloi Nord', 'DJ Zwielicht', 'MC Kellerlicht', 'DJ Nordwind', 'The Salzige Lampen',
   'F.U.C.H.S.', 'S.O.S. (Live!)', 'Nachtfähre?', 'Zeit·Echo', 'Σ Kollektiv', 'Wetter: wechselhaft', 'Ja/Nein Orchester', "Anker's Erben", "Möwe's Kinder", "Lotse's Radio", 'Turm 77', 'Kanal 5', 'Planet 9 Club', 'Orbit (Reprise)', 'Fenster (Akustik)', 'Funke & Söhne (Live)', 'Café Zwielicht', 'Mélange Ozéan', 'Éclat Noir', 'Señor Pegel',
   'Vesper Echo', 'VESPER ECHO', 'Glühlampe', 'Gluhlampe', 'Cafe Zwielicht'].forEach(addSpecial);
  while (names.length < N_ARTISTS) {
    let n = baseName();
    const r = rand();
    if (r < 0.14) n = n.toUpperCase();
    else if (r < 0.21) n = n.toLowerCase();
    if (n.length > 44) n = n.slice(0, 44).trim();
    addName(n);
  }
  // Reihenfolge der Künstlerliste mischen (die Sonderfälle nicht alle vorn), aber deterministisch
  shuffle(names);

  const slug = (n, i) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `act-${i}`;
  const slugSeen = new Set();
  const RAW = names.map((name, i) => {
    const genres = i === 0 ? ['Hip-Hop/Rap', 'Funk'] : genresFor(i);
    let herk = [weighted(COUNTRIES, COUNTRY_W)];
    if (chance(0.09)) { const extra = chance(0.1) ? 3 : (chance(0.3) ? 2 : 1); while (herk.length < 1 + extra) { const c = weighted(COUNTRIES, COUNTRY_W); if (!herk.includes(c)) herk.push(c); } }
    const gender = weighted(['männlich', 'weiblich', 'mixed', 'divers'], [35, 35, 29.5, 0.5]);
    let s = slug(name, i); if (slugSeen.has(s)) s += `-${i}`; slugSeen.add(s);
    const row = [name, genres.join(' / '), herk.join(' / '), gender, `https://example.org/artist/${s}`];
    if (i % 80 === 3) row.push(`https://www.discogs.com/artist/${100000 + i}-${s}`);
    return row;
  });
  // Abdeckung sichern: alle 16 Genres und alle 51 Länder kommen vor (selten genutzte notfalls nachziehen)
  GENRES.forEach(g => { if (!RAW.some(r => r[1].split(' / ').includes(g))) { RAW[ri(50, N_ARTISTS - 1)][1] = g; } });
  COUNTRIES.forEach(c => { if (!RAW.some(r => r[2].split(' / ').includes(c))) { RAW[ri(50, N_ARTISTS - 1)][2] = c; } });
  // ein paar Künstler mit identischem Genre-Muster bewusst unverändert lassen; zwei Namenspaare aus den Sonderfällen bleiben

  // ───────── Venues ─────────
  const VENUE_NAMES = [
    'Elbwerft', 'Elbwerft Bar', 'Kiezkeller', 'Kiezkeller/Hof', 'Mole', 'Mole Terrasse', 'Festivalbus Linie 7',
    'Hafenkran Halle', 'Zum goldenen Anker', 'Bühne am Kai®', 'Café Süd & Söhne', 'Jazz@Sternwarte (Saal 2)', "Rock'n'Roll Garage", 'Ü-Bunker Nr. 3',
    'Theater am Strom®', 'Gängeviertel Hof', 'Alte Druckerei (Keller)', 'Schiffsbauhalle Nord', 'Lagerhaus 12 @ Hafen', 'Kulturpalast Altona',
    'Sternschanze Open Air', 'Trommelfell', 'Kaffeerösterei Bühne', 'Fischmarkt Halle B', 'Dachterrasse Ost', 'Rathaus-Café (Foyer)',
    'Spielbudenplatz Pavillon', 'Heimathafen Neukölln-Süd (Saal)', 'St. Georg Kapelle', 'Werkstatt 5', 'Planten un Blomen Muschel',
    'Container Club', 'Großer Saal im Gewerkschaftshaus (Altbau)', 'Café Ägäis', 'Boulevard Bühne Reeperbahn Mitte (Nord)', 'Fabrik-Etage 3', 'Wasserturm Terrasse',
    'Kellerbühne Gänsemarkt', 'Pier 9 Bar', "Mama Lou's Living Room", 'Bunker-Arena', 'Kaispeicher Foyer', 'Schuppen 52', 'Seemannsheim Saal', 'Tiefgarage Eins',
  ];
  const venues = VENUE_NAMES.slice(0, 45);
  const VENUE_LOCATIONS = {};
  venues.forEach((v, i) => {
    const lat = +(53.5370 + rand() * 0.0300).toFixed(6), lng = +(9.9500 + rand() * 0.0600).toFixed(6);
    VENUE_LOCATIONS[v] = { lat, lng, address: `${pick(['Hafenstraße', 'Große Freiheit', 'Seilerstraße', 'Davidstraße', 'Neuer Pferdemarkt', 'Bernhard-Nocht-Straße', 'Holstenstraße', 'Schulterblatt'])} ${ri(1, 99)}, 2${ri(0, 9)}${ri(0, 9)}${ri(0, 9)}${ri(0, 9)} Hamburg`.replace(/, 2(\d{4})/, ', 20$1').slice(0, 80) };
  });
  // Venue-Verteilung: größte 38, kleinste 2, Summe N_SHOWS (schief)
  function venueCounts() {
    const n = venues.length;
    let lo = 0.5, hi = 6, c;
    for (let it = 0; it < 60; it++) {
      const p = (lo + hi) / 2;
      c = Array.from({ length: n }, (_, i) => 2 + 36 * Math.pow((n - 1 - i) / (n - 1), p));
      const sum = c.reduce((a, b) => a + b, 0);
      if (sum > N_SHOWS) lo = p; else hi = p;
    }
    c = c.map(Math.round);
    let diff = N_SHOWS - c.reduce((a, b) => a + b, 0), k = 3;
    while (diff !== 0) { const step = diff > 0 ? 1 : -1; if (c[k] + step >= 3 && c[k] + step <= 37) { c[k] += step; diff -= step; } k = 3 + ((k - 3 + 1) % (n - 6)); }
    return c;
  }
  const vCounts = venueCounts();

  // ───────── Auftritte: Muster je Künstler ─────────
  // 260 mit 1 Auftritt, 120 mit 2 (70 am selben Tag, 50 an verschiedenen Tagen), 20 mit 3 (an drei Tagen)
  const order = shuffle(Array.from({ length: N_ARTISTS }, (_, i) => i));
  const plan = new Array(N_ARTISTS);
  order.forEach((a, k) => { plan[a] = k < 260 ? 'single' : (k < 330 ? 'sameDay' : (k < 380 ? 'twoDays' : 'threeDays')); });
  plan[RAW.findIndex(r => r[0] === 'Ox')] = 'single';
  const cap = DAY_TOTALS.slice();
  const dayOf = []; // [artistIdx, dayIdx]
  const take = (a, d) => { cap[d]--; dayOf.push([a, d]); };
  const needDays = (n) => DAYS.map((_, d) => d).filter(d => cap[d] >= n);
  const dayW = d => cap[d];
  RAW.forEach((_, a) => {
    if (plan[a] === 'sameDay') { const ds = needDays(2); const d = weighted(ds, ds.map(dayW)); take(a, d); take(a, d); }
    else if (plan[a] === 'twoDays') { const first = weighted(needDays(1), needDays(1).map(dayW)); const rest = needDays(1).filter(d => d !== first); const second = weighted(rest, rest.map(dayW)); take(a, first); take(a, second); }
    else if (plan[a] === 'threeDays') { const ds = shuffle(needDays(1)).slice(0, 3); ds.forEach(d => take(a, d)); }
  });
  RAW.forEach((_, a) => { if (plan[a] === 'single') { const ds = needDays(1); take(a, weighted(ds, ds.map(dayW))); } });
  if (dayOf.length !== N_SHOWS || cap.some(c => c !== 0)) throw new Error('Tagesverteilung geht nicht auf: ' + JSON.stringify({ n: dayOf.length, cap }));

  // Venues je Tag verteilen (größter Rest), dann je Auftritt zuweisen
  const venueTokensByDay = DAYS.map(() => []);
  vCounts.forEach((cnt, v) => {
    const raw = DAY_TOTALS.map(t => cnt * t / N_SHOWS), base = raw.map(Math.floor);
    let rest = cnt - base.reduce((a, b) => a + b, 0);
    raw.map((x, d) => [x - Math.floor(x), d]).sort((x, y) => y[0] - x[0] || x[1] - y[1]).forEach(([, d]) => { if (rest > 0) { base[d]++; rest--; } });
    base.forEach((b, d) => { for (let k = 0; k < b; k++) venueTokensByDay[d].push(v); });
  });
  // Tokenzahl je Tag muss der Tagessumme entsprechen: sonst auffüllen/kürzen
  venueTokensByDay.forEach((tok, d) => { while (tok.length < DAY_TOTALS[d]) tok.push(ri(0, venues.length - 1)); while (tok.length > DAY_TOTALS[d]) tok.splice(ri(0, tok.length - 1), 1); shuffle(tok); });

  // ───────── Zeiten ─────────
  const MIN_W = { 0: 30, 30: 24, 15: 8, 45: 8, 20: 5, 40: 5, 10: 4, 50: 4, 5: 2, 25: 3, 35: 3, 55: 2 };
  const DUR = [15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90], DUR_W = [5, 6, 10, 30, 10, 15, 12, 4, 5, 2, 1];
  const HOUR_W = { 14: 3, 15: 5, 16: 8, 17: 11, 18: 13, 19: 14, 20: 15, 21: 14, 22: 12, 23: 19, 24: 2 };
  const startMinute = () => { const h = +weighted(Object.keys(HOUR_W), Object.values(HOUR_W)); const m = +weighted(Object.keys(MIN_W), Object.values(MIN_W)); return h * 60 + m; };
  const venueBusy = DAYS.map(() => venues.map(() => []));
  const artistBusy = new Map();
  const overlaps = (list, s, e, buf) => list.some(([s2, e2]) => s < e2 + buf && s2 < e + buf);
  const shows = [];
  const tokPos = DAYS.map(() => 0);
  const MARATHON = RAW.findIndex(r => r[0] === 'Ox');   // der eine Auftritt über 3 Stunden
  // Phase 1: Venue und Dauer je Auftritt festlegen; Phase 2: die längsten zuerst einplanen (dichte Venues gehen so auf)
  const items = shuffle(dayOf.slice()).map(([a, d]) => {
    const v = venueTokensByDay[d][tokPos[d]++];
    return { a, d, v, dur: a === MARATHON ? 240 : weighted(DUR, DUR_W) };
  });
  items.map((it, k) => [it, k]).sort((x, y) => y[0].dur - x[0].dur || x[1] - y[1]).forEach(([it]) => {
    const { a, d, v, dur } = it;
    const key = `${a}|${d}`;
    const aBusy = artistBusy.get(key) || [];
    const vBusy = venueBusy[d][v];
    let s = null;
    for (let tries = 0; tries < 600 && s === null; tries++) {
      const cand = startMinute();
      const buf = tries < 400 ? 70 : 20;
      if (!overlaps(vBusy, cand, cand + dur, 10) && !overlaps(aBusy, cand, cand + dur, buf)) s = cand;
    }
    if (s === null) { for (let cand = 13 * 60; cand < 27 * 60 && s === null; cand += 5) if (!overlaps(vBusy, cand, cand + dur, 10) && !overlaps(aBusy, cand, cand + dur, 20)) s = cand; }
    if (s === null) { for (let cand = 13 * 60; cand < 28 * 60 && s === null; cand += 5) if (!overlaps(vBusy, cand, cand + dur, 0) && !overlaps(aBusy, cand, cand + dur, 0)) s = cand; }
    if (s === null) throw new Error('keine freie Zeit gefunden');
    vBusy.push([s, s + dur]); aBusy.push([s, s + dur]); artistBusy.set(key, aBusy);
    shows.push({ a, d, v, s, e: s + dur });
  });
  const hhmm = m => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
  shows.sort((x, y) => x.d - y.d || x.s - y.s || x.v - y.v || x.a - y.a);
  let nid = 10986;
  const RAW_AUFTRITTE = shows.map(x => { nid += ri(1, 9); return [RAW[x.a][0], DAYS[x.d], hhmm(x.s), hhmm(x.e), venues[x.v], nid]; });

  // ───────── Events, Anchor, Sound-Referenzen ─────────
  const EVT_SONST = ['Konferenz: Zukunft der Bühne', 'Panel: Kleine Clubs, große Wirkung', 'Workshop: Booking für Anfänger', 'Talk: Streaming und Fairness', 'Meet & Greet im Foyer', 'Podcast live: Die Nachtschicht', 'Netzwerk-Frühstück', 'Kiez-Rundgang (Führung)', 'Lesung: Briefe aus dem Backstage', 'Kinoabend: Doku über Hafenmusik', 'Diskussion: Nachhaltig touren'];
  const RBF_EVENTS = EVT_SONST.map((name, i) => {
    const d = [0, 1, 1, 2, 2, 1, 2, 3, 1, 2, 3][i], s = [11, 12, 15, 14, 11, 17, 9, 12, 16, 22, 13][i] * 60 + [0, 30, 0, 0, 0, 15, 30, 0, 45, 0, 30][i];
    return { name, day: DAYS[d], time: hhmm(s), endTime: hhmm(s + [60, 75, 90, 60, 45, 60, 90, 90, 45, 120, 60][i]), location: venues[[8, 17, 22, 31, 24, 12, 16, 9, 19, 28, 40][i]], acts: [], kategorie: 'Sonstiges', url: `https://example.org/event/${slug(name, i)}` };
  });
  const evActs = shuffle(RAW.map(r => r[0]).slice()).slice(0, 6);
  RBF_EVENTS.splice(4, 0, { name: 'Anchor Award Show (Showcase)', day: 'Fr 17.09', time: '19:00', endTime: '21:00', location: venues[1], acts: evActs, kategorie: 'Musik', url: 'https://example.org/event/anchor-award-showcase' });
  const ANCHOR = shuffle(RAW.map(r => r[0]).slice()).slice(0, 6);

  const TYP = ['Kraftvoller', 'Verträumter', 'Treibender', 'Melancholischer', 'Tanzbarer', 'Roher', 'Zarter', 'Hymnischer', 'Verspielter', 'Düsterer'];
  const STIL = ['Gitarrenpop', 'Elektro-Folk', 'Postpunk', 'Soul-Pop', 'Noise-Rock', 'Synth-Wave', 'Rap mit Jazz-Einschlag', 'Indie-Rock', 'Songwriter-Balladen', 'Club-Elektronik'];
  const MIT = ['großen Refrains', 'warmen Bläsern', 'sparsamer Instrumentierung', 'treibenden Bässen', 'mehrstimmigem Gesang', 'schrägen Harmonien', 'viel Hall', 'Live-Energie'];
  const artistNames = RAW.map(r => r[0]);
  const refActs = shuffle(artistNames.slice()).slice(0, 71);
  const sizes = [...Array(17).fill(1), ...Array.from({ length: 18 }, (_, i) => [2, 2, 2, 3, 3, 2, 4, 3, 2, 3, 3, 2, 4, 4, 3, 7, 2, 3][i])];
  let cursor = 0;
  const SOUND_REFERENCES = sizes.map((sz, i) => {
    const acts = []; for (let k = 0; k < sz; k++) acts.push(refActs[(cursor++) % refActs.length]);
    return { referenz: [`Vorbild ${String(i + 1).padStart(2, '0')}`], kategorie: `${TYP[i % TYP.length]} ${STIL[(i * 3) % STIL.length]} mit ${MIT[(i * 5) % MIT.length]}`, acts: [...new Set(acts)] };
  });
  SOUND_REFERENCES[20].acts.push(SOUND_REFERENCES[3].acts[0]);   // genau ein Act in zwei Kategorien
  SOUND_REFERENCES[20].acts = [...new Set(SOUND_REFERENCES[20].acts)];

  // ───────── Ausgabe ─────────
  const lines = [];
  const j = x => JSON.stringify(x);
  lines.push('// ── SYNTHETISCHER GROSS-DATENSATZ (rbf-data.volume.test.js) ────────────────────');
  lines.push('// GENERIERT von build-volume-data.js (fester Seed) - NICHT von Hand ändern, sondern das Skript anpassen');
  lines.push('// und neu erzeugen: node build-volume-data.js. KEINE echten Daten: Namen sind Zufallskombinationen aus');
  lines.push('// Wortlisten, alle URLs zeigen auf example.org. Profil: ca. 400 Künstler, 560 Auftritte (Mi 110 / Do 170 /');
  lines.push('// Fr 170 / Sa 110), 45 Venues mit schiefer Verteilung (größte ca. 37, kleinste 2 Auftritte), 12 Events, 35 Sound-Referenzen.');
  lines.push('');
  lines.push("const DATA_VERSION = 'volume-1';");
  lines.push('');
  lines.push(`const DAY_ORDER = ${j(DAYS).replace(/","/g, "', '").replace('["', "['").replace('"]', "']")};`);
  lines.push('');
  lines.push('// [Name, Genre, Herkunft, Geschlecht, RBF-Link, (Discogs-Link)]');
  lines.push('const RAW = [');
  RAW.forEach(r => lines.push(`  ${j(r)},`));
  lines.push('];');
  lines.push('');
  lines.push('// [Name, Tag, Zeit, Ende, Location, nid]');
  lines.push('const RAW_AUFTRITTE = [');
  RAW_AUFTRITTE.forEach(r => lines.push(`  ${j(r)},`));
  lines.push('];');
  lines.push('');
  lines.push('const VENUE_LOCATIONS = {');
  Object.entries(VENUE_LOCATIONS).forEach(([k, v]) => lines.push(`  ${j(k)}: ${j(v)},`));
  lines.push('};');
  lines.push('');
  lines.push(`const ANCHOR_AWARD_NOMINEES = ${j(ANCHOR)};`);
  lines.push('');
  lines.push('const SOUND_REFERENCES = [');
  SOUND_REFERENCES.forEach(r => lines.push(`  ${j(r)},`));
  lines.push('];');
  lines.push('');
  lines.push('const RBF_EVENTS = [');
  RBF_EVENTS.forEach(r => lines.push(`  ${j(r)},`));
  lines.push('];');
  return lines.join('\n') + '\n';
}

module.exports = { build, SEED };
if (require.main === module) {
  const out = path.join(__dirname, 'rbf-data.volume.test.js');
  fs.writeFileSync(out, build(), 'utf-8');
  console.log('geschrieben:', out, `(${fs.statSync(out).size} Bytes)`);
}

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadApp, createChecker } = require('./test-helpers');

// Künstler-Übersicht mit dem großen synthetischen Datensatz (400 Künstler, rbf-data.volume.test.js):
// vollständige Ausgabe, Sortierung, Suche, Genre-/Herkunftsfilter und deren Kombination gegen eine
// unabhängige Berechnung aus den Rohdaten, dazu einfache Zeitgrenzen (großzügig, gegen Ausreißer).
const FILE = path.join(__dirname, 'rbf-data.volume.test.js');
const LIMIT_RENDER_MS = 8000;    // pro Render
const LIMIT_TOTAL_MS = 60000;    // alle Filter-/Such-Renders zusammen

(async () => {
  const t = createChecker();
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FILE, 'utf-8') + ';this.RAW = RAW;', ctx);
  const RAW = Array.from(ctx.RAW).map(r => Array.from(r));
  const D = RAW.map(r => ({ name: r[0], genre: r[1], herkunft: r[2] }));
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tags = v => v.split(' / ');

  const { window: w, document: d, errors } = await loadApp({ dataPath: FILE, trackErrors: true });
  const ev = c => w.eval(c);
  const arr = x => Array.from(x);
  let totalMs = 0, maxMs = 0;
  const renderK = () => { const t0 = Date.now(); w.render(); const ms = Date.now() - t0; totalMs += ms; maxMs = Math.max(maxMs, ms); };
  const rowNames = () => arr(d.querySelectorAll('#artistList .artist-row .artist-name')).map(e => e.textContent.replace(/\s+/g, ' ').trim());
  const reset = () => { d.getElementById('search').value = ''; ev("selectedGenres.clear(); document.getElementById('fHerkunft').value = ''; sortCol = 'name'; sortDir = 1;"); };
  // Alle erwarteten Namen kommen vor (Zeilentext = Name + Badges) und es gibt genau so viele Zeilen
  const sameNames = (expected) => { const dom = rowNames(); return dom.length === expected.length && expected.every(n => dom.some(x => x.startsWith(n))); };

  reset();
  renderK();

  // ───────── 1) Vollständige Ausgabe, Sortierung ─────────
  t.check('Alle 400 Künstler stehen als Zeilen in der Liste (keine Kürzung, kein Nachladen).', d.querySelectorAll('#artistList .artist-row').length === 400, d.querySelectorAll('#artistList .artist-row').length);
  const expectedAsc = D.map(x => x.name).sort((a, b) => a.localeCompare(b, 'de'));
  const domAsc = rowNames();
  t.check('Standard-Sortierung nach Namen (de): Reihenfolge stimmt für alle 400 mit der unabhängig sortierten Liste überein.', domAsc.every((n, i) => n.startsWith(expectedAsc[i])), domAsc.findIndex((n, i) => !n.startsWith(expectedAsc[i])));
  ev("sortDir = -1;"); renderK();
  const domDesc = rowNames();
  t.check('Absteigend sortiert: genau die umgekehrte Reihenfolge.', domDesc.every((n, i) => n.startsWith(expectedAsc[399 - i])));
  reset(); renderK();

  // ───────── 2) Suche ─────────
  const expectSearch = q => D.filter(x => { const nq = norm(q); return norm(x.name).includes(nq) || norm(x.genre).includes(nq) || norm(x.herkunft).includes(nq); }).map(x => x.name);
  const queries = ['kupfer', 'ä', 'hip-hop/rap', 'schweden', 'the ', 'dj ', '(', '·', 'σ', 'nachtfahre', 'ox', 'electronic/live', 'a', 'zzzzqq', ''];
  const failedQueries = [];
  queries.forEach(q => { d.getElementById('search').value = q; renderK(); if (!sameNames(expectSearch(q))) failedQueries.push([q, expectSearch(q).length, rowNames().length]); });
  t.check(`Suche stimmt bei ${queries.length} Suchbegriffen mit der unabhängigen Berechnung überein (Namen, Genre, Herkunft; Akzente/Groß-Klein egal).`, failedQueries.length === 0, failedQueries);
  d.getElementById('search').value = 'zzzzqq'; renderK();
  t.check('Suche ohne Treffer: keine Zeilen.', d.querySelectorAll('#artistList .artist-row').length === 0);
  reset(); renderK();

  // ───────── 3) Genre-Filter ─────────
  const taxonomy = ['Indie', 'Pop', 'Alternative', 'Rock', 'Hip-Hop/Rap', 'Electronic/Live', 'Punk', 'Singer-Songwriter', 'Folk', "R'n'B/Soul", 'Heavy Metal', 'Electronic/DJ', 'Funk', 'Jazz', 'Global', 'Country'];
  const genreResults = taxonomy.map(g => { w.toggleGenreSelection(g); renderK(); const exp = D.filter(x => tags(x.genre).includes(g)).map(x => x.name); const ok = sameNames(exp); w.toggleGenreSelection(g); return [g, exp.length, ok]; });
  t.check('Genre-Filter: für alle 16 Genres stimmt die Zeilenzahl und die Namen (Mehrfach-Genres zählen bei jedem ihrer Genres).', genreResults.every(r => r[2]), genreResults.filter(r => !r[2]));
  t.check('Die Genre-Filter sind trennscharf: Indie > Pop > Alternative sind die größten, Country/Jazz/Global die kleinsten.', genreResults.find(r => r[0] === 'Indie')[1] > genreResults.find(r => r[0] === 'Alternative')[1] && genreResults.find(r => r[0] === 'Jazz')[1] < 10 && genreResults.find(r => r[0] === 'Country')[1] < 10, genreResults.map(r => r.slice(0, 2).join(':')).join(' '));
  w.toggleGenreSelection('Indie'); w.toggleGenreSelection('Pop'); renderK();
  t.check('Mehrfachauswahl Indie + Pop: Vereinigung (ein Künstler mit beiden nur einmal).', sameNames(D.filter(x => tags(x.genre).some(g => g === 'Indie' || g === 'Pop')).map(x => x.name)));
  reset(); renderK();
  t.check('Genre-Liste der App: 16 ganze Labels, alphabetisch.', JSON.stringify(arr(ev('allGenreTags'))) === JSON.stringify([...taxonomy].sort((a, b) => a.localeCompare(b, 'de'))));

  // ───────── 4) Herkunft, Kombination ─────────
  const opts = arr(d.querySelectorAll('#fHerkunft option')).map(o => o.value).filter(Boolean);
  t.check('Herkunfts-Auswahl: 51 einzelne Länder, nie eine Kombination mit " / ".', opts.length === 51 && opts.every(o => !o.includes(' / ')), opts.length);
  const herkResults = ['Deutschland', 'Schweden', 'Kap Verde', 'UK'].map(c => { ev(`document.getElementById('fHerkunft').value = ${JSON.stringify(c)}`); renderK(); const exp = D.filter(x => tags(x.herkunft).includes(c)).map(x => x.name); return [c, exp.length, sameNames(exp)]; });
  t.check('Herkunftsfilter: Deutschland, Schweden, Kap Verde und UK stimmen (auch Künstler mit mehreren Ländern).', herkResults.every(r => r[2]), herkResults);
  reset();
  d.getElementById('search').value = 'a'; w.toggleGenreSelection('Indie'); ev("document.getElementById('fHerkunft').value = 'Deutschland'"); renderK();
  const combo = D.filter(x => norm(x.name + '|' + x.genre + '|' + x.herkunft).includes('a') && (norm(x.name).includes('a') || norm(x.genre).includes('a') || norm(x.herkunft).includes('a')) && tags(x.genre).includes('Indie') && tags(x.herkunft).includes('Deutschland')).map(x => x.name);
  t.check('Suche + Genre + Herkunft zusammen verknüpft die Filter mit UND.', sameNames(combo) && combo.length > 5, combo.length);
  reset(); renderK();

  // ───────── 5) Zeit und Fehler ─────────
  t.check(`Zeitgrenze: kein einzelner Render über ${LIMIT_RENDER_MS / 1000} s (größter: ${maxMs} ms), alle zusammen unter ${LIMIT_TOTAL_MS / 1000} s (${totalMs} ms).`, maxMs < LIMIT_RENDER_MS && totalMs < LIMIT_TOTAL_MS, { maxMs, totalMs });
  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

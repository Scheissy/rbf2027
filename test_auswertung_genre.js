const { loadApp, reloadWithState, createChecker, auswBlock: block } = require('./test-helpers');

// Testdaten (rbf-data.test.js), nid -> Künstler/Genre:
//  1 Nova Frequenz "Electro / Pop" (Mi) | 4 Rosa Mercur "Pop" (Do)
//  2 Stahl & Beton "Techno" (Mi)        | 11 DJ Mitternacht "Techno / House" (Sa)
//  evt-1 RBF Podcast Live (Sonstiges-Event, kein Genre)

const genreRow = (d, name) => [...block(d).querySelectorAll('.ausw-genre')].find(r => r.querySelector('.ausw-loc-head > span:first-child').textContent === name);
const genreNames = d => [...block(d).querySelectorAll('.ausw-genre > .ausw-loc-head > span:first-child')].map(e => e.textContent).join(' | ');
const kpis = d => [...block(d).querySelectorAll('.ausw-kpi')].slice(0, 3).map(k => k.querySelector('.ausw-kpi-val').textContent);
const detailOf = row => row.querySelector('.ausw-expand-detail');
const itemLines = detail => [...detail.querySelectorAll('.ausw-expand-item')].map(el => el.textContent.replace(/\s+/g, ' ').trim());

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  w.setShowDuration('x', 'nid:1', '30'); // Nova Frequenz - Electro / Pop
  w.setShowRating('x', 'nid:4', 4);      // Rosa Mercur - Pop
  w.setShowDuration('x', 'nid:2', '20'); // Stahl & Beton - Techno
  w.setShowRating('x', 'nid:11', 5);     // DJ Mitternacht - Techno / House
  w.setShowDuration('x', 'nid:evt-1', '10'); // RBF Podcast Live - Event, kein Genre
  w.switchTab('auswertung');

  // ── 1) Genre-Abschnitt ist vorhanden und listet die einzelnen Tags ──────
  t.check('Es gibt einen "🎵 Genres"-Abschnitt.', block(d).textContent.includes('🎵 Genres'));
  t.check('"Electro / Pop" wird in EINZELNE Genres zerlegt: sowohl "Pop" als auch "Electro" erscheinen als eigene Zeilen (nicht als ein zusammengesetztes Genre).',
    !!genreRow(d, 'Pop') && !!genreRow(d, 'Electro') && !genreRow(d, 'Electro / Pop'), genreNames(d));

  // ── 2) Mehrfachzuordnung: Nova Frequenz zählt bei Pop UND bei Electro ───
  t.check('"Pop" hat 2 Auftritte (Nova Frequenz + Rosa Mercur).', genreRow(d, 'Pop').getAttribute('data-count') === '2');
  t.check('"Techno" hat 2 Auftritte (Stahl & Beton + DJ Mitternacht).', genreRow(d, 'Techno').getAttribute('data-count') === '2');
  t.check('"Electro" hat 1 Auftritt (nur Nova Frequenz, aber eben ZUSÄTZLICH zu "Pop" gezählt).', genreRow(d, 'Electro').getAttribute('data-count') === '1');
  t.check('"House" hat 1 Auftritt (nur DJ Mitternacht, zusätzlich zu "Techno" gezählt).', genreRow(d, 'House').getAttribute('data-count') === '1');

  // ── 3) Die Summe der Genre-Häufigkeiten übersteigt bewusst die Anzahl
  // besuchter Auftritte - genau das ist die "separate Auswertung wie beim
  // Filtern". Die KPI oben bleibt davon unberührt (zählt jeden Auftritt nur 1x).
  const genreCounts = [...block(d).querySelectorAll('.ausw-genre')].map(r => +r.getAttribute('data-count'));
  const sumGenreCounts = genreCounts.reduce((a, b) => a + b, 0);
  t.check('Summe aller Genre-Häufigkeiten (7) übersteigt die Anzahl besuchter Auftritte (5) - Mehrfachzählung ist beabsichtigt.',
    sumGenreCounts === 7, { sumGenreCounts, genreCounts });
  t.check('Die KPI "Auftritte besucht" bleibt unverändert bei 5 (zählt jeden Auftritt nur einmal).', kpis(d)[0] === '5', kpis(d));

  // ── 4) Events ohne Genre landen unter "Ohne Genre" ──────────────────────
  t.check('Das Event "RBF Podcast Live" (kein Genre) erscheint unter "Ohne Genre".', !!genreRow(d, 'Ohne Genre'));
  const ohneGenreDetail = itemLines(detailOf(genreRow(d, 'Ohne Genre')));
  t.check('"Ohne Genre" listet beim Aufklappen genau das Event auf.',
    ohneGenreDetail.length === 1 && ohneGenreDetail[0].includes('RBF Podcast Live'), ohneGenreDetail);

  // ── 5) Reihenfolge bei Häufigkeit: Gleichstand (Pop/Techno je 2) wird
  // über die Gesamtdauer entschieden (Pop: 30 Min, Techno: 20 Min).
  t.check('Bei Gleichstand (Pop/Techno je 2×) entscheidet die Gesamtdauer: Pop (30 Min) vor Techno (20 Min).',
    genreNames(d).indexOf('Pop') < genreNames(d).indexOf('Techno'), genreNames(d));

  // ── 6) Aufklappen zeigt die zugrunde liegenden Auftritte ────────────────
  genreRow(d, 'Pop').querySelector('.ausw-loc-head').click();
  const popLines = itemLines(detailOf(genreRow(d, 'Pop')));
  t.check('"Pop" listet beim Aufklappen Nova Frequenz UND Rosa Mercur auf.',
    popLines.length === 2 && popLines.some(l => l.includes('Nova Frequenz')) && popLines.some(l => l.includes('Rosa Mercur')), popLines);

  // ── 7) Genre-Liste folgt demselben Sortier-Umschalter wie Locations ─────
  d.querySelector('.ausw-sort-btn[data-sort="rating"]').click();
  // Ø Pop = (4)/1 = 4.0 (nur Rosa Mercur ist bewertet); Ø Techno = 5/1 = 5.0 (nur DJ Mitternacht bewertet).
  t.check('Bei Sortierung nach "Bewertung" wechselt auch die Genre-Reihenfolge entsprechend (Techno Ø5.0 vor Pop Ø4.0).',
    genreNames(d).indexOf('Techno') < genreNames(d).indexOf('Pop'), genreNames(d));
  d.querySelector('.ausw-sort-btn[data-sort="count"]').click();

  // ── 8) Künstler ganz ohne Genre-Angabe (falls Datenlücke) fällt ebenfalls
  // unter "Ohne Genre" - hier simuliert über einen Auftritt ohne dataMap-Eintrag
  // ist nicht einfach nachstellbar; stattdessen wird die Robustheit indirekt
  // durch das Event bereits oben abgedeckt.

  // ── 9) Persistenz/Konsistenz: Auswahl anderer Tage verändert die Genre-Zählung
  // korrekt (dieselbe Logik wie bei Locations, nur eine weitere Ebene).
  const dayBtn = day => [...d.querySelectorAll('.ausw-day-btn')].find(b => b.dataset.day === day);
  ['Mi 15.09', 'Do 16.09', 'Fr 17.09'].forEach(day => dayBtn(day).click()); // nur Sa übrig
  t.check('Bei nur Sa ausgewählt bleibt ausschließlich "Techno" und "House" übrig (DJ Mitternacht).',
    genreNames(d) === 'House | Techno' || genreNames(d) === 'Techno | House', genreNames(d));
  ['Mi 15.09', 'Do 16.09', 'Fr 17.09'].forEach(day => dayBtn(day).click()); // wieder alle Tage

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

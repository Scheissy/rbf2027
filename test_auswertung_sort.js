const { loadApp, reloadWithState, createChecker, ALL_DAYS, auswBlock: block, selectAuswertungDays: selectDays } = require('./test-helpers');

// Testdaten (rbf-data.test.js), nid -> Tag / Location:
//  1 Docks Mi | 2 Molotow Mi | 3 Prinzenbar Do | 7 Uebel & Gefährlich Fr
//  8 Fischauktionshalle Sa | 11 Molotow Sa
//
// Besucht (Dauer in Min):
//  Docks 45 (1x) | Molotow 30+15 = 45 (2x) | Prinzenbar 105 (1x) | Uebel 105 (1x)
//  Fischauktionshalle: nur bewertet, 0 Min (1x)
//
// Erwartung Häufigkeit: Molotow(2) | dann Gleichstand (1x) nach DAUER: Prinzenbar 105, Uebel 105,
//   Docks 45, Fischauktionshalle 0  (alphabetisch wäre Docks/Fischauktionshalle VOR Prinzenbar!)
// Erwartung Dauer: Prinzenbar 105, Uebel 105 (Gleichstand -> Name), Molotow 45 (2x) vor Docks 45 (1x), Fischauktionshalle 0

const rows = d => [...block(d).querySelectorAll('.ausw-loc')].map(r => ({
  name: r.querySelector('.ausw-loc-head > span:first-child').textContent,
  count: +r.getAttribute('data-count'),
  minutes: +r.getAttribute('data-minutes'),
  main: r.querySelector('.ausw-loc-main').textContent,
  meta: r.querySelector('.ausw-loc-meta').textContent,
  width: r.querySelector('.ausw-bar-fill').style.width
}));
const names = d => rows(d).map(r => r.name).join(' | ');
const btn = (d, mode) => d.querySelector(`.ausw-sort-btn[data-sort="${mode}"]`);

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  w.setShowDuration('x', 'nid:1', '45');
  w.setShowDuration('x', 'nid:2', '30');
  w.setShowDuration('x', 'nid:11', '15');
  w.setShowDuration('x', 'nid:3', '105');
  w.setShowDuration('x', 'nid:7', '105');
  w.setShowRating('x', 'nid:8', 3);
  w.switchTab('auswertung');

  // ── 1) Standard: Häufigkeit, mit Tie-Breaker Dauer statt Alphabet ──────
  t.check('Standard-Sortierung ist "Häufigkeit" (Button aktiv).', btn(d, 'count').classList.contains('active') && !btn(d, 'duration').classList.contains('active'));
  t.check('Häufigkeit: Bei Gleichstand entscheidet die DAUER (nicht das Alphabet): Molotow(2x) | Prinzenbar 105 | Uebel 105 | Docks 45 | Fischauktionshalle 0.',
    names(d) === 'Molotow | Prinzenbar | Uebel & Gefährlich | Docks | Fischauktionshalle', names(d));
  t.check('Bei Gleichstand in Häufigkeit UND Dauer entscheidet zuletzt der Name (Prinzenbar vor Uebel).',
    names(d).indexOf('Prinzenbar') < names(d).indexOf('Uebel'));
  selectDays(d, ['Sa 18.09']);
  t.check('Nur Sa ausgewählt folgt derselben Regel: Molotow (15 Min) vor Fischauktionshalle (0 Min), obwohl alphabetisch umgekehrt.',
    names(d) === 'Molotow | Fischauktionshalle', names(d));
  selectDays(d, ALL_DAYS);
  const rc = rows(d);
  t.check('Häufigkeit: Haupt-Wert ist die Anzahl ("2×"), Nebenwert die Dauer ("45 Min"); Balken relativ zur Häufigkeit (100 % / 50 %).',
    rc[0].main === '2×' && rc[0].meta === '45 Min' && rc[0].width === '100%' && rc[1].width === '50%', rc[0]);

  // ── 2) Umschalten auf Dauer ────────────────────────────────────────────
  btn(d, 'duration').click();
  t.check('Klick auf "Dauer" aktiviert den Button (und deaktiviert "Häufigkeit").', btn(d, 'duration').classList.contains('active') && !btn(d, 'count').classList.contains('active'));
  t.check('Dauer: Prinzenbar 105 | Uebel 105 (Gleichstand -> Name) | Molotow 45 (2x) vor Docks 45 (1x) | Fischauktionshalle 0.',
    names(d) === 'Prinzenbar | Uebel & Gefährlich | Molotow | Docks | Fischauktionshalle', names(d));
  const rd = rows(d);
  t.check('Dauer: Haupt-Wert ist die Dauer ("1h 45min"), Nebenwert die Anzahl ("1×").', rd[0].main === '1h 45min' && rd[0].meta === '1×', rd[0]);
  t.check('Dauer: Balken relativ zur Gesamtdauer (100 % / 100 % / 43 % / 43 %).',
    JSON.stringify(rd.slice(0, 4).map(r => r.width)) === JSON.stringify(['100%', '100%', '43%', '43%']), rd.map(r => r.width));
  t.check('Dauer: Location ohne eingetragene Dauer steht ganz unten, zeigt "–" und einen leeren Balken (0 %).',
    rd[4].name === 'Fischauktionshalle' && rd[4].main === '–' && rd[4].width === '0%', rd[4]);
  selectDays(d, ['Sa 18.09']);
  t.check('Auch bei nur Sa ausgewählt wird nach Dauer sortiert.', names(d) === 'Molotow | Fischauktionshalle', names(d));
  selectDays(d, ALL_DAYS);

  // ── 3) Zurück auf Häufigkeit ───────────────────────────────────────────
  btn(d, 'count').click();
  t.check('Zurückschalten auf "Häufigkeit" stellt die ursprüngliche Reihenfolge wieder her.',
    names(d) === 'Molotow | Prinzenbar | Uebel & Gefährlich | Docks | Fischauktionshalle', names(d));

  // ── 4) Scroll-Position bleibt beim Umschalten erhalten ────────────────
  const view = d.getElementById('view-auswertung');
  view.scrollTop = 321;
  btn(d, 'duration').click();
  t.check('Beim Umschalten springt die Ansicht nicht nach oben (Scroll-Position bleibt erhalten).', view.scrollTop === 321, view.scrollTop);

  // ── 5) Unabhängig von "Filter zurücksetzen"/"Jetzt" ────────────────────
  w.resetProgFilters();
  w.jumpToNow();
  w.jumpToNow();
  w.switchTab('kuenstler');
  w.switchTab('auswertung');
  t.check('Die Sortierung ist eine Ansichts-Einstellung: "Filter zurücksetzen"/"Jetzt" und Tab-Wechsel ändern sie nicht.',
    btn(d, 'duration').classList.contains('active') && names(d).startsWith('Prinzenbar | Uebel'), names(d));

  // ── 6) Persistenz über einen echten Neustart ───────────────────────────
  const reloaded = await reloadWithState(w, ['rbf2027_v1']);
  reloaded.window.switchTab('auswertung');
  t.check('Die gewählte Sortierung wird gespeichert und nach einem Neustart wiederhergestellt.',
    btn(reloaded.document, 'duration').classList.contains('active') && names(reloaded.document).startsWith('Prinzenbar | Uebel'),
    names(reloaded.document));

  // ── 7) Ungültige Werte fallen auf "Häufigkeit" zurück ─────────────────
  w.setAuswertungSort('irgendwas');
  t.check('Ein ungültiger Wert fällt sicher auf "Häufigkeit" zurück.', btn(d, 'count').classList.contains('active'));

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

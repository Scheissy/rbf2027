const { loadApp, reloadWithState, createChecker, auswBlock: block } = require('./test-helpers');

// Testdaten (rbf-data.test.js), nid -> Tag / Location:
//  1 Nova Frequenz Mi Docks | 4 Rosa Mercur Do Docks | 10 Nordlicht Prozession Sa Docks
//  2 Stahl & Beton Mi Molotow | 6 Blau Neon Fr Molotow
//
// Docks: 3 Besuche, Dauern 40+80+0(unbewertet keine Dauer,aber Bewertung 5) -> Summe 120, Ø nur über die
//        2 EINGETRAGENEN Dauern (40+80)/2=60; Bewertungen 3★+5★ (2 von 3 bewertet) -> Summe 8, Ø 4.0
// Molotow: 2 Besuche, Dauern 20+0, Summe 20, Ø nur über 1 Dauer = 20; Bewertung 5★ (nur 1) -> Summe 5, Ø 5.0

const sortBtn = (d, mode) => d.querySelector(`.ausw-sort-btn[data-sort="${mode}"]`);
const aggBtn = (d, agg) => d.querySelector(`.ausw-sort-btn[data-agg="${agg}"]`);
const aggBtns = d => [...d.querySelectorAll('.ausw-sort-btn[data-agg]')];
const rows = d => [...block(d).querySelectorAll('.ausw-loc')].map(r => ({
  name: r.querySelector('.ausw-loc-head > span:first-child').textContent,
  main: r.querySelector('.ausw-loc-main').textContent,
  meta: r.querySelector('.ausw-loc-meta').textContent,
  width: r.querySelector('.ausw-bar-fill').style.width
}));
const names = d => rows(d).map(r => r.name).join(' | ');

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  w.setShowDuration('x', 'nid:1', '40');   // Docks
  w.setShowRating('x', 'nid:1', 3);        // Docks
  w.setShowDuration('x', 'nid:4', '80');   // Docks
  w.setShowRating('x', 'nid:10', 5);       // Docks, keine Dauer
  w.setShowDuration('x', 'nid:2', '20');   // Molotow
  w.setShowRating('x', 'nid:6', 5);        // Molotow, keine Dauer
  w.switchTab('auswertung');

  // ── 1) Der Umschalter erscheint NICHT bei "Häufigkeit" ──────────────────
  t.check('Bei "Häufigkeit" (Standard) gibt es keinen Summe/Durchschnitt-Umschalter - ergibt dort keinen Sinn.',
    aggBtns(d).length === 0);

  // ── 2) Dauer: Standard ist weiterhin "Summe" (bestehendes Verhalten) ────
  sortBtn(d, 'duration').click();
  t.check('Bei "Dauer" erscheint der Umschalter, Standard ist "Summe" (unverändertes bisheriges Verhalten).',
    aggBtns(d).length === 2 && aggBtn(d, 'sum').classList.contains('active') && !aggBtn(d, 'avg').classList.contains('active'));
  t.check('Dauer/Summe: Docks (120 Min) vor Molotow (20 Min).', names(d) === 'Docks | Molotow', names(d));
  const sumRows = rows(d);
  t.check('Dauer/Summe zeigt die Gesamtdauer groß, die Anzahl ALLER Besuche klein.',
    sumRows[0].main === '2h' && sumRows[0].meta === '3×', sumRows[0]);

  // ── 3) Dauer: Umschalten auf "Durchschnitt" ─────────────────────────────
  aggBtn(d, 'avg').click();
  t.check('Klick auf "Durchschnitt" aktiviert den Button.', aggBtn(d, 'avg').classList.contains('active') && !aggBtn(d, 'sum').classList.contains('active'));
  // Docks Ø = (40+80)/2 = 60 Min; Molotow Ø = 20/1 = 20 Min -> Docks weiterhin vorn.
  t.check('Dauer/Durchschnitt: Docks (Ø 1h) vor Molotow (Ø 20 Min) - Reihenfolge kann sich vom Summen-Modus unterscheiden.',
    names(d) === 'Docks | Molotow', names(d));
  const avgRows = rows(d);
  t.check('Dauer/Durchschnitt zeigt die Ø-Dauer groß, und als Anzahl NUR die Besuche MIT eingetragener Dauer (2, nicht 3 - Nordlicht Prozession hatte keine).',
    avgRows[0].main === '1h' && avgRows[0].meta === '2×', avgRows[0]);
  t.check('Balken im Durchschnitt-Modus sind relativ zum höchsten DURCHSCHNITT (100 % / 33 %), nicht zur Summe.',
    avgRows[0].width === '100%' && avgRows[1].width === '33%', avgRows.map(r => r.width));

  // ── 4) Bewertung: bewusst KEIN Summe/Durchschnitt-Umschalter mehr - die
  // Summe von Sternebewertungen ist keine aussagekräftige Größe (anders als
  // bei Minuten) und wurde deshalb wieder entfernt. Immer Durchschnitt,
  // unabhängig von der zuvor bei "Dauer" gewählten Einstellung.
  sortBtn(d, 'rating').click();
  t.check('Bei "Bewertung" gibt es keinen Summe/Durchschnitt-Umschalter mehr (bewusst entfernt).', aggBtns(d).length === 0);
  // Docks Ø = (3+5)/2 = 4.0; Molotow Ø = 5.0 -> Molotow vorn.
  t.check('Bewertung zeigt weiterhin (fest) den Durchschnitt: Molotow (Ø 5.0) vor Docks (Ø 4.0).', names(d) === 'Molotow | Docks', names(d));
  t.check('Balken bei Bewertung bleiben absolut auf der 1-5-Skala (Molotow Ø5.0 = 100 %, Docks Ø4.0 = 80 %).',
    rows(d)[0].width === '100%' && rows(d)[1].width === '80%', rows(d).map(r => r.width));

  // ── 5) Zurück bei "Dauer": die dort gewählte Einstellung ist unabhängig
  // von "Bewertung" erhalten geblieben (Bewertung hat ja gar keine eigene
  // Einstellung mehr, kann also auch nichts überschrieben haben). ──────────
  sortBtn(d, 'duration').click();
  t.check('Zurück bei "Dauer": die zuvor gewählte "Durchschnitt"-Einstellung ist weiterhin aktiv.',
    aggBtn(d, 'avg').classList.contains('active'));

  // ── 6) Persistenz über einen echten Neustart (nur für Dauer relevant) ───
  const reloaded = await reloadWithState(w, ['rbf2027_v1']);
  reloaded.window.switchTab('auswertung');
  reloaded.window.setAuswertungSort('duration');
  t.check('Die Wahl "Durchschnitt" bei Dauer übersteht einen Neustart.',
    aggBtn(reloaded.document, 'avg').classList.contains('active'), aggBtns(reloaded.document).map(b => b.className));
  reloaded.window.setAuswertungSort('rating');
  t.check('Bei Bewertung erscheint auch nach dem Neustart kein Umschalter.', aggBtns(reloaded.document).length === 0);

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

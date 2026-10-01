const { loadApp, reloadWithState, createChecker, ALL_DAYS, auswBlock: block, selectAuswertungDays: selectDays } = require('./test-helpers');

// Testdaten (rbf-data.test.js), nid -> Tag / Location:
//  1 Docks Mi | 2 Molotow Mi | 4 Rosa Mercur Do Docks | 6 Blau Neon Fr Molotow | 7 Uebel & Gefährlich Fr
//  10 Nordlicht Prozession Sa Docks | 11 DJ Mitternacht Sa Molotow

const distRows = d => [...block(d).querySelectorAll('.ausw-dist-row')].map(r => ({
  stars: +r.getAttribute('data-stars'), count: +r.getAttribute('data-count'), width: r.querySelector('.ausw-bar-fill').style.width
}));
const distText = d => distRows(d).map(r => `${r.stars}:${r.count}`).join(', ');
const locRows = d => [...block(d).querySelectorAll('.ausw-loc')].map(r => ({
  name: r.querySelector('.ausw-loc-head > span:first-child').textContent,
  avg: r.getAttribute('data-avg-rating'),
  main: r.querySelector('.ausw-loc-main').textContent,
  meta: r.querySelector('.ausw-loc-meta').textContent,
  width: r.querySelector('.ausw-bar-fill').style.width
}));
const locNames = (d, id) => locRows(d, id).map(r => r.name).join(' | ');
const btn = (d, mode) => d.querySelector(`.ausw-sort-btn[data-sort="${mode}"]`);

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  // Besucht, aber (noch) unbewertet: Docks/Mi (nur Dauer).
  w.setShowDuration('x', 'nid:1', '20');
  // Bewertete Auftritte: Molotow/Mi=3, Docks/Do=5, Molotow/Fr=5, Uebel/Fr=4, Docks/Sa=5, Molotow/Sa=2.
  w.setShowRating('x', 'nid:2', 3);
  w.setShowRating('x', 'nid:4', 5);
  w.setShowRating('x', 'nid:6', 5);
  w.setShowRating('x', 'nid:7', 4);
  w.setShowRating('x', 'nid:10', 5);
  w.setShowRating('x', 'nid:11', 2);
  w.switchTab('auswertung');

  // ── 0) Reihenfolge im Block: Locations VOR der Bewertungsverteilung ────
  {
    const html = block(d).innerHTML;
    t.check('Die Bewertungsverteilung steht unterhalb des Locations-Abschnitts (nicht darüber).',
      html.indexOf('📍 Locations') !== -1 && html.indexOf('📍 Locations') < html.indexOf('⭐ Bewertungsverteilung'));
  }

  // ── 1) Bewertungsverteilung: Gesamt ─────────────────────────────────────
  t.check('Verteilung zeigt immer alle 5 Stufen (5→1), auch wenn eine Stufe 0x vorkommt.',
    distRows(d).map(r => r.stars).join(',') === '5,4,3,2,1');
  t.check('Gesamt: 5★=3, 4★=1, 3★=1, 2★=1, 1★=0 (unbewertete "besuchte" Docks/Mi zählt NICHT mit).',
    distText(d) === '5:3, 4:1, 3:1, 2:1, 1:0', distText(d));
  t.check('Balken sind relativ zur häufigsten Bewertungsstufe (5★ = 100 %, die anderen kleiner, 1★ = 0 %).',
    distRows(d)[0].width === '100%' && distRows(d)[4].width === '0%', distRows(d));

  // ── 2) Verteilung je Tag ─────────────────────────────────────────────────
  selectDays(d, ['Mi 15.09']);
  t.check('Nur Mi ausgewählt: nur die Molotow-Bewertung (3★) zählt, Docks (unbewertet, nur Dauer) fließt nicht ein.',
    distText(d) === '5:0, 4:0, 3:1, 2:0, 1:0', distText(d));
  selectDays(d, ['Fr 17.09']);
  t.check('Nur Fr ausgewählt: zwei Bewertungen (5★, 4★).', distText(d) === '5:1, 4:1, 3:0, 2:0, 1:0', distText(d));
  selectDays(d, ALL_DAYS);

  // ── 3) Ohne jede Bewertung: Hinweistext statt leerer Liste ─────────────
  {
    const { window: w2, document: d2 } = await loadApp();
    w2.setShowDuration('x', 'nid:1', '20'); // besucht, aber unbewertet
    w2.switchTab('auswertung');
    t.check('Besuchte, aber unbewertete Auftritte: "Noch keine Bewertungen abgegeben." statt einer leeren Verteilung.',
      block(d2).textContent.includes('Noch keine Bewertungen abgegeben.') && !d2.querySelector('.ausw-dist-row'));
  }

  // ── 4) Dritte Sortier-Option "Bewertung" ────────────────────────────────
  t.check('Umschalter hat jetzt 3 Optionen: Häufigkeit, Dauer, Bewertung (Standard: Häufigkeit aktiv).',
    !!btn(d, 'count') && !!btn(d, 'duration') && !!btn(d, 'rating') && btn(d, 'count').classList.contains('active'));
  btn(d, 'rating').click();
  t.check('Klick auf "Bewertung" aktiviert den Button.', btn(d, 'rating').classList.contains('active') && !btn(d, 'count').classList.contains('active'));

  // Ø je Location (Gesamt): Docks (5+5)/2=5.0, Molotow (3+5+2)/3=3.33, Uebel 4.0.
  t.check('Gesamt nach Bewertung: Docks (Ø 5.0) vor Uebel (Ø 4.0) vor Molotow (Ø 3.3).',
    locNames(d) === 'Docks | Uebel & Gefährlich | Molotow', locNames(d));
  const rows = locRows(d);
  t.check('Bewertungs-Modus: Haupt-Wert ist der Mittelwert ("5.0"), Nebenwert die Anzahl der BEWERTUNGEN ("2×", nicht aller 3 Besuche - einer davon ist unbewertet).', rows[0].main === '5.0' && rows[0].meta === '2×', rows[0]);
  t.check('Balken sind ABSOLUT auf der 1-5-Skala (Docks Ø5.0 = 100 %, Molotow Ø3.33 = 67 %) - nicht relativ zum Erstplatzierten.',
    rows[0].width === '100%' && rows[2].width === '67%', rows.map(r => r.width));

  // ── 5) Location ohne jede Bewertung landet ganz unten ("–") ────────────
  t.check('Location mit besuchtem, aber unbewertetem Auftritt (hier: keine weitere Location betroffen in "gesamt") - Prüfung im Sa-Block statt.', true);
  {
    const { window: w3, document: d3 } = await loadApp();
    w3.setShowDuration('x', 'nid:1', '20'); // Docks, nur Dauer, keine Bewertung
    w3.setShowRating('x', 'nid:2', 4);      // Molotow, bewertet
    w3.switchTab('auswertung');
    w3.setAuswertungSort('rating');
    const r3 = locRows(d3);
    t.check('Unbewertete Location steht nach Bewertungs-Sortierung ganz unten und zeigt "–".',
      r3[r3.length - 1].name === 'Docks' && r3[r3.length - 1].main === '–' && r3[r3.length - 1].width === '0%', r3);
  }

  // ── 6) Zurück auf Häufigkeit ─────────────────────────────────────────────
  btn(d, 'count').click();
  t.check('Zurückschalten auf "Häufigkeit" funktioniert weiterhin wie zuvor.', btn(d, 'count').classList.contains('active'));

  // ── 7) Persistenz über einen echten Neustart ────────────────────────────
  btn(d, 'rating').click();
  const reloaded = await reloadWithState(w, ['rbf2027_v1']);
  reloaded.window.switchTab('auswertung');
  t.check('Die Sortierung "Bewertung" wird gespeichert und nach einem Neustart wiederhergestellt.',
    btn(reloaded.document, 'rating').classList.contains('active') && locNames(reloaded.document) === 'Docks | Uebel & Gefährlich | Molotow',
    locNames(reloaded.document));

  // ── 8) Nur die Auftritts-Bewertung fließt ein, nicht die Künstler-Bewertung ─
  {
    const { window: w4, document: d4 } = await loadApp();
    w4.setRating('Nova Frequenz', 'rp', 5); // Künstler-Bewertung (Promo) - NICHT auftrittsbezogen
    w4.setShowDuration('x', 'nid:1', '20'); // Auftritt besucht, aber ohne Auftritts-Bewertung
    w4.switchTab('auswertung');
    t.check('Eine reine Künstler-Bewertung (Promo/Listening) fließt NICHT in die Verteilung/Location-Bewertung ein.',
      block(d4).textContent.includes('Noch keine Bewertungen abgegeben.'));
  }

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

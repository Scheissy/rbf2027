const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  w.setShowDuration('x', 'nid:1', '45'); // Nova Frequenz, Mi, Docks - sorgt für Inhalt in allen Abschnitten
  w.setShowRating('x', 'nid:1', 4);
  w.switchTab('auswertung');

  const block = d.querySelector('.ausw-block[data-ausw="auswahl"]');
  const html = block.innerHTML;
  // Eindeutige Marker (die vollständigen Überschriften-Elemente statt loser
  // Teilstrings) - "📍 Locations" allein wäre mehrdeutig, weil der Sortier-
  // Label-Text ebenfalls mit "📍 Locations..." beginnt.
  const M = {
    kpis: '<div class="ausw-kpis">',
    sortBtns: '<div class="ausw-sort-btns">',
    locations: '<div class="ausw-sub">📍 Locations</div>',
    genres: '<div class="ausw-sub">🎵 Genres</div>',
    verteilung: '<div class="ausw-sub">⭐ Bewertungsverteilung</div>',
    wege: '<div class="ausw-sub">🚶 Größte Wege</div>',
  };
  const posOf = key => html.indexOf(M[key]);

  // ── 1) Sortier-Buttons sitzen direkt vor "Locations", nicht mehr ganz
  // oben getrennt durch KPIs/Strecke - nur die Kennzahlen-Kacheln und der
  // Strecke-Hinweis liegen noch dazwischen. ────────────────────────────────
  t.check('Die Sortier-Buttons stehen NACH den Kennzahlen-Kacheln, aber UNMITTELBAR VOR "📍 Locations" (nicht mehr weit davon entfernt).',
    posOf('kpis') < posOf('sortBtns') && posOf('sortBtns') < posOf('locations'),
    { kpis: posOf('kpis'), sortBtns: posOf('sortBtns'), locations: posOf('locations') });

  // Zwischen den Sortier-Buttons und der Locations-Überschrift darf nur noch
  // der kurze "Bei Gleichstand..."-Hinweis (und ggf. der Summe/Durchschnitt-
  // Umschalter) stehen - kein KPI-Block, kein Strecke-Abschnitt mehr dazwischen.
  const between = html.slice(html.indexOf('</div>', posOf('sortBtns')), posOf('locations'));
  t.check('Zwischen Sortier-Buttons und "Locations" liegt kein Kennzahlen- oder Strecke-Inhalt mehr (nur der kurze Hinweistext/Zusatz-Umschalter).',
    !between.includes('ausw-kpi-val') && !between.includes('ausw-walklegs-list'), between);

  // ── 2) "Größte Wege" steht jetzt am Ende, nach Locations/Genres/Bewertungsverteilung ─
  t.check('"🚶 Größte Wege" steht NACH "📍 Locations", "🎵 Genres" UND "⭐ Bewertungsverteilung" (nicht mehr direkt am Anfang).',
    posOf('locations') < posOf('wege') && posOf('genres') < posOf('wege') && posOf('verteilung') < posOf('wege'),
    { locations: posOf('locations'), genres: posOf('genres'), verteilung: posOf('verteilung'), wege: posOf('wege') });

  // ── 3) Die vollständige Reihenfolge im Block ist wie vereinbart ─────────
  const order = ['kpis', 'sortBtns', 'locations', 'genres', 'verteilung', 'wege'];
  const positions = order.map(posOf);
  t.check('Gesamt-Reihenfolge: Kennzahlen → Sortier-Buttons → Locations → Genres → Bewertungsverteilung → Größte Wege.',
    positions.every((p, i) => i === 0 || positions[i - 1] < p), { order, positions });

  // ── 4) Funktionalität bleibt an der neuen Position erhalten ─────────────
  d.querySelector('.ausw-sort-btn[data-sort="duration"]').click(); // rendert neu -> Referenz danach neu holen
  t.check('Die Sortier-Buttons sind an der neuen Position weiterhin funktionsfähig.',
    d.querySelector('.ausw-sort-btn[data-sort="duration"]').classList.contains('active'));
  w.setAuswertungSort('count');

  t.check('Keine JS-Fehler.', errors.length === 0, errors);
  t.finish();
})();

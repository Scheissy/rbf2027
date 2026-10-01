const { loadApp, createChecker, auswBlock: block } = require('./test-helpers');

// Testdaten (rbf-data.test.js), nid -> Tag / Location:
//  1 Nova Frequenz Mi Docks | 2 Stahl & Beton Mi Molotow | 4 Rosa Mercur Do Docks
//  6 Blau Neon Fr Molotow | 10 Nordlicht Prozession Sa Docks

const locRow = (d, name) => [...block(d).querySelectorAll('.ausw-loc')].find(r => r.querySelector('.ausw-loc-head > span:first-child').textContent === name);
const distEntry = (d, stars) => [...block(d).querySelectorAll('.ausw-dist-row')].find(r => +r.getAttribute('data-stars') === stars).closest('.ausw-dist-entry');
const detailOf = row => row.querySelector('.ausw-expand-detail');
const itemLines = detail => [...detail.querySelectorAll('.ausw-expand-item')].map(el => el.textContent.replace(/\s+/g, ' ').trim());
const arrowOf = row => row.querySelector('.ausw-expand-arrow').textContent;

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  w.setShowDuration('x', 'nid:1', '45');
  w.setShowRating('x', 'nid:1', 4);
  w.setShowDuration('x', 'nid:4', '60'); // Rosa Mercur, Docks, nur Dauer
  w.setShowRating('x', 'nid:10', 4);     // Nordlicht Prozession, Docks, nur Bewertung
  w.setShowRating('x', 'nid:2', 4);      // Stahl & Beton, Molotow
  w.switchTab('auswertung');

  // ── 1) Standardmäßig eingeklappt ─────────────────────────────────────────
  const docksRow = locRow(d, 'Docks');
  if (!t.check('Location-Zeile "Docks" gefunden.', !!docksRow)) return t.finish();
  t.check('Detail-Liste ist standardmäßig eingeklappt (Pfeil "▸").',
    detailOf(docksRow).classList.contains('collapsed') && arrowOf(docksRow) === '▸');

  // ── 2) Aufklappen zeigt die zugrunde liegenden Auftritte, chronologisch ──
  docksRow.querySelector('.ausw-loc-head').click();
  t.check('Klick auf die Kopfzeile klappt die Liste auf (Pfeil dreht auf "▾").',
    !detailOf(docksRow).classList.contains('collapsed') && arrowOf(docksRow) === '▾');
  const docksLines = itemLines(detailOf(docksRow));
  t.check('Docks listet alle 3 zugrunde liegenden Auftritte auf, chronologisch (Mi, Do, Sa).',
    docksLines.length === 3 && docksLines[0].includes('Nova Frequenz') && docksLines[1].includes('Rosa Mercur') && docksLines[2].includes('Nordlicht Prozession'), docksLines);
  t.check('Nova Frequenz zeigt Tag, Zeit, Dauer UND Bewertung (beides gleichzeitig vorhanden).',
    docksLines[0].includes('Mi 15.09') && docksLines[0].includes('20:00') && docksLines[0].includes('45 Min') && /★/.test(docksLines[0]), docksLines[0]);
  t.check('Nordlicht Prozession zeigt nur die Bewertung, keine Dauer (war nicht eingetragen).',
    !docksLines[2].includes('Min') && /★/.test(docksLines[2]), docksLines[2]);

  // ── 3) Wieder zuklappen ──────────────────────────────────────────────────
  docksRow.querySelector('.ausw-loc-head').click();
  t.check('Erneuter Klick klappt die Liste wieder zu.', detailOf(docksRow).classList.contains('collapsed') && arrowOf(docksRow) === '▸');

  // ── 4) Andere Zeilen bleiben von einem Klick unberührt ──────────────────
  const molotowRow = locRow(d, 'Molotow');
  docksRow.querySelector('.ausw-loc-head').click(); // Docks wieder auf
  t.check('Andere Location-Zeilen bleiben unabhängig - Molotow ist weiterhin eingeklappt.',
    detailOf(molotowRow).classList.contains('collapsed'));
  docksRow.querySelector('.ausw-loc-head').click(); // aufräumen

  // ── 5) Bewertungsverteilung ist ebenfalls aufklappbar ───────────────────
  const fourStarEntry = distEntry(d, 4);
  const fourStarRow = fourStarEntry.querySelector('.ausw-dist-row');
  t.check('4★-Zeile hat einen Pfeil und ist zunächst eingeklappt.',
    !!detailOf(fourStarEntry) && detailOf(fourStarEntry).classList.contains('collapsed') && arrowOf(fourStarRow) === '▸');
  fourStarRow.click();
  const fourStarLines = itemLines(detailOf(fourStarEntry));
  t.check('4★ listet alle 3 mit 4 Sternen bewerteten Auftritte auf (Nova Frequenz, Stahl & Beton, Nordlicht Prozession), chronologisch.',
    fourStarLines.length === 3 &&
    fourStarLines[0].includes('Nova Frequenz') && fourStarLines[1].includes('Stahl & Beton') && fourStarLines[2].includes('Nordlicht Prozession'),
    fourStarLines);

  // ── 6) Eine 0er-Bewertungsstufe hat keinen Pfeil und lässt sich nicht aufklappen ─
  const oneStarEntry = distEntry(d, 1);
  const oneStarRow = oneStarEntry.querySelector('.ausw-dist-row');
  t.check('1★ (0 Einträge) hat keinen Pfeil und keine Detail-Liste.',
    oneStarRow.querySelector('.ausw-expand-arrow') === null && detailOf(oneStarEntry) === null);
  oneStarRow.click(); // darf keinen Fehler werfen und nichts bewirken
  t.check('Klick auf eine leere Bewertungsstufe wirft keinen Fehler.', errors.length === 0, errors);

  // ── 7) Aufklapp-Zustand ist rein optisch (kein Neu-Rendern, keine Persistenz) ─
  docksRow.querySelector('.ausw-loc-head').click(); // Docks auf
  w.setAuswertungSort('duration'); // löst renderAuswertung() aus (Neu-Rendern)
  const docksRowAfter = locRow(d, 'Docks');
  t.check('Nach einem Neu-Rendern (z.B. Sortierung wechseln) ist die Detail-Liste wieder eingeklappt (kein persistenter UI-Zustand).',
    detailOf(docksRowAfter).classList.contains('collapsed'));
  w.setAuswertungSort('count');

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

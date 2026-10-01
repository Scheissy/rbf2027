const { loadApp, createChecker, auswBlock: block, refHaversineMeters: air, refFormatMeters: km } = require('./test-helpers');

// Eigene Testdaten: 4 Locations mit echten Koordinaten, 6 Wegstrecken über
// 2 Tage verteilt - genug, um "Top 5 von 6" (Kappung) UND das gemischte
// Fußweg-/Luftlinien-Kennzeichen pro EINZELNER Strecke zu prüfen.
const COORDS = {
  'Docks': { lat: 53.549274, lng: 9.964525 },
  'Prinzenbar': { lat: 53.548774, lng: 9.964696 },
  'Molotow': { lat: 53.550220812527, lng: 9.9565170694518 },
  'Knust': { lat: 53.558177, lng: 9.967824 },
};
const dataScript = `
const DATA_VERSION = 'test-walk-legs';
const DAY_ORDER = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];
const RAW = [
  ${[1, 2, 3, 4, 5, 6, 7].map(i => `['Act${i}', 'Pop', 'Hamburg, DE', 'divers', 'https://example.org/${i}']`).join(',\n  ')}
];
const RAW_AUFTRITTE = [
  ['Act1', 'Fr 17.09', '19:00', '19:20', 'Docks', 1],
  ['Act2', 'Fr 17.09', '19:30', '19:50', 'Prinzenbar', 2],
  ['Act3', 'Fr 17.09', '20:00', '20:20', 'Molotow', 3],
  ['Act4', 'Fr 17.09', '21:00', '21:20', 'Knust', 4],
  ['Act5', 'Sa 18.09', '19:00', '19:20', 'Prinzenbar', 5],
  ['Act6', 'Sa 18.09', '20:00', '20:20', 'Knust', 6],
  ['Act7', 'Sa 18.09', '21:00', '21:20', 'Docks', 7],
];
const VENUE_LOCATIONS = {
  'Docks': { lat: ${COORDS.Docks.lat}, lng: ${COORDS.Docks.lng} },
  'Prinzenbar': { lat: ${COORDS.Prinzenbar.lat}, lng: ${COORDS.Prinzenbar.lng} },
  'Molotow': { lat: ${COORDS.Molotow.lat}, lng: ${COORDS.Molotow.lng} },
  'Knust': { lat: ${COORDS.Knust.lat}, lng: ${COORDS.Knust.lng} },
};
const ANCHOR_AWARD_NOMINEES = []; const SOUND_REFERENCES = []; const RBF_EVENTS = [];
let lastAutoFixes = []; let lastValidationIssues = [];
function autoFixAuftritte() {} function validateAuftritte() {} function updateValidationPanel() {}
`;
// Fußweg-Matrix deckt bewusst NICHT "Knust" ab - jede Strecke von/zu Knust
// fällt auf Luftlinie zurück, alle anderen nutzen die (hier identischen)
// Matrix-Werte. So lässt sich das Kennzeichen pro EINZELNER Strecke prüfen,
// nicht nur global für den ganzen Tag.
const walkScript = `const WALK_DISTANCES = { generated: '2026-01-01', source: 'test',
  venues: { 'Docks': 0, 'Prinzenbar': 1, 'Molotow': 2 },
  meters: [[0, 100, 700], [100, 0, 700], [700, 700, 0]] };`;


const legLines = d => [...block(d).querySelectorAll('.ausw-walklegs-list .ausw-expand-item')].map(el => el.textContent.replace(/\s+/g, ' ').trim());

(async () => {
  const { window: w, document: d, errors } = await loadApp({ dataScript, walkScript, trackErrors: true });
  const t = createChecker();

  [1, 2, 3, 4, 5, 6, 7].forEach(n => w.setShowDuration('x', `nid:${n}`, '20'));
  w.switchTab('auswertung');

  // ── Erwartete Strecken (Referenz, unabhängig von der App berechnet) ──────
  // Fr: Docks-Prinzenbar (Matrix 100), Prinzenbar-Molotow (Matrix 700), Molotow-Knust (Luftlinie)
  // Sa: Prinzenbar-Knust (Luftlinie), Knust-Docks (Luftlinie)
  const legs = [
    { label: 'Act1 → Act2', m: 100 },
    { label: 'Act2 → Act3', m: 700 },
    { label: 'Act3 → Act4', m: Math.round(air(COORDS.Molotow, COORDS.Knust)) },
    { label: 'Act5 → Act6', m: Math.round(air(COORDS.Prinzenbar, COORDS.Knust)) },
    { label: 'Act6 → Act7', m: Math.round(air(COORDS.Knust, COORDS.Docks)) },
  ].sort((a, b) => b.m - a.m);

  const shown = legLines(d);
  t.check('Es werden genau 5 Wege angezeigt (die 5 größten von insgesamt 5 - hier noch keine Kappung nötig).', shown.length === 5, shown);
  t.check('Die Wege sind absteigend nach Distanz sortiert.',
    shown.every((line, i) => line.includes(legs[i].label)), { shown, expected: legs.map(l => l.label) });
  t.check('Der größte Weg zeigt die korrekte Distanz.', shown[0].includes(km(legs[0].m)), { line: shown[0], expected: km(legs[0].m) });

  // Die beiden Matrix-basierten Strecken (Act1→Act2, Act2→Act3) haben KEIN
  // "(Luftlinie)"-Kennzeichen, alle Strecken von/zu Knust hingegen schon -
  // pro einzelner Strecke, nicht global für den ganzen Tag.
  const matrixLine = shown.find(l => l.includes('Act1 → Act2'));
  const airLine = shown.find(l => l.includes('Act3 → Act4'));
  t.check('Eine Strecke mit vollständigen Fußweg-Daten zeigt KEIN "(Luftlinie)"-Kennzeichen.', !!matrixLine && !matrixLine.includes('Luftlinie'), matrixLine);
  t.check('Eine Strecke von/zu einer Location ohne Fußweg-Daten (Knust) zeigt "(Luftlinie)", auch wenn andere Strecken desselben Tages exakt sind.',
    !!airLine && airLine.includes('Luftlinie'), airLine);

  // ── Kappung: eine 6. (kleinste) Strecke hinzufügen -> darf NICHT erscheinen ─
  {
    const dataScript2 = dataScript.replace(
      "['Act7', 'Sa 18.09', '21:00', '21:20', 'Docks', 7],",
      "['Act7', 'Sa 18.09', '21:00', '21:20', 'Docks', 7],\n  ['Act8', 'Sa 18.09', '21:30', '21:50', 'Docks', 8],"
    ).replace("${[1, 2, 3, 4, 5, 6, 7]", "${[1, 2, 3, 4, 5, 6, 7, 8]");
    const app2 = await loadApp({ dataScript: dataScript2, walkScript, trackErrors: true });
    [1, 2, 3, 4, 5, 6, 7, 8].forEach(n => app2.window.setShowDuration('x', `nid:${n}`, '20'));
    app2.window.switchTab('auswertung');
    const shown2 = legLines(app2.document);
    t.check('Bei 6 Strecken werden weiterhin nur die 5 größten gezeigt (die kleinste - Docks→Docks, 0 m - fällt raus).',
      shown2.length === 5 && !shown2.some(l => l.includes('Act7 → Act8')), shown2);
  }

  // ── Reagiert auf die Tages-Auswahl (nur Fr) ──────────────────────────────
  {
    const dayBtn = day => [...d.querySelectorAll('.ausw-day-btn')].find(b => b.dataset.day === day);
    ['Mi 15.09', 'Do 16.09', 'Sa 18.09'].forEach(day => dayBtn(day).click()); // nur Fr übrig
    const frOnly = legLines(d);
    t.check('Bei nur Fr ausgewählt erscheinen ausschließlich die 3 Fr-Strecken (keine Sa-Strecken).',
      frOnly.length === 3 && frOnly.every(l => l.includes('Fr 17.09')), frOnly);
    ['Mi 15.09', 'Do 16.09', 'Sa 18.09'].forEach(day => dayBtn(day).click()); // wieder alle Tage
  }

  // ── Ohne jede berechenbare Strecke: Hinweis statt leerer Liste ──────────
  {
    const app3 = await loadApp({ trackErrors: true }); // Standard-Testdaten, keine Koordinaten-Überschneidung nötig
    app3.window.switchTab('auswertung');
    t.check('Ohne besuchte Auftritte zeigt der Block generell den Leer-Hinweis (kein "Größte Wege" nötig).',
      block(app3.document).textContent.includes('Noch keine besuchten Auftritte'));
  }

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

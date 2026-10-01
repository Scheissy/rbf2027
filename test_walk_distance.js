const { loadApp, createChecker, ALL_DAYS, auswBlock: block, selectAuswertungDays: selectDays, refHaversineMeters: air, refFormatMeters: km } = require('./test-helpers');

// Eigene Testdaten: echte Koordinaten aus dem Reeperbahn-Gelände, damit die
// erwarteten Luftlinien-Werte unabhängig (hier im Test) nachgerechnet werden.
const COORDS = {
  'Docks': { lat: 53.549274, lng: 9.964525 },
  'Prinzenbar': { lat: 53.548774, lng: 9.964696 },
  'Molotow': { lat: 53.550220812527, lng: 9.9565170694518 },
  'Molotow Top Ten Bar': { lat: 53.550220812527, lng: 9.9565170694518 },
};
const dataScript = `
const DATA_VERSION = 'test-walk';
const DAY_ORDER = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];
const RAW = [
  ${[1, 2, 3, 4, 5, 6, 7].map(i => `['Act${i}', 'Pop', 'Hamburg, DE', 'divers', 'https://example.org/${i}']`).join(',\n  ')}
];
const RAW_AUFTRITTE = [
  ['Act1', 'Fr 17.09', '20:00', '20:45', 'Docks', 1],
  ['Act2', 'Fr 17.09', '21:00', '21:45', 'Prinzenbar', 2],
  ['Act3', 'Fr 17.09', '23:30', '00:15', 'Molotow', 3],
  ['Act4', 'Fr 17.09', '00:10', '00:50', 'Docks', 4],
  ['Act5', 'Fr 17.09', '22:00', '22:45', 'Nur Adresse', 5],
  ['Act6', 'Fr 17.09', '', '', 'Docks', 6],
  ['Act7', 'Sa 18.09', '20:00', '20:45', 'Molotow', 7],
];
const VENUE_LOCATIONS = {
  'Docks': { lat: ${COORDS.Docks.lat}, lng: ${COORDS.Docks.lng} },
  'Prinzenbar': { lat: ${COORDS.Prinzenbar.lat}, lng: ${COORDS.Prinzenbar.lng} },
  'Molotow': { lat: ${COORDS.Molotow.lat}, lng: ${COORDS.Molotow.lng}, address: 'Reeperbahn 136' },
  'Molotow Top Ten Bar': { lat: ${COORDS['Molotow Top Ten Bar'].lat}, lng: ${COORDS['Molotow Top Ten Bar'].lng} },
  'Nur Adresse': { address: 'Heiligengeistfeld, 20359 Hamburg' },
};
const ANCHOR_AWARD_NOMINEES = []; const SOUND_REFERENCES = []; const RBF_EVENTS = [];
let lastAutoFixes = []; let lastValidationIssues = [];
function autoFixAuftritte() {} function validateAuftritte() {} function updateValidationPanel() {}
`;

// Unabhängige Referenz-Implementierung (nicht die der App!).
const leg = (x, y) => Math.round(air(COORDS[x], COORDS[y]));

const walkKpi = d => block(d).querySelector('.ausw-kpi[data-walk-kind]');
const walkVal = d => { const k = walkKpi(d); return k && k.querySelector('.ausw-kpi-val').textContent; };
const walkLabel = d => { const k = walkKpi(d); return k && k.querySelector('.ausw-kpi-label').textContent; };

// Alle Auftritte außer Act5 (keine Koordinaten), Act6 (keine Uhrzeit) und Act7 (Sa) am Fr besucht.
async function loadWith(walkScript) {
  const app = await loadApp({ dataScript, walkScript });
  const w = app.window;
  [1, 2, 3, 4, 5, 6, 7].forEach(n => w.setShowDuration('x', `nid:${n}`, '30'));
  w.switchTab('auswertung');
  return app;
}

(async () => {
  const t = createChecker();

  // ── Reine Funktionen ───────────────────────────────────────────────────
  {
    const { window: w } = await loadApp({ dataScript });
    t.check('formatMeters: 0 m / 999 m / 1,0 km / 1,2 km / 2,3 km.',
      [0, 999, 1000, 1234, 2281].map(w.formatMeters).join(' | ') === '0 m | 999 m | 1,0 km | 1,2 km | 2,3 km',
      [0, 999, 1000, 1234, 2281].map(w.formatMeters));
    const ref = air(COORDS.Docks, COORDS.Molotow);
    t.check('haversineMeters stimmt mit der unabhängigen Referenz überein (Docks-Molotow ~539 m).',
      Math.abs(w.haversineMeters(COORDS.Docks, COORDS.Molotow) - ref) < 0.001 && Math.round(ref) === 539, { app: w.haversineMeters(COORDS.Docks, COORDS.Molotow), ref });
    const dm = w.walkMeters('Docks', 'Molotow');
    t.check('walkMeters ohne Matrix: Luftlinie (exact=false), gerundet.', dm && dm.meters === leg('Docks', 'Molotow') && dm.exact === false, dm);
    t.check('walkMeters: identischer Ort = 0 m, exakt.', JSON.stringify(w.walkMeters('Docks', 'Docks')) === '{"meters":0,"exact":true}');
    t.check('walkMeters: Alias-Location mit gleichen Koordinaten (Molotow / Top Ten Bar) = 0 m.', w.walkMeters('Molotow', 'Molotow Top Ten Bar').meters === 0);
    t.check('walkMeters: Location ohne Koordinaten -> null (nicht berechenbar).', w.walkMeters('Docks', 'Nur Adresse') === null && w.walkMeters('Docks', '') === null);
  }

  // ── Ohne Fußweg-Datei: Luftlinie, sauber gekennzeichnet ────────────────
  {
    const { window: w, document: d } = await loadWith('');
    // Kette Fr (chronologisch, 00:10 gehört NACH 23:30): Docks 20:00 -> Prinzenbar 21:00 -> Molotow 23:30 -> Docks 00:10
    const expected = leg('Docks', 'Prinzenbar') + leg('Prinzenbar', 'Molotow') + leg('Molotow', 'Docks');
    const wrongOrder = leg('Docks', 'Docks') + leg('Docks', 'Prinzenbar') + leg('Prinzenbar', 'Molotow'); // 00:10 fälschlich zuerst
    t.check('Testvoraussetzung: richtige und falsche Reihenfolge ergeben unterschiedliche Strecken.', expected !== wrongOrder, { expected, wrongOrder });

    // Standardauswahl = alle Tage: Sa trägt 0 bei (nur 1 Stopp), die Strecke
    // entspricht also exakt der Fr-Kette - der Beweis, dass es KEINEN Weg über
    // die Tagesgrenze Fr -> Sa gibt (sonst wäre der Wert höher).
    t.check(`Mit allen Tagen ausgewählt: Strecke = ${km(expected)} (Zeiten nach Mitternacht korrekt einsortiert, Act5/Act6 nicht in der Kette, kein Weg über die Tagesgrenze zu Sa).`,
      walkVal(d) === km(expected), walkVal(d));
    t.check('Ohne Fußweg-Datei wird die Strecke als "Luftlinie" gekennzeichnet.', walkLabel(d) === 'Luftlinie' && walkKpi(d).getAttribute('data-walk-kind') === 'air');
    t.check('Hinweis nennt die 2 nicht berücksichtigten Auftritte (ohne Koordinaten / ohne Uhrzeit).',
      block(d).querySelector('.ausw-note').textContent.includes('2 besuchte Auftritte sind'));
    selectDays(d, ['Sa 18.09']);
    t.check('Nur Sa ausgewählt: nur ein Stopp -> keine Strecke ("–"), Label neutral.', walkVal(d) === '–' && walkLabel(d) === 'Strecke');
    selectDays(d, ALL_DAYS);
    // Die frühere feste Info-Box ist einem ⓘ-Icon-Modal gewichen - der erklärende
    // Text wird erst beim Öffnen befüllt (openAuswertungInfoModal()), nicht beim
    // bloßen Rendern der Blöcke. Kennzeichnung IN den Kennzahlen selbst bleibt
    // aber unverändert sichtbar (siehe walkLabel-Prüfungen oben/unten).
    w.openAuswertungInfoModal();
    const modalText = d.getElementById('auswertungInfoModal').textContent;
    t.check('Info-Modal erwähnt die Luftlinien-Näherung, keine OSM-Quellenangabe.',
      modalText.includes('Luftlinie') && !modalText.includes('OpenStreetMap'), modalText);
    w.closeAuswertungInfoModal();
  }

  // ── Mit vollständiger Fußweg-Matrix ────────────────────────────────────
  {
    const matrix = `const WALK_DISTANCES = { generated: '2026-09-21', source: 'test',
      venues: { 'Docks': 0, 'Prinzenbar': 1, 'Molotow': 2, 'Molotow Top Ten Bar': 2 },
      meters: [[0, 100, 700], [100, 0, 700], [700, 700, 0]] };`;
    const { window: w, document: d } = await loadWith(matrix);
    t.check('Mit Matrix: Fr = 100 + 700 + 700 = 1,5 km, Label "Fußweg".', walkVal(d) === '1,5 km' && walkLabel(d) === 'Fußweg' && walkKpi(d).getAttribute('data-walk-kind') === 'walk', { val: walkVal(d), label: walkLabel(d) });
    w.openAuswertungInfoModal();
    t.check('Mit Matrix zeigt das Info-Modal die OpenStreetMap-Quellenangabe.', d.getElementById('auswertungInfoModal').textContent.includes('OpenStreetMap'));
    w.closeAuswertungInfoModal();
    const m = w.walkMeters('Docks', 'Prinzenbar');
    t.check('walkMeters nutzt die Matrix (exact=true) statt der Luftlinie.', m.meters === 100 && m.exact === true, m);
    t.check('Alias-Locations mit gleichem Matrix-Index = 0 m (exakt).', JSON.stringify(w.walkMeters('Molotow', 'Molotow Top Ten Bar')) === '{"meters":0,"exact":true}');
  }

  // ── Matrix, in der eine Location fehlt -> gemischt ──────────────────────
  {
    const matrix = `const WALK_DISTANCES = { generated: '2026-09-21', source: 'test',
      venues: { 'Docks': 0, 'Prinzenbar': 1 }, meters: [[0, 100], [100, 0]] };`;
    const { document: d } = await loadWith(matrix);
    const expected = 100 + leg('Prinzenbar', 'Molotow') + leg('Molotow', 'Docks');
    t.check('Fehlt eine Location in der Matrix, wird nur dieser Wechsel als Luftlinie gerechnet ("teils Luftlinie").',
      walkVal(d) === km(expected) && walkKpi(d).getAttribute('data-walk-kind') === 'mixed' && walkLabel(d) === 'Weg (teils Luftlinie)',
      { val: walkVal(d), expected: km(expected), label: walkLabel(d) });
  }

  // ── Kein Wechsel möglich -> "–" ─────────────────────────────────────────
  {
    const { window: w, document: d } = await loadApp({ dataScript });
    w.setShowDuration('x', 'nid:5', '30'); // nur Act5 (keine Koordinaten)
    w.switchTab('auswertung');
    t.check('Ohne berechenbare Wechsel zeigt die Strecke "–" (und erklärt, warum).',
      walkVal(d) === '–' && block(d).querySelector('.ausw-note').textContent.includes('1 besuchter Auftritt ist'));
  }

  t.finish();
})();

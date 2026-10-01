const { loadApp, createChecker } = require('./test-helpers');

// Eigene, kleine Testdatendatei NUR für diesen Test - bewusst mit vollen
// deutschen Ländernamen (nicht den sonst üblichen Kürzeln in
// rbf-data.test.js), um die Abkürzungs-Logik konkret zu prüfen.
const dataScript = `
const DATA_VERSION = 'test-country-abbr';
const DAY_ORDER = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];
const RAW = [
  ['Lang Land Act', 'Pop', 'Berlin, Deutschland', 'divers', 'https://example.org/a'],
  ['Kurz Code Act', 'Pop', 'Wien, AT', 'divers', 'https://example.org/b'],
  ['Nur Land Act', 'Pop', 'Vereinigtes Königreich', 'divers', 'https://example.org/c'],
  ['Multi Land Act', 'Pop', 'Berlin, Deutschland / Australien', 'divers', 'https://example.org/d'],
];
const RAW_AUFTRITTE = [
  ['Lang Land Act', 'Mi 15.09', '20:00', '20:45', 'Docks', 1],
  ['Kurz Code Act', 'Mi 15.09', '21:00', '21:45', 'Docks', 2],
];
const VENUE_LOCATIONS = { 'Docks': { lat: 1, lng: 1 } };
const ANCHOR_AWARD_NOMINEES = [];
const SOUND_REFERENCES = [];
const RBF_EVENTS = [];
let lastAutoFixes = [];
let lastValidationIssues = [];
function autoFixAuftritte() {}
function validateAuftritte() {}
function updateValidationPanel() {}
`;

(async () => {
  const { window: w, document: d } = await loadApp({ dataScript });
  const t = createChecker();

  // 1) Reine Funktionstests von shortenHerkunft() - direkt und eindeutig.
  const cases = [
    ['Berlin, Deutschland', 'Berlin, DE'],
    ['Wien, Österreich', 'Wien, AT'],
    ['Zürich, Schweiz', 'Zürich, CH'],
    ['London, Vereinigtes Königreich', 'London, UK'],
    ['New York, Vereinigte Staaten', 'New York, USA'],
    ['Wien, AT', 'Wien, AT'], // bereits abgekürzt -> unverändert
    ['Vereinigtes Königreich', 'UK'], // nur Land, kein Komma
    ['Utopia, Nirgendwo', 'Utopia, Nirgendwo'], // unbekanntes Land -> unverändert
    ['', ''],
    // Zusammengesetzte Länder (mehrere Herkunftsländer, per "/" getrennt) -
    // genau der nachgemeldete Fall.
    ['Berlin, Deutschland / Australien', 'Berlin, DE / AU'],
    ['Deutschland / Australien', 'DE / AU'], // ohne Stadt
    ['Berlin, Deutschland / Nirgendwo', 'Berlin, DE / Nirgendwo'], // gemischt bekannt/unbekannt
    // Nachträglich ergänzte Länder.
    ['Kabul, Afghanistan', 'Kabul, AFG'],
    ['Casablanca, Marokko', 'Casablanca, MA'],
    ['Nikosia, Zypern', 'Nikosia, CY'],
    ['Luxemburg, Luxemburg', 'Luxemburg, LUX'],
    ['Lagos, Nigeria', 'Lagos, NG'],
    ['Bogotá, Kolumbien', 'Bogotá, CO'],
    ['Beirut, Libanon', 'Beirut, LB'],
    ['Damaskus, Syrien', 'Damaskus, SY'],
    ['Torshavn, Färöer-Inseln', 'Torshavn, FO'],
    ['Torshavn, Färöer', 'Torshavn, FO'],
    ['Karachi, Pakistan', 'Karachi, PK'],
    ['Paramaribo, Suriname', 'Paramaribo, SR'],
    ['Ramallah, Palästina', 'Ramallah, PS'],
    ['Tunis, Tunesien', 'Tunis, TN'],
    ['Bischkek, Kirgistan', 'Bischkek, KG'],
    ['Praia, Kap Verde', 'Praia, CV'],
  ];
  for (const [input, expected] of cases) {
    const got = w.shortenHerkunft(input);
    t.check(`shortenHerkunft("${input}") -> "${got}"`, got === expected, { erwartet: expected });
  }

  // 2) Integration: Künstler-Übersicht zeigt die abgekürzte Form.
  w.render();
  const countryDivs = [...d.querySelectorAll('.artist-country')].map(el => el.textContent);
  t.check('Künstler-Übersicht zeigt "Berlin, DE" statt "Berlin, Deutschland".', countryDivs.includes('Berlin, DE'), countryDivs);
  t.check('Reiner Länder-Wert ohne Stadt wird ebenfalls korrekt abgekürzt ("UK").', countryDivs.includes('UK'), countryDivs);
  t.check('Zusammengesetztes Land ("Deutschland / Australien") wird in der Künstler-Übersicht korrekt zu "DE / AU" gekürzt.',
    countryDivs.includes('Berlin, DE / AU'), countryDivs);

  // 3) Herkunft-Filter-Dropdown zeigt ebenfalls die abgekürzte Form als Label,
  // behält aber den vollen Namen als "value" (für korrektes Filtern).
  const herkunftSel = d.getElementById('fHerkunft');
  const options = [...herkunftSel.options];
  const berlinOption = options.find(o => o.value === 'Berlin, Deutschland');
  t.check('Dropdown-Option behält den vollen Wert, zeigt aber die abgekürzte Beschriftung.',
    !!berlinOption && berlinOption.textContent === 'Berlin, DE', berlinOption && berlinOption.textContent);

  // 4) Filtern funktioniert weiterhin über den vollen (rohen) Wert.
  herkunftSel.value = 'Berlin, Deutschland';
  w.render();
  const namesAfterFilter = [...d.querySelectorAll('.artist-name')].map(el => el.textContent);
  t.check('Filtern über den Herkunft-Dropdown funktioniert weiterhin korrekt (roher Wert bleibt Filterkriterium).',
    namesAfterFilter.some(n => n.includes('Lang Land Act')) && !namesAfterFilter.some(n => n.includes('Kurz Code Act')), namesAfterFilter);
  herkunftSel.value = '';
  w.render();

  // 5) Programm-Übersicht zeigt weiterhin den VOLLEN Ländernamen (bewusst
  // NICHT abgekürzt, da dort mehr Platz vorhanden ist).
  w.currentTab = 'programm';
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();
  const progMetaTexts = [...d.querySelectorAll('.prog-meta')].map(el => el.textContent);
  t.check('Programm-Übersicht zeigt weiterhin den vollen Ländernamen ("Berlin, Deutschland").',
    progMetaTexts.some(txt => txt.includes('Berlin, Deutschland')), progMetaTexts);

  t.finish();
})();

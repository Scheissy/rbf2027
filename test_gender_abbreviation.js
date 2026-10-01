const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  // 1) Reine Funktionstests von shortenGeschlecht().
  const cases = [
    ['weiblich', 'w'],
    ['männlich', 'm'],
    ['divers', 'd'],
    ['mixed', 'mix'],
    ['unbekannt', 'unbekannt'], // unbekannter Wert -> unverändert
  ];
  for (const [input, expected] of cases) {
    const got = w.shortenGeschlecht(input);
    t.check(`shortenGeschlecht("${input}") -> "${got}"`, got === expected, { erwartet: expected });
  }

  // 2) Keine Kollision: "m" (männlich) und "mix" (mixed) sind eindeutig
  // unterscheidbare Strings, keine Überschneidung.
  const short = Object.values({ w: w.shortenGeschlecht('weiblich'), m: w.shortenGeschlecht('männlich'), d: w.shortenGeschlecht('divers'), mix: w.shortenGeschlecht('mixed') });
  const uniqueCount = new Set(short).size;
  t.check('Alle vier Kurzformen sind eindeutig voneinander unterscheidbar (keine Kollision).', uniqueCount === 4, short);

  // 3) Integration: Künstler-Übersicht zeigt die Kurzform, mit vollem Wert im title.
  w.render();
  const genderBadges = [...d.querySelectorAll('.artist-row .badge')].filter(b => ['w', 'm', 'd', 'mix'].includes(b.textContent));
  t.check(`Künstler-Übersicht zeigt Kurzformen (${genderBadges.length} Badges gefunden).`, genderBadges.length > 0);
  const mixedBadge = genderBadges.find(b => b.textContent === 'mix');
  if (!mixedBadge) {
    console.log('ℹ️  Kein "mixed"-Künstler in den Testdaten - Kollisionsfreiheit wurde bereits oben rein funktional geprüft.');
  } else {
    t.check(`"mixed"-Badge zeigt "mix" mit vollem Wert im title-Attribut ("${mixedBadge.getAttribute('title')}").`, !!mixedBadge.getAttribute('title'));
  }

  // 4) Programm-Übersicht zeigt weiterhin den VOLLEN Wert (bewusst nicht
  // abgekürzt, dort ist genug Platz).
  w.currentTab = 'programm';
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();
  const progGenderTexts = [...d.querySelectorAll('.prog-name .badge')].map(b => b.textContent);
  const hasFullWordInProg = progGenderTexts.some(txt => ['weiblich', 'männlich', 'divers', 'mixed'].includes(txt));
  t.check('Programm-Übersicht zeigt weiterhin den vollen Geschlecht-Wert.', hasFullWordInProg, progGenderTexts);

  t.finish();
})();

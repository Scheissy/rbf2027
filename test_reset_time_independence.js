const { loadApp, createChecker } = require('./test-helpers');

function snapshotFilterState(w, d) {
  return {
    activeDays: [...d.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day),
    timeFrom: d.getElementById('timeFrom').value,
    timeTo: d.getElementById('timeTo').value,
    // selectedLocs ist eine top-level `let`-Variable, kein window-Property -
    // wir lesen den Location-Filter-Zustand daher indirekt über den
    // sichtbaren Button-Text ab ("📍 Alle Locations" = leer/zurückgesetzt).
    locBtnText: d.getElementById('locFilterBtn').textContent.trim(),
    status: d.getElementById('fProgStatus').value,
    duration: d.getElementById('fProgDuration').checked,
    planned: d.getElementById('fProgPlanned').checked
  };
}

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  // "Zeitunabhängig" bezieht sich jetzt konkret auf: innerhalb DESSELBEN
  // Festivaltags liefert "Filter zurücksetzen" immer denselben Zustand,
  // unabhängig von der genauen Uhrzeit des Klicks (die Tage-Auswahl selbst
  // hängt bewusst vom Tag ab, siehe test_reset_past_days.js).
  w.getBerlinNow = () => ({ year: 2027, month: 9, day: 17, hour: 10, minute: 0 });
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === 'Mi 15.09'));
  d.getElementById('timeFrom').value = '15:00';
  d.getElementById('fProgStatus').value = 'ja';
  d.getElementById('fProgDuration').checked = true;
  w.toggleLocSelection('Docks');

  w.resetProgFilters();
  const stateFriAt10 = snapshotFilterState(w, d);

  // Gleicher Tag (Freitag), andere Uhrzeit (22 statt 10 Uhr) - Ergebnis muss
  // identisch sein, denn die Uhrzeit innerhalb eines Tages darf keine Rolle
  // spielen (nur der Tag selbst ist jetzt relevant, siehe getPastFestivalDays()).
  w.getBerlinNow = () => ({ year: 2027, month: 9, day: 17, hour: 22, minute: 0 });
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === 'Fr 17.09'));
  d.getElementById('timeFrom').value = '20:00';
  d.getElementById('fProgStatus').value = 'unbekannt';
  d.getElementById('fProgPlanned').checked = true;

  w.resetProgFilters();
  const stateFriAt22 = snapshotFilterState(w, d);

  console.log('Zustand nach Reset (Fr 10 Uhr):', JSON.stringify(stateFriAt10));
  console.log('Zustand nach Reset (Fr 22 Uhr):', JSON.stringify(stateFriAt22));

  t.check('"Filter zurücksetzen" liefert am selben Festivaltag unabhängig von der genauen Uhrzeit IMMER denselben Zustand.',
    JSON.stringify(stateFriAt10) === JSON.stringify(stateFriAt22));

  const expected = {
    activeDays: ['Fr 17.09', 'Sa 18.09'],
    timeFrom: '08:00',
    timeTo: '',
    locBtnText: '📍 Alle Locations',
    status: '',
    duration: false,
    planned: false
  };
  t.check('Reset-Zustand an einem Freitag entspricht "Fr+Sa aktiv, ab 08:00, keine weiteren Filter" (Mi/Do als vergangen ausgeblendet).',
    JSON.stringify(stateFriAt10) === JSON.stringify(expected), stateFriAt10);

  t.finish();
})();

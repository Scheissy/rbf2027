const { loadApp, createChecker, activeDays } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  function check(label, mockNow, expectedDays) {
    w.getBerlinNow = () => mockNow;
    w.resetProgFilters();
    const got = activeDays(d);
    t.check(`${label} -> ${JSON.stringify(got)}`, JSON.stringify(got) === JSON.stringify(expectedDays), { erwartet: expectedDays, erhalten: got });
  }

  // Mittwoch (erster Festivaltag) - kein Tag ist "davor", also alle aktiv.
  check('Reset am Mi 15.09, 12 Uhr', { year: 2027, month: 9, day: 15, hour: 12, minute: 0 },
    ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09']);

  // Donnerstag - Mittwoch ist vorbei.
  check('Reset am Do 16.09, 12 Uhr', { year: 2027, month: 9, day: 16, hour: 12, minute: 0 },
    ['Do 16.09', 'Fr 17.09', 'Sa 18.09']);

  // Freitag (das konkrete Beispiel aus der Anfrage) - Mi+Do sind vorbei.
  check('Reset am Fr 17.09, 12 Uhr', { year: 2027, month: 9, day: 17, hour: 12, minute: 0 },
    ['Fr 17.09', 'Sa 18.09']);

  // Samstag (letzter Tag) - nur noch Samstag übrig.
  check('Reset am Sa 18.09, 12 Uhr', { year: 2027, month: 9, day: 18, hour: 12, minute: 0 },
    ['Sa 18.09']);

  // Nachteulen-Puffer: 2 Uhr nachts am 17.09 (Kalendertag Freitag) zählt
  // wegen des Nachtprogramms noch als "Donnerstag" - Mi ist vorbei, Do/Fr/Sa
  // bleiben aktiv (Donnerstag ist ja noch "heute" aus Sicht des Nachtprogramms).
  check('Reset am 17.09 um 2 Uhr nachts (zählt noch als Do)', { year: 2027, month: 9, day: 17, hour: 2, minute: 0 },
    ['Do 16.09', 'Fr 17.09', 'Sa 18.09']);

  // Vor Festivalbeginn - alles ist zukünftig, kein Tag wird ausgeblendet.
  check('Reset vor Festivalbeginn (1. September)', { year: 2027, month: 9, day: 1, hour: 12, minute: 0 },
    ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09']);

  // Nach Festivalende - alles ist vergangen, dann lieber alles zeigen statt
  // eine leere Auswahl (kein Tag wird ausgeblendet).
  check('Reset nach Festivalende (25. September)', { year: 2027, month: 9, day: 25, hour: 12, minute: 0 },
    ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09']);

  t.finish();
})();

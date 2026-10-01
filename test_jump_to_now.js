const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  // "Jetzt" ist Do 16.09, 14:07 Uhr Berlin -> minus 30 Min, auf 30-Min-Slot
  // abgerundet = 13:30. getBerlinNow ist eine function-Deklaration und damit
  // (anders als let/const) eine echte window-Property - wir können sie für
  // den Test gefahrlos überschreiben.
  w.getBerlinNow = () => ({ year: 2027, month: 9, day: 16, hour: 14, minute: 7 });

  // Vorbedingung herstellen: irgendein anderer Filter ist aktiv (Status
  // "Gesehen"), Tag/Zeit weichen von "jetzt" ab.
  d.getElementById('fProgStatus').value = 'ja';
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === 'Sa 18.09'));
  d.getElementById('timeFrom').value = '08:00';

  // 1. Klick: nur Tag+Zeit sollen sich ändern, Status-Filter bleibt erhalten.
  // "Heute" ist Do 16.09 -> aktiviert werden Do+Fr+Sa (heute + kommende Tage,
  // Mi ist vorbei) - analog zu resetProgFilters()/applySmartProgDefaults().
  w.jumpToNow();
  const expectedDays = ['Do 16.09', 'Fr 17.09', 'Sa 18.09'];
  const dayOk1 = [...d.querySelectorAll('.day-btn')].every(b => b.classList.contains('active') === expectedDays.includes(b.dataset.day));
  const timeOk1 = d.getElementById('timeFrom').value === '13:30';
  const statusUnchanged1 = d.getElementById('fProgStatus').value === 'ja';
  t.check('1. Klick setzt Tag/Zeit korrekt auf "jetzt" (heute + kommende Tage).', dayOk1 && timeOk1, { dayOk1, timeOk1, timeFrom: d.getElementById('timeFrom').value });
  t.check('1. Klick lässt den Status-Filter unangetastet.', statusUnchanged1);

  // 2. Klick (wir stehen bereits auf Tag/Zeit von "jetzt"): jetzt sollen die
  // übrigen Filter zusätzlich zurückgesetzt werden.
  w.jumpToNow();
  const statusReset = d.getElementById('fProgStatus').value === '';
  const dayOk2 = [...d.querySelectorAll('.day-btn')].every(b => b.classList.contains('active') === expectedDays.includes(b.dataset.day));
  const timeOk2 = d.getElementById('timeFrom').value === '13:30';
  t.check('2. Klick (bereits auf "jetzt") setzt den Status-Filter zusätzlich zurück.', statusReset);
  t.check('Tag/Zeit bleiben beim 2. Klick weiterhin korrekt auf "jetzt".', dayOk2 && timeOk2);

  // "Ausgeblendete anzeigen" und die beiden Event-Sichtbarkeits-Haken dürfen
  // auch beim 2. Klick nicht angetastet werden.
  d.getElementById('progShowHidden').checked = true;
  d.getElementById('settingShowMusicEvents').checked = false;
  d.getElementById('settingShowOtherEvents').checked = false;
  w.jumpToNow(); // weiterhin "schon auf jetzt" -> zählt als "2./n-ter Klick"
  const untouched = d.getElementById('progShowHidden').checked === true
    && d.getElementById('settingShowMusicEvents').checked === false
    && d.getElementById('settingShowOtherEvents').checked === false;
  t.check('"Ausgeblendete anzeigen" und die Event-Sichtbarkeits-Haken bleiben unangetastet.', untouched);

  // Nach einer manuellen Änderung (z.B. anderer Tag) gilt der nächste Klick
  // wieder als "1. Klick" (nur Zeitsprung, kein Reset der übrigen Filter).
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === 'Mi 15.09'));
  d.getElementById('fProgStatus').value = 'unbekannt';
  w.jumpToNow();
  const statusPreservedAgain = d.getElementById('fProgStatus').value === 'unbekannt';
  t.check('Nach manueller Tag-Änderung zählt der nächste Klick wieder als "1. Klick" (kein sofortiger Reset).', statusPreservedAgain);

  t.finish();
})();

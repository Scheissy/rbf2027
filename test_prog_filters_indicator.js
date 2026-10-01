const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  w.currentTab = 'programm';
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();

  const dot = d.getElementById('progFiltersActiveDot');
  const isDotVisible = () => dot.style.display === 'inline-block';

  // 1) Panel eingeklappt, keine Filter aktiv -> Punkt unsichtbar.
  t.check('Ohne aktive Filter (eingeklappt) ist der Punkt unsichtbar.', !isDotVisible());

  // 2) Die beiden Event-Checkboxen ausschalten -> Punkt bleibt trotzdem
  // unsichtbar (explizit ausgenommen laut Vorgabe).
  d.getElementById('settingShowMusicEvents').checked = false;
  w.toggleSetting('showMusicEvents', false);
  d.getElementById('settingShowOtherEvents').checked = false;
  w.toggleSetting('showOtherEvents', false);
  w.renderProg();
  t.check('Die beiden Event-Sichtbarkeits-Haken lösen den Punkt NICHT aus (wie gefordert).', !isDotVisible());
  // Zurücksetzen für die folgenden Tests.
  d.getElementById('settingShowMusicEvents').checked = true;
  w.toggleSetting('showMusicEvents', true);
  d.getElementById('settingShowOtherEvents').checked = true;
  w.toggleSetting('showOtherEvents', true);

  // 3) Jeder der "echten" versteckten Filter einzeln aktivieren -> Punkt
  // muss jedes Mal erscheinen, und nach dem Zurücksetzen wieder verschwinden.
  const cases = [
    { label: 'Genre-Filter', set: () => w.toggleProgGenreSelection('Techno'), unset: () => w.toggleProgGenreSelection('Techno') },
    { label: 'Künstler-Ø-Bewertungsfilter', set: () => w.setProgRatingFilter(3), unset: () => w.setProgRatingFilter(3) },
    { label: 'Auftritt-Bewertungsfilter', set: () => w.setProgShowRatingFilter(3), unset: () => w.setProgShowRatingFilter(3) },
    { label: 'Status-Filter', set: () => { d.getElementById('fProgStatus').value = 'ja'; w.renderProg(); }, unset: () => { d.getElementById('fProgStatus').value = ''; w.renderProg(); } },
    { label: '"Nur als Ziel markierte"', set: () => { d.getElementById('fProgPlanned').checked = true; w.renderProg(); }, unset: () => { d.getElementById('fProgPlanned').checked = false; w.renderProg(); } },
    { label: '"Nur mit Dauer"', set: () => { d.getElementById('fProgDuration').checked = true; w.renderProg(); }, unset: () => { d.getElementById('fProgDuration').checked = false; w.renderProg(); } },
    { label: '"Ausgeblendete anzeigen"', set: () => { d.getElementById('progShowHidden').checked = true; w.renderProg(); }, unset: () => { d.getElementById('progShowHidden').checked = false; w.renderProg(); } }
  ];
  for (const c of cases) {
    c.set();
    t.check(`${c.label} löst den Punkt korrekt aus.`, isDotVisible());
    c.unset();
    t.check(`${c.label} zurückgesetzt -> Punkt verschwindet wieder.`, !isDotVisible());
  }

  // 4) Bei AUFGEKLAPPTEM Panel bleibt der Punkt unsichtbar, auch wenn ein
  // Filter aktiv ist (dort sieht man die Filter ja bereits direkt).
  d.getElementById('fProgPlanned').checked = true;
  w.renderProg();
  w.toggleProgFiltersPanel(); // aufklappen
  t.check('Bei aufgeklapptem Panel bleibt der Punkt unsichtbar, obwohl ein Filter aktiv ist.', !isDotVisible());
  w.toggleProgFiltersPanel(); // wieder einklappen
  t.check('Nach dem erneuten Einklappen erscheint der Punkt wieder (Filter ist ja weiterhin aktiv).', isDotVisible());
  d.getElementById('fProgPlanned').checked = false;
  w.renderProg();

  // 5) "Filter zurücksetzen" räumt auch den Indikator mit auf - UND setzt
  // die Bewertungsfilter tatsächlich zurück (nicht nur den Indikator-Punkt):
  // geprüft an der WIRKUNG (ein durch den Filter ausgeblendeter Auftritt muss
  // wieder erscheinen), nicht nur am internen Zustand. Regressionsschutz für
  // die gemeinsame clearProgFilterState()-Funktion (genutzt von
  // resetProgFilters() UND jumpToNow(), siehe Fall 6 unten).
  d.getElementById('fProgStatus').value = 'ja';
  w.toggleProgGenreSelection('Pop');
  w.setProgShowRatingFilter(5); // Nova Frequenz (unbewertet) wird dadurch ausgeblendet
  w.renderProg();
  t.check('Testvoraussetzung: Auftritt-Bewertungsfilter (5★) blendet den unbewerteten "Nova Frequenz" aus.',
    !d.getElementById('progList').innerHTML.includes('Nova Frequenz'));
  w.resetProgFilters();
  t.check('"Filter zurücksetzen" entfernt auch den Aktiv-Indikator wieder.', !isDotVisible());
  t.check('"Filter zurücksetzen" setzt den Auftritt-Bewertungsfilter WIRKLICH zurück ("Nova Frequenz" ist wieder sichtbar), nicht nur optisch den Indikator-Punkt.',
    d.getElementById('progList').innerHTML.includes('Nova Frequenz'));

  // 6) Derselbe Reset-Kern wird auch beim 2. "Jetzt"-Klick verwendet
  // (clearProgFilterState()) - muss den Bewertungsfilter ebenso zurücksetzen.
  // "Jetzt" braucht einen echten Festivaltag, sonst bricht es sofort ab.
  w.getBerlinNow = () => ({ year: 2027, month: 9, day: 17, hour: 14, minute: 0 });
  w.setProgShowRatingFilter(5); // Blau Neon (Fr, unbewertet) wird dadurch ausgeblendet
  w.renderProg();
  t.check('Testvoraussetzung: Bewertungsfilter erneut aktiv, "Blau Neon" (Fr) ausgeblendet.',
    !d.getElementById('progList').innerHTML.includes('Blau Neon'));
  w.jumpToNow(); // 1. Klick: nur Tag/Zeit (springt auf Fr+Sa), Bewertungsfilter bleibt (noch) bestehen
  w.jumpToNow(); // 2. Klick (bereits auf "jetzt"): setzt die übrigen Filter zurück
  t.check('Der 2. "Jetzt"-Klick setzt den Auftritt-Bewertungsfilter ebenfalls WIRKLICH zurück ("Blau Neon" ist wieder sichtbar).',
    d.getElementById('progList').innerHTML.includes('Blau Neon'));

  t.finish();
})();

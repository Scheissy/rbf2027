const { createHelpers, loadApp, createChecker } = require('./test-helpers');

// Einzeltests der Filter-Prädikate (Programm- und Künstler-Übersicht) und der Hilfstabellen.
(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { ev } = H;
  const t = createChecker();

  const P = id => ev(`PROG_FILTERS.find(p => p.id === '${id}')`).test;
  const K = id => ev(`KUENSTLER_FILTERS.find(p => p.id === '${id}')`).test;
  const base = (over) => Object.assign({ days: ['Do 16.09'], fromVal: '', toVal: '', showHidden: false, minRating: 0, statusVal: '', durationOnly: false, plannedOnly: false }, over || {});
  const show = (over) => Object.assign({ name: 'X', day: 'Do 16.09', time: '21:00', endTime: '22:00', location: 'Docks', nid: 77 }, over || {});
  const reset = () => ev("selectedLocs.clear(); progSelectedGenres.clear(); selectedGenres.clear(); hiddenEvents = {}; planFlags = {}; showDurations = {}; showRatings = {}; progShowRatingFilter = 0; progRatingFilter = 0; kuenstlerAvgFilter = 0; statsAusgeblendetFilter = false; statsBewertetFilter = false; statsUnbewertetFilter = false; statsReinhoerenFilter = false; kuenstlerSeenFilter = ''; appSettings.hiddenLocations = []; appSettings.showRbfEvents = true;");
  reset();

  // ───────── Programm-Prädikate ─────────
  t.check('Die Programm-Filter-Liste enthält genau diese 12 Prädikate in dieser Reihenfolge.', ev("PROG_FILTERS.map(p => p.id).join()") === 'day,rbfEvents,hiddenLocation,location,hidden,time,avgRating,genre,showRating,status,duration,planned');
  t.check('Jedes Prädikat hat eine eindeutige Id und eine test-Funktion.', ev("new Set(PROG_FILTERS.map(p => p.id)).size === PROG_FILTERS.length && PROG_FILTERS.every(p => typeof p.test === 'function')"));
  t.check('day: nur Auftritte aktiver Tage.', P('day')(show(), base()) === true && P('day')(show({ day: 'Fr 17.09' }), base()) === false);
  ev("appSettings.showRbfEvents = false;");
  t.check('rbfEvents: bei ausgeschalteten Sonderveranstaltungen fallen Events raus, Künstler-Auftritte bleiben.', P('rbfEvents')(show({ isEvent: true }), base()) === false && P('rbfEvents')(show(), base()) === true);
  ev("appSettings.showRbfEvents = true;");
  t.check('rbfEvents: bei eingeschalteten Events bleiben sie.', P('rbfEvents')(show({ isEvent: true }), base()) === true);
  ev("appSettings.hiddenLocations = ['Docks'];");
  t.check('hiddenLocation: dauerhaft ausgeblendete Location fällt raus, andere bleiben.', P('hiddenLocation')(show(), base()) === false && P('hiddenLocation')(show({ location: 'Molotow' }), base()) === true);
  ev("appSettings.hiddenLocations = [];");
  t.check('location: ohne Auswahl bleibt alles, mit Auswahl nur die gewählten Locations.', P('location')(show(), base()) === true && (ev("selectedLocs.add('Molotow')"), P('location')(show(), base()) === false && P('location')(show({ location: 'Molotow' }), base()) === true));
  reset();
  t.check('hidden: ausgeblendeter Künstler fällt raus, mit "Ausgeblendete anzeigen" bleibt er.', P('hidden')(show(), base(), { ausgeblendet: true }) === false && P('hidden')(show(), base({ showHidden: true }), { ausgeblendet: true }) === true && P('hidden')(show(), base(), { ausgeblendet: false }) === true);
  ev("hiddenEvents[77] = true;");
  t.check('hidden: ausgeblendete Sonderveranstaltung fällt raus; ein gleichnamiger Künstler-Auftritt (kein Event) nicht.', P('hidden')(show({ isEvent: true }), base(), undefined) === false && P('hidden')(show({ isEvent: false }), base(), undefined) === true);
  reset();
  const tm = (time, from, to) => P('time')(show({ time }), base({ fromVal: from, toVal: to }));
  t.check('time: ohne Uhrzeit (TBA) bleibt der Auftritt immer.', tm('', '22:00', '23:00') === true);
  t.check('time: Von-/Bis-Grenzen sind inklusive, davor/danach fällt raus.', tm('21:00', '21:00', '22:00') === true && tm('22:00', '21:00', '22:00') === true && tm('20:59', '21:00', '22:00') === false && tm('22:01', '21:00', '22:00') === false);
  t.check('time: ohne Grenzen bleibt alles; nur "Von" bzw. nur "Bis" wirkt einseitig.', tm('03:00', '', '') === true && tm('09:00', '10:00', '') === false && tm('11:00', '', '10:00') === false);
  t.check('time: Nachtprogramm nach Mitternacht zählt als später als 23:00.', tm('00:30', '', '23:00') === false && tm('00:30', '22:00', '') === true);
  t.check('avgRating: Mindestbewertung greift (Künstler ohne Eintrag zählt als 0, fällt also raus).', P('avgRating')(show(), base({ minRating: 3 }), { rp: 5, rl: 5 }) === true && P('avgRating')(show(), base({ minRating: 3 }), { rp: 1, rl: 1 }) === false && P('avgRating')(show(), base({ minRating: 3 }), undefined) === false && P('avgRating')(show(), base(), undefined) === true);
  ev("progSelectedGenres.add('Rock');");
  t.check('genre: nur Künstler mit gewähltem Genre; Events (kein Eintrag) fallen raus.', P('genre')(show(), base(), { genre: 'Rock / Pop' }) === true && P('genre')(show(), base(), { genre: 'Techno' }) === false && P('genre')(show(), base(), undefined) === false);
  ev("progSelectedGenres.clear();");
  t.check('genre: ohne Auswahl bleibt alles (auch Events).', P('genre')(show(), base(), undefined) === true);
  ev("progShowRatingFilter = 3; showRatings['nid:77'] = 2;");
  t.check('showRating: Auftritte mit zu niedriger (oder ohne) Auftritts-Bewertung fallen raus.', P('showRating')(show(), base()) === false && (ev("showRatings['nid:77'] = 4"), P('showRating')(show(), base()) === true));
  reset();
  const st = (val, d2) => P('status')(show(), base({ statusVal: val }), d2);
  t.check('status "ja": nur gesehene Künstler; Events (kein Eintrag) fallen raus.', st('ja', { gesehen: 'ja' }) === true && st('ja', { gesehen: 'bekannt' }) === false && st('ja', undefined) === false);
  t.check('status "bekannt": bekannte UND gesehene Künstler.', st('bekannt', { gesehen: 'bekannt' }) === true && st('bekannt', { gesehen: 'ja' }) === true && st('bekannt', { gesehen: '' }) === false);
  t.check('status "unbekannt": nur Künstler ohne Status; Events fallen raus.', st('unbekannt', { gesehen: '' }) === true && st('unbekannt', { gesehen: 'ja' }) === false && st('unbekannt', undefined) === false);
  t.check('status leer: alles bleibt, auch Events.', st('', undefined) === true && st('', { gesehen: 'ja' }) === true);
  t.check('duration: "nur mit Dauer" lässt nur Auftritte mit eingetragener Dauer durch.', P('duration')(show(), base({ durationOnly: true })) === false && (ev("showDurations['nid:77'] = 30"), P('duration')(show(), base({ durationOnly: true })) === true) && P('duration')(show(), base()) === true);
  t.check('planned: "nur Ziele" lässt nur markierte Auftritte durch.', P('planned')(show(), base({ plannedOnly: true })) === false && (ev("planFlags['nid:77'] = true"), P('planned')(show(), base({ plannedOnly: true })) === true) && P('planned')(show(), base()) === true);
  reset();

  // Zusammenspiel: getFilteredAuftritte = alle Prädikate (UND), mit echten Filter-Elementen
  H.showAllProg({ switchTab: true });
  const all = ev("allProgEntries().length"), shown = ev("getFilteredAuftritte().length");
  t.check('getFilteredAuftritte ohne Filter liefert alle Einträge mit Tag-Filter "alle Tage" und ab 08:00.', shown > 0 && shown <= all);
  const sample = ev("getFilteredAuftritte()[0]");
  ev(`planFlags[showKey(getFilteredAuftritte()[0])] = true;`);
  d.getElementById('fProgPlanned').checked = true;
  t.check('Zusammenspiel: Haken "nur Ziele" lässt über getFilteredAuftritte genau den markierten Auftritt übrig.', ev("getFilteredAuftritte().length") === 1 && ev("showKey(getFilteredAuftritte()[0])") === ev(`showKey(${JSON.stringify(sample)})`));
  d.getElementById('fProgPlanned').checked = false; reset();
  const origTest = ev("PROG_FILTERS.find(p => p.id === 'day')");
  const keep = origTest.test; origTest.test = () => false;
  t.check('Ein Prädikat, das false liefert, blendet über getFilteredAuftritte alles aus (die Liste wird wirklich verwendet).', ev("getFilteredAuftritte().length") === 0);
  origTest.test = keep;
  t.check('Nach Wiederherstellen des Prädikats ist die Liste wieder gefüllt.', ev("getFilteredAuftritte().length") > 0);
  const state = ev("readProgFilterState()");
  t.check('readProgFilterState liest alle acht Werte (Tage, Von, Bis, Ausgeblendete, Mindestbewertung, Status, Dauer, Ziele).', ['days', 'fromVal', 'toVal', 'showHidden', 'minRating', 'statusVal', 'durationOnly', 'plannedOnly'].every(k => k in state) && Array.isArray(state.days));

  // ───────── Künstler-Prädikate ─────────
  const kf = (over) => Object.assign({ q: '', fg: '', fs: '', fHerkunft: '', fSoundRef: '' }, over || {});
  const art = (over) => Object.assign({ name: 'Nova Frequenz', genre: 'Electro / Pop', herkunft: 'Berlin, DE', geschlecht: 'weiblich', gesehen: '', rp: 0, rl: 0, ausgeblendet: false, reinhoeren: false }, over || {});
  t.check('Die Künstler-Filter-Liste enthält genau diese 11 Prädikate in dieser Reihenfolge.', ev("KUENSTLER_FILTERS.map(p => p.id).join()") === 'search,gender,seen,genre,herkunft,soundRef,hidden,avg,rated,unrated,listen');
  t.check('search: findet Name, Genre und Herkunft; Umlaute/Groß-Kleinschreibung egal; sonst raus.', K('search')(art(), kf({ q: ev("normalizeSearch('nova')") })) && K('search')(art(), kf({ q: ev("normalizeSearch('electro')") })) && K('search')(art(), kf({ q: ev("normalizeSearch('berlin')") })) && !K('search')(art(), kf({ q: ev("normalizeSearch('zzz')") })) && K('search')(art(), kf()));
  t.check('gender: nur das gewählte Geschlecht, leer = alle.', K('gender')(art(), kf({ fg: 'weiblich' })) && !K('gender')(art(), kf({ fg: 'männlich' })) && K('gender')(art(), kf()));
  t.check('seen: Künstler-Status nach derselben Tabelle wie im Programm.', K('seen')(art({ gesehen: 'ja' }), kf({ fs: 'bekannt' })) && !K('seen')(art({ gesehen: '' }), kf({ fs: 'bekannt' })) && K('seen')(art({ gesehen: '' }), kf({ fs: 'unbekannt' })) && K('seen')(art({ gesehen: 'ja' }), kf()));
  ev("selectedGenres.add('Techno');");
  t.check('genre: nur Künstler mit gewähltem Genre.', !K('genre')(art(), kf()) && K('genre')(art({ genre: 'Techno / Rave' }), kf()));
  ev("selectedGenres.clear();");
  t.check('genre: ohne Auswahl bleibt alles.', K('genre')(art(), kf()));
  t.check('herkunft: nur die gewählte Herkunft (als Tag), leer = alle.', K('herkunft')(art({ herkunft: 'Berlin, DE' }), kf({ fHerkunft: 'Berlin, DE' })) && !K('herkunft')(art({ herkunft: 'Berlin, DE' }), kf({ fHerkunft: 'Paris, FR' })) && K('herkunft')(art(), kf()));
  const orig = w.soundReferencesFor; w.soundReferencesFor = () => [{ referenz: ['Band A'], kategorie: 'x' }];
  t.check('soundRef: nur Künstler mit der gewählten Referenz.', K('soundRef')(art(), kf({ fSoundRef: 'Band A' })) && !K('soundRef')(art(), kf({ fSoundRef: 'Band B' })) && K('soundRef')(art(), kf()));
  w.soundReferencesFor = orig;
  t.check('hidden: standardmäßig nur sichtbare Künstler; mit Statistik-Filter "ausgeblendet" nur ausgeblendete.', K('hidden')(art()) && !K('hidden')(art({ ausgeblendet: true })) && (ev("statsAusgeblendetFilter = true"), !K('hidden')(art()) && K('hidden')(art({ ausgeblendet: true }))));
  ev("statsAusgeblendetFilter = false; kuenstlerAvgFilter = 3;");
  t.check('avg: Mindest-Durchschnitt greift.', K('avg')(art({ rp: 5, rl: 5 })) && !K('avg')(art({ rp: 1, rl: 1 })));
  ev("kuenstlerAvgFilter = 0; statsBewertetFilter = true;");
  t.check('rated ("bewertet"): mindestens eine Bewertung (Vorab oder Live).', K('rated')(art({ rp: 2 })) && K('rated')(art({ rl: 3 })) && !K('rated')(art()));
  ev("statsBewertetFilter = false; statsUnbewertetFilter = true;");
  t.check('unrated ("unbewertet"): Künstler ohne Vorab-Bewertung.', K('unrated')(art()) && !K('unrated')(art({ rp: 2 })));
  ev("statsUnbewertetFilter = false; statsReinhoerenFilter = true;");
  t.check('listen ("reinhören"): nur markierte Künstler.', K('listen')(art({ reinhoeren: true })) && !K('listen')(art()));
  reset();
  w.switchTab('kuenstler'); w.resetKuenstlerFilters();
  const total = ev("getFiltered().length");
  t.check('getFiltered ohne Filter: alle nicht ausgeblendeten Künstler.', total === ev("Object.values(dataMap).filter(x => !x.ausgeblendet).length"));
  d.getElementById('search').value = 'nova';
  t.check('getFiltered mit Suche "nova" findet über das Suchfeld den passenden Künstler.', ev("getFiltered().map(x => x.name)").includes('Nova Frequenz') && ev("getFiltered().length") < total);
  d.getElementById('search').value = '';
  // Zusammenspiel über getFiltered: jedes Prädikat wirkt, mehrere gelten gleichzeitig (UND)
  const allNames = ev("getFiltered().map(x => x.name)");
  const female = ev("getFiltered().filter(x => x.geschlecht === 'weiblich').length");
  d.getElementById('fGender').value = 'weiblich';
  t.check('getFiltered: Geschlechter-Filter wirkt über das Filterfeld.', ev("getFiltered().length") === female && female > 0 && female < allNames.length);
  ev("kuenstlerSeenFilter = 'ja'; dataMap['Nova Frequenz'].gesehen = 'ja';");
  const femaleSeen = ev("getFiltered().length");
  t.check('getFiltered: mehrere Filter gelten gleichzeitig (UND): weiblich UND gesehen ist eine Teilmenge.', femaleSeen >= 1 && femaleSeen <= female && ev("getFiltered().every(x => x.geschlecht === 'weiblich' && x.gesehen === 'ja')"));
  ev("kuenstlerSeenFilter = ''; dataMap['Nova Frequenz'].gesehen = '';");
  d.getElementById('fGender').value = '';
  ev("statsReinhoerenFilter = true; dataMap['Nova Frequenz'].reinhoeren = true;");
  t.check('getFiltered: Statistik-Flag "reinhören" wirkt über getFiltered.', ev("getFiltered().map(x => x.name)").join() === ev("Object.values(dataMap).filter(x => x.reinhoeren && !x.ausgeblendet).map(x => x.name)").join());
  ev("statsReinhoerenFilter = false; dataMap['Nova Frequenz'].reinhoeren = false;");

  // ───────── seenFilterMatches + STAT_FILTERS ─────────
  const sm = ev("[['ja','ja'],['ja','bekannt'],['ja',''],['bekannt','ja'],['bekannt','bekannt'],['bekannt',''],['unbekannt',''],['unbekannt','ja'],['','ja'],['quatsch','']].map(([k,g]) => seenFilterMatches(k, g))");
  t.check('seenFilterMatches: Wahrheitstabelle (ja, bekannt inkl. gesehen, unbekannt, leer/unbekannter Wert lässt alles durch).', sm.join() === 'true,false,false,true,true,false,true,false,true,true', sm);
  t.check('STAT_FILTERS kennt genau diese 7 Arten.', ev("Object.keys(STAT_FILTERS).sort().join()") === 'ausgeblendet,bekannt,bewertet,ja,reinhoeren,unbekannt,unbewertet');
  const flags = () => ev("JSON.stringify([statsBewertetFilter, statsUnbewertetFilter, statsReinhoerenFilter, statsAusgeblendetFilter, kuenstlerSeenFilter])");
  const kinds = { bewertet: '[true,false,false,false,""]', unbewertet: '[false,true,false,false,""]', reinhoeren: '[false,false,true,false,""]', ausgeblendet: '[false,false,false,true,""]', ja: '[false,false,false,false,"ja"]', bekannt: '[false,false,false,false,"bekannt"]', unbekannt: '[false,false,false,false,"unbekannt"]' };
  const bad = [];
  for (const [k, expected] of Object.entries(kinds)) {
    w.resetKuenstlerFilters(); w.filterByStat(k);
    const on = flags(); const isOn = ev(`STAT_FILTERS['${k}'].isOn()`);
    w.filterByStat(k);
    const off = flags();
    if (on !== expected || !isOn || off !== '[false,false,false,false,""]') bad.push({ k, on, off });
  }
  t.check('filterByStat: jede Art schaltet genau ihren Filter an, der zweite Klick wieder aus (alle anderen bleiben aus).', bad.length === 0, bad);
  w.filterByStat('bewertet'); w.filterByStat('ja');
  t.check('filterByStat: ein anderer Filter ersetzt den bisherigen (kein Mischzustand).', flags() === kinds.ja);
  w.filterByStat('gesamt');
  t.check('filterByStat("gesamt") und unbekannte Arten setzen alle Filter zurück, ohne Fehler.', flags() === '[false,false,false,false,""]' && (w.filterByStat('quatsch'), flags() === '[false,false,false,false,""]'));

  t.finish();
})();

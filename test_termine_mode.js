const { createHelpers, loadApp, reloadWithState, createChecker } = require('./test-helpers');

// Einstellung "📅 Weitere Termine" (Settings-Tab, appSettings.termineMode):
// 'off' = keine Terminliste und kein 📅-Hinweis, 'future' (Standard) = nur noch bevorstehende
// Termine ohne den eigenen, 'all' = alle Termine samt "Dieser Termin" (wie vorher).
(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { ev, fire, progRow: row, ridOf } = H;
  const t = createChecker();

  const sel = () => d.getElementById('settingTermineMode');
  const setMode = v => { sel().value = v; fire(sel(), 'change'); };
  const stored = () => (JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').settings) || {};
  const marker = skey => row(skey) && row(skey).querySelector('.prog-right-col .prog-more-ind');
  const detailOpen = skey => !d.getElementById(`${ridOf(skey)}-detail`).classList.contains('collapsed');
  const terms = skey => { if (!detailOpen(skey)) w.toggleProgRating(ridOf(skey)); return d.getElementById(`${ridOf(skey)}-terms`); };
  const termRows = skey => { const el = terms(skey); return el ? [...el.querySelectorAll('.prog-term')] : []; };
  const headText = skey => { const el = terms(skey); return el ? el.querySelector('.prog-terms-head span').textContent : null; };   // Überschrift ohne Pfeil
  const termKeys = skey => termRows(skey).map(r => (r.getAttribute('onclick') || '').match(/jumpToProgShow\('([^']+)'/)).map(m => m && m[1]);
  const mock = (month, day, hour, minute) => { w.getBerlinNow = () => ({ year: 2027, month, day, hour, minute }); };
  const outside = () => { w.getBerlinNow = () => ({ year: 2026, month: 10, day: 4, hour: 12, minute: 0 }); };
  const showAll = () => { w.switchTab('programm'); d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active')); d.getElementById('timeFrom').value = '08:00'; d.getElementById('timeTo').value = ''; w.renderProg(); };
  const closeRows = () => { [...d.querySelectorAll('#progList .prog-item')].forEach(el => { const r = el.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1]; if (!d.getElementById(`${r}-detail`).classList.contains('collapsed')) w.toggleProgRating(r); }); };

  // Vier Termine für Rosa Mercur: A (Mi, vorbei sobald Do 22 Uhr), B = nid 4 (Do 21:00-21:45), C = nid 5 (Fr, ohne Zeit), D (Sa 20:00-20:45)
  ev("auftritte.push({ name: 'Rosa Mercur', day: 'Mi 15.09', time: '18:00', endTime: '18:45', location: 'Docks', nid: 9101 }, { name: 'Rosa Mercur', day: 'Sa 18.09', time: '20:00', endTime: '20:45', location: 'Molotow', nid: 9102 });");
  const A = 'nid:9101', B = 'nid:4', C = 'nid:5', D = 'nid:9102';
  outside();
  showAll();

  // ───────── 1) Standard + Oberfläche ─────────
  t.check('Standard: nur zukünftige Termine.', ev('termineMode()') === 'future');
  t.check('Einstellung in der Oberfläche: Auswahl mit drei Optionen (aus / nur zukünftige / alle).', [...sel().options].map(o => o.value).join() === 'off,future,all');
  t.check('Die Auswahl zeigt den Standard \"Nur zukünftige\".', sel().value === 'future');
  t.check('Die Einstellung steht im Settings-Tab.', !!sel().closest('#view-io'));
  ev("appSettings.termineMode = 'kaputt';");
  t.check('Ungültiger Wert fällt auf den Standard zurück.', ev('termineMode()') === 'future');
  ev("appSettings.termineMode = undefined;");
  t.check('Fehlender Wert fällt auf den Standard zurück.', ev('termineMode()') === 'future');
  ev("appSettings.termineMode = null;");
  t.check('Leerer Wert fällt auf den Standard zurück.', ev('termineMode()') === 'future');
  ev("appSettings.termineMode = 'future';");
  w.setTermineSetting('unsinn');
  t.check('setTermineSetting nimmt keine ungültigen Werte an (Standard bleibt).', stored().termineMode === 'future' && ev('termineMode()') === 'future', stored());

  // ───────── 2) Modus "alle" = bisheriges Verhalten ─────────
  setMode('all');
  showAll();
  t.check('Modus \"Alle\": Auswahl gespeichert.', stored().termineMode === 'all' && ev('termineMode()') === 'all', stored());
  t.check('Modus \"Alle\": alle vier Termine stehen in der Liste (auch der eigene).', termRows(B).length === 4 && termRows(B).filter(r => r.classList.contains('current')).length === 1, termRows(B).length);
  t.check('Modus \"Alle\": Kopfzeile heißt weiterhin \"Termine (4)\".', headText(B) === 'Termine (4)', headText(B));
  t.check('Modus \"Alle\": 📅 an allen Terminen außer dem letzten.', [A, B, C].every(k => !!marker(k)) && !marker(D), [A, B, C, D].map(k => !!marker(k)));
  closeRows();

  // ───────── 3) Modus "aus" ─────────
  setMode('off');
  showAll();
  t.check('Modus \"Aus\": Auswahl gespeichert.', stored().termineMode === 'off' && ev('termineMode()') === 'off', stored());
  t.check('Modus \"Aus\": nirgends ein 📅-Hinweis in der Programm-Liste.', d.querySelectorAll('#progList .prog-more-ind').length === 0 && !marker(A) && !marker(B));
  t.check('Modus \"Aus\": keine Terminliste in der Detailansicht (auch bei vier Terminen).', !terms(B) && detailOpen(B));
  closeRows();
  t.check('Modus \"Aus\": Detailansicht der übrigen Zeilen ist unverändert (RBF-Link und \"Zum Künstler\" noch da).', (() => { w.toggleProgRating(ridOf(B)); const det = d.getElementById(`${ridOf(B)}-detail`); return /Zum Künstler/.test(det.textContent) && !!det.querySelector('a.prog-detail-link'); })());
  closeRows();

  // ───────── 4) Modus "nur zukünftige" ohne laufendes Festival (nichts ist vorbei) ─────────
  setMode('future');
  showAll();
  t.check('Modus \"Nur zukünftige\": Auswahl gespeichert.', stored().termineMode === 'future', stored());
  t.check('Außerhalb des Festivals (nichts vorbei): die drei anderen Termine stehen in der Liste, der eigene nicht.', termRows(B).length === 3 && termRows(B).every(r => !r.classList.contains('current')) && !termRows(B).some(r => r.textContent.includes('Dieser Termin')), termRows(B).length);
  t.check('... chronologisch (A, C, D) und alle anklickbar.', termKeys(B).join() === [A, C, D].join() && termRows(B).every(r => !!r.getAttribute('onclick')), termKeys(B));
  t.check('Kopfzeile heißt "Kommende Termine (3)" und nennt nur die aufgelisteten Termine.', headText(B) === 'Kommende Termine (3)' && terms(B).querySelector('.prog-terms-head').textContent.includes('▸'), headText(B));
  t.check('Terminliste startet weiterhin zugeklappt.', !terms(B).classList.contains('open'));
  t.check('📅 an allen Terminen außer dem letzten.', [A, B, C].every(k => !!marker(k)) && !marker(D), [A, B, C, D].map(k => !!marker(k)));
  closeRows();
  t.check('Künstler mit nur einem Termin: weder Liste noch Hinweis (Nova Frequenz).', !terms('nid:1') && !marker('nid:1'));
  closeRows();

  // ───────── 5) Modus "nur zukünftige" während des Festivals ─────────
  mock(9, 16, 22, 0);                          // Do 22:00: A (Mi) und B (Do 21:00-21:45) sind vorbei
  showAll();
  t.check('Do 22:00, Termin A (vorbei): Liste nur mit den kommenden Terminen C und D.', termKeys(A).join() === [C, D].join(), termKeys(A));
  t.check('... Kopfzeile \"Kommende Termine (2)\".', headText(A) === 'Kommende Termine (2)', headText(A));
  closeRows();
  t.check('Do 22:00, Termin B (vorbei): ebenfalls C und D, nicht A und nicht der eigene.', termKeys(B).join() === [C, D].join(), termKeys(B));
  closeRows();
  t.check('Do 22:00, Termin C: nur D (der eigene Termin und vergangene stehen nicht in der Liste).', termKeys(C).join() === [D].join() && headText(C) === 'Kommende Termine (1)', termKeys(C));
  closeRows();
  t.check('Do 22:00, Termin D: die Liste zeigt den noch kommenden früheren Termin C (nicht A, B, nicht D selbst).', termKeys(D).join() === [C].join(), termKeys(D));
  closeRows();
  t.check('Do 22:00: 📅 an A, B und C (später folgt noch ein kommender Termin), nicht an D.', [A, B, C].every(k => !!marker(k)) && !marker(D), [A, B, C, D].map(k => !!marker(k)));
  t.check('Vorbei gelegene Termine erscheinen in der Liste nicht (also nichts gedimmt).', (() => { const r = [A, B, C, D].flatMap(k => { const x = termRows(k); closeRows(); return x; }); return r.length > 0 && r.every(x => !x.classList.contains('past')); })());

  // Alles Spätere ist vorbei: kein 📅 und keine Liste
  mock(9, 18, 23, 0);                          // Sa 23:00: alle vier vorbei
  showAll();
  t.check('Sa 23:00: alle Termine vorbei -> bei C keine Terminliste und kein 📅.', !terms(C) && !marker(C));
  closeRows();
  t.check('... ebenso bei A, B und D.', [A, B, D].every(k => { const r = !terms(k) && !marker(k); closeRows(); return r; }));
  // Später folgt nur ein vorbei gelegener Termin, ein anderer kommt noch: Sa 12:00 -> D kommt noch (20:00)
  mock(9, 18, 12, 0);
  showAll();
  t.check('Sa 12:00: bei B (vorbei) steht D in der Liste, C (Fr, ohne Zeit) ist vorbei.', termKeys(B).join() === [D].join(), termKeys(B));
  closeRows();
  t.check('Sa 12:00: 📅 an B (D kommt noch), nicht an D.', !!marker(B) && !marker(D));
  closeRows();
  outside();

  // ───────── 6) Live-Aktualisierung im Modus "nur zukünftige" ─────────
  showAll();
  terms(A);                                    // A aufklappen: Liste B, C, D (nichts vorbei)
  t.check('Ausgangslage: Liste von A hat drei Einträge, \"Kommende Termine (3)\".', termRows(A).length === 3 && headText(A) === 'Kommende Termine (3)', termRows(A).length);
  mock(9, 16, 22, 0);                          // jetzt sind A und B vorbei, ohne dass neu gerendert wird
  w.togglePlanFlag(ridOf(C), C);               // löst refreshTermineLists aus
  t.check('Live-Aktualisierung (Ziel bei C): Inhalt der Liste zeigt jetzt nur C und D, das 🎯 bei C.', termRows(A).length === 2 && termRows(A)[0].textContent.includes('🎯'), termRows(A).map(r => r.textContent));
  t.check('... und die Kopfzeile zieht mit (\"Kommende Termine (2)\").', headText(A) === 'Kommende Termine (2)', headText(A));
  t.check('... die Zeile bleibt dabei offen, die Terminliste zu.', detailOpen(A) && !d.getElementById(`${ridOf(A)}-terms`).classList.contains('open'));
  w.togglePlanFlag(ridOf(C), C);
  closeRows();
  outside();

  // ───────── 7) Sprung aus der Terminliste (nur zukünftige) ─────────
  showAll();
  terms(B);
  termRows(B).find(r => (r.getAttribute('onclick') || '').includes(D)).click();
  t.check('Tipp auf einen Termin der verkürzten Liste springt dorthin (Ziel offen, Ausgangszeile zu).', detailOpen(D) && !detailOpen(B));
  t.check('... mit Zurück-Chip \"← Termin: Do 16.09, 21:00\".', d.getElementById('jumpBackLabel').textContent === '← Termin: Do 16.09, 21:00', d.getElementById('jumpBackLabel').textContent);
  w.jumpBack();
  t.check('Zurück führt zur Ausgangszeile.', detailOpen(B));
  closeRows();

  // ───────── 8) Sonderveranstaltungen: nie Hinweis/Liste ─────────
  ev("appSettings.showRbfEvents = true; appSettings.showMusicEvents = true; appSettings.showOtherEvents = true;");
  for (const mode of ['all', 'future']) {
    setMode(mode); showAll();
    const evEl = [...d.querySelectorAll('#progList .prog-item')].find(el => el.textContent.includes('Anchor Award Show'));
    const evRid = evEl.getAttribute('onclick').match(/'([^']+)'/)[1];
    w.toggleProgRating(evRid);
    t.check(`Modus \"${mode}\": Sonderveranstaltung ohne Hinweis und ohne Terminliste.`, !evEl.querySelector('.prog-more-ind') && !d.getElementById(`${evRid}-terms`));
    w.toggleProgRating(evRid);
    // Schutzabfrage direkt: selbst ein Event, das zufällig wie ein Künstler mit mehreren Terminen heißt, bekommt nie Liste/Hinweis
    const fakeEvt = "{ name: 'Rosa Mercur', day: 'Do 16.09', time: '21:00', isEvent: true, nid: 'evt-99' }";
    t.check(`Modus \"${mode}\": Eintrag mit isEvent hat nie eine Terminliste und nie einen Hinweis (auch bei gleichem Namen wie ein Künstler mit mehreren Terminen).`, ev(`termineShows(${fakeEvt}).length`) === 0 && ev(`hasLaterShow(${fakeEvt})`) === false);
  }

  // ───────── 9) Wechsel der Einstellung wirkt in der Programm-Übersicht ─────────
  setMode('future'); showAll();
  t.check('Ausgangslage: 📅 sichtbar.', !!marker(A));
  w.switchTab('io');
  setMode('off');
  w.switchTab('programm');
  t.check('Wechsel auf \"Aus\" im Settings-Tab: nach Rückkehr in den Programm-Tab ist das 📅 weg (Liste wurde neu gebaut).', !marker(A) && d.querySelectorAll('#progList .prog-more-ind').length === 0);
  w.switchTab('io');
  setMode('all');
  w.switchTab('programm');
  t.check('Wechsel auf \"Alle\": 📅 wieder da, Liste mit \"Dieser Termin\".', !!marker(A) && termRows(A).some(r => r.textContent.includes('Dieser Termin')));
  setMode('future'); w.switchTab('programm');
  t.check('Wechsel zurück auf \"Nur zukünftige\": Überschrift heißt wieder \"Kommende Termine (n)\".', headText(B) === 'Kommende Termine (3)', headText(B));
  closeRows();
  setMode('all'); w.switchTab('programm');
  t.check('Wechsel auf \"Alle\": Überschrift heißt wieder \"Termine (n)\" (ohne \"Kommende\").', headText(B) === 'Termine (4)', headText(B));
  closeRows();

  // ───────── 10) Andere Einstellungen/Filter bleiben unberührt ─────────
  const settingsWithout = () => { const s = { ...JSON.parse(JSON.stringify(ev('appSettings'))) }; delete s.termineMode; return JSON.stringify(s); };
  const before = settingsWithout();
  const filtersBefore = JSON.stringify(ev('[progSelectedGenres.size, selectedLocs && selectedLocs.size, document.getElementById("timeFrom").value]'));
  setMode('off'); setMode('future'); setMode('all');
  t.check('Umschalten ändert keine anderen Einstellungen.', settingsWithout() === before);
  t.check('Umschalten ändert keine Filter.', JSON.stringify(ev('[progSelectedGenres.size, selectedLocs && selectedLocs.size, document.getElementById("timeFrom").value]')) === filtersBefore);
  setMode('off');
  w.resetProgFilters();
  t.check('\"Filter zurücksetzen\" lässt die Einstellung unberührt.', ev('termineMode()') === 'off');
  mock(9, 16, 12, 0);
  w.jumpToNow(); w.jumpToNow();
  t.check('\"Jetzt\" (auch zweiter Klick) lässt die Einstellung unberührt.', ev('termineMode()') === 'off');
  outside();

  // ───────── 11) Neustart: Einstellung bleibt erhalten, alte Speicherstände bekommen den Standard ─────────
  setMode('off');
  const fresh = await reloadWithState(w, ['rbf2027_v1', 'rbf2027_filters_v1']);
  t.check('Neustart: \"Aus\" bleibt erhalten (Einstellung und Auswahl).', fresh.window.eval('termineMode()') === 'off' && fresh.document.getElementById('settingTermineMode').value === 'off');
  setMode('all');
  const fresh2 = await reloadWithState(w, ['rbf2027_v1', 'rbf2027_filters_v1']);
  t.check('Neustart: \"Alle\" bleibt erhalten.', fresh2.window.eval('termineMode()') === 'all' && fresh2.document.getElementById('settingTermineMode').value === 'all');
  // alter Speicherstand ohne das Feld
  const old = JSON.parse(w.localStorage.getItem('rbf2027_v1'));
  delete old.settings.termineMode;
  w.localStorage.setItem('rbf2027_v1', JSON.stringify(old));
  const fresh3 = await reloadWithState(w, ['rbf2027_v1', 'rbf2027_filters_v1']);
  t.check('Alter Speicherstand ohne die Einstellung: Standard \"Nur zukünftige\" (Einstellung und Auswahl).', fresh3.window.eval('termineMode()') === 'future' && fresh3.document.getElementById('settingTermineMode').value === 'future');
  const fresh4 = await loadApp();
  t.check('Erster Start ohne Speicherstand: Standard \"Nur zukünftige\".', fresh4.window.eval('termineMode()') === 'future' && fresh4.document.getElementById('settingTermineMode').value === 'future');

  t.finish();
})();

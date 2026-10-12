const { createHelpers, loadApp, reloadWithState, createChecker } = require('./test-helpers');

// Speicher-Schema: Tabellen für Künstler-Einträge, Hauptzustand und Filter. Das Speicherformat
// (Schlüssel und deren Reihenfolge) ist ein Vertrag mit bestehenden Speicherständen und Exporten.
(async () => {
  const { window: w, document: d } = await loadApp();
  const { ev } = createHelpers(w, d);
  const t = createChecker();
  const LS = 'rbf2027_v1', LSF = 'rbf2027_filters_v1';
  const stored = () => JSON.parse(w.localStorage.getItem(LS));

  // ───────── Format-Vertrag (Schlüssel + Reihenfolge) ─────────
  t.check('Künstler-Eintrag: genau diese 14 Kurzschlüssel in dieser Reihenfolge.', ev("ARTIST_RECORD_SAVE.map(x => x[0]).join()") === 'n,rp,rl,s,u,manual,edited,genre,herkunft,geschlecht,rbfUrl,h,c,rh');
  t.check('Hauptzustand: genau diese 5 Teile in dieser Reihenfolge.', ev("PERSISTED_STATE.map(p => p.key).join()") === 'showRatings,showDurations,planFlags,hiddenEvents,settings');
  t.check('Filterzustand: genau diese 22 Felder in dieser Reihenfolge.', ev("FILTER_FIELDS.map(f => f.key).join()") === 'search,fGender,kuenstlerSeenFilter,selectedGenres,fHerkunft,fSoundRef,fHidden,kuenstlerAvgFilter,statsBewertetFilter,statsUnbewertetFilter,statsReinhoerenFilter,activeDays,timeFrom,timeTo,selectedLocs,progSelectedGenres,progRatingFilter,progShowRatingFilter,fProgStatus,fProgDuration,fProgPlanned,progShowHidden');
  t.check('Filterfelder: eindeutige Schlüssel, bekannte Typen, Lesen/Schreiben vorhanden.', ev("new Set(FILTER_FIELDS.map(f => f.key)).size === FILTER_FIELDS.length && FILTER_FIELDS.every(f => ['string','boolean','number','array'].includes(f.type) && typeof f.read === 'function' && typeof f.write === 'function')"));

  // ───────── Künstler-Eintrag ─────────
  const sample = { name: 'Nova Frequenz', rp: 4, rl: 2, gesehen: 'ja', customUrl: 'https://x.org', manual: false, edited: true, genre: 'Pop', herkunft: 'Berlin', geschlecht: 'weiblich', rbfUrl: 'https://r.org', ausgeblendet: true, kommentar: 'Hallo', reinhoeren: true };
  const rec = w.artistToRecord(sample);
  t.check('artistToRecord: Golden-String des Speicherformats (Schlüsselreihenfolge, Werte).', JSON.stringify(rec) === '{"n":"Nova Frequenz","rp":4,"rl":2,"s":"ja","u":"https://x.org","manual":false,"edited":true,"genre":"Pop","herkunft":"Berlin","geschlecht":"weiblich","rbfUrl":"https://r.org","h":true,"c":"Hallo","rh":true}', JSON.stringify(rec));
  t.check('artistToRecord: fehlende optionale Felder werden zu false/"" (manual, edited, h, c, rh).', (() => { const r = w.artistToRecord({ name: 'A', rp: 0, rl: 0, gesehen: '', customUrl: '' }); return r.manual === false && r.edited === false && r.h === false && r.c === '' && r.rh === false; })());
  const tgt = {};
  w.applyArtistRecord(tgt, { n: 'Nova Frequenz', rp: 4, rl: 2, s: 'ja', u: 'https://x.org', manual: false, edited: true, h: true, c: 'Hallo', rh: true });
  t.check('applyArtistRecord: übernimmt die Werte in die Eigenschaften (s -> gesehen, u -> customUrl, h -> ausgeblendet, c -> kommentar, rh -> reinhoeren).', tgt.rp === 4 && tgt.rl === 2 && tgt.gesehen === 'ja' && tgt.customUrl === 'https://x.org' && tgt.edited === true && tgt.ausgeblendet === true && tgt.kommentar === 'Hallo' && tgt.reinhoeren === true);
  const tgt2 = {};
  w.applyArtistRecord(tgt2, {});
  t.check('applyArtistRecord: leerer Eintrag ergibt Standardwerte (0, "", false).', tgt2.rp === 0 && tgt2.rl === 0 && tgt2.gesehen === '' && tgt2.customUrl === '' && tgt2.manual === false && tgt2.ausgeblendet === false && tgt2.kommentar === '' && tgt2.reinhoeren === false);
  const max = ev('MAX'), maxC = ev('MAX_COMMENT_LEN');
  const tgt3 = {};
  w.applyArtistRecord(tgt3, { rp: 999, rl: 999, c: 'x'.repeat(maxC + 500) });
  t.check('applyArtistRecord: Bewertungen werden auf MAX begrenzt, der Kommentar auf MAX_COMMENT_LEN gekürzt.', tgt3.rp === max && tgt3.rl === max && tgt3.kommentar.length === maxC, { max, maxC, rp: tgt3.rp, len: tgt3.kommentar.length });
  t.check('artistHasUserData: nur Künstler mit mindestens einer Nutzer-Änderung werden gespeichert.', !w.artistHasUserData({ rp: 0, rl: 0, gesehen: '', customUrl: '', manual: false, ausgeblendet: false, kommentar: '', reinhoeren: false }) && w.artistHasUserData({ rp: 1 }) && w.artistHasUserData({ rl: 1 }) && w.artistHasUserData({ gesehen: 'ja' }) && w.artistHasUserData({ customUrl: 'x' }) && w.artistHasUserData({ manual: true }) && w.artistHasUserData({ ausgeblendet: true }) && w.artistHasUserData({ kommentar: 'k' }) && w.artistHasUserData({ reinhoeren: true }));
  const man = w.newManualArtist('Neu', { genre: 'Punk' });
  t.check('newManualArtist: Grundwerte eines von Hand angelegten Künstlers (geschlecht "mixed", manual true, nichts bewertet).', man.name === 'Neu' && man.genre === 'Punk' && man.herkunft === '' && man.geschlecht === 'mixed' && man.manual === true && man.rp === 0 && man.gesehen === '' && man.ausgeblendet === false);

  // ───────── Speichern: Aufbau des gespeicherten JSON ─────────
  ev("dataMap['Nova Frequenz'].rp = 3; dataMap['Nova Frequenz'].kommentar = 'Test'; showRatings['nid:1'] = 4; showDurations['nid:1'] = 45; planFlags['nid:2'] = true; hiddenEvents[7] = true; appSettings.backChipMode = 'manual';");
  w.localStorage.clear(); w.saveToStorage();
  const s1 = stored();
  t.check('Gespeichert: Hauptschlüssel in fester Reihenfolge (ratings, auftritte, auftritteVersion, showRatings, showDurations, planFlags, hiddenEvents, settings).', Object.keys(s1).join() === 'ratings,auftritte,auftritteVersion,showRatings,showDurations,planFlags,hiddenEvents,settings', Object.keys(s1));
  t.check('Gespeichert: nur Künstler mit Nutzerdaten (hier genau Nova Frequenz) im Kurzformat.', s1.ratings.length === 1 && s1.ratings[0].n === 'Nova Frequenz' && s1.ratings[0].rp === 3 && s1.ratings[0].c === 'Test');
  t.check('Gespeichert: Auftritts-Zustand und Einstellungen stehen unter den erwarteten Schlüsseln.', s1.showRatings['nid:1'] === 4 && s1.showDurations['nid:1'] === 45 && s1.planFlags['nid:2'] === true && s1.hiddenEvents['7'] === true && s1.settings.backChipMode === 'manual' && s1.auftritteVersion === ev('DATA_VERSION'));
  const v0 = ev('stateVersion'); w.saveToStorage();
  t.check('Jedes Speichern erhöht stateVersion (Grundlage des Programm-Listen-Caches).', ev('stateVersion') === v0 + 1);

  // ───────── Laden: Runde Speichern -> Neustart ─────────
  const fresh = await reloadWithState(w, [LS, LSF]);
  const fev = c => fresh.window.eval(c);
  t.check('Neustart: Bewertung, Kommentar und Auftritts-Zustand sind wiederhergestellt.', fev("dataMap['Nova Frequenz'].rp") === 3 && fev("dataMap['Nova Frequenz'].kommentar") === 'Test' && fev("showRatings['nid:1']") === 4 && fev("showDurations['nid:1']") === 45 && fev("planFlags['nid:2']") === true && fev("hiddenEvents[7]") === true);
  t.check('Neustart: Einstellungen werden mit den Standardwerten verschmolzen (gespeichertes backChipMode, Standard für den Rest).', fev("appSettings.backChipMode") === 'manual' && fev("appSettings.durationInputMode") === 'minutes' && fev("appSettings.persistFilters") === ev("appSettings.persistFilters"));
  fresh.window.close();

  // Altformate / kaputte Stände
  const boot = async (main, filters) => {
    const f = await loadApp();
    if (main !== null) f.window.localStorage.setItem(LS, main);
    if (filters !== null) f.window.localStorage.setItem(LSF, filters);
    f.window.loadFromStorage(); f.window.loadFilterState();
    return f;
  };
  let f = await boot('{}', null);
  t.check('Leerer Speicherstand "{}" lädt ohne Fehler und ändert nichts.', f.window.eval("dataMap['Nova Frequenz'].rp") === 0);
  t.check('Fehlende Teile im Speicherstand lassen die Standardwerte stehen (Auftritts-Zustand bleibt ein Objekt, Einstellungen behalten ihre Standardwerte).', f.window.eval("[showRatings, showDurations, planFlags, hiddenEvents].every(o => o && typeof o === 'object' && !Array.isArray(o)) && typeof appSettings === 'object' && appSettings.backChipMode === 'time' && appSettings.durationInputMode === 'minutes'"));
  f.window.close();
  f = await boot(JSON.stringify({ settings: { backChipMode: 'manual' } }), null);
  t.check('Teil-Einstellungen im Speicherstand werden mit den Standardwerten verschmolzen (nur backChipMode überschrieben, der Rest bleibt Standard).', f.window.eval("appSettings.backChipMode") === 'manual' && f.window.eval("appSettings.durationInputMode") === 'minutes' && f.window.eval("appSettings.backChipSeconds") === 15 && f.window.eval("Array.isArray(appSettings.hiddenLocations)"));
  f.window.close();
  f = await boot('{kaputt', '{kaputt');
  t.check('Kaputtes JSON (Haupt- und Filterstand) wird abgefangen, die App startet mit Standardwerten.', f.window.eval("dataMap['Nova Frequenz'].rp") === 0 && f.window.eval("document.getElementById('search').value") === '');
  f.window.close();
  f = await boot(JSON.stringify({ ratings: [{ n: 'NOVA FREQUENZ', rp: 4, s: 'bekannt' }, { n: 'Gibt Es Nicht', rp: 3 }] }), null);
  t.check('Geänderte Schreibweise eines Namens wird eindeutig zugeordnet; unbekannte Künstler werden ignoriert.', f.window.eval("dataMap['Nova Frequenz'].rp") === 4 && f.window.eval("dataMap['Nova Frequenz'].gesehen") === 'bekannt' && f.window.eval("dataMap['Gibt Es Nicht']") === undefined);
  f.window.close();
  f = await boot(JSON.stringify({ ratings: [{ n: 'Hand A', manual: true, genre: 'Punk', geschlecht: 'divers', rp: 5, s: 'ja' }] }), null);
  t.check('Von Hand angelegte Künstler (manual) werden neu angelegt und befüllt.', f.window.eval("dataMap['Hand A'].manual") === true && f.window.eval("dataMap['Hand A'].genre") === 'Punk' && f.window.eval("dataMap['Hand A'].geschlecht") === 'divers' && f.window.eval("dataMap['Hand A'].rp") === 5);
  f.window.close();
  f = await boot(JSON.stringify({ auftritte: [{ name: 'X', day: 'Do 16.09', time: '10:00', location: 'Y', nid: 9001 }], auftritteVersion: 'alt' }), null);
  t.check('Gespeicherte Auftrittsdaten mit veralteter Version werden verworfen.', f.window.eval("auftritte.some(a => a.nid === 9001)") === false);
  f.window.close();

  // ───────── Filterzustand ─────────
  ev("appSettings.persistFilters = true;");
  d.getElementById('search').value = 'nova'; d.getElementById('fGender').value = 'weiblich';
  ev("kuenstlerSeenFilter = 'ja'; selectedGenres.add('Pop'); statsReinhoerenFilter = true; kuenstlerAvgFilter = 3; selectedLocs.add('Docks'); progSelectedGenres.add('Techno'); progRatingFilter = 2; progShowRatingFilter = 4;");
  d.getElementById('timeFrom').value = '10:00'; d.getElementById('fProgPlanned').checked = true; d.getElementById('progShowHidden').checked = true;
  d.querySelectorAll('.day-btn').forEach((b, i) => b.classList.toggle('active', i === 1));
  w.localStorage.removeItem(LSF); w.saveFilterState();
  const sf = JSON.parse(w.localStorage.getItem(LSF));
  t.check('Gespeicherter Filterzustand: alle 22 Felder in fester Reihenfolge.', Object.keys(sf).join() === ev("FILTER_FIELDS.map(f => f.key).join()"));
  t.check('Gespeicherter Filterzustand: Werte aus Feldern, Variablen, Mengen (als Listen) und Tag-Buttons.', sf.search === 'nova' && sf.fGender === 'weiblich' && sf.kuenstlerSeenFilter === 'ja' && sf.selectedGenres.join() === 'Pop' && sf.statsReinhoerenFilter === true && sf.kuenstlerAvgFilter === 3 && sf.selectedLocs.join() === 'Docks' && sf.progSelectedGenres.join() === 'Techno' && sf.progRatingFilter === 2 && sf.progShowRatingFilter === 4 && sf.timeFrom === '10:00' && sf.fProgPlanned === true && sf.progShowHidden === true && sf.activeDays.length === 1);
  const fr = await reloadWithState(w, [LS, LSF]);
  const frev = c => fr.window.eval(c);
  t.check('Neustart: Filter sind wiederhergestellt (Felder, Variablen, Mengen, aktive Tage).', fr.document.getElementById('search').value === 'nova' && fr.document.getElementById('fGender').value === 'weiblich' && frev('kuenstlerSeenFilter') === 'ja' && frev("[...selectedGenres].join()") === 'Pop' && frev('statsReinhoerenFilter') === true && frev('kuenstlerAvgFilter') === 3 && frev("[...selectedLocs].join()") === 'Docks' && frev("[...progSelectedGenres].join()") === 'Techno' && frev('progRatingFilter') === 2 && frev('progShowRatingFilter') === 4 && fr.document.getElementById('timeFrom').value === '10:00' && fr.document.getElementById('fProgPlanned').checked === true && [...fr.document.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).length === 1);
  t.check('Neustart: Such-Löschen-Kreuz wird passend zum Suchtext eingeblendet; "smartProgDefaultsApplied" gesetzt.', fr.document.getElementById('searchClear').style.display === 'flex' && frev('smartProgDefaultsApplied') === true);
  fr.window.close();
  f = await boot(null, JSON.stringify({ search: 5, fGender: null, selectedGenres: 'x', fHidden: 1, kuenstlerAvgFilter: '3', activeDays: {}, timeFrom: [], progRatingFilter: '2', fProgPlanned: 'ja', fProgDuration: true, fHerkunft: 'FR' }));
  const fv = c => f.window.eval(c);
  t.check('Felder mit falschem Typ werden übersprungen, die mit richtigem Typ trotzdem übernommen.', f.document.getElementById('search').value === '' && fv('statsAusgeblendetFilter') === false && fv('kuenstlerAvgFilter') === 0 && fv('progRatingFilter') === 0 && f.document.getElementById('fProgPlanned').checked === false && f.document.getElementById('fProgDuration').checked === true);
  f.window.close();
  f = await boot(JSON.stringify({ settings: { persistFilters: false } }), JSON.stringify({ search: 'nova', fProgPlanned: true }));
  t.check('Mit ausgeschalteter Filter-Persistenz wird der Filterzustand weder geladen ...', f.document.getElementById('search').value === '' && f.document.getElementById('fProgPlanned').checked === false);
  f.window.close();
  ev("appSettings.persistFilters = false;"); w.localStorage.removeItem(LSF); w.saveFilterState();
  t.check('... noch gespeichert.', w.localStorage.getItem(LSF) === null);

  t.finish();
})();

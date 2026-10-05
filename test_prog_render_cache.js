const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const ev = code => w.eval(code);

  // Zähler: wie oft wurde die Programm-Liste / die Künstler-Liste / eine Künstler-Zeile aufgebaut?
  const count = { prog: 0, kuenstler: 0, artistItem: 0 };
  const wrap = (name, key) => { const o = w[name]; w[name] = function () { count[key]++; return o.apply(this, arguments); }; };
  wrap('renderProgCore', 'prog'); wrap('render', 'kuenstler'); wrap('renderArtistItem', 'artistItem');
  const reset = () => { count.prog = 0; count.kuenstler = 0; count.artistItem = 0; };

  const setDays = days => d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', days.includes(b.dataset.day)));
  const allDays = () => [...d.querySelectorAll('.day-btn')].map(b => b.dataset.day);
  const row = skey => [...d.querySelectorAll('#progList .prog-item')].find(el => el.dataset.skey === skey);
  const ridOf = skey => row(skey).getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  const detail = skey => d.getElementById(`${ridOf(skey)}-detail`);
  const prepare = () => { w.switchTab('programm'); setDays(allDays()); d.getElementById('timeFrom').value = '08:00'; d.getElementById('timeTo').value = ''; w.renderProg(); };

  // ───────── A) Detailansicht wird erst beim Aufklappen gebaut ─────────
  prepare();
  const rows = [...d.querySelectorAll('#progList .prog-item')];
  t.check('Liste aufgebaut (mehrere Zeilen).', rows.length >= 5, rows.length);
  t.check('Zugeklappt sind ALLE Detail-Container leer (kein vorab gebautes Detail-HTML).', [...d.querySelectorAll('#progList .prog-detail')].every(el => el.innerHTML.trim() === '' && el.classList.contains('collapsed')));
  w.toggleProgRating(ridOf('nid:1'));
  t.check('Aufklappen füllt die Detailansicht (Sterne, Dauer-Button, Ziel-/Gesehen-Bereich).', !!detail('nid:1').querySelector('.stars') && !!detail('nid:1').querySelector('.duration-btn') && detail('nid:1').innerHTML.length > 500);
  w.toggleProgRating(ridOf('nid:2'));
  t.check('Es ist immer nur eine Detailansicht offen (die andere zu, aber nicht neu gebaut).', detail('nid:1').classList.contains('collapsed') && !detail('nid:2').classList.contains('collapsed') && detail('nid:2').innerHTML.length > 500);

  // Zustand ändern, während die Zeile zugeklappt ist -> beim nächsten Aufklappen frisch
  w.setShowDuration(ridOf('nid:1'), 'nid:1', 40);                 // Zeile nid:1 ist zu
  w.toggleProgRating(ridOf('nid:1'));
  t.check('Dauer, die bei zugeklappter Zeile gesetzt wurde, steht beim Aufklappen korrekt da (frisch gebaut, nicht veraltet).', detail('nid:1').querySelector('.duration-btn').textContent.includes('40 Min'), detail('nid:1').querySelector('.duration-btn').textContent);
  w.setShowRating(ridOf('nid:2'), 'nid:2', 5);                    // Zeile nid:2 ist jetzt zu
  w.toggleProgRating(ridOf('nid:2'));
  t.check('Auftritts-Bewertung bei zugeklappter Zeile gesetzt: beim Aufklappen korrekt.', detail('nid:2').querySelector('.stars-sm[id$="-show"]').innerHTML.includes('active') || /★/.test(detail('nid:2').querySelector('.stars-sm[id$="-show"]').innerHTML));
  w.toggleProgRating(ridOf('nid:2'));
  w.setShowDuration(ridOf('nid:1'), 'nid:1', 0); w.setShowRating(ridOf('nid:2'), 'nid:2', 5);

  // ───────── B) Liste wird nur bei Bedarf neu aufgebaut ─────────
  prepare();
  const marker = row('nid:1'); marker.__keep = 1;
  reset();
  w.switchTab('kuenstler'); w.switchTab('programm');
  t.check('Tabwechsel hin und zurück OHNE Änderung baut die Programm-Liste NICHT neu auf.', count.prog === 0, count);
  t.check('... die Zeilen sind dieselben DOM-Knoten.', row('nid:1') && row('nid:1').__keep === 1);

  // Scrollstelle bleibt erhalten
  const pl = d.getElementById('progList');
  let st = 0; Object.defineProperty(pl, 'scrollTop', { get: () => st, set: v => { st = v; }, configurable: true });
  st = 321;
  w.switchTab('kuenstler'); st = 0; w.switchTab('programm');
  t.check('Ohne Neuaufbau wird die Scrollstelle der Programm-Liste beim Zurückkehren wiederhergestellt.', st === 321, st);

  // Änderungen, die einen Neuaufbau erzwingen müssen
  const mustRebuild = (label, change) => {
    prepare(); const m = row('nid:1'); m.__keep = 1; w.switchTab('kuenstler');
    change(); reset(); w.switchTab('programm');
    t.check(`Änderung "${label}" in einem anderen Tab -> Programm-Liste wird beim Zurückkehren neu aufgebaut.`, count.prog === 1 && !(row('nid:1') && row('nid:1').__keep === 1), { prog: count.prog });
    reset(); w.switchTab('kuenstler'); w.switchTab('programm');
    t.check(`... und danach ist wieder alles "frisch" (kein weiterer Neuaufbau).`, count.prog === 0, count);
  };
  mustRebuild('Künstler ausblenden', () => { w.toggleHidden('Nova Frequenz'); });
  ev("dataMap['Nova Frequenz'].ausgeblendet = false; saveToStorage();");
  mustRebuild('Einstellung geändert (Maps-Links aus)', () => { ev("appSettings.showMapsLinks = !appSettings.showMapsLinks;"); });
  ev("appSettings.showMapsLinks = !appSettings.showMapsLinks;");
  mustRebuild('Programm-Filter geändert (Tag)', () => { setDays([allDays()[0]]); });
  mustRebuild('"Ausgeblendete anzeigen" geändert', () => { d.getElementById('progShowHidden').checked = !d.getElementById('progShowHidden').checked; });
  d.getElementById('progShowHidden').checked = false;
  mustRebuild('Gesehen-Status (Künstler-Tab)', () => { w.setSeen('Nova Frequenz', 'ja'); });
  mustRebuild('Speicherstand geändert (saveToStorage)', () => { ev("saveToStorage()"); });
  mustRebuild('Event-Einstellung geändert', () => { ev("appSettings.showRbfEvents = !appSettings.showRbfEvents;"); });
  ev("appSettings.showRbfEvents = !appSettings.showRbfEvents;");
  // Daten ersetzt
  mustRebuild('Auftritte ersetzt/ergänzt', () => { ev("auftritte = auftritte.concat([{ name: 'Nova Frequenz', day: 'Sa 18.09', time: '23:00', endTime: '23:30', location: 'Docks', nid: 99 }]);"); });
  ev("auftritte = auftritte.slice(0, -1);");

  // Inhaltlich korrekt nach Änderung
  prepare(); w.switchTab('kuenstler');
  w.toggleHidden('Nova Frequenz');
  w.switchTab('programm');
  t.check('Inhalt stimmt: ausgeblendeter Künstler fehlt nach der Rückkehr in der Liste.', !row('nid:1'));
  w.switchTab('kuenstler'); w.toggleHidden('Nova Frequenz'); w.switchTab('programm');
  t.check('Wieder eingeblendet: Zeile ist zurück.', !!row('nid:1'));

  // ───────── C) Sprünge bauen nicht unnötig auf ─────────
  prepare(); w.switchTab('kuenstler'); w.resetKuenstlerFilters(); w.render();
  reset();
  w.jumpToProgShow('nid:1');
  t.check('Sprung ins Programm bei unverändertem Stand und sichtbarem Ziel: Liste wird NICHT neu aufgebaut.', count.prog === 0 && !d.getElementById('view-programm').classList.contains('hidden'), count);
  t.check('... Ziel ist trotzdem aufgeklappt.', !detail('nid:1').classList.contains('collapsed') && detail('nid:1').innerHTML.length > 500);

  w.switchTab('kuenstler');
  setDays([allDays()[allDays().length - 1]]); w.renderProg();   // Ziel (Mi 15.09) ist ausgefiltert
  reset();
  w.jumpToProgShow('nid:1');
  t.check('Sprung auf ausgefilterten Termin: Liste wird genau EINMAL (mit den angepassten Filtern) aufgebaut.', count.prog === 1 && !!row('nid:1'), count);

  reset();
  w.jumpToProgShow('nid:2', true);                    // schon im Programm, Ziel sichtbar
  t.check('Sprung innerhalb des Programms auf sichtbares Ziel: kein Neuaufbau.', count.prog === 0 && !!row('nid:2'), count);

  w.switchTab('programm'); setDays(allDays()); w.renderProg();
  w.switchTab('kuenstler'); w.resetKuenstlerFilters(); w.render();
  reset();
  w.jumpToArtist('Nova Frequenz');
  t.check('Sprung zum sichtbaren Künstler: nur seine Zeile wird neu gezeichnet, nicht die ganze Künstler-Liste.', count.kuenstler === 0 && count.artistItem >= 1 && !!d.querySelector('#item-Nova\\ Frequenz .artist-detail'), count);
  w.switchTab('programm');
  d.getElementById('search').value = 'zzz-nichts'; w.render();
  reset();
  w.jumpToArtist('Nova Frequenz');
  t.check('Ist der Künstler weggefiltert: Filter werden zurückgesetzt und die Liste einmal neu aufgebaut.', count.kuenstler === 1 && !!d.getElementById('item-Nova Frequenz') && d.getElementById('search').value === '', count);

  t.finish();
})();

const { createHelpers, loadApp, createChecker } = require('./test-helpers');

// Selbsttest der gemeinsamen Test-Werkzeuge (createHelpers): Wenn ein Helfer falsch arbeitet,
// würden sonst viele Tests unbemerkt das Falsche prüfen.
(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const H = createHelpers(w, d);
  const { ev, fire, sleep, viewVisible, chipVisible, progRow, ridOfRow, ridOf, detailOpen, showAllProg, installFakeLayout } = H;

  // ev
  t.check('ev wertet Code im App-Fenster aus (auch globale let-Variablen).', ev('1 + 1') === 2 && ev("typeof appSettings") === 'object');

  // fire
  let got = 0; const probe = d.createElement('div'); d.body.appendChild(probe);
  probe.addEventListener('change', () => { got++; });
  fire(probe, 'change');
  t.check('fire löst ein Ereignis aus, das auch Listener erreicht.', got === 1);
  let bubbled = 0; d.body.addEventListener('ping', () => { bubbled++; }); fire(probe, 'ping');
  t.check('fire-Ereignisse sprudeln nach oben (bubbles).', bubbled === 1);
  probe.remove();

  // sleep
  const t0 = Date.now(); await sleep(60);
  t.check('sleep wartet mindestens die angegebene Zeit.', Date.now() - t0 >= 55);

  // viewVisible
  w.switchTab('programm');
  t.check('viewVisible: der aktive Tab ist sichtbar, andere nicht.', viewVisible('programm') === true && viewVisible('kuenstler') === false);
  w.switchTab('kuenstler');
  t.check('viewVisible folgt dem Tabwechsel.', viewVisible('kuenstler') === true && viewVisible('programm') === false);

  // showAllProg
  w.switchTab('kuenstler');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
  d.getElementById('timeFrom').value = '10:00'; d.getElementById('timeTo').value = '12:00';
  showAllProg();
  const days = [...d.querySelectorAll('.day-btn')];
  t.check('showAllProg aktiviert ALLE Tage, auch wenn vorher keiner aktiv war.', days.length > 0 && days.every(b => b.classList.contains('active')), days.map(b => b.className));
  t.check('showAllProg setzt "Von" auf 08:00 und lässt "Bis" unverändert (ohne clearTimeTo).', d.getElementById('timeFrom').value === '08:00' && d.getElementById('timeTo').value === '12:00');
  t.check('showAllProg baut die Liste auf (Zeilen vorhanden) - ohne switchTab bleibt der Tab unverändert.', d.querySelectorAll('#progList .prog-item').length > 0 && viewVisible('kuenstler') === true);
  showAllProg({ switchTab: true, clearTimeTo: true });
  t.check('showAllProg({ switchTab, clearTimeTo }) wechselt zum Programm-Tab und leert "Bis".', viewVisible('programm') === true && d.getElementById('timeTo').value === '');
  w.switchTab('kuenstler'); selectOnlyFirstDay();
  function selectOnlyFirstDay() { d.querySelectorAll('.day-btn').forEach((b, i) => b.classList.toggle('active', i === 0)); }
  ev("selectedLocs.add('Docks');");
  showAllProg({ reset: true });
  t.check('showAllProg({ reset: true }) setzt vorher die Programm-Filter zurück (Location-Auswahl leer) und zeigt alle Tage.', ev('selectedLocs.size') === 0 && [...d.querySelectorAll('.day-btn')].every(b => b.classList.contains('active')));
  showAllProg({ switchTab: true });

  // progRow / ridOfRow / ridOf / detailOpen
  const row = progRow('nid:1');
  t.check('progRow findet die Zeile zu einem Auftritts-Schlüssel (und sonst undefined).', !!row && row.dataset.skey === 'nid:1' && progRow('nid:gibt-es-nicht') === undefined);
  const rid = ridOfRow(row);
  t.check('ridOfRow liefert die Zeilen-Id aus dem onclick (passt zum Detail-Container der Zeile).', /^[\w-]+$/.test(rid) && !!d.getElementById(`${rid}-detail`), rid);
  t.check('ridOf(skey) = ridOfRow(progRow(skey)).', ridOf('nid:1') === rid);
  t.check('detailOpen: zugeklappt = false, nicht vorhanden = false.', detailOpen('nid:1') === false && detailOpen('nid:gibt-es-nicht') === false);
  w.toggleProgRating(rid);
  t.check('detailOpen: nach dem Aufklappen = true.', detailOpen('nid:1') === true);
  w.toggleProgRating(rid);
  t.check('detailOpen: nach dem Zuklappen wieder false.', detailOpen('nid:1') === false);

  // chipVisible
  t.check('chipVisible: ohne Zurück-Chip false.', chipVisible() === false);
  w.showJumpBackChip({ tab: 'kuenstler', label: 'Künstler', subject: 'x', anchor: null, openKey: null });
  t.check('chipVisible: mit angezeigtem Zurück-Chip true.', chipVisible() === true);
  w.hideJumpBackChip();

  // installFakeLayout
  const lists = installFakeLayout();
  t.check('installFakeLayout gibt die beiden Listen-Elemente zurück (artistList, progList).', lists.length === 2 && lists[0].id === 'artistList' && lists[1].id === 'progList');
  const pl = d.getElementById('progList');
  const kids = [...pl.children];
  const r0 = kids[0].getBoundingClientRect(), r2 = kids[2].getBoundingClientRect(), rl = pl.getBoundingClientRect();
  t.check('Fake-Layout: Liste 600px hoch, jede Zeile 100px hoch, Zeile i beginnt bei i*100.', rl.height === 600 && r0.top === 0 && r0.height === 100 && r2.top === 200 && r2.bottom === 300, { rl, r0, r2 });
  pl.scrollTop = 250;
  t.check('Fake-Layout: scrollTop ist frei setzbar und verschiebt die Zeilen entsprechend (Zeile 2: 200 - 250 = -50).', pl.scrollTop === 250 && kids[2].getBoundingClientRect().top === -50);
  t.check('Fake-Layout: Elemente außerhalb der Listen haben Null-Rects.', d.getElementById('toast').getBoundingClientRect().height === 0);
  const custom = installFakeLayout(['progList'], 40, 200);
  t.check('installFakeLayout mit eigenen Maßen: Zeilenhöhe 40, Listenhöhe 200, nur progList.', custom.length === 1 && d.getElementById('progList').getBoundingClientRect().height === 200 && [...d.getElementById('progList').children][3].getBoundingClientRect().top === 120 - d.getElementById('progList').scrollTop);

  t.finish();
})();

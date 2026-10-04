const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const ev = code => w.eval(code);

  const showProg = () => {
    w.switchTab('programm');
    d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
    d.getElementById('timeFrom').value = '08:00';
    d.getElementById('timeTo').value = '';
    w.renderProg();
  };
  const rowsOf = name => [...d.querySelectorAll('#progList .prog-item')].filter(el => el.querySelector('.prog-name').textContent.trim().startsWith(name));
  const isSeenRow = el => el.classList.contains('prog-item-seen');
  const ridOf = row => row.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];

  showProg();
  const nova = () => rowsOf('Nova Frequenz');
  const rosa = () => rowsOf('Rosa Mercur');
  t.check('Testdaten: Nova Frequenz hat 1, Rosa Mercur mehrere Auftritte im Programm.', nova().length === 1 && rosa().length >= 2, { nova: nova().length, rosa: rosa().length });

  // 1) Ohne Status keine Markierung
  t.check('Ohne Gesehen-Status ist keine Zeile markiert.', [...d.querySelectorAll('#progList .prog-item')].every(el => !isSeenRow(el)));

  // 2) "Gesehen" (über die Künstler-Übersicht gesetzt) markiert beim Wechsel ins Programm
  w.switchTab('kuenstler');
  w.setSeen('Nova Frequenz', 'ja');
  showProg();
  t.check('Gesehen: die Programm-Zeile des Künstlers ist markiert (prog-item-seen).', isSeenRow(nova()[0]));
  t.check('Andere Künstler bleiben unmarkiert.', rosa().every(el => !isSeenRow(el)));

  // 3) "Bekannt" zählt NICHT
  w.switchTab('kuenstler');
  w.setSeen('Nova Frequenz', 'ja');            // Toggle: ja -> ''
  w.setSeen('Nova Frequenz', 'bekannt');
  showProg();
  t.check('"Bekannt" wird nicht markiert.', !isSeenRow(nova()[0]));
  w.switchTab('kuenstler');
  w.setSeen('Nova Frequenz', 'bekannt');       // zurück auf ''
  t.check('Ausgangslage: Nova Frequenz ohne Status.', ev("dataMap['Nova Frequenz'].gesehen") === '');

  // 4) Live-Update aus der Programm-Übersicht, ohne Neu-Rendern; alle Zeilen des Künstlers
  showProg();
  const r0 = rosa();
  const rid0 = ridOf(r0[0]);
  w.setSeenProg(rid0, 'Rosa Mercur', 'ja');
  t.check('Live: Klick auf "Gesehen" markiert ALLE sichtbaren Zeilen des Künstlers sofort.', rosa().every(isSeenRow) && rosa().length === r0.length);
  t.check('Live-Update ersetzt die Zeilen nicht (gleiche DOM-Knoten).', r0.every((el, i) => el === rosa()[i]));
  w.setSeenProg(rid0, 'Rosa Mercur', 'bekannt');
  t.check('Live: Wechsel auf "Bekannt" entfernt die Markierung wieder.', rosa().every(el => !isSeenRow(el)));
  w.setSeenProg(rid0, 'Rosa Mercur', 'ja');
  w.setSeenProg(rid0, 'Rosa Mercur', 'ja');   // Toggle aus
  t.check('Live: erneuter Klick (Toggle aus) entfernt die Markierung.', rosa().every(el => !isSeenRow(el)));
  w.setSeenProg(rid0, 'Rosa Mercur', 'ja');

  // 5) Persistenz über Neu-Rendern
  w.renderProg();
  t.check('Nach Neu-Rendern bleibt die Markierung bestehen.', rosa().every(isSeenRow));

  // 6) Namensfarbe + Seitenstreifen
  const css = d.querySelector('style').textContent;
  t.check('Seitenstreifen: grüner Inset-Schatten auf .prog-item-seen (kein Layout-Versatz).', /\.prog-item-seen\s*\{[^}]*box-shadow:\s*inset\s+3px\s+0\s+0\s+var\(--green\)/.test(css));
  t.check('Namensfarbe: .prog-item-seen .prog-name ist grün.', /\.prog-item-seen \.prog-name\s*\{[^}]*color:\s*var\(--green\)/.test(css));
  t.check('Kein Häkchen/zusätzliches Element im Namen (Platz bleibt frei).', !rosa()[0].querySelector('.prog-name').innerHTML.includes('✓'));

  // 7) Sonderveranstaltungen werden nie markiert
  ev("appSettings.showRbfEvents = true; appSettings.showMusicEvents = true; appSettings.showOtherEvents = true;");
  w.renderProg();
  const evRow = [...d.querySelectorAll('#progList .prog-item')].find(el => el.textContent.includes('Anchor Award Show'));
  t.check('Event-Zeile ("Anchor Award Show") ist nie markiert.', !!evRow && !isSeenRow(evRow));
  // Namenskollision: Gäbe es zu einem Event-Namen einen Künstlereintrag mit Status "Gesehen",
  // darf die Event-Zeile trotzdem nicht markiert werden.
  ev("dataMap['Anchor Award Show'] = { name:'Anchor Award Show', genre:'', herkunft:'', geschlecht:'mixed', rbfUrl:'', rp:0, rl:0, gesehen:'ja', customUrl:'', manual:false, ausgeblendet:false };");
  w.renderProg();
  const evRow2 = [...d.querySelectorAll('#progList .prog-item')].find(el => el.textContent.includes('Anchor Award Show'));
  t.check('Event-Zeile bleibt unmarkiert, auch wenn ein gleichnamiger Künstler "Gesehen" ist.', !!evRow2 && !isSeenRow(evRow2));
  ev("delete dataMap['Anchor Award Show'];");
  w.renderProg();

  // 8) Mit ausgeblendetem Künstler: beide Optiken (Abdunkeln + Markierung) vertragen sich
  ev("dataMap['Rosa Mercur'].ausgeblendet = true;");
  d.getElementById('progShowHidden').checked = true;
  w.renderProg();
  t.check('Ausgeblendeter + gesehener Künstler: Zeile trägt beide Klassen.', rosa().every(el => isSeenRow(el) && el.classList.contains('prog-item-hidden')));
  ev("dataMap['Rosa Mercur'].ausgeblendet = false;");
  d.getElementById('progShowHidden').checked = false;


  t.finish();
})();

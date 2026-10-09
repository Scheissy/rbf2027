const { createHelpers, loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { ev, progRow: row, ridOf } = H;
  const t = createChecker();

  H.showAllProg({ switchTab: true, clearTimeTo: true });

  const marked = skey => !!row(skey) && row(skey).classList.contains('prog-item-visited');
  const dur = (skey, v) => w.setShowDuration(ridOf(skey), skey, v);
  const rate = (skey, n) => w.setShowRating(ridOf(skey), skey, n);

  // Zwei Auftritte desselben Künstlers (Rosa Mercur) + ein einzelner (Nova Frequenz)
  const rosaKeys = [...d.querySelectorAll('#progList .prog-item')].filter(el => el.querySelector('.prog-name').textContent.trim().startsWith('Rosa Mercur')).map(el => el.dataset.skey);
  t.check('Testdaten: Rosa Mercur hat mindestens 2 Auftritte, Nova Frequenz einen (nid:1).', rosaKeys.length >= 2 && !!row('nid:1'), rosaKeys);

  // 1) Ausgangslage
  t.check('Ohne Dauer/Bewertung ist keine Zeile markiert.', [...d.querySelectorAll('#progList .prog-item')].every(el => !el.classList.contains('prog-item-visited')));
  t.check('Der Dauer-Vorschlag (Nova Frequenz 20:00-20:45) markiert NICHT.', !marked('nid:1'));

  // 2) Dauer -> markiert (live, gleicher DOM-Knoten)
  const node = row('nid:1');
  dur('nid:1', 45);
  t.check('Dauer eingetragen -> Zeile sofort markiert.', marked('nid:1'));
  t.check('Live-Update ersetzt die Zeile nicht (gleicher DOM-Knoten).', row('nid:1') === node);
  dur('nid:1', 0);
  t.check('Dauer wieder entfernt (0) -> Markierung weg.', !marked('nid:1'));

  // 3) Auftritts-Bewertung -> markiert
  rate('nid:1', 3);
  t.check('Auftritts-Bewertung gesetzt -> Zeile markiert.', marked('nid:1'));
  rate('nid:1', 3);                       // gleicher Stern = Toggle aus
  t.check('Bewertung zurückgenommen -> Markierung weg.', !marked('nid:1'));

  // 4) Eines von beiden genügt; Markierung bleibt, solange eines vorhanden ist
  dur('nid:1', 30); rate('nid:1', 4);
  dur('nid:1', 0);
  t.check('Dauer + Bewertung, Dauer entfernt -> bleibt markiert (Bewertung genügt).', marked('nid:1'));
  rate('nid:1', 4);
  t.check('Danach auch Bewertung entfernt -> Markierung weg.', !marked('nid:1'));

  // 5) Die Markierung gilt für ALLE Auftritte des Künstlers, sobald einer besucht ist
  const rosaMarked = () => rosaKeys.map(marked);
  const node2 = rosaKeys.map(row);
  dur(rosaKeys[0], 60);
  t.check('Dauer bei EINEM Auftritt markiert alle Zeilen dieses Künstlers.', rosaMarked().every(Boolean), rosaMarked());
  t.check('Andere Künstler bleiben unmarkiert (Nova Frequenz).', !marked('nid:1'));
  t.check('Live-Update ersetzt keine Zeilen (gleiche DOM-Knoten).', rosaKeys.every((k, i) => row(k) === node2[i]));
  rate(rosaKeys[1], 5);
  dur(rosaKeys[0], 0);
  t.check('Dauer des ersten entfernt, Bewertung am zweiten Auftritt bleibt -> alle Zeilen bleiben markiert.', rosaMarked().every(Boolean), rosaMarked());
  rate(rosaKeys[1], 5);                    // Toggle aus
  t.check('Danach nirgends mehr Dauer/Bewertung -> keine Zeile des Künstlers markiert.', rosaMarked().every(x => !x), rosaMarked());

  // 5b) Besuchter Auftritt steht wegen Filter gerade nicht in der Liste - die anderen werden trotzdem markiert
  const dayOf = k => ev(`auftritte.find(a => showKey(a) === '${k}').day`);
  const otherDay = rosaKeys.slice(1).map(k => ({ k, day: dayOf(k) })).find(x => x.day !== dayOf(rosaKeys[0]));
  t.check('Testdaten: Rosa Mercur spielt an mindestens zwei verschiedenen Tagen.', !!otherDay);
  dur(rosaKeys[0], 50);
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === otherDay.day));
  w.renderProg();
  t.check('Besuchter Auftritt ist durch den Tagesfilter ausgeblendet ...', !row(rosaKeys[0]));
  t.check('... trotzdem ist der andere sichtbare Auftritt des Künstlers markiert.', marked(otherDay.k));
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  w.renderProg();
  t.check('Alle Tage wieder aktiv: beide Auftritte markiert.', marked(rosaKeys[0]) && marked(otherDay.k));
  dur(rosaKeys[0], 0);
  t.check('Dauer entfernt -> Markierung auch beim anderen Auftritt weg (Live-Update).', !marked(rosaKeys[0]) && !marked(otherDay.k));

  // 6) Künstler-Status "Gesehen"/"Bekannt" spielt keine Rolle
  w.switchTab('kuenstler');
  w.setSeen('Nova Frequenz', 'ja');
  w.switchTab('programm');
  t.check('Künstler-Status "Gesehen" markiert die Zeile NICHT.', !marked('nid:1'));
  w.switchTab('kuenstler');
  w.setSeen('Nova Frequenz', 'bekannt');
  w.switchTab('programm');
  t.check('Künstler-Status "Bekannt" markiert die Zeile NICHT.', !marked('nid:1'));
  w.switchTab('kuenstler'); w.setSeen('Nova Frequenz', 'bekannt'); w.switchTab('programm');
  dur('nid:1', 20);
  t.check('Status egal: Auftritt mit Dauer ist trotzdem markiert.', marked('nid:1'));
  dur('nid:1', 0);

  // 7) Über das Dauer-Modal
  w.openDurationModal(ridOf('nid:1'), 'nid:1', 'Nova Frequenz', 45);
  w.closeDurationModal();
  t.check('Modal öffnen/schließen mit unverändertem Vorschlag markiert NICHT.', !marked('nid:1'));
  w.openDurationModal(ridOf('nid:1'), 'nid:1', 'Nova Frequenz', 45);
  w.stepDurationModal(5);
  w.closeDurationModal();
  t.check('Stepper im Modal (45 -> 50) speichert und markiert.', marked('nid:1'));
  w.openDurationModal(ridOf('nid:1'), 'nid:1', 'Nova Frequenz', 45);
  w.resetDurationModal();
  w.closeDurationModal();
  t.check('"Zurücksetzen" im Modal entfernt die Markierung wieder.', !marked('nid:1'));
  w.openDurationModal(ridOf('nid:1'), 'nid:1', 'Nova Frequenz', 45);
  w.confirmDurationModal();
  t.check('"Als Auftritt speichern" (Vorschlag übernehmen) markiert.', marked('nid:1'));
  dur('nid:1', 0);

  // 8) Neu-Rendern / Neustart behalten die Markierung
  dur('nid:1', 40); rate(rosaKeys[0], 2);
  w.renderProg();
  t.check('Nach Neu-Rendern bleiben beide Markierungen bestehen.', marked('nid:1') && marked(rosaKeys[0]));
  dur('nid:1', 0); rate(rosaKeys[0], 2);
  w.renderProg();
  t.check('Nach Neu-Rendern sind entfernte Markierungen weg.', !marked('nid:1') && !marked(rosaKeys[0]));

  // 9) Sonderveranstaltungen sind Auftritte mit Auftritts-Dauer/-Bewertung -> ebenfalls markierbar
  ev("appSettings.showRbfEvents = true; appSettings.showMusicEvents = true; appSettings.showOtherEvents = true;");
  w.renderProg();
  const evEl = [...d.querySelectorAll('#progList .prog-item')].find(el => el.textContent.includes('Anchor Award Show'));
  const evKey = evEl.dataset.skey;
  t.check('Event "Anchor Award Show" ist anfangs unmarkiert.', !marked(evKey));
  dur(evKey, 90);
  t.check('Event mit Dauer ist markiert.', marked(evKey));
  dur(evKey, 0);

  // 10) Verträgt sich mit ausgeblendet und mit Filter "Nur mit Dauer"
  rate('nid:1', 5);
  ev("dataMap['Nova Frequenz'].ausgeblendet = true;");
  d.getElementById('progShowHidden').checked = true;
  w.renderProg();
  t.check('Ausgeblendeter + besuchter Auftritt: beide Klassen.', row('nid:1').classList.contains('prog-item-hidden') && marked('nid:1'));
  ev("dataMap['Nova Frequenz'].ausgeblendet = false;");
  d.getElementById('progShowHidden').checked = false;
  rate('nid:1', 5);
  dur('nid:1', 30);
  d.getElementById('fProgDuration').checked = true;
  w.renderProg();
  t.check('Mit Filter "Nur mit Dauer" sind die sichtbaren Zeilen alle markiert.', [...d.querySelectorAll('#progList .prog-item')].every(el => el.classList.contains('prog-item-visited')) && !!row('nid:1'));
  dur('nid:1', 0);
  t.check('Dauer entfernt bei aktivem Filter: Zeile verschwindet (keine Markierungs-Reste).', !row('nid:1'));
  d.getElementById('fProgDuration').checked = false;
  w.renderProg();

  // 11) Optik: Namensfarbe + Seitenstreifen, kein Häkchen, keine Layout-Verschiebung
  const css = d.querySelector('style').textContent;
  t.check('Seitenstreifen: grüner Inset-Schatten auf .prog-item-visited (kein Layout-Versatz).', /\.prog-item-visited\s*\{[^}]*box-shadow:\s*inset\s+3px\s+0\s+0\s+var\(--green\)/.test(css));
  t.check('Namensfarbe: .prog-item-visited .prog-name ist grün.', /\.prog-item-visited \.prog-name\s*\{[^}]*color:\s*var\(--green\)/.test(css));
  dur('nid:1', 30);
  t.check('Kein Häkchen/zusätzliches Element im Namen (Platz bleibt frei).', !row('nid:1').querySelector('.prog-name').innerHTML.includes('✓'));
  t.check('Alte Artist-Markierung (prog-item-seen) existiert nicht mehr.', !/prog-item-seen/.test(css) && !d.querySelector('.prog-item-seen'));

  t.finish();
})();

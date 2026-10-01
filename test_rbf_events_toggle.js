const { loadApp, reloadWithState, createChecker, namesInList: namesInListShared } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  w.currentTab = 'programm';
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();

  const namesInList = () => namesInListShared(d);
  const musicRow = d.getElementById('rowShowMusicEvents');
  const otherRow = d.getElementById('rowShowOtherEvents');
  const settingCb = d.getElementById('settingShowRbfEvents');

  // 1) Standard: Schalter an, Events sichtbar, Checkbox-Zeilen sichtbar.
  t.check('Schalter ist standardmäßig eingeschaltet.', settingCb.checked);
  const namesBefore = namesInList();
  t.check('Bei eingeschaltetem Schalter sind Sonderveranstaltungen sichtbar.',
    namesBefore.some(n => n.includes('Anchor Award Show') || n.includes('RBF Podcast Live')));
  t.check('Beide Event-Checkbox-Zeilen sind bei eingeschaltetem Schalter sichtbar.',
    musicRow.style.display !== 'none' && otherRow.style.display !== 'none');

  // 2) Schalter ausschalten -> Events verschwinden komplett, Checkbox-Zeilen
  // verschwinden ebenfalls, unabhängig vom eigenen Zustand der beiden Haken.
  settingCb.checked = false;
  w.toggleSetting('showRbfEvents', false);
  w.renderProg();
  const namesAfter = namesInList();
  t.check('Bei ausgeschaltetem Schalter verschwinden alle Sonderveranstaltungen aus der Liste.',
    !namesAfter.some(n => n.includes('Anchor Award Show') || n.includes('RBF Podcast Live')));
  t.check('Beide Event-Checkbox-Zeilen verschwinden ebenfalls.',
    musicRow.style.display === 'none' && otherRow.style.display === 'none');

  // 3) Reguläre Künstler-Auftritte bleiben davon komplett unberührt.
  t.check('Reguläre Künstler-Auftritte bleiben unberührt.', namesAfter.some(n => n.includes('Nova Frequenz')));

  // 4) Auch wenn die beiden Unter-Checkboxen selbst noch "an" wären, bleiben
  // Events beim Hauptschalter=aus trotzdem draußen (Hauptschalter hat Vorrang).
  d.getElementById('settingShowMusicEvents').checked = true;
  d.getElementById('settingShowOtherEvents').checked = true;
  w.renderProg();
  const namesStillOff = namesInList();
  t.check('Hauptschalter hat Vorrang vor den beiden Unter-Checkboxen.',
    !namesStillOff.some(n => n.includes('Anchor Award Show') || n.includes('RBF Podcast Live')));

  // 5) Schalter wieder einschalten -> Events und Checkbox-Zeilen kommen zurück.
  settingCb.checked = true;
  w.toggleSetting('showRbfEvents', true);
  w.renderProg();
  const namesRestored = namesInList();
  t.check('Erneutes Einschalten bringt die Sonderveranstaltungen zurück.', namesRestored.some(n => n.includes('Anchor Award Show')));
  t.check('Checkbox-Zeilen erscheinen nach erneutem Einschalten wieder.',
    musicRow.style.display !== 'none' && otherRow.style.display !== 'none');

  // 6) Persistenz: Zustand übersteht einen simulierten Reload.
  settingCb.checked = false;
  w.toggleSetting('showRbfEvents', false);

  const reloaded = await reloadWithState(w, ['rbf2027_v1']);
  reloaded.window.currentTab = 'programm';
  reloaded.window.renderProg();
  const namesAfterReload = [...reloaded.document.querySelectorAll('.prog-name')].map(el => el.textContent);
  const settingCb2 = reloaded.document.getElementById('settingShowRbfEvents');
  t.check('Ausgeschalteter Zustand wird korrekt persistiert und nach Reload wiederhergestellt.',
    !settingCb2.checked && !namesAfterReload.some(n => n.includes('Anchor Award Show')));

  t.finish();
})();

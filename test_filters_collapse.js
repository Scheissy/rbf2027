const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  const panel = d.getElementById('progFiltersExtra');
  const btn = d.getElementById('progFiltersToggleBtn');

  // 1) Standard: eingeklappt
  t.check('Erweiterte Filter sind standardmäßig eingeklappt.',
    panel.style.display === 'none' && btn.textContent.includes('Weitere Filter'), { display: panel.style.display, btnText: btn.textContent });

  // 2) Zeit-/Location-Zeile bleibt immer sichtbar (nicht Teil des Panels)
  const timeFrom = d.getElementById('timeFrom');
  const locBtn = d.getElementById('locFilterBtn');
  const timeRowVisible = timeFrom && locBtn && !panel.contains(timeFrom) && !panel.contains(locBtn);
  t.check('Zeit-/Location-Auswahl liegt außerhalb des einklappbaren Bereichs.', timeRowVisible);

  // 3) Aufklappen per Button
  w.toggleProgFiltersPanel();
  t.check('Klick auf den Toggle-Button klappt das Panel auf.',
    panel.style.display === 'flex' && btn.textContent.includes('Weniger Filter'), { display: panel.style.display, btnText: btn.textContent });

  // 4) Inhalte, die vorher direkt sichtbar waren, liegen jetzt im Panel
  const hiddenCheckbox = d.getElementById('progShowHidden');
  const statusSelect = d.getElementById('fProgStatus');
  const musicEventsCb = d.getElementById('settingShowMusicEvents');
  t.check('Bewertungs-/Status-/Ausblenden-/Event-Filter liegen im einklappbaren Bereich.',
    panel.contains(hiddenCheckbox) && panel.contains(statusSelect) && panel.contains(musicEventsCb));

  // 5) Zustand wird über appSettings persistiert
  w.saveToStorage();
  panel.style.display = 'none'; // UI zurücksetzen, um Reload zu simulieren (appSettings selbst
                                 // ist eine top-level `let`-Variable im Script, kein window-Property,
                                 // genau wie in echten Browsern - daher hier nicht direkt zugreifbar)
  w.loadFromStorage();
  w.applySettingsUI();
  t.check('Aufgeklappter Zustand wird korrekt persistiert und nach Reload wiederhergestellt.', panel.style.display === 'flex');

  // 6) Wieder zuklappen funktioniert
  w.toggleProgFiltersPanel();
  t.check('Erneuter Klick klappt das Panel wieder zu.',
    panel.style.display === 'none' && btn.textContent.includes('Weitere Filter'));

  // 7) Filterfunktion selbst bleibt unberührt (Status-Filter im eingeklappten
  //    Zustand wirkt weiterhin, auch wenn nicht sichtbar)
  w.currentTab = 'programm';
  statusSelect.value = 'ja';
  w.renderProg();
  const listHtmlAfter = d.getElementById('progList').innerHTML;
  // Kein Auftritt in den Testdaten ist als "gesehen" markiert -> Liste sollte leer/gefiltert sein
  t.check('Status-Filter wirkt weiterhin, auch während das Panel eingeklappt ist.',
    listHtmlAfter.includes('prog-empty') || !listHtmlAfter.includes('Nova Frequenz'));
  statusSelect.value = ''; // zurücksetzen für Sauberkeit

  t.finish();
})();

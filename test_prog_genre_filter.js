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

  // 1) UI-Elemente vorhanden: Button zwischen den Bewertungssternen und dem
  // Status-Dropdown, Modal, Chips-Container.
  const panel = d.getElementById('progFiltersExtra');
  const btn = d.getElementById('progGenreFilterBtn');
  const modal = d.getElementById('progGenreModal');
  const chips = d.getElementById('progGenreChips');
  t.check('Genre-Filter-Button, Modal und Chips-Container sind vorhanden und liegen im "Weitere Filter"-Panel.',
    !!btn && !!modal && !!chips && panel.contains(btn), { btn: !!btn, modal: !!modal, chips: !!chips, inPanel: panel.contains(btn) });

  // Position: Button muss zwischen den Bewertungssternen (prog-rating-filter)
  // und dem Status-Select (fProgStatus) liegen.
  const children = [...panel.children];
  const ratingRowIdx = children.findIndex(c => c.querySelector && c.querySelector('.prog-rating-filter'));
  const genreBtnIdx = children.indexOf(btn);
  const statusRowIdx = children.findIndex(c => c.querySelector && c.querySelector('#fProgStatus'));
  t.check('Genre-Filter-Button liegt strukturell zwischen den Bewertungen und dem Status-Dropdown.',
    ratingRowIdx !== -1 && genreBtnIdx !== -1 && statusRowIdx !== -1 && ratingRowIdx < genreBtnIdx && genreBtnIdx < statusRowIdx,
    { ratingRowIdx, genreBtnIdx, statusRowIdx });

  // 2) Button-Text initial "Alle Genres", Modal öffnet/schließt.
  t.check('Button zeigt initial "🎵 Alle Genres".', btn.textContent.includes('Alle Genres'), btn.textContent);
  w.openProgGenreModal();
  t.check('Modal öffnet sich.', modal.classList.contains('open'));

  // 3) Genre-Liste im Modal enthält die bekannten Testdaten-Genres (z.B. "Techno").
  const modalList = d.getElementById('progGenreModalList');
  t.check('Genre-Liste im Modal enthält erwartete Genres (z.B. "Techno").', modalList.textContent.includes('Techno'));

  // 4) Genre auswählen ("Techno", passt zu "Stahl & Beton") -> Liste filtert
  // entsprechend, andere Künstler verschwinden.
  w.toggleProgGenreSelection('Techno');
  w.closeProgGenreModal();
  const namesAfterFilter = namesInList();
  const hasStahlBeton = namesAfterFilter.some(n => n.includes('Stahl & Beton'));
  const hasNovaFrequenz = namesAfterFilter.some(n => n.includes('Nova Frequenz'));
  t.check('Filter auf "Techno" zeigt "Stahl & Beton", blendet "Nova Frequenz" (Electro/Pop) aus.',
    hasStahlBeton && !hasNovaFrequenz, { hasStahlBeton, hasNovaFrequenz });

  // 5) Events (ohne Genre) verschwinden bei aktivem Genre-Filter (analog zu
  // Bewertungs-/Status-Filtern, die Events ebenfalls ausschließen).
  const hasEvent = namesAfterFilter.some(n => n.includes('Anchor Award Show') || n.includes('RBF Podcast Live'));
  t.check('Sonderveranstaltungen (ohne Genre) werden bei aktivem Genre-Filter ausgeblendet.', !hasEvent);

  // 6) Chip erscheint, Button-Text zeigt Anzahl.
  t.check('Chip "Techno" erscheint, Button zeigt "Genre (1)".',
    chips.style.display !== 'none' && chips.textContent.includes('Techno') && btn.textContent.includes('Genre (1)'),
    { chipsDisplay: chips.style.display, chipsText: chips.textContent, btnText: btn.textContent });

  // 7) Chip per "✕" wieder entfernen -> Filter zurückgesetzt, alle wieder sichtbar.
  const chipX = chips.querySelector('.filter-chip-x');
  chipX.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const namesAfterRemove = namesInList();
  t.check('Entfernen des Chips setzt den Filter zurück, Button zeigt wieder "Alle Genres".',
    namesAfterRemove.some(n => n.includes('Nova Frequenz')) && btn.textContent.includes('Alle Genres'));

  // 8) "Filter zurücksetzen" (allgemein) setzt auch den Genre-Filter zurück.
  w.toggleProgGenreSelection('Pop');
  w.resetProgFilters();
  t.check('"Filter zurücksetzen" setzt auch den Programm-Genre-Filter zurück.',
    btn.textContent.includes('Alle Genres') && chips.style.display === 'none');

  // 9) Persistenz: Auswahl übersteht einen simulierten Reload (reloadWithState()
  // kapselt das "neue, frische App-Instanz laden" - siehe test-helpers.js).
  w.toggleProgGenreSelection('Folk');
  w.saveFilterState();
  const reloaded = await reloadWithState(w, ['rbf2027_filters_v1']);
  reloaded.window.currentTab = 'programm';
  reloaded.window.renderProg();
  const btn2 = reloaded.document.getElementById('progGenreFilterBtn');
  const chips2 = reloaded.document.getElementById('progGenreChips');
  t.check('Genre-Auswahl wird korrekt persistiert und in einer frischen App-Instanz (echtes Reload) wiederhergestellt.',
    btn2.textContent.includes('Folk') || chips2.textContent.includes('Folk'), { btn2: btn2.textContent, chips2: chips2.textContent });
  // Aufräumen: "Folk" wurde nur auf der ORIGINALEN Instanz (w) gesetzt, um es
  // zu speichern (reloaded diente nur als Lese-Test) - für die folgenden Tests
  // muss der Zustand auf w wieder sauber sein.
  w.resetProgGenreFilter();

  // 10) Künstler-Tab-Genre-Filter bleibt komplett unberührt (eigener Zustand).
  t.check('Der Genre-Filter der Künstler-Übersicht bleibt unabhängig/unberührt.',
    ![...w.document.querySelectorAll('#fGenreBtn')].some(b => b.textContent.includes('Folk')));

  // 11) "Jetzt" (zweistufiges Verhalten, siehe jumpToNow()): 1. Klick lässt
  // den Genre-Filter unangetastet, 2. Klick (bereits auf "jetzt") setzt ihn
  // zusammen mit den übrigen Filtern zurück - analog zu Location/Bewertung/
  // Status/Dauer/Ziel.
  w.getBerlinNow = () => ({ year: 2027, month: 9, day: 17, hour: 14, minute: 0 });
  w.toggleProgGenreSelection('Techno');
  w.jumpToNow(); // 1. Klick: nur Tag/Zeit
  t.check('1. "Jetzt"-Klick lässt den Genre-Filter unangetastet.',
    btn.textContent.includes('Techno') || btn.textContent.includes('Genre (1)'), btn.textContent);
  w.jumpToNow(); // 2. Klick (bereits auf "jetzt"): auch Genre zurücksetzen
  t.check('2. "Jetzt"-Klick setzt den Genre-Filter korrekt mit zurück.', btn.textContent.includes('Alle Genres'), btn.textContent);

  t.finish();
})();

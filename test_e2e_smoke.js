const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  const step = (label, fn) => {
    try {
      fn();
      t.check(label, errors.length === 0, errors.length ? [...errors] : undefined);
      errors.length = 0;
    } catch (e) {
      t.check(label, false, `AUSNAHME: ${e.message}`);
    }
  };

  // Simuliert Freitagnachmittag, mitten im Festival.
  w.getBerlinNow = () => ({ year: 2027, month: 9, day: 17, hour: 16, minute: 0 });

  step('App-Start / Künstler-Tab initial rendern', () => {
    w.render();
  });

  step('Suche eingeben und wieder löschen', () => {
    d.getElementById('search').value = 'Nova';
    w.onSearchInput();
    d.getElementById('search').value = '';
    w.onSearchInput();
  });

  step('Künstler bewerten (Promo + Live)', () => {
    w.setRating('Nova Frequenz', 'rp', 4);
    w.setRating('Nova Frequenz', 'rl', 5);
  });

  step('Künstler als Gesehen markieren, dann wieder zurücknehmen', () => {
    w.setSeen('Nova Frequenz', 'ja');
    w.setSeen('Nova Frequenz', 'ja'); // erneuter Klick = zurücknehmen
  });

  step('Künstler zum Reinhören vormerken und wieder entfernen', () => {
    w.toggleReinhoeren('Blau Neon');
    w.toggleReinhoeren('Blau Neon');
  });

  step('Künstler ausblenden und wieder einblenden', () => {
    w.toggleHidden('Grauzone Sieben');
    w.toggleHidden('Grauzone Sieben');
  });

  step('Stat-Kachel-Filter anklicken und zurücksetzen', () => {
    w.filterByStat('unbewertet');
    w.filterByStat('gesamt');
  });

  step('In den Programm-Tab wechseln', () => {
    w.switchTab('programm');
  });

  step('Erweiterte Filter aufklappen und wieder zuklappen', () => {
    w.toggleProgFiltersPanel();
    w.toggleProgFiltersPanel();
  });

  step('Ziel-Flag umschalten, während "Nur als Ziel markierte" aktiv ist (Scroll-Anker-Erhaltung)', () => {
    const wasPlanned = d.getElementById('fProgPlanned').checked;
    d.getElementById('fProgPlanned').checked = true;
    w.togglePlanFlag('x', 'nid:1');
    w.togglePlanFlag('x', 'nid:1');
    d.getElementById('fProgPlanned').checked = wasPlanned;
    w.renderProg();
  });

  step('Sonderveranstaltung ausblenden und wieder einblenden', () => {
    const entry = w.allProgEntries().find(e => e.isEvent);
    if (!entry) throw new Error('Kein Event in den Testdaten gefunden');
    w.toggleEventHidden(entry.nid);
    w.toggleEventHidden(entry.nid);
  });

  step('"Jetzt" zweimal hintereinander klicken (Zeitsprung + Reset)', () => {
    w.jumpToNow();
    w.jumpToNow();
  });

  step('"Jetzt"-Info-Modal öffnen und schließen', () => {
    w.openModal('jumpToNowInfoModal');
    w.closeModal('jumpToNowInfoModal');
  });

  step('Location-Info-Modal öffnen und schließen', () => {
    w.openLocFilterInfoModal();
    w.closeModal('locFilterInfoModal');
  });

  step('Location dauerhaft ausblenden und wieder zurücksetzen', () => {
    w.toggleLocVisibility('Docks');
    w.resetLocManage();
  });

  step('"Filter zurücksetzen" (Programm) klicken', () => {
    w.resetProgFilters();
  });

  step('Tag-Auswahl manuell umschalten', () => {
    const btn = [...d.querySelectorAll('.day-btn')][0];
    w.toggleDay(btn);
    w.toggleDay(btn);
  });

  step('Zurück in den Künstler-Tab wechseln', () => {
    w.switchTab('kuenstler');
  });

  step('In den Auswertung-Tab wechseln, Info-Modal öffnen und schließen', () => {
    w.switchTab('auswertung');
    w.openAuswertungInfoModal();
    w.closeModal('auswertungInfoModal');
  });

  step('Auswertung: alle drei Sortierungen durchschalten, Summe/Durchschnitt bei Dauer testen', () => {
    w.setAuswertungSort('duration');
    w.setAuswertungAgg('avg');
    w.setAuswertungAgg('sum');
    w.setAuswertungSort('rating');
    w.setAuswertungSort('count');
  });

  step('Auswertung: einen Tag ab- und wieder anwählen (per Klick, wie in echter Nutzung)', () => {
    const dayBtn = [...d.querySelectorAll('.ausw-day-btn')][0];
    dayBtn.click();
    dayBtn.click();
  });

  step('Auswertung: eine Location-Zeile auf- und wieder zuklappen', () => {
    const head = d.querySelector('.ausw-loc-head');
    if (head) { head.click(); head.click(); }
  });

  step('Auswertung: eine Genre-Zeile auf- und wieder zuklappen', () => {
    const head = d.querySelector('.ausw-genre .ausw-loc-head');
    if (head) { head.click(); head.click(); }
  });

  step('Auswertung: "Größte Wege" wird ohne Fehler mitgerendert', () => {
    w.renderAuswertung();
  });

  step('In den Settings-Tab (io) wechseln', () => {
    w.switchTab('io');
  });

  step('Kompletter Speichern/Laden-Zyklus (Persistenz)', () => {
    w.saveToStorage();
    w.loadFromStorage();
    w.applySettingsUI();
  });

  step('Erneutes vollständiges Rendern beider Tabs ohne Fehler', () => {
    w.render();
    w.renderProg();
  });

  t.finish();
})();

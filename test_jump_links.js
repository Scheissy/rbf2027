const { createHelpers, loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { detailOpen, ev, progRow, ridOfRow: ridOf, viewVisible } = H;
  const t = createChecker();

  const resetAll = () => {
    ev("selectedLocs.clear(); progSelectedGenres.clear(); appSettings.hiddenLocations = [];");
    d.getElementById('progShowHidden').checked = false;
    d.getElementById('fProgStatus').value = '';
    w.switchTab('kuenstler');
    w.resetKuenstlerFilters();
    ev("expandedRows.clear();");
    w.render();
  };
  const toastText = () => (d.getElementById('toast') || {}).textContent || '';

  // ───────────── A) Künstler -> Programm ─────────────
  w.switchTab('kuenstler');
  w.resetKuenstlerFilters();
  w.toggleExpand('Nova Frequenz');
  const dayEl = [...d.querySelectorAll('#artistList .show-day')][0];
  const timeEl = [...d.querySelectorAll('#artistList .show-time')][0];
  t.check('In der Künstler-Übersicht sind Tag und Zeit des Auftritts antippbar (show-jump).',
    !!dayEl && !!timeEl && dayEl.classList.contains('show-jump') && timeEl.classList.contains('show-jump'));
  t.check('Tag und Zeit verlinken auf den Auftritt (nid:1).',
    dayEl.getAttribute('onclick').includes("jumpToProgShow('nid:1')") && timeEl.getAttribute('onclick').includes("jumpToProgShow('nid:1')"));

  // Ausgangslage: Programm-Filter blenden den Auftritt aus (anderer Tag, spätere Zeit, falsche Location)
  w.switchTab('programm');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === 'Sa 18.09'));
  d.getElementById('timeFrom').value = '22:00';
  ev("selectedLocs.add('Molotow');");
  w.renderProg();
  t.check('Ausgangslage: Nova Frequenz ist im Programm durch Tag/Zeit/Location NICHT sichtbar.', !progRow('nid:1'));
  w.switchTab('kuenstler');
  dayEl.click();
  t.check('Klick auf den Tag wechselt in die Programm-Übersicht.', viewVisible('programm') && !viewVisible('kuenstler'));
  t.check('Der Auftritt ist danach in der Liste sichtbar.', !!progRow('nid:1'));
  t.check('Die Detailansicht des Auftritts ist aufgeklappt.', detailOpen('nid:1'));
  t.check('Der Auftritt wird kurz hervorgehoben (jump-flash).', progRow('nid:1').classList.contains('jump-flash'));
  t.check('Tag Mi 15.09 wurde zusätzlich aktiviert (Sa 18.09 bleibt aktiv).',
    [...d.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day).sort().join() === 'Mi 15.09,Sa 18.09');
  t.check('Zeit- und Location-Filter, die den Auftritt ausblendeten, wurden gelöst.', d.getElementById('timeFrom').value === '08:00' && d.getElementById('timeTo').value === '' && ev('selectedLocs.size') === 0);

  // Nur das Nötige anpassen: Filter, die den Auftritt NICHT ausblenden, bleiben
  w.switchTab('kuenstler');
  w.switchTab('programm');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === 'Mi 15.09'));
  d.getElementById('timeFrom').value = '08:00';
  ev("selectedLocs.clear(); selectedLocs.add('Docks');");
  w.renderProg();
  t.check('Ausgangslage 2: Auftritt ist mit Docks-Filter bereits sichtbar.', !!progRow('nid:1'));
  w.jumpToProgShow('nid:1');
  t.check('Ist der Auftritt schon sichtbar, bleibt der Location-Filter unverändert (Docks).', ev("[...selectedLocs].join()") === 'Docks');
  t.check('...und auch der Tag-/Zeit-Filter bleibt unverändert.', d.getElementById('timeFrom').value === '08:00' && [...d.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).length === 1);
  t.check('...der Auftritt ist trotzdem aufgeklappt.', detailOpen('nid:1'));

  // Zweiter Sprung auf einen anderen Auftritt klappt den ersten wieder zu
  w.jumpToProgShow('nid:2');
  t.check('Sprung auf einen anderen Auftritt klappt den vorherigen zu (nur einer offen).', !detailOpen('nid:1') && detailOpen('nid:2'));

  // Dauerhaft ausgeblendete Location -> Hinweis, kein Wechsel
  resetAll();
  ev("appSettings.hiddenLocations = ['Docks'];");
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  t.check('Ausgeblendete Location (Einstellungen): kein Tabwechsel, man bleibt in der Künstler-Übersicht.', viewVisible('kuenstler') && !viewVisible('programm'));
  t.check('...und es erscheint ein Hinweis zur Location.', toastText().includes('Docks') && toastText().includes('ausgeblendet'), toastText());
  ev("appSettings.hiddenLocations = [];");

  // Ausgeblendeter Künstler -> Hinweis; mit aktivem Haken funktioniert der Sprung
  w.switchTab('kuenstler');
  ev("dataMap['Nova Frequenz'].ausgeblendet = true;");
  w.jumpToProgShow('nid:1');
  t.check('Ausgeblendeter Künstler (Haken aus): kein Tabwechsel, Hinweis statt Sprung ins Leere.', viewVisible('kuenstler') && toastText().includes('ausgeblendet'), toastText());
  d.getElementById('progShowHidden').checked = true;
  w.jumpToProgShow('nid:1');
  t.check('Mit "Ausgeblendete anzeigen" springt es zum ausgeblendeten Auftritt.', viewVisible('programm') && !!progRow('nid:1') && detailOpen('nid:1'));
  ev("dataMap['Nova Frequenz'].ausgeblendet = false;");
  d.getElementById('progShowHidden').checked = false;

  // Unbekannter Schlüssel
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:does-not-exist');
  t.check('Unbekannter Auftritt: kein Tabwechsel, Hinweis.', viewVisible('kuenstler') && toastText().includes('nicht gefunden'), toastText());

  // ───────────── B) Programm -> Künstler ─────────────
  resetAll();
  w.switchTab('programm');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();
  const row1 = progRow('nid:1');
  w.toggleProgRating(ridOf(row1));
  const toArtistBtn = [...d.getElementById(`${ridOf(row1)}-detail`).querySelectorAll('button')].find(b => b.textContent.includes('Zum Künstler'));
  t.check('Programm-Detailansicht hat den Button "👤 Zum Künstler".', !!toArtistBtn);
  t.check('Button verweist auf den richtigen Künstler.', toArtistBtn.getAttribute('onclick').includes("jumpToArtist('Nova Frequenz')"));

  // Künstler-Filter, die ihn ausblenden
  d.getElementById('search').value = 'zzz-nichts';
  d.getElementById('fGender').value = 'weiblich';
  w.render();
  toArtistBtn.click();
  t.check('Klick wechselt in die Künstler-Übersicht.', viewVisible('kuenstler') && !viewVisible('programm'));
  t.check('Der Künstler ist sichtbar und aufgeklappt.', !!d.getElementById('item-Nova Frequenz') && !!d.querySelector('#item-Nova\\ Frequenz .artist-detail'));
  t.check('Die Suche, die ihn ausblendete, wurde zurückgesetzt.', d.getElementById('search').value === '');
  t.check('Der Künstler wird hervorgehoben (jump-flash).', d.querySelector('#item-Nova\\ Frequenz .artist-row').classList.contains('jump-flash'));

  // Filter, die ihn NICHT ausblenden, bleiben
  w.switchTab('programm');
  d.getElementById('fGender').value = 'weiblich';
  const gender = ev("dataMap['Nova Frequenz'].geschlecht");
  d.getElementById('fGender').value = gender;
  w.render();
  w.jumpToArtist('Nova Frequenz');
  t.check('Passender Künstler-Filter (Geschlecht) bleibt erhalten, wenn er den Künstler nicht ausblendet.', d.getElementById('fGender').value === gender);

  // Ausgeblendeter Künstler: Filter "Ausgeblendet" wird gesetzt
  w.resetKuenstlerFilters();
  ev("dataMap['Stahl & Beton'].ausgeblendet = true;");
  w.jumpToArtist('Stahl & Beton');
  t.check('Ausgeblendeter Künstler: Künstler-Filter "Ausgeblendet" wird gesetzt und der Künstler ist sichtbar.',
    ev('statsAusgeblendetFilter') === true && !!d.getElementById('item-Stahl & Beton'));
  ev("dataMap['Stahl & Beton'].ausgeblendet = false;");
  w.resetKuenstlerFilters();

  // Unbekannter Künstler
  w.switchTab('programm');
  w.jumpToArtist('Gibt Es Nicht');
  t.check('Unbekannter Künstler: kein Tabwechsel, Hinweis.', viewVisible('programm') && toastText().includes('nicht in der Liste'), toastText());

  // Event-Act-Chips
  w.resetKuenstlerFilters();
  w.switchTab('programm');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  ev("appSettings.showRbfEvents = true; appSettings.showMusicEvents = true; appSettings.showOtherEvents = true;");
  w.renderProg();
  const evRow = [...d.querySelectorAll('#progList .prog-item')].find(el => el.textContent.includes('Anchor Award Show'));
  t.check('Testevent "Anchor Award Show" ist im Programm.', !!evRow);
  w.toggleProgRating(ridOf(evRow));            // Detailansicht wird erst beim Aufklappen gebaut
  const detail = d.getElementById(`${ridOf(evRow)}-detail`);
  const chips = [...detail.querySelectorAll('.badge')];
  const linked = chips.filter(c => c.classList.contains('badge-link'));
  t.check('Act-Chips bekannter Künstler sind antippbar, unbekannte nicht.',
    linked.length === 1 && linked[0].textContent === 'Nova Frequenz' && chips.some(c => c.textContent === 'Unbekannter Act' && !c.classList.contains('badge-link')));
  linked[0].click();
  t.check('Tipp auf den Act-Chip springt zum Künstler (aufgeklappt).', viewVisible('kuenstler') && !!d.querySelector('#item-Nova\\ Frequenz .artist-detail'));

  t.finish();
})();

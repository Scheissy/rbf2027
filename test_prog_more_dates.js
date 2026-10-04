const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const ev = code => w.eval(code);

  const setDays = days => d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', days.includes(b.dataset.day)));
  const allDays = () => [...d.querySelectorAll('.day-btn')].map(b => b.dataset.day);
  const showAll = () => { w.switchTab('programm'); setDays(allDays()); d.getElementById('timeFrom').value = '08:00'; d.getElementById('timeTo').value = ''; w.renderProg(); };
  const row = skey => [...d.querySelectorAll('#progList .prog-item')].find(el => el.dataset.skey === skey);
  const ridOf = skey => row(skey).getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  const marker = skey => row(skey).querySelector('.prog-right-col .prog-more-ind');
  const terms = skey => d.getElementById(`${ridOf(skey)}-terms`);
  const termRows = skey => [...terms(skey).querySelectorAll('.prog-term')];
  const detailOpen = skey => !d.getElementById(`${ridOf(skey)}-detail`).classList.contains('collapsed');
  const chip = () => d.getElementById('jumpBackChip');
  const chipVisible = () => chip().style.display !== 'none';
  const label = () => d.getElementById('jumpBackLabel').textContent;
  const activeDays = () => [...d.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day);

  showAll();
  const rosa = ev("artistShowsSorted('Rosa Mercur').map(showKey)");
  const rosaEntries = ev("artistShowsSorted('Rosa Mercur')").map(x => ({ day: x.day, time: x.time, endTime: x.endTime, location: x.location }));
  t.check('Testdaten: Rosa Mercur hat mindestens 2 Termine, Nova Frequenz genau 1.', rosa.length >= 2 && ev("artistShowsSorted('Nova Frequenz').length") === 1, rosa);
  const sortedOk = rosaEntries.every((e, i) => i === 0 || ev(`dayIndex('${rosaEntries[i - 1].day}')`) < ev(`dayIndex('${e.day}')`) || (rosaEntries[i - 1].day === e.day && ev(`timeSortValue('${rosaEntries[i - 1].time}')`) <= ev(`timeSortValue('${e.time}')`)));
  t.check('artistShowsSorted liefert die Termine chronologisch.', sortedOk, rosaEntries);

  // ───────── 1) Hinweis (📅) nur, wenn noch ein späterer Termin folgt ─────────
  t.check('Alle Termine VOR dem letzten tragen den Hinweis.', rosa.slice(0, -1).every(k => !!marker(k)), rosa.map(k => !!marker(k)));
  t.check('Der LETZTE Termin trägt keinen Hinweis.', !marker(rosa[rosa.length - 1]));
  t.check('Künstler mit nur einem Termin (Nova Frequenz) hat keinen Hinweis.', !marker('nid:1'));
  t.check('Hinweis sitzt in der rechten Spalte unter Bewertung und Aufklapp-Pfeil.', (() => { const col = marker(rosa[0]).parentElement; const kids = [...col.children]; return col.classList.contains('prog-right-col') && kids.indexOf(marker(rosa[0])) > kids.findIndex(c => c.classList.contains('prog-rating-arrow')); })());
  t.check('Hinweis ist ein einfaches Icon (📅) mit Beschriftung für Screenreader/Tooltip.', marker(rosa[0]).textContent === '📅' && !!marker(rosa[0]).getAttribute('title'));

  // Filter ändern den Hinweis nicht: gezählt wird über alle Termine
  const lastDay = rosaEntries[rosaEntries.length - 1].day;
  setDays([lastDay]); w.renderProg();
  const lastOnlyKeys = rosa.filter((k, i) => rosaEntries[i].day === lastDay);
  t.check('Nur der Tag des letzten Termins aktiv: kein Hinweis am letzten Termin.', !marker(lastOnlyKeys[lastOnlyKeys.length - 1]));
  const firstDay = rosaEntries[0].day;
  setDays([firstDay]); w.renderProg();
  t.check('Nur der Tag des ersten Termins aktiv: Hinweis erscheint trotzdem (späterer Termin ist nur ausgefiltert).', !!marker(rosa[0]));
  showAll();

  // Sonderveranstaltungen: nie ein Hinweis
  ev("appSettings.showRbfEvents = true; appSettings.showMusicEvents = true; appSettings.showOtherEvents = true;");
  w.renderProg();
  const evEl = [...d.querySelectorAll('#progList .prog-item')].find(el => el.textContent.includes('Anchor Award Show'));
  t.check('Sonderveranstaltung hat keinen Hinweis und keine Terminliste.', !evEl.querySelector('.prog-more-ind') && !d.getElementById(`${evEl.getAttribute('onclick').match(/'([^']+)'/)[1]}-terms`));

  // ───────── 2) Terminliste in der Detailansicht ─────────
  t.check('Terminliste nur bei mehreren Terminen: bei Nova Frequenz keine.', !terms('nid:1'));
  t.check('Rosa Mercur: Terminliste vorhanden, ein Eintrag je Termin.', !!terms(rosa[0]) && termRows(rosa[0]).length === rosa.length);
  const cur0 = termRows(rosa[0]).filter(r => r.classList.contains('current'));
  t.check('Genau ein Eintrag ist "Dieser Termin", und zwar der eigene (Position = erster).', cur0.length === 1 && termRows(rosa[0])[0] === cur0[0] && cur0[0].textContent.includes('Dieser Termin'));
  const curLast = termRows(rosa[rosa.length - 1]).filter(r => r.classList.contains('current'));
  t.check('Beim letzten Termin steht "Dieser Termin" ganz unten (frühere oberhalb).', termRows(rosa[rosa.length - 1]).indexOf(curLast[0]) === rosa.length - 1);
  t.check('Reihenfolge der Einträge = chronologisch (Tag/Zeit je Zeile passen zu den Daten).', termRows(rosa[0]).every((r, i) => r.querySelector('.t-day').textContent === rosaEntries[i].day && r.querySelector('.t-time').textContent.startsWith(rosaEntries[i].time)));
  t.check('Andere Einträge zeigen den Ort (ohne Ort: TBA).', termRows(rosa[0])[1].querySelector('.t-loc').textContent === (rosaEntries[1].location || 'TBA'));
  t.check('Der eigene Eintrag ist nicht anklickbar, die anderen schon.', !cur0[0].getAttribute('onclick') && termRows(rosa[0]).slice(1).every(r => (r.getAttribute('onclick') || '').includes('jumpToProgShow')));
  t.check('Klick in die Terminliste klappt die Zeile nicht zu (stopPropagation).', terms(rosa[0]).getAttribute('onclick').includes('stopPropagation'));

  // Status der anderen Termine in der Liste, live nachgezogen
  const otherKey = rosa[1];
  w.togglePlanFlag(ridOf(otherKey), otherKey);
  t.check('Ziel (🎯) beim zweiten Termin erscheint live in der Liste des ersten.', termRows(rosa[0])[1].textContent.includes('🎯'));
  w.setShowDuration(ridOf(otherKey), otherKey, 45);
  t.check('Dauer (⏱ 45 Min) erscheint live in der Liste des ersten.', termRows(rosa[0])[1].textContent.includes('45'));
  w.setShowRating(ridOf(otherKey), otherKey, 4);
  t.check('Auftritts-Bewertung erscheint live in der Liste (mini-Sterne).', termRows(rosa[0])[1].querySelector('.t-icons').innerHTML.length > 20);
  w.togglePlanFlag(ridOf(otherKey), otherKey); w.setShowDuration(ridOf(otherKey), otherKey, 0); w.setShowRating(ridOf(otherKey), otherKey, 4);
  t.check('Alles entfernt: Symbole verschwinden wieder aus der Liste.', termRows(rosa[0])[1].querySelector('.t-icons').textContent.trim() === '');

  // ───────── 3) Vorbei gelegene Termine gedimmt ─────────
  const mock = (month, day, hour, minute) => { w.getBerlinNow = () => ({ year: 2027, month, day, hour, minute }); };
  const dayDate = { 'Mi 15.09': [9, 15], 'Do 16.09': [9, 16], 'Fr 17.09': [9, 17], 'Sa 18.09': [9, 18] };
  const [m0, d0] = dayDate[rosaEntries[0].day];
  mock(9, d0, 23, 59);                           // erster Termin-Tag, kurz vor Mitternacht: erster Termin vorbei
  w.renderProg();
  t.check('Während des Festivals: ein bereits vorbei gelegener Termin ist gedimmt (past).', termRows(rosa[1])[0].classList.contains('past'));
  t.check('Spätere Tage sind nicht gedimmt.', termRows(rosa[0]).slice(1).filter((r, i) => rosaEntries[i + 1].day !== rosaEntries[0].day).every(r => !r.classList.contains('past')));
  mock(9, d0, 7, 0);                             // früh am Tag: noch nichts vorbei
  w.renderProg();
  t.check('Am selben Tag vor Beginn: kein Termin gedimmt.', termRows(rosa[1]).every(r => !r.classList.contains('past')));
  w.getBerlinNow = () => ({ year: 2026, month: 10, day: 4, hour: 12, minute: 0 });   // außerhalb des Festivals
  w.renderProg();
  t.check('Außerhalb des Festivals wird nichts gedimmt.', termRows(rosa[1]).every(r => !r.classList.contains('past')));
  t.check('isShowPast: Vortag = vorbei, Folgetag = nicht vorbei (Festival-Tag Do).', (() => { mock(9, 16, 12, 0); const r = [ev("isShowPast({day:'Mi 15.09', time:'20:00'})"), ev("isShowPast({day:'Fr 17.09', time:'20:00'})"), ev("isShowPast({day:'Do 16.09', time:'10:00', endTime:'11:00'})"), ev("isShowPast({day:'Do 16.09', time:'20:00', endTime:'21:00'})")]; return r.join() === 'true,false,true,false'; })());
  t.check('isShowPast: nach Mitternacht (00:30) zählt noch zum Vortag: 22-23 Uhr vorbei, 23:30-00:45 noch nicht.', (() => { mock(9, 17, 0, 30); return ev("isShowPast({day:'Do 16.09', time:'22:00', endTime:'23:00'})") === true && ev("isShowPast({day:'Do 16.09', time:'23:30', endTime:'00:45'})") === false; })());
  w.getBerlinNow = () => ({ year: 2026, month: 10, day: 4, hour: 12, minute: 0 });

  // ───────── 4) Sprung aus der Terminliste (inkl. Zurück-Chip im selben Tab) ─────────
  showAll();
  setDays(allDays()); w.renderProg();
  w.toggleProgRating(ridOf(rosa[0]));
  t.check('Ausgangslage: erster Termin ist aufgeklappt, kein Chip.', detailOpen(rosa[0]) && !chipVisible());
  termRows(rosa[0])[1].click();
  t.check('Tipp auf einen anderen Termin: Ziel-Zeile ist aufgeklappt, Ausgangs-Zeile zu.', detailOpen(rosa[1]) && !detailOpen(rosa[0]));
  t.check('Es bleibt im Programm-Tab, der Zurück-Chip erscheint.', !d.getElementById('view-programm').classList.contains('hidden') && chipVisible());
  t.check('Chip nennt die Ausgangsstelle (Tag, Zeit des ersten Termins).', label() === `← Termin: ${rosaEntries[0].day}${rosaEntries[0].time ? ', ' + rosaEntries[0].time : ''}`, label());
  w.jumpBack();
  t.check('Zurück-Chip führt zum Ausgangs-Termin zurück (aufgeklappt) und verschwindet.', detailOpen(rosa[0]) && !chipVisible());

  // Ziel durch Filter ausgeblendet -> Sprung passt Filter an; Zurück stellt sie wieder her
  setDays([rosaEntries[0].day].filter((x, i, a) => a.indexOf(x) === i)); w.renderProg();
  const hiddenTarget = rosa.find((k, i) => rosaEntries[i].day !== rosaEntries[0].day);
  t.check('Ausgangslage: anderer Termin ist durch den Tagesfilter ausgeblendet.', !row(hiddenTarget));
  const before = JSON.stringify(activeDays());
  w.toggleProgRating(ridOf(rosa[0]));
  termRows(rosa[0]).find(r => (r.getAttribute('onclick') || '').includes(hiddenTarget)).click();
  t.check('Sprung auf den ausgeblendeten Termin: Tag wurde aktiviert, Termin sichtbar und aufgeklappt.', !!row(hiddenTarget) && detailOpen(hiddenTarget) && activeDays().length > 1);
  w.jumpBack();
  t.check('Zurück stellt die vorherigen Tag-Filter wieder her.', JSON.stringify(activeDays()) === before, { before, now: activeDays() });
  t.check('... und der Termin davor ist wieder aufgeklappt, der Hinweis-Chip weg.', !!row(rosa[0]) && detailOpen(rosa[0]) && !chipVisible());

  // Hat der Nutzer die Filter nach dem Sprung selbst geändert, bleiben seine Filter
  w.toggleProgRating(ridOf(rosa[0]));
  termRows(rosa[0]).find(r => (r.getAttribute('onclick') || '').includes(hiddenTarget)).click();
  const extra = allDays().find(x => !activeDays().includes(x));
  if (extra) { setDays(activeDays().concat(extra)); w.renderProg(); }
  const mine = JSON.stringify(activeDays());
  if (!chipVisible()) { w.jumpToProgShow(hiddenTarget, true); }
  w.jumpBack();
  t.check('Nach eigener Filteränderung überschreibt "Zurück" die Filter NICHT.', JSON.stringify(activeDays()) === mine, { mine, now: activeDays() });

  // Normaler Sprung ohne Terminliste (nur Programm-Tab) bleibt chipfrei
  showAll();
  w.jumpToProgShow('nid:1');
  t.check('Sprung ohne Terminlisten-Kontext im selben Tab erzeugt weiterhin keinen Chip.', !chipVisible());

  // Ausgeblendete Location -> Hinweis statt Sprung, kein Chip
  showAll();
  const hiddenLoc = rosaEntries[0].location;
  t.check('Testdaten: erster Termin hat eine Location.', !!hiddenLoc);
  ev(`appSettings.hiddenLocations = [${JSON.stringify(hiddenLoc)}];`);
  w.renderProg();
  w.toggleProgRating(ridOf(rosa[1]));
  termRows(rosa[1]).find(r => (r.getAttribute('onclick') || '').includes(rosa[0])).click();
  t.check('Termin an ausgeblendeter Location: kein Sprung, kein Chip.', !chipVisible() && detailOpen(rosa[1]));
  ev("appSettings.hiddenLocations = [];");

  t.finish();
})();

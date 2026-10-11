const { createHelpers, loadApp, createChecker } = require('./test-helpers');

// Einzeltests der aus renderProgCoreImpl / renderArtistItem / jumpToProgShow / paintDurationModal
// herausgelösten Bausteine.
(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { ev, progRow, ridOfRow, viewVisible } = H;
  const t = createChecker();
  const box = html => { const el = d.createElement('div'); el.innerHTML = html; return el; };
  const entry = skey => ev(`allProgEntries().find(x => showKey(x) === ${JSON.stringify(skey)})`);
  const nova = entry('nid:1');              // Nova Frequenz, 1 Termin
  const rosa = ev("artistShowsSorted('Rosa Mercur')[0]");   // Rosa Mercur, mehrere Termine

  // ───────── Programm-Zeile ─────────
  t.check('progIsHidden: ausgeblendeter Künstler und ausgeblendete Sonderveranstaltung = true, sonst false.', w.progIsHidden(nova, { ausgeblendet: true }) === true && !w.progIsHidden(nova, { ausgeblendet: false }) && (ev("hiddenEvents[501] = true"), w.progIsHidden({ isEvent: true, nid: 501 }, undefined) === true) && !w.progIsHidden({ isEvent: true, nid: 502 }, undefined));
  ev("hiddenEvents = {};");
  const time = box(w.progTimeColHTML(nova, 'progr-0', 'nid:1')).firstElementChild;
  t.check('progTimeColHTML: Spalte mit Start-/Endzeit und Ziel-Button für den Auftritt.', time.classList.contains('prog-time-col') && time.textContent.includes(nova.time) && !!time.querySelector('.plan-flag-btn') && time.querySelector('.plan-flag-btn').dataset.skey === 'nid:1');
  const info = box(w.progInfoHTML(nova, ev("dataMap['Nova Frequenz']"), 'progr-0', 'nid:1')).firstElementChild;
  t.check('progInfoHTML: Name, Genre/Herkunft, Ort und die Meta-Zeile mit Ids der Zeile.', info.classList.contains('prog-info') && info.querySelector('.prog-name').textContent.includes('Nova Frequenz') && info.querySelector('.prog-meta').textContent.includes('Electro') && info.querySelector('.prog-loc').textContent.includes(nova.location) && !!info.querySelector('#progr-0-showmetarow') && !!info.querySelector('#progr-0-durationsummary'));
  ev("showDurations['nid:1'] = 45; showRatings['nid:1'] = 4;");
  const info2 = box(w.progInfoHTML(nova, ev("dataMap['Nova Frequenz']"), 'progr-0', 'nid:1')).firstElementChild;
  t.check('progInfoHTML: eingetragene Dauer und Auftritts-Bewertung erscheinen in der Meta-Zeile.', info2.querySelector('#progr-0-durationsummary').textContent.includes('45') && info2.querySelector('#progr-0-showsummary').innerHTML.length > 0);
  ev("showDurations = {}; showRatings = {};");
  const right1 = box(w.progRightColHTML(nova, ev("dataMap['Nova Frequenz']"), 'progr-0')).firstElementChild;
  t.check('progRightColHTML: Bewertungs-Badge und Pfeil; kein 📅 beim einzigen Termin.', right1.classList.contains('prog-right-col') && !!right1.querySelector('.prog-avg-badge') && right1.querySelector('.prog-rating-arrow').textContent === '▸' && !right1.querySelector('.prog-more-ind'));
  const right2 = box(w.progRightColHTML(rosa, ev("dataMap['Rosa Mercur']"), 'progr-1')).firstElementChild;
  t.check('progRightColHTML: 📅 erscheint, wenn nach dem Termin noch einer folgt.', !!right2.querySelector('.prog-more-ind'));
  const row = box(w.progRowHTML(nova, 'progr-9', new w.Set()));
  const kids = [...row.children];
  t.check('progRowHTML: Zeile (id/data-skey/onclick) gefolgt von leerem, zugeklapptem Detail-Container.', kids.length === 2 && kids[0].id === 'progr-9-row' && kids[0].dataset.skey === 'nid:1' && kids[0].getAttribute('onclick') === "toggleProgRating('progr-9')" && kids[1].id === 'progr-9-detail' && kids[1].classList.contains('collapsed') && kids[1].innerHTML === '');
  t.check('progRowHTML: die Zeile enthält in dieser Reihenfolge Zeit-Spalte, Info, rechte Spalte.', [...kids[0].children].map(c => c.className.split(' ')[0]).join() === 'prog-time-col,prog-info,prog-right-col');
  t.check('progRowHTML: ohne Markierung weder "besucht" noch "ausgeblendet".', !kids[0].classList.contains('prog-item-visited') && !kids[0].classList.contains('prog-item-hidden'));
  const rowVisited = box(w.progRowHTML(nova, 'progr-9', new w.Set(['Nova Frequenz']))).firstElementChild;
  t.check('progRowHTML: Künstler in "besucht"-Liste -> Klasse prog-item-visited.', rowVisited.classList.contains('prog-item-visited'));
  ev("dataMap['Nova Frequenz'].ausgeblendet = true;");
  const rowHidden = box(w.progRowHTML(nova, 'progr-9', new w.Set())).firstElementChild;
  t.check('progRowHTML: ausgeblendeter Künstler -> Klasse prog-item-hidden.', rowHidden.classList.contains('prog-item-hidden'));
  ev("dataMap['Nova Frequenz'].ausgeblendet = false;");
  ev("progRidsByName = {}; progEntryByRid = {};");
  w.registerProgRow(nova, 'progr-3'); w.registerProgRow(nova, 'progr-4'); w.registerProgRow(rosa, 'progr-5');
  t.check('registerProgRow: ordnet Zeilen-Ids dem Künstler zu (mehrere Zeilen je Künstler) und dem Auftritt.', ev("progRidsByName['Nova Frequenz'].join()") === 'progr-3,progr-4' && ev("progRidsByName['Rosa Mercur'].join()") === 'progr-5' && ev("progEntryByRid['progr-5'].name") === 'Rosa Mercur');
  H.showAllProg({ switchTab: true });
  const listHtml = d.getElementById('progList').innerHTML;
  t.check('renderProg setzt die Zeilen aus den Bausteinen zusammen: Tages-Überschriften, Zeilen mit Detail-Container, Zuordnung registriert.', listHtml.includes('prog-day-header') && d.querySelectorAll('#progList .prog-item').length === d.querySelectorAll('#progList .prog-detail').length && Object.keys(ev('progEntryByRid')).length === d.querySelectorAll('#progList .prog-item').length);

  // ───────── Künstlerzeile ─────────
  w.switchTab('kuenstler'); w.resetKuenstlerFilters(); w.render();
  const dn = ev("dataMap['Nova Frequenz']"), dr = ev("dataMap['Rosa Mercur']");
  const r0 = box(w.artistRowHTML(dn, 'Nova Frequenz', 'Nova Frequenz', false, true)).firstElementChild;
  t.check('artistRowHTML: Kopfzeile mit Pfeil ▸ (zu), Name, Herkunft und Geschlecht.', r0.classList.contains('artist-row') && r0.querySelector('.artist-expand').textContent === '▸' && r0.querySelector('.artist-name').textContent.includes('Nova Frequenz') && !!r0.querySelector('.artist-country') && !!r0.querySelector('.badge'));
  t.check('artistRowHTML: aufgeklappt ▾, ohne Auftritte "·".', box(w.artistRowHTML(dn, 'Nova Frequenz', 'Nova Frequenz', true, true)).querySelector('.artist-expand').textContent === '▾' && box(w.artistRowHTML(dn, 'Nova Frequenz', 'Nova Frequenz', false, false)).querySelector('.artist-expand').textContent === '·');
  ev("dataMap['Nova Frequenz'].ausgeblendet = true;");
  t.check('artistRowHTML: ausgeblendeter Künstler: Klasse artist-row-hidden und 🙈-Badge.', box(w.artistRowHTML(ev("dataMap['Nova Frequenz']"), 'Nova Frequenz', 'Nova Frequenz', false, true)).querySelector('.artist-row-hidden') !== null && box(w.artistRowHTML(ev("dataMap['Nova Frequenz']"), 'Nova Frequenz', 'Nova Frequenz', false, true)).textContent.includes('🙈'));
  ev("dataMap['Nova Frequenz'].ausgeblendet = false;");
  t.check('artistShowsHTML: ohne Auftritte der Hinweis "Noch keine Auftrittsdaten".', box(w.artistShowsHTML('X', [])).querySelector('.no-shows') !== null);
  const shows = ev("auftritte.filter(a => a.name === 'Rosa Mercur')").slice().reverse();
  const sh = box(w.artistShowsHTML('Rosa Mercur', shows));
  const days = [...sh.querySelectorAll('.show-day')].map(x => x.textContent);
  t.check('artistShowsHTML: eine Zeile je Auftritt, chronologisch sortiert (auch bei umgekehrter Eingabe).', sh.querySelectorAll('.show-row').length === shows.length && days.join() === ev("artistShowsSorted('Rosa Mercur').map(a => a.day)").join(), days);
  const sr = box(w.artistShowRowHTML(ev("auftritte.find(a => a.name === 'Nova Frequenz')"), 0, 'Nova Frequenz')).firstElementChild;
  t.check('artistShowRowHTML: Ziel-Flag zuerst, dann Tag, Zeit, Ort und Sterne; Tag/Zeit springen ins Programm.', sr.classList.contains('show-row') && sr.firstElementChild.classList.contains('plan-flag-btn') && !!sr.querySelector('.show-day') && !!sr.querySelector('.show-time') && sr.querySelector('.show-day').getAttribute('onclick').includes('jumpToProgShow'));
  const det = box(w.artistDetailHTML(dn, 'Nova Frequenz', 'Nova Frequenz', '<div class="show-row" id="probe"></div>')).firstElementChild;
  t.check('artistDetailHTML: Detailbereich mit Genre, Links (RBF/Discogs) und der übergebenen Auftrittsliste.', det.classList.contains('artist-detail') && det.textContent.includes('Electro') && !!det.querySelector('.detail-links') && !!det.querySelector('#probe'));
  ev("expandedRows.add('Nova Frequenz');"); w.renderArtistItem('Nova Frequenz');
  const item = d.getElementById('item-Nova Frequenz');
  t.check('renderArtistItem: zusammengesetzt aus Kopfzeile + Detailbereich mit Auftrittszeilen.', !!item.querySelector('.artist-row') && !!item.querySelector('.artist-detail') && item.querySelectorAll('.show-row').length === 1);
  ev("expandedRows.delete('Nova Frequenz');"); w.renderArtistItem('Nova Frequenz');
  t.check('renderArtistItem: zugeklappt nur die Kopfzeile.', !item.querySelector('.artist-detail') && !!item.querySelector('.artist-row'));
  t.check('renderArtistItem: für einen Künstler ohne Container keine Wirkung und kein Fehler.', (() => { try { w.renderArtistItem('Name ohne Zeile'); return true; } catch (e) { return false; } })());

  // ───────── Sprung-Bausteine ─────────
  w.switchTab('kuenstler');
  ev("appSettings.hiddenLocations = [];");
  t.check('jumpBlockReason: normaler Auftritt -> null.', w.jumpBlockReason(nova) === null);
  ev(`appSettings.hiddenLocations = [${JSON.stringify(nova.location)}];`);
  t.check('jumpBlockReason: ausgeblendete Location -> Hinweistext mit dem Ortsnamen.', w.jumpBlockReason(nova).includes(nova.location) && w.jumpBlockReason(nova).includes('ausgeblendet'));
  ev("appSettings.hiddenLocations = []; dataMap['Nova Frequenz'].ausgeblendet = true; document.getElementById('progShowHidden').checked = false;");
  t.check('jumpBlockReason: ausgeblendeter Künstler ohne "Ausgeblendete anzeigen" -> Hinweis; mit Haken -> null.', w.jumpBlockReason(nova).includes('Ausgeblendete anzeigen') && (ev("document.getElementById('progShowHidden').checked = true"), w.jumpBlockReason(nova) === null));
  ev("dataMap['Nova Frequenz'].ausgeblendet = false; document.getElementById('progShowHidden').checked = false;");
  H.showAllProg({ switchTab: true });
  t.check('ensureShowVisibleInProg: ist der Auftritt schon sichtbar, ändert sich nichts (false).', w.ensureShowVisibleInProg(nova, 'nid:1') === false);
  d.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
  const changed = w.ensureShowVisibleInProg(nova, 'nid:1');
  t.check('ensureShowVisibleInProg: aktiviert den Tag des Auftritts und meldet die Änderung (true).', changed === true && [...d.querySelectorAll('.day-btn')].find(b => b.dataset.day === nova.day).classList.contains('active') && ev("getFilteredAuftritte().some(x => showKey(x) === 'nid:1')"));
  H.showAllProg({ switchTab: true });
  t.check('openProgShowRow: gibt die aufgeklappte Zeile zurück, für einen Schlüssel ohne Zeile null.', (() => { const r = w.openProgShowRow('nid:1', false); return !!r && r.dataset.skey === 'nid:1' && H.detailOpen('nid:1') && w.openProgShowRow('nid:gibt-es-nicht', false) === null; })());
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  t.check('jumpToProgShow (zusammengesetzt): wechselt ins Programm und öffnet den Auftritt.', viewVisible('programm') && H.detailOpen('nid:1'));

  // ───────── Dauer-Dialog zeichnen ─────────
  ev("appSettings.durationInputMode = 'hm'; showDurations = {};");
  w.openDurationModal('x', 'nid:1', 'Test', 0);
  w.paintDurationInputs(125, false, true);
  t.check('paintDurationInputs (Std:Min): Stundenfeld 2, Minutenfeld 5, Stunden-Zeile sichtbar.', d.getElementById('durationModalHInput').value === '2' && d.getElementById('durationModalInput').value === '5' && d.getElementById('durationModalHoursRow').style.display === 'flex');
  w.paintDurationInputs(125, false, false);
  t.check('paintDurationInputs (Minuten): ein Feld mit 125, Stunden-Zeile ausgeblendet.', d.getElementById('durationModalInput').value === '125' && d.getElementById('durationModalHoursRow').style.display === 'none');
  w.paintDurationTexts(125, false, 125);
  t.check('paintDurationTexts: Vorschau zeigt die Dauer, Speichern heißt "Fertig", links "Zurücksetzen".', d.getElementById('durationModalPreview').textContent.includes('2h 5min') && d.getElementById('durationModalSave').textContent === 'Fertig' && d.getElementById('durationModalReset').textContent === 'Zurücksetzen');
  w.paintDurationTexts(45, true, 0);
  t.check('paintDurationTexts (Vorschlag): "Als Auftritt speichern" und links "Schließen".', d.getElementById('durationModalSave').textContent === 'Als Auftritt speichern' && d.getElementById('durationModalReset').textContent === 'Schließen');
  w.paintDurationModal(75, false, 75);
  t.check('paintDurationModal (zusammengesetzt) ruft alle drei Teile auf: Felder, Nachbarzeilen und Texte stimmen zu 75 Min.', d.getElementById('durationModalHInput').value === '1' && d.getElementById('durationModalInput').value === '15' && d.getElementById('durationModalPreview').textContent.includes('1h 15min'));
  const nb = id => d.getElementById(id);
  t.check('paintDurationModal: die Nachbarzeilen zeigen den nächsten Schritt (Std:Min, 75 Min = 1:15 -> Minuten 10/20, Stunden 0/2).', nb('durationModalMinus').textContent === '10' && nb('durationModalPlus').textContent === '20' && nb('durationModalHMinus').textContent === '0' && nb('durationModalHPlus').textContent === '2' && !nb('durationModalMinus').disabled);
  w.paintDurationNeighbours(0, true);
  t.check('paintDurationNeighbours: bei 0 gibt es nach unten keinen Schritt (Zeilen leer und deaktiviert), nach oben schon.', nb('durationModalMinus').textContent === '' && nb('durationModalMinus').disabled === true && nb('durationModalHMinus').disabled === true && nb('durationModalPlus').textContent === '5');
  w.paintDurationNeighbours(125, false);
  t.check('paintDurationNeighbours (Minuten-Modus): Nachbarn sind die vollen Minuten (120/130).', nb('durationModalMinus').textContent === '120' && nb('durationModalPlus').textContent === '130');
  w.closeDurationModal();

  t.finish();
})();

const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  w.currentTab = 'programm';
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();

  const item = d.querySelector('[data-skey="nid:1"]');          // Nova Frequenz 20:00-20:45
  const rid = item.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  const skey = 'nid:1';
  const btn = () => d.getElementById(`${rid}-durbtn`);
  const modal = () => d.getElementById('durationModal');
  const input = () => d.getElementById('durationModalInput');
  const save = () => d.getElementById('durationModalSave');
  const reset = () => d.getElementById('durationModalReset');
  const minus = () => d.getElementById('durationModalMinus');
  const plus = () => [...modal().querySelectorAll('.duration-step-btn')].find(b => b.textContent === '+');
  const summary = () => d.getElementById(`${rid}-durationsummary`);
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const stored = () => JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').showDurations || {};
  const visited = () => w.isVisited ? w.isVisited({ nid: 1 }) : undefined;

  // 1) Berechnung des Vorschlags
  const sug = (time, endTime) => w.suggestedDurationMin({ time, endTime });
  t.check('20:00-20:45 -> 45 Min.', sug('20:00', '20:45') === 45);
  t.check('Nach Mitternacht: 23:30-00:15 -> 45 Min.', sug('23:30', '00:15') === 45, sug('23:30', '00:15'));
  t.check('Ohne Endzeit / ohne Startzeit / TBA -> kein Vorschlag (0).', sug('20:00', '') === 0 && sug('', '21:00') === 0 && sug('', '') === 0);
  t.check('Unlesbare Zeit -> kein Vorschlag.', sug('abc', '21:00') === 0 && sug('20:00', 'xx') === 0);
  t.check('Nova Frequenz in den Testdaten: 45 Min Vorschlag.', sug('20:00', '20:45') === 45);

  // 2) Anzeige: Vorschlag sichtbar, aber NICHT gespeichert und NICHT als Auftritt gezählt
  t.check('Ohne gespeicherte Dauer zeigt der Button KEINE Zeit und NICHT den Vorschlag: nur "+ Eintragen".', btn().textContent === '+ Eintragen', btn().textContent);
  t.check('Button hat die neutrale "leer"-Optik, keine Vorschlags-Optik.', btn().classList.contains('duration-btn-empty') && !btn().classList.contains('duration-btn-suggest'));
  t.check('Im ganzen Programm-Eintrag taucht der Vorschlag nirgends als "Vorschlag"/💡 auf.', !item.textContent.includes('Vorschlag') && !item.textContent.includes('💡'));
  t.check('Vorschlag steht NICHT in showDurations/Storage.', stored()[skey] === undefined, stored());
  t.check('Kurzanzeige in der Programm-Zeile bleibt leer (Vorschlag ist keine Dauer).', summary().style.display === 'none' && summary().textContent === '');
  t.check('Gesamtzeit-Leiste bleibt leer (Vorschlag zählt nicht).', d.getElementById('progTotalTime').style.display === 'none');
  if (visited() !== undefined) t.check('Auftritt gilt mit bloßem Vorschlag NICHT als besucht.', visited() === false);
  t.check('Act ohne Zeiten (TBA, nid 5) zeigt weiterhin "+ Eintragen".', d.getElementById(d.querySelector('[data-skey="nid:5"]').getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1] + '-durbtn').textContent === '+ Eintragen');

  // 3) Modal: Vorschlag vorbelegt (gedimmt), Hauptbutton = Speichern
  btn().click();
  t.check('Modal zeigt den Vorschlag (45) im Feld.', input().value === '45');
  t.check('Feld ist als Vorschlag gedimmt markiert.', input().classList.contains('duration-input-suggest'));
  t.check('Hauptbutton heißt "Als Auftritt speichern".', save().textContent === 'Als Auftritt speichern', save().textContent);
  t.check('Zurücksetzen ist deaktiviert (es gibt nichts Gespeichertes).', reset().disabled === true);
  t.check('Modal-Vorschau nennt den Vorschlag.', d.getElementById('durationModalPreview').textContent.includes('Vorschlag'));

  // 4) Schließen ohne Speichern darf nichts speichern
  d.querySelector('#durationModal .modal-close').click();
  t.check('✕ speichert den Vorschlag NICHT (Button bleibt "+ Eintragen").', stored()[skey] === undefined && btn().textContent === '+ Eintragen');
  btn().click();
  modal().dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t.check('Klick auf den Hintergrund speichert den Vorschlag NICHT.', stored()[skey] === undefined);
  btn().click();
  fire(input(), 'change');  // change ohne Änderung des Vorschlagswerts
  t.check('Unveränderter Vorschlag im Feld wird auch bei "change" nicht gespeichert.', stored()[skey] === undefined && input().classList.contains('duration-input-suggest'));
  w.closeDurationModal();
  t.check('Schließen per closeDurationModal() speichert nicht.', stored()[skey] === undefined);

  // 5) Bewusst speichern -> echte Dauer, zählt als Auftritt
  btn().click();
  save().click();
  t.check('"Als Auftritt speichern" schreibt 45 als echte Dauer.', stored()[skey] === 45, stored());
  t.check('Modal schließt nach dem Speichern.', !modal().classList.contains('open'));
  t.check('Button zeigt jetzt die echte Dauer (⏱ 45 Min).', btn().textContent === '⏱ 45 Min' && !btn().classList.contains('duration-btn-empty'), btn().textContent);
  t.check('Kurzanzeige zeigt die gespeicherte Dauer.', summary().style.display !== 'none' && summary().textContent.includes('45 Min'));
  t.check('Gesamtzeit zählt die gespeicherte Dauer.', d.getElementById('progTotalTime').textContent.includes('45 Min'), d.getElementById('progTotalTime').textContent);
  if (visited() !== undefined) t.check('Gespeichert -> Auftritt gilt jetzt als besucht.', visited() === true);

  // 6) Im Modal ohne Vorschlags-Modus: Hauptbutton heißt "Fertig", Zurücksetzen aktiv
  btn().click();
  t.check('Mit echter Dauer: Hauptbutton "Fertig", Feld nicht gedimmt, Zurücksetzen aktiv.', save().textContent === 'Fertig' && !input().classList.contains('duration-input-suggest') && reset().disabled === false);

  // 7) Zurücksetzen -> Vorschlag erscheint wieder, nichts mehr gespeichert/gezählt
  reset().click();
  t.check('Zurücksetzen löscht die echte Dauer.', stored()[skey] === undefined);
  t.check('Danach zeigt Modal wieder den Vorschlag (gedimmt, "Als Auftritt speichern").', input().value === '45' && input().classList.contains('duration-input-suggest') && save().textContent === 'Als Auftritt speichern');
  t.check('Button in der Zeile zeigt wieder nur "+ Eintragen" (keine Zeit, kein Vorschlag).', btn().textContent === '+ Eintragen' && btn().classList.contains('duration-btn-empty'), btn().textContent);
  t.check('Kurzanzeige/Gesamtzeit sind wieder leer.', summary().style.display === 'none' && d.getElementById('progTotalTime').style.display === 'none');
  if (visited() !== undefined) t.check('Auftritt gilt nach Zurücksetzen wieder als nicht besucht.', visited() === false);
  w.closeDurationModal();

  // 8) Stepper / Tippen im Vorschlags-Zustand = bewusste Eingabe
  btn().click();
  plus().click();
  t.check('+ im Vorschlags-Zustand startet beim Vorschlag (45 -> 50) und speichert 50.', stored()[skey] === 50 && input().value === '50' && !input().classList.contains('duration-input-suggest'), { s: stored()[skey], i: input().value });
  reset().click();
  minus().click();
  t.check('− im Vorschlags-Zustand startet beim Vorschlag (45 -> 40) und speichert 40.', stored()[skey] === 40, stored());
  reset().click();
  input().value = '52'; fire(input(), 'change');
  t.check('Eigene Eingabe (52) im Vorschlags-Zustand wird gespeichert.', stored()[skey] === 52, stored());
  reset().click();
  input().value = '60';           // getippt, noch kein change
  save().click();
  t.check('Getippte Zahl + Hauptbutton speichert die getippte Zahl (60), nicht den Vorschlag.', stored()[skey] === 60, stored());

  // 9) Filter "Nur mit Dauer": Vorschlag allein reicht nicht
  btn().click(); reset().click(); w.closeDurationModal();
  d.getElementById('fProgDuration').checked = true;
  w.renderProg();
  t.check('Filter "Nur mit Dauer": Auftritt mit bloßem Vorschlag erscheint NICHT.', !d.querySelector('[data-skey="nid:1"]'));
  d.getElementById('fProgDuration').checked = false;
  w.renderProg();

  // 10) Auswertung: Vorschlag zählt nicht
  w.currentTab = 'auswertung';
  t.check('Stand der Daten: keine gespeicherten Dauern -> Auswertung zählt nichts.', Object.keys(stored()).length === 0, stored());

  // 11) Alignment: Zeile mit Bewertung + Dauer oben bündig, gleich hohe Steuerelemente
  const css = d.querySelector('style').textContent;
  t.check('Split-Zeile richtet Paare oben aus (align-items: flex-start).', /\.prog-detail-row-split\s*\{[^}]*align-items:\s*flex-start/.test(css));
  t.check('Sterne und Dauer-Button haben dieselbe Höhe (28px).', /\.prog-detail-pair \.stars\s*\{[^}]*min-height:\s*28px/.test(css) && /\.duration-btn\s*\{[^}]*height:\s*28px/.test(css));

  t.finish();
})();

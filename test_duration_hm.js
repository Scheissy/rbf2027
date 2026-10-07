const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const ev = code => w.eval(code);

  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const $ = id => d.getElementById(id);
  const modal = () => $('durationModal');
  const mInput = () => $('durationModalInput'), hInput = () => $('durationModalHInput');
  const mMinus = () => $('durationModalMinus'), mPlus = () => $('durationModalPlus');
  const hMinus = () => $('durationModalHMinus'), hPlus = () => $('durationModalHPlus');
  const hoursRow = () => $('durationModalHoursRow');
  const stored = () => (JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').showDurations) || {};
  const settings = () => (JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').settings) || {};
  const total = skey => stored()[skey];
  const typeM = v => { mInput().value = v; fire(mInput(), 'change'); };
  const typeH = v => { hInput().value = v; fire(hInput(), 'change'); };
  const modeSel = () => $('settingDurationInputMode');
  const setMode = v => { modeSel().value = v; fire(modeSel(), 'change'); };

  w.switchTab('programm');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  d.getElementById('timeTo').value = '';
  w.renderProg();
  const rowOf = skey => [...d.querySelectorAll('#progList .prog-item')].find(el => el.dataset.skey === skey);
  const ridOf = skey => rowOf(skey).getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  const open = (skey, sug) => { w.openDurationModal(ridOf(skey), skey, 'Test', sug || 0); };
  const close = () => w.closeDurationModal();
  const TBA = 'nid:5';        // ohne Zeiten -> kein Vorschlag
  const NOVA = 'nid:1';       // 20:00-20:45 -> Vorschlag 45

  // ───────── 1) Einstellung ─────────
  t.check('Standard: Eingabe in Minuten.', ev('durationInputMode()') === 'minutes' && modeSel().value === 'minutes');
  t.check('Auswahl bietet "Minuten" und "Stunden:Minuten".', [...modeSel().options].map(o => o.value).join() === 'minutes,hm');
  open(TBA);
  t.check('Standard-Modus: keine Stunden-Zeile, ein Feld mit allen Minuten (max 999).', hoursRow().style.display === 'none' && mInput().max === '999');
  close();
  setMode('hm');
  t.check('Einstellung wird gespeichert.', settings().durationInputMode === 'hm', settings());
  setMode('minutes');
  t.check('... und wieder zurückgestellt.', settings().durationInputMode === 'minutes');
  ev("appSettings.durationInputMode = 'quatsch';");
  t.check('Ungültiger gespeicherter Wert fällt auf "Minuten" zurück.', ev('durationInputMode()') === 'minutes');
  ev("delete appSettings.durationInputMode;");
  t.check('Alte Speicherstände ohne die Einstellung: "Minuten".', ev('durationInputMode()') === 'minutes');

  // ───────── 2) Modus Stunden:Minuten – Anzeige ─────────
  setMode('hm');
  open(TBA);
  t.check('Std:Min: Stunden-Zeile ist sichtbar.', hoursRow().style.display === 'flex');
  t.check('Ausgangslage: 0 Std 0 Min, beide Minus-Buttons und Stunden-Minus deaktiviert.', hInput().value === '0' && mInput().value === '0' && mMinus().disabled && hMinus().disabled);
  t.check('Minuten-Feld ist auf 59 begrenzt (max-Attribut), Stunden-Feld auf 16.', mInput().max === '59' && hInput().max === '16');

  // ───────── 3) Plus/Minus getrennt für Stunden und Minuten ─────────
  mPlus().click();
  t.check('Minuten + : 0:00 -> 0:05 (Stunden bleiben).', total(TBA) === 5 && hInput().value === '0' && mInput().value === '5', { s: total(TBA), h: hInput().value, m: mInput().value });
  hPlus().click();
  t.check('Stunden + : 0:05 -> 1:05 (Minuten bleiben).', total(TBA) === 65 && hInput().value === '1' && mInput().value === '5', { s: total(TBA) });
  hPlus().click();
  t.check('Stunden + : 1:05 -> 2:05.', total(TBA) === 125 && hInput().value === '2' && mInput().value === '5');
  hMinus().click();
  t.check('Stunden − : 2:05 -> 1:05 (Minuten bleiben).', total(TBA) === 65 && hInput().value === '1' && mInput().value === '5');
  mMinus().click();
  t.check('Minuten − : 1:05 -> 1:00 (Stunden bleiben).', total(TBA) === 60 && hInput().value === '1' && mInput().value === '0');
  hMinus().click();
  t.check('Stunden − : 1:00 -> 0:00; Eintrag wird entfernt (0 = keine Dauer).', total(TBA) === undefined && hInput().value === '0' && mInput().value === '0');
  t.check('Bei 0:00 sind Minuten-Minus und Stunden-Minus wieder deaktiviert.', mMinus().disabled && hMinus().disabled);

  // Krumme Werte: Minuten springen zum nächsten 5er (wie im Minuten-Modus)
  typeM('47');
  t.check('Minuten tippen: 0:47 gespeichert (47 Min).', total(TBA) === 47 && hInput().value === '0' && mInput().value === '47');
  mPlus().click();
  t.check('Minuten + bei 47 springt zum nächsten 5er: 0:50.', total(TBA) === 50 && mInput().value === '50');
  typeM('47'); mMinus().click();
  t.check('Minuten − bei 47 springt zum vorigen 5er: 0:45.', total(TBA) === 45 && mInput().value === '45');

  // Übertrag bei 60 (Plus) und Borgen (Minus)
  typeM('55'); mPlus().click();
  t.check('Minuten + bei 55: Übertrag in die Stunden -> 1:00 (nicht "0:60").', total(TBA) === 60 && hInput().value === '1' && mInput().value === '0', { s: total(TBA), h: hInput().value, m: mInput().value });
  mMinus().click();
  t.check('Minuten − bei 1:00: leiht sich eine Stunde -> 0:55.', total(TBA) === 55 && hInput().value === '0' && mInput().value === '55');
  typeH('2'); typeM('55'); mPlus().click();
  t.check('Übertrag auch mit Stunden: 2:55 + -> 3:00.', total(TBA) === 180 && hInput().value === '3' && mInput().value === '0');
  mMinus().click();
  t.check('... und 3:00 − -> 2:55.', total(TBA) === 175 && hInput().value === '2' && mInput().value === '55');

  // ───────── 4) Tippen ─────────
  typeH('1'); typeM('30');
  t.check('Tippen 1 Std 30 Min -> 90 Minuten gespeichert.', total(TBA) === 90 && hInput().value === '1' && mInput().value === '30');
  typeH('3');
  t.check('Stunden tippen ändert nur die Stunden (3:30).', total(TBA) === 210 && mInput().value === '30' && hInput().value === '3');
  typeM('75');
  t.check('Minuten > 59 tippen (75) wird übertragen: 3:30 -> 3 Std + 75 Min = 4:15.', total(TBA) === 255 && hInput().value === '4' && mInput().value === '15', { s: total(TBA), h: hInput().value, m: mInput().value });
  typeM('60');
  t.check('Minuten = 60 tippen: wird zur vollen Stunde (4:15 -> 4 Std + 60 = 5:00).', total(TBA) === 300 && hInput().value === '5' && mInput().value === '0');
  typeM('-5');
  t.check('Negative Minuten -> 0 (nie unter 0): 5:00.', total(TBA) === 300 && mInput().value === '0');
  typeM('');
  t.check('Leeres Minutenfeld zählt als 0 Minuten (Stunden bleiben).', total(TBA) === 300 && hInput().value === '5');
  typeH('1'); typeM('15');
  typeH('abc');
  t.check('Text im Stundenfeld wird zu 0 Stunden (1:15 -> 0:15).', total(TBA) === 15 && hInput().value === '0');
  typeH('2.6'); typeM('15');
  t.check('Dezimale Stunden werden gerundet (2.6 -> 3).', total(TBA) === 195 && hInput().value === '3', total(TBA));

  // ───────── 5) Obergrenze 999 Minuten = 16:39 ─────────
  typeH('20');
  t.check('Zu viele Stunden (20) -> auf 999 Minuten (16:39) gedeckelt.', total(TBA) === 999 && hInput().value === '16' && mInput().value === '39', { s: total(TBA), h: hInput().value, m: mInput().value });
  t.check('Bei 16:39 sind Stunden-Plus deaktiviert.', hPlus().disabled === true);
  hMinus().click();
  t.check('Stunden − von 16:39 -> 15:39.', total(TBA) === 939 && hInput().value === '15' && mInput().value === '39');
  typeM('50'); hPlus().click();
  t.check('Stunden-Plus würde über 999 -> 15:50 + 1 Std wird nicht ausgeführt (Plus ist deaktiviert).', hPlus().disabled === true && total(TBA) === 950);
  w.stepDurationModalHours(1);
  t.check('Auch direkter Aufruf lässt den Wert bei 15:50 unverändert (kein Überlauf).', total(TBA) === 950);
  t.check('nextDurationHourStep: 45 + = 105, 105 − = 45, 45 − = 45, 999 + = 999.', w.nextDurationHourStep(45, 1) === 105 && w.nextDurationHourStep(105, -1) === 45 && w.nextDurationHourStep(45, -1) === 45 && w.nextDurationHourStep(999, 1) === 999);
  w.resetDurationModal();

  // ───────── 6) Vorschlag im Std:Min-Modus ─────────
  close();
  open(NOVA, 45);
  t.check('Vorschlag (45 Min) erscheint als 0 Std 45 Min, beide Felder gedimmt.', hInput().value === '0' && mInput().value === '45' && hInput().classList.contains('duration-input-suggest') && mInput().classList.contains('duration-input-suggest'));
  t.check('Vorschlag ist (noch) nicht gespeichert.', total(NOVA) === undefined);
  hMinus().click();
  t.check('Stunden − beim Vorschlag 0:45 ändert nichts und speichert nichts.', total(NOVA) === undefined && mInput().value === '45');
  w.stepDurationModalHours(-1);            // der Button ist hier deaktiviert -> direkter Aufruf prüft die Absicherung
  t.check('Direkter Stunden-Minus-Aufruf beim Vorschlag (0:45) speichert den Vorschlag nicht.', total(NOVA) === undefined);
  t.check('Stunden-Minus-Button ist beim Vorschlag unter 1 Std deaktiviert.', hMinus().disabled === true);
  close();
  t.check('Schließen ohne Eingabe speichert den Vorschlag nicht.', total(NOVA) === undefined);
  open(NOVA, 45);
  hPlus().click();
  t.check('Stunden + beim Vorschlag: 0:45 -> 1:45, wird gespeichert (105 Min), nicht mehr gedimmt.', total(NOVA) === 105 && hInput().value === '1' && mInput().value === '45' && !hInput().classList.contains('duration-input-suggest'));
  w.resetDurationModal();
  t.check('Zurücksetzen: Vorschlag erscheint wieder (0:45, gedimmt).', total(NOVA) === undefined && mInput().value === '45' && hInput().classList.contains('duration-input-suggest'));
  mPlus().click();
  t.check('Minuten + beim Vorschlag: 0:45 -> 0:50 gespeichert.', total(NOVA) === 50 && mInput().value === '50');
  w.resetDurationModal();
  typeM('52');
  t.check('Minuten tippen beim Vorschlag speichert 0:52.', total(NOVA) === 52);
  w.resetDurationModal();
  typeH('1');
  t.check('Stunden tippen beim Vorschlag (1): Minuten-Anteil des Vorschlags (45) bleibt -> 1:45 = 105.', total(NOVA) === 105 && mInput().value === '45', total(NOVA));
  w.resetDurationModal();
  w.confirmDurationModal();
  t.check('"Als Auftritt speichern" übernimmt den Vorschlag (45) im Std:Min-Modus.', total(NOVA) === 45 && !modal().classList.contains('open'));
  open(NOVA, 45); w.resetDurationModal(); close();

  // ───────── 7) Anzeige in der Zeile + Wechsel des Modus ─────────
  w.toggleProgRating(ridOf(TBA));        // Dauer-Button steckt in der (erst beim Aufklappen gebauten) Detailansicht
  open(TBA);
  hPlus().click(); mPlus().click();
  const btn = () => $(`${ridOf(TBA)}-durbtn`);
  t.check('Button in der Zeile zeigt die Dauer wie immer (1h 5min).', btn().textContent.includes('1h 5min'), btn().textContent);
  t.check('Vorschau im Modal zeigt dieselbe Dauer.', $('durationModalPreview').textContent.includes('1h 5min'));
  close();
  setMode('minutes');
  open(TBA);
  t.check('Zurück im Minuten-Modus: Stunden-Zeile weg, ein Feld mit 65 Minuten (nichts geht verloren).', hoursRow().style.display === 'none' && mInput().value === '65' && mInput().max === '999');
  mPlus().click();
  t.check('Minuten-Modus: + springt auf den nächsten 5er: 65 -> 70.', total(TBA) === 70);
  w.resetDurationModal(); close();
  t.check('Minuten-Modus: Eingabe über 59 Minuten bleibt möglich (z. B. 150).', (() => { open(TBA); typeM('150'); const ok = total(TBA) === 150 && mInput().value === '150'; w.resetDurationModal(); close(); return ok; })());

  // ───────── 8) Oberfläche / Einstellung wird angezeigt ─────────
  ev("appSettings.durationInputMode = 'hm';");
  w.applySettingsUI();
  t.check('applySettingsUI zeigt den gespeicherten Modus in der Auswahl.', modeSel().value === 'hm');
  open(TBA);
  t.check('Beim Öffnen des Dialogs gilt der gespeicherte Modus sofort (Stunden-Zeile sichtbar).', hoursRow().style.display === 'flex');
  close();


  // ───────── 9) Anordnung: Räder nebeneinander, kleinerer Wert oben, größerer unten ─────────
  const css = d.querySelector('style').textContent;
  const cols = d.querySelector('#durationModal .duration-cols');
  const kidsOf = el => [...el.children].map(c => c.id || c.className);
  t.check('Stunden- und Minuten-Rad stehen nebeneinander in einer Zeile (Stunden links, ":" dazwischen, Minuten rechts).', kidsOf(cols).join() === 'durationModalHoursRow,durationModalSep,durationModalMinutesCol', kidsOf(cols));
  t.check('Die Zeile ist ein Flex-Row (nicht untereinander), die Räder selbst sind vertikal.', /\.duration-cols\s*\{[^}]*display:\s*flex/.test(css) && !/\.duration-cols\s*\{[^}]*flex-direction:\s*column/.test(css) && /\.duration-col\s*\{[^}]*flex-direction:\s*column/.test(css));
  const order = col => [...col.children].map(c => c.tagName === 'INPUT' ? 'input' : c.tagName === 'BUTTON' ? (/Minus$/.test(c.id) ? 'minus' : 'plus') : 'unit').join();
  t.check('Stunden-Rad von oben nach unten: kleinerer Wert (Minus), Wert, größerer Wert (Plus), "Std".', order($('durationModalHoursRow')) === 'minus,input,plus,unit' && $('durationModalHoursRow').lastElementChild.textContent === 'Std', order($('durationModalHoursRow')));
  const minCol = $('durationModalMinutesCol');
  t.check('Minuten-Rad von oben nach unten: kleinerer Wert, Wert, größerer Wert, "Min".', order(minCol) === 'minus,input,plus,unit' && minCol.lastElementChild.textContent === 'Min', order(minCol));
  t.check('Der kleinere Wert liegt über dem Feld, der größere darunter (DOM-Reihenfolge je Rad).', hMinus().compareDocumentPosition(hInput()) & 4 && hInput().compareDocumentPosition(hPlus()) & 4 && mMinus().compareDocumentPosition(mInput()) & 4 && mInput().compareDocumentPosition(mPlus()) & 4);
  const cssVar = name => { const m = css.match(new RegExp(`\\.duration-cols\\s*\\{[^}]*${name}:\\s*(\\d+)px`)); return m ? +m[1] : NaN; };
  t.check('Kompakte Größen: Nachbar-Zeile höchstens 36px, Mittelzeile höchstens 48px, Rad höchstens 90px breit.', cssVar('--wh-row') <= 36 && cssVar('--wh-center') <= 48 && cssVar('--wh-w') <= 90, { r: cssVar('--wh-row'), c: cssVar('--wh-center'), w: cssVar('--wh-w') });
  t.check('Die Mittelzeile ist höher als die Nachbar-Zeilen (Wert ist der Blickfang).', cssVar('--wh-row') < cssVar('--wh-center'));
  t.check('Nachbar-Zeilen und Eingabefeld teilen sich die Breite (gemeinsame Variable), damit die Zahlen sauber untereinander fluchten.', /\.duration-nb\s*\{[^}]*width:\s*var\(--wh-w\)/.test(css) && /\.duration-input\s*\{[^}]*width:\s*var\(--wh-w\)/.test(css));
  t.check('":" sitzt auf Höhe der Mittelzeile (Versatz = Nachbar-Zeile, Höhe = Mittelzeile, gleiche Variablen).', /\.duration-sep\s*\{[^}]*height:\s*var\(--wh-center\)[^}]*margin-top:\s*var\(--wh-row\)/.test(css));
  t.check('Räder fangen Wischgesten selbst ab (touch-action: none) und sind nicht markierbar.', /\.duration-col\s*\{[^}]*touch-action:\s*none[^}]*user-select:\s*none/.test(css));
  t.check('Dialog ist kompakt: kleiner Innenabstand in Kopf, Inhalt und Fuß.', /#durationModal \.modal-body\s*\{[^}]*padding:\s*12px[^}]*gap:\s*6px/.test(css) && /#durationModal \.modal-header\s*\{[^}]*padding:\s*12px/.test(css) && /#durationModal \.modal-footer\s*\{[^}]*padding:\s*10px/.test(css));
  t.check('Geschätzte Dialoghöhe des Std:Min-Modus: unter 280px.', 46 + (12 + cssVar('--wh-row') * 2 + cssVar('--wh-center') + 14 + 6 + 18 + 8) + 54 < 280);
  ev("appSettings.durationInputMode = 'hm';"); w.applySettingsUI(); open(TBA);
  t.check('Std:Min: Stunden-Rad und ":" sichtbar.', hoursRow().style.display === 'flex' && $('durationModalSep').style.display === 'flex');
  close();
  ev("appSettings.durationInputMode = 'minutes';"); w.applySettingsUI(); open(TBA);
  t.check('Minuten-Modus: nur das Minuten-Rad, keine Stunden-Spalte und kein ":".', hoursRow().style.display === 'none' && $('durationModalSep').style.display === 'none');
  close();

  t.finish();
})();

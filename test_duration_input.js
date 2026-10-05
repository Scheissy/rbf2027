const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  w.currentTab = 'programm';
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();

  // TBA-Auftritt (nid 5) hat keine Zeiten -> kein Dauer-Vorschlag, saubere Ausgangslage.
  const progItem = d.querySelector('[data-skey="nid:5"]');
  const rid = progItem.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  w.toggleProgRating(rid);                    // Detailansicht wird erst beim Aufklappen gebaut
  const skey = 'nid:5';
  const hasRow = () => !!d.querySelector('[data-skey="nid:5"]');
  const btn = () => d.getElementById(`${rid}-durbtn`);
  const modal = () => d.getElementById('durationModal');
  const input = () => d.getElementById('durationModalInput');
  const minus = () => d.getElementById('durationModalMinus');
  const plus = () => [...modal().querySelectorAll('.duration-step-btn')].find(b => b.textContent === '+');
  const preview = () => d.getElementById('durationModalPreview').textContent;
  const summary = () => d.getElementById(`${rid}-durationsummary`);
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const typeValue = v => { input().value = v; fire(input(), 'change'); };
  const dur = () => JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').showDurations || {};

  // 1) Detailzeile: nur noch ein Button, kein Dropdown, kein Eingabefeld.
  t.check('Kein Dauer-Dropdown (.duration-select) mehr vorhanden.', d.querySelector('.duration-select') === null);
  t.check('Detailzeile zeigt nur einen Button (kein Zahlenfeld in der Liste).', !!btn() && btn().tagName === 'BUTTON' && !d.getElementById(`${rid}-detail`).querySelector('input.duration-input'));
  t.check('Ohne Eintrag zeigt der Button "+ Eintragen".', btn().textContent === '+ Eintragen', btn().textContent);
  t.check('Modal ist anfangs geschlossen.', !modal().classList.contains('open'));

  // 2) Antippen öffnet das Modal.
  btn().click();
  t.check('Klick auf den Button öffnet das Dauer-Modal.', modal().classList.contains('open'));
  t.check('Modal-Titel nennt den Act.', d.getElementById('durationModalTitle').textContent.includes('Rosa Mercur'), d.getElementById('durationModalTitle').textContent);
  t.check('Modal startet bei 0, Minus deaktiviert.', input().value === '0' && minus().disabled === true);

  // 3) Freie Eingabe.
  typeValue('47');
  t.check('Freie Eingabe 47 wird gespeichert (kein 15-Min-Raster).', dur()[skey] === 47, dur());
  t.check('Button in der Zeile zeigt 47 Min.', btn().textContent.includes('47 Min'), btn().textContent);
  t.check('Kurzanzeige in der Programm-Zeile zeigt 47 Min.', summary().textContent.includes('47 Min') && summary().style.display !== 'none', summary().textContent);
  t.check('Vorschau im Modal zeigt 47 Min.', preview().includes('47 Min'), preview());
  t.check('Minus ist bei 47 aktiv.', minus().disabled === false);

  // 4) 5-Minuten-Stepper: krumme Werte springen zum nächsten 5er, glatte Werte +/- 5.
  const at = v => dur()[skey] === v && input().value === String(v);
  plus().click();
  t.check('+ bei 47 springt zum nächsten 5er (47 -> 50), nicht auf 52.', at(50), { s: dur()[skey], i: input().value });
  plus().click();
  t.check('+ bei glattem Wert addiert 5 (50 -> 55).', at(55), { s: dur()[skey] });
  minus().click();
  t.check('− bei glattem Wert zieht 5 ab (55 -> 50).', at(50), { s: dur()[skey] });
  typeValue('47'); minus().click();
  t.check('− bei 47 springt zum vorigen 5er (47 -> 45), nicht auf 42.', at(45), { s: dur()[skey] });
  typeValue('48'); minus().click();
  t.check('− bei 48 -> 45.', at(45), { s: dur()[skey] });
  typeValue('46'); plus().click();
  t.check('+ bei 46 -> 50.', at(50), { s: dur()[skey] });
  typeValue('49'); plus().click();
  t.check('+ bei 49 -> 50 (nur 1 Minute Sprung).', at(50), { s: dur()[skey] });
  typeValue('51'); minus().click();
  t.check('− bei 51 -> 50 (nur 1 Minute Sprung).', at(50), { s: dur()[skey] });
  t.check('nextDurationStep: 47+ = 50, 47- = 45, 50+ = 55, 50- = 45, 0- = 0, 2- = 0, 3+ = 5.',
    w.nextDurationStep(47, 5) === 50 && w.nextDurationStep(47, -5) === 45 && w.nextDurationStep(50, 5) === 55
    && w.nextDurationStep(50, -5) === 45 && w.nextDurationStep(0, -5) === 0 && w.nextDurationStep(2, -5) === 0 && w.nextDurationStep(3, 5) === 5);
  typeValue('42'); minus().click(); minus().click();
  t.check('Zweimal − von 42: 40, dann 35.', at(35), { s: dur()[skey] });
  t.check('Button und Kurzanzeige folgen dem Stepper (35 Min).', btn().textContent.includes('35 Min') && summary().textContent.includes('35 Min'));

  // 5) Nie kleiner als 0.
  typeValue('3');
  minus().click();
  t.check('Von 3 mit − landet man bei 0, nicht im Negativen; Eintrag wird gelöscht.', dur()[skey] === undefined && input().value === '0', { s: dur()[skey], i: input().value });
  t.check('Bei 0 ist Minus deaktiviert, Kurzanzeige ausgeblendet, Button wieder "+ Eintragen".', minus().disabled === true && summary().style.display === 'none' && btn().textContent === '+ Eintragen');
  w.stepDurationModal(-5);
  t.check('stepDurationModal(-5) bei 0 bleibt bei 0.', dur()[skey] === undefined && input().value === '0');
  plus().click();
  t.check('+ von 0 ergibt 5.', dur()[skey] === 5 && input().value === '5', { s: dur()[skey], i: input().value });

  // 6) Ungültige Eingaben.
  typeValue('-20');
  t.check('Negative Eingabe wird zu 0 (Eintrag gelöscht).', dur()[skey] === undefined && input().value === '0', { s: dur()[skey], i: input().value });
  typeValue('30'); typeValue('');
  t.check('Leeres Feld entfernt die Dauer.', dur()[skey] === undefined && input().value === '0');
  typeValue('abc');
  t.check('Text ohne Zahl ergibt 0.', dur()[skey] === undefined && input().value === '0');
  typeValue('12.6');
  t.check('Dezimalwert wird gerundet (12.6 -> 13).', dur()[skey] === 13, dur());
  typeValue('5000');
  t.check('Unsinnig großer Wert wird auf 999 begrenzt.', dur()[skey] === 999 && input().value === '999', { s: dur()[skey], i: input().value });
  plus().click();
  t.check('+ über das Maximum hinaus bleibt bei 999.', dur()[skey] === 999);
  minus().click();
  t.check('− von 999 springt zum vorigen 5er (995).', dur()[skey] === 995, dur());
  typeValue('997'); plus().click();
  t.check('+ bei 997 wird auf das Maximum 999 gekappt (nicht 1000).', dur()[skey] === 999, dur());

  // 7) Zurücksetzen + Schließen.
  typeValue('60');
  d.querySelector('#durationModal .form-btn-cancel').click();
  t.check('"Zurücksetzen" entfernt die Dauer (Modal bleibt offen).', dur()[skey] === undefined && input().value === '0' && modal().classList.contains('open'));
  input().value = '25';              // getippt, aber noch kein change-Event
  d.querySelector('#durationModal .form-btn-save').click();
  t.check('"Fertig" übernimmt noch nicht bestätigte Eingabe (25) und schließt das Modal.', dur()[skey] === 25 && !modal().classList.contains('open'), { s: dur()[skey] });
  btn().click();
  t.check('Modal öffnet erneut mit dem gespeicherten Wert.', modal().classList.contains('open') && input().value === '25');
  modal().dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t.check('Klick auf den Hintergrund schließt das Modal, Wert bleibt.', !modal().classList.contains('open') && dur()[skey] === 25);
  btn().click();
  d.querySelector('#durationModal .modal-close').click();
  t.check('✕ schließt das Modal.', !modal().classList.contains('open'));

  // 8) Gesamtzeit + Filter "Nur mit Dauer".
  btn().click();
  typeValue('90');
  const totalText = d.getElementById('progTotalTime').textContent;
  t.check('Gesamtzeit-Leiste übernimmt die Eingabe (1h 30min).', totalText.includes('1h 30min'), totalText);
  d.getElementById('fProgDuration').checked = true;
  w.renderProg();
  t.check('Mit Filter "Nur mit Dauer" bleibt der Auftritt sichtbar.', hasRow());
  typeValue('3'); w.stepDurationModal(-5);   // 3 -> 0 per Stepper
  t.check('Dauer per Stepper auf 0 (3 -> 0) -> Auftritt verschwindet aus "Nur mit Dauer"; Modal bleibt bedienbar.',
    !hasRow() && input().value === '0');
  w.closeDurationModal();
  t.check('Modal lässt sich danach sauber schließen.', !modal().classList.contains('open'));

  t.finish();
})();

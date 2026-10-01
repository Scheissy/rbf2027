const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  const modal = d.getElementById('locFilterInfoModal');
  const icons = [...d.querySelectorAll('.info-icon-btn')];

  if (!t.check('locFilterInfoModal existiert im DOM', !!modal)) return t.finish();
  t.check('Genau 2 ⓘ-Icons im DOM (Jetzt-Button + Location-Filter).', icons.length === 2, icons.length);

  // 1) Standard geschlossen
  t.check('Location-Info-Modal ist standardmäßig geschlossen.', !modal.classList.contains('open'));

  // 2) Öffnen
  w.openLocFilterInfoModal();
  t.check('openLocFilterInfoModal() öffnet das Modal.', modal.classList.contains('open'));

  // 3) Inhalt erwähnt die Kernaussage: Dauereinstellung, übersteht Reset UND
  //    "Ausgeblendete anzeigen"
  const bodyText = modal.textContent;
  const mentionsManage = bodyText.includes('Locations verwalten');
  const mentionsPersistent = /Dauereinstellung/.test(bodyText);
  const mentionsResetSurvives = bodyText.includes('Filter zurücksetzen') && bodyText.includes('Ausgeblendete Künstler/Events mit anzeigen');
  t.check('Modal-Text erklärt den Sonderfall korrekt und vollständig.',
    mentionsManage && mentionsPersistent && mentionsResetSurvives, { mentionsManage, mentionsPersistent, mentionsResetSurvives });

  // 4) Schließen per Funktion
  w.closeLocFilterInfoModal();
  t.check('closeLocFilterInfoModal() schließt das Modal.', !modal.classList.contains('open'));

  // 5) Backdrop-Klick schließt, Klick auf die Karte selbst nicht
  w.openLocFilterInfoModal();
  w.handleLocFilterInfoBackdropClick({ target: modal });
  t.check('Klick auf den Backdrop schließt das Modal.', !modal.classList.contains('open'));
  w.openLocFilterInfoModal();
  const card = modal.querySelector('.modal');
  w.handleLocFilterInfoBackdropClick({ target: card });
  t.check('Klick auf die Karte selbst schließt das Modal nicht.', modal.classList.contains('open'));

  // 6) Der "Locations verwalten öffnen"-Button im Modal schließt das Modal,
  //    wechselt in den Settings-Tab und öffnet direkt locManageModal.
  const jumpBtn = [...modal.querySelectorAll('button')].find(b => b.textContent.includes('Locations verwalten öffnen'));
  if (!t.check('"Locations verwalten öffnen"-Button existiert im Modal.', !!jumpBtn)) return t.finish();
  jumpBtn.click();
  const ioVisible = !d.getElementById('view-io').classList.contains('hidden');
  const locManageOpen = d.getElementById('locManageModal').classList.contains('open');
  const infoModalClosed = !modal.classList.contains('open');
  t.check('Button wechselt in Settings, öffnet Locations verwalten und schließt das Info-Modal.',
    ioVisible && locManageOpen && infoModalClosed, { ioVisible, locManageOpen, infoModalClosed });

  // 7) Das ⓘ-Icon sitzt strukturell direkt neben dem Location-Filter-Button
  const locBtn = d.getElementById('locFilterBtn');
  const locIcon = icons.find(i => i.getAttribute('onclick').includes('openLocFilterInfoModal'));
  t.check('ⓘ-Icon steht direkt neben dem Location-Filter-Button.', !!locIcon && locIcon.parentElement === locBtn.parentElement);

  // 8) Ohne aktive Location-Auswahl bleibt der neue "Aktuell ausgewählt"-
  // Abschnitt unsichtbar.
  const selectionSection = d.getElementById('locFilterInfoSelection');
  const selectionList = d.getElementById('locFilterInfoSelectionList');
  w.openLocFilterInfoModal();
  t.check('Ohne aktive Location-Auswahl bleibt der "Aktuell ausgewählt"-Abschnitt unsichtbar.', selectionSection.style.display === 'none');
  w.closeLocFilterInfoModal();

  // 9) Mit aktiver Auswahl (z.B. zwei Locations) erscheint der Abschnitt und
  // listet genau die ausgewählten Locations auf.
  w.toggleLocSelection('Docks');
  w.toggleLocSelection('Molotow');
  w.openLocFilterInfoModal();
  const listedNames = [...selectionList.querySelectorAll('.badge')].map(b => b.textContent);
  t.check('Mit aktiver Auswahl zeigt der Abschnitt genau die ausgewählten Locations ("Docks", "Molotow").',
    selectionSection.style.display === 'block' && listedNames.includes('Docks') && listedNames.includes('Molotow') && listedNames.length === 2,
    { display: selectionSection.style.display, listedNames });

  // 10) Auswahl wieder aufheben -> Abschnitt verschwindet beim nächsten Öffnen wieder.
  w.closeLocFilterInfoModal();
  w.toggleLocSelection('Docks');
  w.toggleLocSelection('Molotow');
  w.openLocFilterInfoModal();
  t.check('Nach Aufheben der Auswahl verschwindet der Abschnitt beim nächsten Öffnen wieder.', selectionSection.style.display === 'none');
  w.closeLocFilterInfoModal();

  t.finish();
})();

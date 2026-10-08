const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const ev = code => w.eval(code);

  const backdrops = [...d.querySelectorAll('.modal-backdrop')];
  const ids = backdrops.map(b => b.id);
  const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const isOpen = id => d.getElementById(id).classList.contains('open');

  // ───────── 1) Aufbau: alle Modals folgen derselben Mechanik ─────────
  t.check('Alle 11 bekannten Modals sind im Markup vorhanden.', ids.length === 11 && ['genreModal', 'commentModal', 'durationModal', 'jumpToNowInfoModal', 'locFilterInfoModal', 'soundRefModal', 'locModal', 'progGenreModal', 'locManageModal', 'installModal', 'auswertungInfoModal'].every(i => ids.includes(i)), ids);
  const regular = backdrops.filter(b => b.id !== 'durationModal');
  t.check('Jedes Modal außer dem Dauer-Dialog hat den gemeinsamen Hintergrund-Handler modalBackdropClick(event).', regular.every(b => b.getAttribute('onclick') === 'modalBackdropClick(event)'), regular.map(b => b.id + ':' + b.getAttribute('onclick')));
  t.check('Der Dauer-Dialog hat bewusst keinen Hintergrund-Handler.', !d.getElementById('durationModal').getAttribute('onclick'));
  // Kopier-Fehler-Schutz: jeder Schließen-Button schließt das Modal, in dem er steht
  const wrongClose = [];
  // (ein Button darf nach dem Schließen weitere Aktionen auslösen, z. B. "Locations verwalten" öffnen)
  regular.forEach(b => b.querySelectorAll('[onclick*="closeModal("]').forEach(el => {
    const ids = [...el.getAttribute('onclick').matchAll(/closeModal\('([^']+)'\)/g)].map(m => m[1]);
    if (ids.some(i => i !== b.id)) wrongClose.push(b.id + ' -> ' + el.getAttribute('onclick'));
  }));
  t.check('Jeder Schließen-Button im Markup ruft closeModal mit der Id SEINES Modals auf (kein Copy-Paste-Fehler).', wrongClose.length === 0, wrongClose);
  t.check('Jedes Modal (außer Dauer-Dialog) hat mindestens einen Schließen-Button.', regular.every(b => b.querySelector('[onclick^="closeModal("], [onclick*="closeModal("]')), regular.filter(b => !b.querySelector('[onclick*="closeModal("]')).map(b => b.id));

  // ───────── 2) Verhalten über echte Klicks auf das Markup ─────────
  regular.forEach(b => {
    w.openModal(b.id);
    const opened = isOpen(b.id);
    click(b.querySelector('.modal'));                      // Tipp auf die Karte selbst
    const stayedOnCard = isOpen(b.id);
    click(b);                                              // Tipp auf den abgedunkelten Hintergrund
    const closedByBackdrop = !isOpen(b.id);
    w.openModal(b.id);
    click(b.querySelector('[onclick*="closeModal("]'));    // Schließen-Button
    const closedByButton = !isOpen(b.id);
    t.check(`${b.id}: öffnet, bleibt bei Tipp auf die Karte offen, schließt per Hintergrund-Tipp und per Button.`, opened && stayedOnCard && closedByBackdrop && closedByButton, { opened, stayedOnCard, closedByBackdrop, closedByButton });
  });
  w.openModal('durationModal');
  click(d.getElementById('durationModal'));
  t.check('Dauer-Dialog: Tipp auf den Hintergrund schließt NICHT.', isOpen('durationModal'));
  w.closeDurationModal();
  t.check('Dauer-Dialog: lässt sich über seine eigene Schließ-Logik schließen.', !isOpen('durationModal'));
  w.modalBackdropClick({ target: d.getElementById('commentModal').querySelector('.modal') });
  t.check('modalBackdropClick ignoriert Ziele, die kein Modal-Hintergrund sind (Karte, Text, null).', (() => { try { w.modalBackdropClick({ target: null }); w.modalBackdropClick({ target: d.body }); w.modalBackdropClick({ target: d.createTextNode('x') }); return true; } catch (e) { return false; } })());

  // ───────── 3) Öffnen-Funktionen der einzelnen Modals benutzen die gemeinsame Mechanik ─────────
  const openers = [
    ['genreModal', () => w.openGenreModal()], ['locModal', () => w.openLocModal()], ['progGenreModal', () => w.openProgGenreModal()],
    ['locManageModal', () => w.openLocManageModal()], ['installModal', () => w.openInstallModal()],
    ['locFilterInfoModal', () => w.openLocFilterInfoModal()], ['auswertungInfoModal', () => w.openAuswertungInfoModal()],
    ['jumpToNowInfoModal', () => w.openModal('jumpToNowInfoModal')],
  ];
  openers.forEach(([id, fn]) => { fn(); const ok = isOpen(id); w.closeModal(id); t.check(`Öffnen von ${id} funktioniert und das Modal lässt sich mit closeModal wieder schließen.`, ok && !isOpen(id)); });
  ev("dataMap['Nova Frequenz'].kommentar = 'Testkommentar';");
  w.openCommentModal('Nova Frequenz');
  t.check('Kommentar-Modal: öffnet mit dem Kommentartext.', isOpen('commentModal') && d.getElementById('commentModalText').textContent === 'Testkommentar');
  w.closeModal('commentModal');
  w.soundReferencesFor = () => [{ referenz: ['Band A'], kategorie: 'Test' }];
  w.openSoundRefModal('Nova Frequenz');
  t.check('Soundreferenz-Modal: öffnet mit dem Inhalt.', isOpen('soundRefModal') && d.getElementById('soundRefModalBody').textContent.includes('Band A'));
  w.closeModal('soundRefModal');
  // Die Info-Buttons im Markup öffnen das richtige Modal
  const infoBtn = d.querySelector('[onclick*="openModal(\'jumpToNowInfoModal\')"]');
  t.check('Das ⓘ neben "Jetzt" öffnet das Modal direkt über openModal (ohne eigenen Wrapper).', !!infoBtn);

  // ───────── 4) Keine Wrapper-Reste ─────────
  const removed = ['closeGenreModal', 'closeCommentModal', 'closeSoundRefModal', 'closeJumpToNowInfoModal', 'closeLocFilterInfoModal', 'closeAuswertungInfoModal', 'closeLocModal', 'closeProgGenreModal', 'closeLocManageModal', 'closeInstallModal',
    'handleGenreBackdropClick', 'handleCommentBackdropClick', 'handleSoundRefBackdropClick', 'handleJumpToNowInfoBackdropClick', 'handleLocFilterInfoBackdropClick', 'handleAuswertungInfoBackdropClick', 'handleLocBackdropClick', 'handleProgGenreBackdropClick', 'handleLocManageBackdropClick', 'handleInstallBackdropClick', 'openJumpToNowInfoModal'];
  const stillThere = removed.filter(n => typeof w[n] !== 'undefined');
  t.check('Die 21 früheren Einzel-Wrapper (close…/handle…Backdrop…/openJumpToNowInfoModal) existieren nicht mehr.', stillThere.length === 0, stillThere);
  t.check('Die Mehrfachfilter-Fabrik liefert kein eigenes close/handleBackdrop mehr (nur noch open).', typeof ev('genreModalApi.close') === 'undefined' && typeof ev('genreModalApi.handleBackdrop') === 'undefined' && typeof ev('genreModalApi.open') === 'function');
  t.check('Gemeinsame Funktionen sind vorhanden: openModal, closeModal, modalBackdropClick.', ['openModal', 'closeModal', 'modalBackdropClick'].every(n => typeof w[n] === 'function'));

  // ───────── 5) Zwei Modals gleichzeitig / Reihenfolge ─────────
  w.openModal('genreModal'); w.openModal('locModal');
  w.closeModal('genreModal');
  t.check('closeModal schließt nur das genannte Modal, andere bleiben offen.', !isOpen('genreModal') && isOpen('locModal'));
  w.closeModal('locModal');

  t.finish();
})();

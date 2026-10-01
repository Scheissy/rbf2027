const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  const modal = d.getElementById('jumpToNowInfoModal');
  const icon = d.querySelector('.info-icon-btn');

  if (!t.check('jumpToNowInfoModal existiert im DOM', !!modal)) return t.finish();
  if (!t.check('ⓘ-Icon-Button existiert im DOM', !!icon)) return t.finish();

  // 1) Standard: Modal geschlossen
  t.check('Info-Modal ist standardmäßig geschlossen.', !modal.classList.contains('open'));

  // 2) Öffnen über die Funktion (entspricht Klick auf das Icon)
  w.openJumpToNowInfoModal();
  t.check('openJumpToNowInfoModal() öffnet das Modal.', modal.classList.contains('open'));

  // 3) Inhalt erwähnt beide Stufen (1. Tippen / weiteres Tippen) sowie die
  //    beiden Ausnahmen (Ausgeblendete anzeigen, Event-Sichtbarkeit)
  const bodyText = modal.textContent;
  const mentionsStage1 = /1\.\s*Tippen/.test(bodyText);
  const mentionsStage2 = /weiteres\s*Tippen/.test(bodyText);
  const mentionsExceptions = bodyText.includes('Ausgeblendete anzeigen') && /Musik-\/Sonstige-Events/.test(bodyText);
  t.check('Modal-Text erklärt beide Stufen sowie die beiden Ausnahmen korrekt.',
    mentionsStage1 && mentionsStage2 && mentionsExceptions, { mentionsStage1, mentionsStage2, mentionsExceptions });

  // 4) Schließen per Funktion
  w.closeJumpToNowInfoModal();
  t.check('closeJumpToNowInfoModal() schließt das Modal.', !modal.classList.contains('open'));

  // 5) Backdrop-Klick schließt (Klick direkt auf den Backdrop, nicht auf die Karte)
  w.openJumpToNowInfoModal();
  w.handleJumpToNowInfoBackdropClick({ target: modal });
  t.check('Klick auf den Backdrop schließt das Modal.', !modal.classList.contains('open'));

  // 6) Klick auf die Karte selbst (nicht den Backdrop) darf NICHT schließen
  w.openJumpToNowInfoModal();
  const card = modal.querySelector('.modal');
  w.handleJumpToNowInfoBackdropClick({ target: card });
  t.check('Klick auf die Karte selbst schließt das Modal nicht (kein versehentliches Schließen).', modal.classList.contains('open'));
  w.closeJumpToNowInfoModal();

  // 7) Das ⓘ-Icon sitzt sichtbar direkt neben dem "Jetzt"-Button (gleicher
  //    Elternknoten), nicht irgendwo lose im Filterbereich.
  const jetztBtn = [...d.querySelectorAll('.prog-quick-btn')].find(b => b.textContent.includes('Jetzt'));
  t.check('ⓘ-Icon steht direkt neben dem "Jetzt"-Button.', !!jetztBtn && jetztBtn.parentElement === icon.parentElement);

  t.finish();
})();

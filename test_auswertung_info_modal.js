const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  w.switchTab('auswertung');
  const el = d.getElementById('auswertungContent');
  const modal = d.getElementById('auswertungInfoModal');
  const icon = el.querySelector('.info-icon-btn');

  // ── 1) Kompakter Header statt der früheren, dauerhaft sichtbaren Info-Box ──
  t.check('Keine dauerhaft sichtbare Info-Box mehr im Auswertung-Tab (der Erklärtext steckt im Modal).',
    !el.querySelector('.info-box'));
  t.check('Stattdessen ein kompakter Header mit Titel und ⓘ-Icon.',
    el.querySelector('.ausw-header-title').textContent.includes('Auswertung') && !!icon, el.innerHTML.slice(0, 200));
  t.check('Der Header nimmt sichtbar weniger Platz ein als die frühere Info-Box (kurzer Text statt mehrerer Absätze).',
    el.querySelector('.ausw-header').textContent.trim().length < 30, el.querySelector('.ausw-header').textContent);

  // ── 2) Modal existiert, ist initial geschlossen und enthält die komplette Erklärung ──
  if (!t.check('auswertungInfoModal existiert im DOM.', !!modal)) return t.finish();
  t.check('Modal ist standardmäßig geschlossen.', !modal.classList.contains('open'));
  w.openAuswertungInfoModal();
  const bodyText = modal.textContent;
  t.check('Modal erklärt "besucht" (Dauer/Bewertung), Strecke und die Bewertungsbasis - dieselben Infos wie zuvor die Box.',
    bodyText.includes('Dauer') && bodyText.includes('bewertet') && bodyText.includes('Strecke') && bodyText.includes('Auftritts-Bewertung'), bodyText);
  w.closeAuswertungInfoModal();
  t.check('closeAuswertungInfoModal() schließt das Modal wieder.', !modal.classList.contains('open'));

  // ── 3) Öffnen per Icon-Klick (Backdrop-Verhalten wie bei den anderen Info-Modals) ──
  icon.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t.check('Klick auf das ⓘ-Icon öffnet das Modal.', modal.classList.contains('open'));
  w.handleAuswertungInfoBackdropClick({ target: modal });
  t.check('Klick auf den Backdrop schließt das Modal.', !modal.classList.contains('open'));
  w.openAuswertungInfoModal();
  w.handleAuswertungInfoBackdropClick({ target: modal.querySelector('.modal') });
  t.check('Klick auf die Karte selbst schließt das Modal NICHT.', modal.classList.contains('open'));
  w.closeAuswertungInfoModal();

  // ── 4) Der Fußweg-Hinweis wird je nach vorhandener Matrix korrekt befüllt ──
  w.openAuswertungInfoModal();
  t.check('Ohne rbf-walk.js nennt das Modal die Luftlinien-Näherung, keine OSM-Quellenangabe.',
    d.getElementById('auswertungInfoWalkNote').textContent.includes('Luftlinie') && !d.getElementById('auswertungInfoWalkNote').textContent.includes('OpenStreetMap'));
  w.closeAuswertungInfoModal();

  // ── 5) Neu-Rendern (Sortierung wechseln) hält Header/Modal intakt ──────
  w.setAuswertungSort('duration');
  t.check('Nach Neu-Rendern (Sortierung geändert) ist der Header weiterhin vorhanden und funktionsfähig.',
    !!d.getElementById('auswertungContent').querySelector('.ausw-header-title'));
  w.openAuswertungInfoModal();
  t.check('Das Modal selbst bleibt beim Neu-Rendern des Contents unverändert erreichbar.', d.getElementById('auswertungInfoModal').classList.contains('open'));
  w.closeAuswertungInfoModal();
  w.setAuswertungSort('count');

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  w.currentTab = 'programm';
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();

  const nameRow = [...d.querySelectorAll('.prog-name')].find(el => el.textContent.includes('Nova Frequenz'));
  const progItem = nameRow.closest('.prog-item');
  const rid = progItem.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  const badge = () => d.getElementById(`${rid}-summary`);
  const stars = () => [...badge().querySelectorAll('.prog-mini-star')];
  const filledCount = () => stars().filter(s => s.classList.contains('on')).length;
  const halfCount = () => stars().filter(s => s.classList.contains('half')).length;

  // 1) Plan-Flag (🎯) sitzt jetzt in .prog-time-col, nicht mehr in .prog-right-col.
  const timeCol = progItem.querySelector('.prog-time-col');
  const rightCol = progItem.querySelector('.prog-right-col');
  const flagInTimeCol = timeCol.querySelector('.plan-flag-btn') !== null;
  const flagInRightCol = rightCol.querySelector('.plan-flag-btn') !== null;
  t.check('🎯-Ziel-Button sitzt jetzt in .prog-time-col (bei der Zeit), nicht mehr in .prog-right-col.',
    flagInTimeCol && !flagInRightCol, { flagInTimeCol, flagInRightCol });

  // 2) Die Zeitanzeige selbst existiert weiterhin (eigenes Element .prog-time-val).
  t.check('Zeitanzeige steckt jetzt in einem eigenen .prog-time-val-Element.', !!timeCol.querySelector('.prog-time-val'));

  // 3) Die Bewertungs-Badge (jetzt volle 5-Sterne-Anzeige) sitzt in
  // .prog-right-col, IMMER gerendert (nicht display:none), nur über die
  // Klasse "has-rating" (visibility) gesteuert - garantiert konstante
  // Breite (immer exakt 5 Sterne), kein Layout-Sprung mehr möglich.
  t.check('Bewertungs-Badge sitzt in .prog-right-col.', rightCol.contains(badge()));
  t.check('Badge wird nie per display:none entfernt (immer im Layout vorhanden, feste Breite garantiert).', badge().style.display !== 'none');
  t.check('Die Badge zeigt immer exakt 5 Sterne, unabhängig vom Bewertungsstatus (feste Breite).', stars().length === 5, stars().length);
  t.check('Ohne Bewertung fehlt die Klasse "has-rating" (Badge unsichtbar, aber weiterhin im Layout).', !badge().classList.contains('has-rating'));
  t.check('Ohne Bewertung sind alle 5 Sterne leer (kein "on"/"half").', filledCount() === 0 && halfCount() === 0);

  // 4) Bewertung setzen (4 von 5) -> Badge bekommt "has-rating" + 4 gefüllte
  // Sterne, bleibt aber exakt an derselben Stelle in derselben .prog-right-col.
  w.setProgRating(rid, 'Nova Frequenz', 'rp', 4);
  t.check('Nach dem Bewerten (4) zeigt die Badge genau 4 gefüllte Sterne und die Klasse "has-rating".',
    badge().classList.contains('has-rating') && filledCount() === 4, { filled: filledCount(), html: badge().innerHTML });
  t.check('Weiterhin exakt 5 Sterne insgesamt (nur der Füllstand ändert sich).', stars().length === 5, stars().length);
  t.check('Badge bleibt strukturell weiterhin in derselben .prog-right-col (keine Verschiebung).', rightCol.contains(badge()));

  // 5) Bewertung zurücksetzen -> "has-rating" verschwindet wieder, weiterhin
  // exakt 5 (jetzt wieder leere) Sterne im DOM.
  w.setProgRating(rid, 'Nova Frequenz', 'rp', 4); // gleicher Wert erneut = zurücksetzen
  t.check('Zurücksetzen entfernt "has-rating" und leert die Sterne wieder, Element bleibt erhalten.',
    !badge().classList.contains('has-rating') && filledCount() === 0);

  t.finish();
})();

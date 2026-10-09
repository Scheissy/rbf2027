const { createHelpers, loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const t = createChecker();
  const NAME = "Dov'è Liana"; // Testdaten: Apostroph + Akzent, genau der gemeldete Fall

  // Vorbedingung: Künstler-Bewertung (Promo) über die Künstler-Übersicht setzen -
  // simuliert "Bewertung aus der Künstler-Bewertung".
  w.setRating(NAME, 'rp', 4);

  w.currentTab = 'programm';
  // Alle Tage/Zeiten sicherstellen, damit der Auftritt garantiert sichtbar ist.
  H.showAllProg({ reset: true });

  // ── Test 1: Künstler-Bewertung erscheint in der Programm-Detailansicht ────
  const entry = w.allProgEntries().find(e => e.name === NAME);
  if (!t.check(`Auftritt für "${NAME}" in den Testdaten gefunden.`, !!entry)) return t.finish();
  const nameRow = [...d.querySelectorAll('.prog-name')].find(el => el.textContent.includes(NAME));
  if (!t.check(`Gerenderte Zeile für "${NAME}" gefunden.`, !!nameRow)) return t.finish();
  const progItem = nameRow.closest('.prog-item');
  // rid steckt im id des zugehörigen "-arrow"/"-detail"-Elements - wir lesen es
  // stattdessen aus dem onclick des prog-item selbst aus.
  const onclickAttr = progItem.getAttribute('onclick'); // z.B. toggleProgRating('progr-3')
  const actualRid = onclickAttr.match(/toggleProgRating\('([^']+)'\)/)[1];

  w.toggleProgRating(actualRid); // Detail aufklappen
  const rpStars = d.getElementById(`${actualRid}-rp`);
  const filledStars = rpStars ? rpStars.querySelectorAll('.star.on').length : 0;
  t.check(`Künstler-Bewertung (4 Sterne Promo) für "${NAME}" wird in der Programm-Detailansicht korrekt angezeigt.`, filledStars === 4, filledStars);

  // ── Test 2: Bewertung in der Programm-Übersicht SETZEN (Klick auf Stern 3) ─
  const rpStarsEls = () => [...d.querySelectorAll(`#${actualRid}-rp .star`)];
  rpStarsEls()[2].dispatchEvent(new w.MouseEvent('click', { bubbles: true })); // Stern 3 anklicken
  let filled = rpStarsEls().filter(s => s.classList.contains('on')).length;
  t.check('Klick auf Stern 3 setzt die Promo-Bewertung korrekt auf 3.', filled === 3, filled);
  t.check('Keine JS-Fehler beim 1. Klick.', errors.length === 0, errors);
  errors.length = 0;

  // ── Test 3: Bewertung ERNEUT ÄNDERN (Klick auf Stern 5) - das war der
  // eigentlich gemeldete Bug ("kann diese aber nicht mehr ändern"). ─────────
  rpStarsEls()[4].dispatchEvent(new w.MouseEvent('click', { bubbles: true })); // Stern 5 anklicken
  filled = rpStarsEls().filter(s => s.classList.contains('on')).length;
  t.check('Ein WEITERER Klick (Stern 5) ändert die Bewertung erneut korrekt - Bug behoben.', filled === 5, filled);
  t.check('Keine JS-Fehler beim 2. Klick.', errors.length === 0, errors);
  errors.length = 0;

  // ── Test 4: dataMap wurde tatsächlich korrekt aktualisiert (nicht nur die Optik) ─
  w.saveToStorage();
  const raw = w.localStorage.getItem('rbf2027_v1');
  const saved = JSON.parse(raw);
  const savedEntry = saved.ratings.find(r => r.n === NAME);
  t.check('Die geänderte Bewertung (5) wird korrekt persistiert (dataMap wirklich aktualisiert, nicht nur die Anzeige).',
    !!savedEntry && savedEntry.rp === 5, savedEntry);

  // ── Test 5: "Gesehen"-Buttons für denselben Künstler in der Programm-
  // Übersicht - gleiches Bug-Muster, mehrfach hintereinander umschaltbar.
  // Wichtig: nach jedem Klick wird der Container per outerHTML ERSETZT
  // (setSeenProg), daher muss er nach jedem Klick frisch aus dem Dokument
  // geholt werden - eine gecachte Referenz würde auf den alten,
  // ausgehängten Knoten zeigen und keine verlässliche Aussage mehr liefern. ─
  const getJaBtn = () => {
    const container = d.getElementById(`${actualRid}-seen`);
    return [...container.querySelectorAll('.seen-btn')].find(b => b.textContent.includes('Gesehen'));
  };
  getJaBtn().dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t.check('"✓ Gesehen" lässt sich für den Sonderzeichen-Künstler 1x setzen.', getJaBtn().classList.contains('active-ja'));
  // Erneut klicken -> muss sich wieder umschalten lassen (zurücknehmen)
  getJaBtn().dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t.check('Ein weiterer Klick auf "✓ Gesehen" nimmt die Markierung korrekt wieder zurück (kein Hängenbleiben).', !getJaBtn().classList.contains('active-ja'));
  t.check('Keine JS-Fehler bei den Gesehen-Klicks.', errors.length === 0, errors);

  t.finish();
})();

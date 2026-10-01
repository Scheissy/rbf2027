const { loadApp, createChecker, mockRowLayout } = require('./test-helpers');

// jsdom liefert standardmäßig überall Null-Rects (kein echtes Layout) - wir
// simulieren daher gezielt ein Layout über den gemeinsamen mockRowLayout()-
// Helfer (siehe test-helpers.js): jede sichtbare ".artist-item"-Zeile bekommt
// eine Höhe von 50px, gestapelt in DOM-Reihenfolge. "scrolledPast" Zeilen
// gelten als bereits aus dem sichtbaren Bereich gescrollt.
function mockLayout(w, d, scrolledPast) {
  mockRowLayout(w, d.getElementById('artistList'), scrolledPast, el => el.id && el.id.startsWith('item-'));
}

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  w.render();
  const list = d.getElementById('artistList');
  const items = () => [...list.children].filter(c => c.id && c.id.startsWith('item-'));

  // ── Test 1: Anker-Künstler bleibt nach der Filteränderung in der Liste -
  // Scroll soll auf ihn ausgerichtet bleiben, NICHT auf den alten Pixel-Wert
  // und NICHT auf 0. ─────────────────────────────────────────────────────
  {
    mockLayout(w, d, 3); // 3 Zeilen "gescrollt", 4. Zeile wird zum Anker
    const anchorItem = items()[3];
    const anchorName = anchorItem.id.slice(5);
    // dataMap ist eine top-level `let`-Variable, kein window-Property - wir
    // lesen das Geschlecht daher aus dem gerenderten Badge (title-Attribut
    // enthält den vollen Wert, siehe shortenGeschlecht()).
    const anchorGender = anchorItem.querySelector('.badge[title]').getAttribute('title');

    list.scrollTop = 999; // bewusst ein Wert, der NICHT dem korrekten Ergebnis entspricht
    d.getElementById('fGender').value = anchorGender; // Filter, der den Anker-Künstler behält
    w.renderKuenstlerPreservingAnchor();

    const newItems = items();
    const stillThere = newItems.some(it => it.id === `item-${anchorName}`);
    t.check(`Anker-Künstler ("${anchorName}") ist nach dem Filtern (Geschlecht: ${anchorGender}) weiterhin in der Liste.`, stillThere);

    // Erwarteter Scroll-Wert: Position des Ankers in der NEUEN Liste (mit
    // demselben Mock-Layout, jetzt aber ggf. anderer Index) minus dem
    // ursprünglichen Offset (0, da er beim 1. Aufruf exakt an der Oberkante lag).
    const newIdx = newItems.findIndex(it => it.id === `item-${anchorName}`);
    const listTop = 100, rowHeight = 50, scrolledPast = 3;
    const expectedNewTop = listTop + (newIdx - scrolledPast) * rowHeight;
    const expectedScrollDelta = (expectedNewTop - listTop) - 0; // anchorOffset war 0
    const expectedScrollTop = 999 + expectedScrollDelta;
    t.check('Scroll-Position wird korrekt auf den Anker-Künstler ausgerichtet (nicht der alte Pixel-Wert, nicht 0).',
      list.scrollTop === expectedScrollTop && list.scrollTop !== 999 && list.scrollTop !== 0,
      { scrollTop: list.scrollTop, expectedScrollTop });
  }

  // ── Test 2: Anker-Künstler wird durch die Filteränderung HERAUSGEFILTERT -
  // dann soll bewusst ganz nach oben (scrollTop = 0) gescrollt werden. ──────
  {
    d.getElementById('fGender').value = ''; // zurücksetzen
    w.render();
    mockLayout(w, d, 3);
    const anchorItem = items()[3];
    const anchorName = anchorItem.id.slice(5);
    const anchorGender = anchorItem.querySelector('.badge[title]').getAttribute('title');
    // Ein Geschlecht wählen, das der Anker-Künstler NICHT hat, damit er
    // garantiert rausgefiltert wird.
    const otherGender = ['weiblich', 'männlich', 'divers', 'mixed'].find(g => g !== anchorGender);

    list.scrollTop = 777;
    d.getElementById('fGender').value = otherGender;
    w.renderKuenstlerPreservingAnchor();

    const stillThere = items().some(it => it.id === `item-${anchorName}`);
    t.check(`Anker-Künstler ("${anchorName}") ist nach dem Filtern (Geschlecht: ${otherGender}) NICHT mehr in der Liste (Testvoraussetzung).`, !stillThere);
    t.check('Bei rausgefiltertem Anker wird ganz nach oben gescrollt (scrollTop = 0).', list.scrollTop === 0);

    d.getElementById('fGender').value = ''; // aufräumen
    w.render();
  }

  t.finish();
})();

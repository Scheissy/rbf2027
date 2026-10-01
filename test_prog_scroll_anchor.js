const { loadApp, createChecker, mockRowLayout, namesInList } = require('./test-helpers');

// jsdom liefert standardmäßig überall Null-Rects (kein echtes Layout) - wir
// simulieren daher ein einfaches, gleichförmiges Zeilenlayout über den
// gemeinsamen mockRowLayout()-Helfer (siehe test-helpers.js): jedes Kind von
// #progList, egal ob Tages-Header oder Auftritt, ist 50px hoch (Header zählen
// hier bewusst mit, anders als in der Künstler-Übersicht). "scrolledPast" ist
// die Anzahl an Zeilen, die bereits aus dem sichtbaren Bereich gescrollt sind.
function mockLayout(w, d, scrolledPast) {
  mockRowLayout(w, d.getElementById('progList'), scrolledPast, el => el.parentElement === d.getElementById('progList'), { width: 320 });
}
const progItem = (d, skey) => [...d.getElementById('progList').children].find(el => el.classList.contains('prog-item') && el.dataset.skey === skey);
const domIndex = (d, skey) => [...d.getElementById('progList').children].indexOf(progItem(d, skey));

async function setup(w0) {
  const { window: w, document: d } = w0 ? { window: w0, document: w0.document } : await loadApp();
  w.switchTab('programm');
  w.resetProgFilters();
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.toggleSetting('showRbfEvents', false); // Events raus - für vorhersagbare, reine Künstler-Chronologie
  w.renderProg();
  return { w, d };
}

(async () => {
  const t = createChecker();

  // ── 1) Anker bleibt erhalten, wenn er die neuen Filter weiter erfüllt ────
  {
    const { w, d } = await setup();
    const oldIdx = domIndex(d, 'nid:10'); // Nordlicht Prozession (Sa, Docks, Post-Rock - eindeutiges Genre)
    if (!t.check('Testvoraussetzung: "Nordlicht Prozession" gerendert gefunden.', oldIdx !== -1)) return t.finish();
    mockLayout(w, d, oldIdx); // landet exakt auf dieser Zeile, anchorOffset = 0
    d.getElementById('progList').scrollTop = 999;
    w.toggleProgGenreSelection('Post-Rock'); // ruft intern renderProg() auf; übrig bleibt nur Nordlicht Prozession
    t.check('Nach dem Filtern ist nur noch "Nordlicht Prozession" sichtbar (Testvoraussetzung).',
      namesInList(d).length === 1 && namesInList(d)[0].includes('Nordlicht Prozession'), namesInList(d));
    const newIdx = domIndex(d, 'nid:10');
    const expected = 999 + (newIdx - oldIdx) * 50;
    t.check('Scroll-Position wird korrekt auf den weiterhin sichtbaren Anker ausgerichtet (nicht der alte Pixel-Wert, nicht 0).',
      d.getElementById('progList').scrollTop === expected && expected !== 999 && expected !== 0,
      { scrollTop: d.getElementById('progList').scrollTop, expected, oldIdx, newIdx });
  }

  // ── 2) Anker wird herausgefiltert - zeitlich SPÄTERER Nachbar wird gefunden ─
  // Anker: Blau Neon (Fr 20:30, nicht als Ziel markiert). Einzig markiert:
  // Lila Oktober (Sa 19:00) - 4 Schritte später in der Chronologie. Der
  // dazwischenliegende Grauzone Sieben/Rosa Mercur(TBA)/Funkeninsel sind
  // NICHT markiert und dürfen nicht fälschlich als Ziel erscheinen.
  {
    const { w, d } = await setup();
    w.togglePlanFlag('x', 'nid:9'); // Lila Oktober als Ziel markieren
    const oldIdx = domIndex(d, 'nid:6'); // Blau Neon
    if (!t.check('Testvoraussetzung: "Blau Neon" gerendert gefunden.', oldIdx !== -1)) return t.finish();
    mockLayout(w, d, oldIdx);
    d.getElementById('progList').scrollTop = 999;
    d.getElementById('fProgPlanned').checked = true;
    w.renderProg(); // entspricht dem Aktivieren von "Nur als Ziel markierte" aus der Anfrage
    t.check('Nach dem Filtern ist nur noch die als Ziel markierte "Lila Oktober" sichtbar (Testvoraussetzung).',
      namesInList(d).length === 1 && namesInList(d)[0].includes('Lila Oktober'), namesInList(d));
    const newIdx = domIndex(d, 'nid:9');
    const expected = 999 + (newIdx - oldIdx) * 50;
    t.check('Wird der Anker herausgefiltert, springt die Liste NICHT nach oben, sondern richtet sich am zeitlich nächsten (späteren) sichtbaren Eintrag aus.',
      d.getElementById('progList').scrollTop === expected && expected !== 0, { scrollTop: d.getElementById('progList').scrollTop, expected });
  }

  // ── 3) Anker wird herausgefiltert - zeitlich FRÜHERER Nachbar wird gefunden ─
  // Symmetrischer Fall: einzig markiert ist Dov'è Liana (Do 18:30), 3 Schritte
  // VOR dem Anker Blau Neon - die Suche muss auch rückwärts fündig werden.
  {
    const { w, d } = await setup();
    w.togglePlanFlag('x', 'nid:12'); // Dov'è Liana als Ziel markieren
    const oldIdx = domIndex(d, 'nid:6'); // Blau Neon
    mockLayout(w, d, oldIdx);
    d.getElementById('progList').scrollTop = 999;
    d.getElementById('fProgPlanned').checked = true;
    w.renderProg();
    t.check("Nach dem Filtern ist nur noch die markierte \"Dov'è Liana\" sichtbar (Testvoraussetzung).",
      namesInList(d).length === 1 && namesInList(d)[0].includes("Dov'è Liana"), namesInList(d));
    const newIdx = domIndex(d, 'nid:12');
    const expected = 999 + (newIdx - oldIdx) * 50;
    t.check('Die Rückwärtssuche nach einem früheren Nachbarn funktioniert ebenso.',
      d.getElementById('progList').scrollTop === expected && expected !== 0, { scrollTop: d.getElementById('progList').scrollTop, expected });
  }

  // ── 4) Tages-Header werden bei der Anker-Wahl übersprungen ──────────────
  // Scroll-Position so gewählt, dass ein Tages-Header ("Do 16.09") gerade
  // sichtbar wird - der Anker muss trotzdem der erste ECHTE Auftritt danach
  // sein (Dov'è Liana), nicht der Header selbst (der hätte keinen data-skey,
  // die Nachbarsuche würde dann komplett ausfallen und stur auf 0 zurückfallen).
  {
    const { w, d } = await setup();
    const dayHeader = [...d.getElementById('progList').children].find(el => el.classList.contains('prog-day-header') && el.textContent === 'Do 16.09');
    const headerIdx = [...d.getElementById('progList').children].indexOf(dayHeader);
    mockLayout(w, d, headerIdx); // Header liegt exakt an der Oberkante
    d.getElementById('progList').scrollTop = 999;
    w.toggleProgGenreSelection('Techno'); // entfernt Dov'è Liana; Stahl & Beton (Techno) und DJ Mitternacht (Techno/House) bleiben
    const newIdx = domIndex(d, 'nid:2'); // Stahl & Beton: der chronologisch nähere der beiden Überlebenden
    // anchorOffset beim ursprünglichen Anker (Dov'è Liana, EINE Zeile nach dem
    // Header) war 50 (nicht 0) - genau das beweist, dass wirklich der Auftritt
    // und nicht der Header als Referenzpunkt diente.
    const expected = 999 + ((newIdx - headerIdx) * 50 - 50);
    t.check('Ein sichtbarer Tages-Header wird nicht selbst zum Anker - stattdessen wird korrekt auf den ersten Auftritt danach ausgerichtet.',
      d.getElementById('progList').scrollTop === expected && expected !== 0, { scrollTop: d.getElementById('progList').scrollTop, expected });
  }

  // ── 5) Gar kein Eintrag erfüllt die neuen Filter -> sauberer Fallback ───
  {
    const { w, d, errors } = await (async () => { const r = await loadApp({ trackErrors: true }); return { ...(await setup(r.window)), errors: r.errors }; })();
    const oldIdx = domIndex(d, 'nid:6');
    mockLayout(w, d, oldIdx);
    d.getElementById('progList').scrollTop = 999;
    d.getElementById('fProgPlanned').checked = true; // niemand ist markiert -> Liste wird komplett leer
    w.renderProg();
    t.check('Ohne jeden verbleibenden Eintrag (leere Liste) wird sauber auf 0 zurückgesetzt, kein Fehler.',
      d.getElementById('progList').scrollTop === 0 && errors.length === 0, errors);
  }

  // ── 6) Regressionsschutz für den konkret gemeldeten Bug: Ziel-Flag direkt
  // über die UI-Funktion umschalten, während "Nur als Ziel markierte" aktiv
  // ist - darf keinen Fehler werfen (unabhängig vom Mock-Layout). ───────────
  {
    const app = await loadApp({ trackErrors: true });
    const { w, d } = await setup(app.window);
    d.getElementById('fProgPlanned').checked = true;
    w.togglePlanFlag('x', 'nid:1'); // Nova Frequenz neu markieren -> erscheint
    w.togglePlanFlag('x', 'nid:1'); // wieder entfernen -> verschwindet, exakt der Bug-Auslöser
    t.check('Ziel-Flag bei aktivem "Nur als Ziel markierte"-Filter umschalten wirft keinen Fehler.', app.errors.length === 0, app.errors);
  }

  t.finish();
})();

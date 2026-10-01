const { loadApp, reloadWithState, createChecker, ALL_DAYS, auswBlock: block, selectAuswertungDays: selectDays } = require('./test-helpers');

// Testdaten (rbf-data.test.js), nid -> Tag / Location:
//  1 Nova Frequenz Mi Docks | 2 Stahl & Beton Mi Molotow | 3 Kollektiv Nachtfalter Do Prinzenbar
//  4 Rosa Mercur Do Docks   | 6 Blau Neon Fr Molotow      | 8 Funkeninsel Sa Fischauktionshalle
//  9 Lila Oktober Sa Prinzenbar | 10 Nordlicht Prozession Sa Docks
const title = d => block(d).querySelector('.io-section-title').textContent;
const kpis = d => [...block(d).querySelectorAll('.ausw-kpi')].slice(0, 3).map(k => k.querySelector('.ausw-kpi-val').textContent);
const locNames = d => [...block(d).querySelectorAll('.ausw-loc > .ausw-loc-head > span:first-child')].map(e => e.textContent).join(' | ');
const dayBtns = d => [...d.querySelectorAll('.ausw-day-btn')];
const activeDayLabels = d => dayBtns(d).filter(b => b.classList.contains('active')).map(b => b.dataset.day);
(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const t = createChecker();

  w.switchTab('auswertung');

  // ── 1) Tages-Auswahl statt fester Struktur ──────────────────────────────
  t.check('Es gibt genau 4 Tage-Buttons, in chronologischer Reihenfolge.',
    dayBtns(d).map(b => b.dataset.day).join(',') === ALL_DAYS.join(','));
  t.check('Standardmäßig (noch nie gewählt) sind ALLE Tage aktiv - entspricht dem früheren "Gesamt".',
    JSON.stringify(activeDayLabels(d)) === JSON.stringify(ALL_DAYS));
  t.check('Es gibt nur noch EINEN Auswertungs-Bereich (keine 5 separaten Blöcke mehr).',
    d.querySelectorAll('.ausw-block').length === 1);
  t.check('Mit allen 4 Tagen aktiv lautet der Titel "Gesamt".', title(d) === 'Gesamt', title(d));

  // ── 2) Regressionswerte: mit ALLEN Tagen identisch zum früheren "Gesamt" ──
  w.setShowRating('x', 'nid:2', 4);
  w.setShowDuration('x', 'nid:4', '60');
  w.setShowRating('x', 'nid:4', 5);
  w.setShowRating('x', 'nid:6', 2);
  w.setShowDuration('x', 'nid:11', '30');
  w.renderAuswertung();
  t.check('Mit voller Auswahl: 4 besuchte Auftritte, 1h 30min, Ø 3.7.',
    JSON.stringify(kpis(d)) === JSON.stringify(['4', '1h 30min', '3.7']), kpis(d));
  t.check('Mit voller Auswahl: Location-Reihenfolge wie zuvor (Molotow vor Docks).',
    locNames(d) === 'Molotow | Docks', locNames(d));

  // ── 3) Das konkrete Beispiel aus der Anfrage: NUR Mi + Sa auswählen ─────
  // Übrig bleiben nid:2 (Mi, Molotow, ★4) und nid:11 (Sa, Molotow, 30 Min);
  // nid:4 (Do, Docks) und nid:6 (Fr, Molotow) fallen komplett weg.
  selectDays(d, ['Mi 15.09', 'Sa 18.09']);
  t.check('Titel zeigt die Auswahl an ("Mi 15.09 + Sa 18.09"), chronologisch (nicht Klickreihenfolge).',
    title(d) === 'Mi 15.09 + Sa 18.09', title(d));
  t.check('Nur Mi+Sa ausgewählt: 2 besuchte Auftritte (Do/Fr fallen komplett raus), 30 Min, Ø 4.0.',
    JSON.stringify(kpis(d)) === JSON.stringify(['2', '30 Min', '4.0']), kpis(d));
  t.check('Locations werden über die AUSGEWÄHLTEN Tage hinweg summiert: Molotow (Mi+Sa) steht als EIN Eintrag mit Anzahl 2, nicht als zwei separate Zeilen.',
    locNames(d) === 'Molotow' && block(d).querySelector('.ausw-loc').getAttribute('data-count') === '2', locNames(d));
  t.check('Docks (nur der Do-Auftritt) verschwindet komplett aus der Liste, weil Donnerstag abgewählt ist.',
    !locNames(d).includes('Docks'));

  // ── 4) Nur ein einzelner Tag ─────────────────────────────────────────────
  selectDays(d, ['Fr 17.09']);
  t.check('Ein einzelner ausgewählter Tag zeigt dessen Namen als Titel (kein "+").', title(d) === 'Fr 17.09', title(d));
  t.check('Nur Fr: 1 besuchter Auftritt (Blau Neon, ★2).', JSON.stringify(kpis(d)) === JSON.stringify(['1', '–', '2.0']), kpis(d));

  // ── 5) Kein Tag ausgewählt: klare Meldung statt leerer/verwirrender Ansicht ─
  selectDays(d, []);
  t.check('Kein Tag ausgewählt -> Hinweistext statt einer (leeren) Auswertung.',
    !d.querySelector('.ausw-block') && d.getElementById('auswertungContent').textContent.includes('mindestens einen Tag'));
  t.check('Kein JS-Fehler bei komplett leerer Auswahl.', errors.length === 0, errors);
  errors.length = 0;

  // ── 6) Zurück auf alle Tage ──────────────────────────────────────────────
  selectDays(d, ALL_DAYS);
  t.check('Erneutes Aktivieren aller Tage stellt "Gesamt" wieder her.', title(d) === 'Gesamt' && JSON.stringify(kpis(d)) === JSON.stringify(['4', '1h 30min', '3.7']));

  // ── 7) Scroll-Position bleibt bei jedem Klick erhalten ──────────────────
  const view = d.getElementById('view-auswertung');
  view.scrollTop = 555;
  dayBtns(d).find(b => b.dataset.day === 'Mi 15.09').click();
  t.check('Beim Umschalten der Tage springt die Ansicht nicht nach oben.', view.scrollTop === 555, view.scrollTop);
  selectDays(d, ALL_DAYS);

  // ── 8) Persistenz über einen echten Neustart ────────────────────────────
  selectDays(d, ['Mi 15.09', 'Sa 18.09']);
  const reloaded = await reloadWithState(w, ['rbf2027_v1']);
  reloaded.window.switchTab('auswertung');
  t.check('Die gewählten Tage werden gespeichert und nach einem Neustart identisch wiederhergestellt.',
    JSON.stringify(activeDayLabels(reloaded.document)) === JSON.stringify(['Mi 15.09', 'Sa 18.09']) && title(reloaded.document) === 'Mi 15.09 + Sa 18.09',
    activeDayLabels(reloaded.document));

  // ── 9) Eine bewusst leere Auswahl bleibt nach Neustart leer ─────────────
  {
    const { window: w2, document: d2 } = await loadApp();
    w2.switchTab('auswertung');
    selectDays(d2, []);
    const reloaded2 = await reloadWithState(w2, ['rbf2027_v1']);
    reloaded2.window.switchTab('auswertung');
    t.check('Eine bewusst leere Auswahl bleibt nach einem Neustart leer (kein automatisches Zurückfallen auf "alle Tage").',
      activeDayLabels(reloaded2.document).length === 0 && !reloaded2.document.querySelector('.ausw-block'));
  }

  // ── 10) Datenmigration: gespeicherte Tage existieren nicht mehr ────────
  // (z.B. nach einem rbf-data.js-Update mit anderen Tagsnamen) - dann auf
  // "alle Tage" zurückfallen statt eine für den Nutzer unerklärliche Leerauswahl
  // zu zeigen, die er so nie getroffen hat.
  {
    const { window: w3, document: d3 } = await loadApp();
    w3.localStorage.setItem('rbf2027_v1', JSON.stringify({
      ratings: [], auftritte: [], showRatings: {}, showDurations: {}, planFlags: {}, hiddenEvents: {},
      settings: { auswertungDays: ['Fantasietag 99.99'] }
    }));
    w3.loadFromStorage();
    w3.switchTab('auswertung');
    t.check('Sind ALLE gespeicherten Tage ungültig (Datenupdate), fällt die Auswahl auf "alle Tage" zurück statt leer zu bleiben.',
      JSON.stringify(activeDayLabels(d3)) === JSON.stringify(ALL_DAYS) && title(d3) === 'Gesamt', activeDayLabels(d3));
  }

  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

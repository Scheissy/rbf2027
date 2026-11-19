const { createHelpers, loadApp, createChecker } = require('./test-helpers');

// Datenprüfung der App (js/16-validierung.js): validateAuftritte(), autoFixAuftritte(),
// updateValidationPanel(). Jede Prüfung bekommt einen Negativfall (Problem wird gemeldet) und einen
// Positivfall (sauberer Fall bleibt ohne Meldung) - sonst würde "meldet immer" oder "meldet nie" nicht auffallen.
(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { ev } = H;
  const t = createChecker();

  // ── Hilfen ──
  let nidCounter = 5000;
  const mk = (over = {}) => ({ name: 'Nova Frequenz', day: 'Do 16.09', time: '20:00', endTime: '20:45', location: 'Docks', nid: nidCounter++, ...over });
  const run = list => { ev(`auftritte = ${JSON.stringify(list)};`); return Array.from(w.validateAuftritte(true)); };
  const has = (issues, text) => issues.some(i => i.includes(text));
  const panel = () => d.getElementById('validationPanel');
  const spy = () => {
    const toasts = [], logs = [];
    const origToast = w.toast, origLog = w.safeLog;
    w.toast = (...a) => toasts.push(a);
    w.safeLog = (...a) => logs.push(a);
    return { toasts, logs, restore() { w.toast = origToast; w.safeLog = origLog; } };
  };

  // Datenbasis der Testdaten, damit die Annahmen unten stimmen
  const known = ['Nova Frequenz', 'Rosa Mercur', 'Blau Neon'].every(n => ev(`!!dataMap[${JSON.stringify(n)}]`));
  const venues = ['Docks', 'Molotow'].every(v => ev(`!!VENUE_LOCATIONS[${JSON.stringify(v)}]`));
  t.check('Voraussetzung: Testkünstler und Testorte sind in den Testdaten vorhanden.', known && venues);

  const base = () => [
    mk({ name: 'Nova Frequenz' }),
    mk({ name: 'Rosa Mercur', location: 'Molotow' }),
    mk({ name: 'Blau Neon', day: 'Fr 17.09', time: '', endTime: '', location: '' }),   // TBA ohne Ort
  ];
  t.check('Sauberer Datensatz (inkl. TBA-Auftritt): keine Auffälligkeit.', run(base()).length === 0, run(base()));

  // ── Unbekannter Tag ──
  let r = run([mk({ day: 'Do 99.09' })]);
  t.check('Unbekannter Tag wird gemeldet (mit Tag und Künstler).', has(r, 'Unbekannter Tag „Do 99.09" bei Nova Frequenz'), r);
  t.check('... bekannter Tag: keine Meldung.', !has(run([mk({ day: 'Sa 18.09' })]), 'Unbekannter Tag'));

  // ── Künstler fehlt ──
  r = run([mk({ name: 'Geisterband' })]);
  t.check('Auftritt eines Künstlers, der nicht in der Künstlerliste steht, wird gemeldet.', has(r, '„Geisterband" (Auftritt) nicht in der Künstlerliste gefunden'), r);
  t.check('... bekannter Künstler: keine Meldung.', !has(run([mk()]), 'nicht in der Künstlerliste'));

  // ── Zeitformate ──
  r = run([mk({ time: '9:00', endTime: '' })]);
  t.check('Ungültiges Startzeit-Format wird gemeldet.', has(r, 'Ungültiges Zeitformat „9:00" bei Nova Frequenz'), r);
  r = run([mk({ endTime: '21.45' })]);
  t.check('Ungültiges Endzeit-Format wird gemeldet.', has(r, 'Ungültiges Endzeit-Format „21.45" bei Nova Frequenz'), r);
  r = run([mk({ time: '19:05', endTime: '19:50' }), mk({ name: 'Rosa Mercur', time: '', endTime: '', location: 'Molotow' })]);
  t.check('Gültige Zeiten und TBA (leere Zeit): keine Zeitformat-Meldung.', !has(r, 'Zeitformat') && !has(r, 'Endzeit-Format'), r);

  // ── Location ──
  r = run([mk({ location: ' Docks' })]);
  t.check('Location mit führendem Leerzeichen wird gemeldet.', has(r, 'Location mit Leerzeichen-Problem bei Nova Frequenz: " Docks"'), r);
  r = run([mk({ location: 'Unbekannte Halle' })]);
  t.check('Location ohne Maps-Eintrag wird gemeldet.', has(r, 'Location „Unbekannte Halle" (Nova Frequenz) hat keinen Maps-Eintrag'), r);
  r = run([mk({ location: 'Molotow' })]);
  t.check('... Location mit Maps-Eintrag: weder Leerzeichen- noch Maps-Meldung.', !has(r, 'Leerzeichen-Problem') && !has(r, 'Maps-Eintrag'), r);

  // ── Endzeit / Dauer ──
  r = run([mk({ time: '21:00', endTime: '20:30' })]);
  t.check('Endzeit vor der Startzeit wird gemeldet.', has(r, 'Endzeit nicht nach Startzeit bei Nova Frequenz (21:00–20:30)'), r);
  r = run([mk({ time: '21:00', endTime: '21:00' })]);
  t.check('Endzeit gleich Startzeit wird ebenfalls gemeldet.', has(r, 'Endzeit nicht nach Startzeit bei Nova Frequenz (21:00–21:00)'), r);
  r = run([mk({ time: '21:00', endTime: '21:45' })]);
  t.check('Endzeit nach Startzeit: keine Meldung.', !has(r, 'Endzeit nicht nach Startzeit') && !has(r, 'lange Show'), r);
  r = run([mk({ time: '23:30', endTime: '00:15' })]);
  t.check('Auftritt über Mitternacht (23:30–00:15) ist gültig: weder Endzeit- noch Dauer-Meldung.', !has(r, 'Endzeit nicht nach Startzeit') && !has(r, 'lange Show'), r);
  r = run([mk({ time: '20:00', endTime: '23:30' })]);
  t.check('Ungewöhnlich lange Show (3,5 h) wird gemeldet, mit Stundenangabe.', has(r, 'Ungewöhnlich lange Show bei Nova Frequenz: 20:00–23:30 (3.5h)'), r);
  t.check('Genau 3 Stunden sind noch normal ...', !has(run([mk({ time: '20:00', endTime: '23:00' })]), 'lange Show'));
  t.check('... eine Minute mehr ist auffällig.', has(run([mk({ time: '20:00', endTime: '23:01' })]), 'Ungewöhnlich lange Show'));

  // ── Duplikate ──
  r = run([mk({ nid: 1 }), mk({ nid: 2 })]);
  t.check('Exaktes Duplikat (Künstler, Tag, Zeit, Ort gleich) wird gemeldet, mit Anzahl.', has(r, 'Exaktes Duplikat (2×): Nova Frequenz / Do 16.09 / 20:00 / Docks'), r);
  r = run([mk({ nid: 1 }), mk({ nid: 2, time: '21:00', endTime: '21:45' })]);
  t.check('... gleicher Künstler am selben Ort, aber andere Zeit: kein Duplikat.', !has(r, 'Exaktes Duplikat'), r);
  r = run([mk({ nid: 1 }), mk({ nid: 2, location: 'Molotow' })]);
  t.check('Gleicher Künstler zur gleichen Zeit an zwei Orten wird gemeldet.', has(r, 'Nova Frequenz / Do 16.09 / 20:00: unterschiedliche Locations gleichzeitig (Docks, Molotow)'), r);
  r = run([mk({ nid: 1 }), mk({ nid: 2, time: '21:00', endTime: '21:45', location: 'Molotow' })]);
  t.check('... gleicher Künstler an zwei Orten zu verschiedenen Zeiten: keine Meldung.', !has(r, 'unterschiedliche Locations'), r);
  r = run([mk({ nid: 1, time: '', endTime: '', location: 'Docks' }), mk({ nid: 2, time: '', endTime: '', location: 'Molotow' })]);
  t.check('... zwei Auftritte ohne Uhrzeit (TBA) an verschiedenen Orten: keine Meldung.', !has(r, 'unterschiedliche Locations'), r);

  // ── Zwei Künstler gleichzeitig am selben Ort ──
  r = run([mk({ name: 'Nova Frequenz' }), mk({ name: 'Rosa Mercur' })]);
  t.check('Zwei Künstler zur selben Zeit am selben Ort werden gemeldet (mit beiden Namen).', has(r, 'Do 16.09 / 20:00 / Docks: mehrere Künstler gleichzeitig am selben Ort (Nova Frequenz, Rosa Mercur)'), r);
  r = run([mk({ name: 'Nova Frequenz' }), mk({ name: 'Rosa Mercur', location: 'Molotow' })]);
  t.check('... gleiche Zeit, verschiedene Orte: keine Meldung.', !has(r, 'mehrere Künstler gleichzeitig'), r);
  r = run([mk({ name: 'Nova Frequenz' }), mk({ name: 'Rosa Mercur', time: '21:00', endTime: '21:45' })]);
  t.check('... gleicher Ort, verschiedene Zeiten: keine Meldung.', !has(r, 'mehrere Künstler gleichzeitig'), r);
  r = run([mk({ name: 'Nova Frequenz', location: '' }), mk({ name: 'Rosa Mercur', location: '' })]);
  t.check('... gleiche Zeit, beide ohne Ort: keine Meldung.', !has(r, 'mehrere Künstler gleichzeitig'), r);

  // ── Überlappungen desselben Künstlers am selben Tag ──
  r = run([mk({ time: '20:00', endTime: '21:00' }), mk({ time: '20:30', endTime: '21:30', location: 'Molotow' })]);
  t.check('Überlappende Auftritte desselben Künstlers am selben Tag werden gemeldet.', has(r, 'Überlappende Auftritte bei Nova Frequenz am Do 16.09'), r);
  r = run([mk({ time: '20:00', endTime: '21:00' }), mk({ time: '21:30', endTime: '22:15', location: 'Molotow' })]);
  t.check('... nacheinander ohne Überschneidung: keine Meldung.', !has(r, 'Überlappende'), r);
  r = run([mk({ time: '20:00', endTime: '21:00' }), mk({ time: '21:00', endTime: '21:45', location: 'Molotow' })]);
  t.check('... Anschluss ohne Pause (Ende = nächster Start) gilt nicht als Überlappung.', !has(r, 'Überlappende'), r);
  r = run([mk({ time: '20:00', endTime: '21:00' }), mk({ time: '', endTime: '', location: '' })]);
  t.check('... ein Auftritt ohne Uhrzeit (TBA) am selben Tag: keine Überlappungs-Meldung.', !has(r, 'Überlappende'), r);
  r = run([mk({ time: '20:00', endTime: '21:00' }), mk({ day: 'Fr 17.09', time: '20:30', endTime: '21:30' })]);
  t.check('... gleiche Uhrzeiten an verschiedenen Tagen: keine Überlappungs-Meldung.', !has(r, 'Überlappende'), r);

  // ── Auffällig viele Auftritte ──
  const days = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];
  r = run(days.map(day => mk({ day })));
  t.check('Vier Auftritte desselben Künstlers werden als auffällig gemeldet.', has(r, 'Nova Frequenz hat ungewöhnlich viele Auftritte (4) - evtl. Mehrfach-Import?'), r);
  r = run(days.slice(0, 3).map(day => mk({ day })));
  t.check('... drei Auftritte sind noch normal.', !has(r, 'ungewöhnlich viele Auftritte'), r);

  // ── Rückgabe, Zustand und Panel ──
  const prob = [mk({ day: 'Do 99.09' }), mk({ name: 'Geisterband', day: 'Fr 17.09' })];
  r = run(prob);
  t.check('validateAuftritte liefert genau die gefundenen Meldungen (2) und merkt sie sich in lastValidationIssues.', r.length === 2 && JSON.stringify(Array.from(ev('lastValidationIssues'))) === JSON.stringify(r), r);
  let txt = panel().textContent;
  t.check('Das Panel im Settings-Tab zeigt die Anzahl und jede Meldung.', txt.includes('2 Auffälligkeit(en), die eine Entscheidung brauchen') && r.every(i => txt.includes(i)), txt);
  r = run(base());
  txt = panel().textContent;
  t.check('Ohne Auffälligkeit zeigt das Panel \"Keine weiteren Auffälligkeiten\" (und keine Warnung).', txt.includes('✓ Keine weiteren Auffälligkeiten') && !txt.includes('Auffälligkeit(en)'), txt);
  {
    const el = panel(), parent = el.parentNode, next = el.nextSibling;
    parent.removeChild(el);
    let threw = false;
    try { w.updateValidationPanel(); w.validateAuftritte(true); } catch (e) { threw = true; }
    parent.insertBefore(el, next);
    t.check('Fehlt das Panel im DOM, passiert nichts (kein Fehler).', !threw);
  }

  // ── silent / Rückmeldung (toast, safeLog) ──
  let s = spy();
  ev(`auftritte = ${JSON.stringify(prob)};`);
  w.validateAuftritte(true);
  t.check('silent=true: weder Toast noch Log, auch bei Meldungen.', s.toasts.length === 0 && s.logs.length === 0, [s.toasts, s.logs]);
  w.validateAuftritte(false);
  t.check('silent=false mit 2 Meldungen: ein Toast \"⚠️ Datencheck: 2 Auffälligkeit(en) - siehe Settings\" (als Warnung).', s.toasts.length === 1 && s.toasts[0][0] === '⚠️ Datencheck: 2 Auffälligkeit(en) - siehe Settings' && s.toasts[0][1] === false, s.toasts);
  t.check('... und ein Log-Eintrag mit der Anzahl.', s.logs.length === 1 && String(s.logs[0][0]).includes('2 Auffälligkeit(en)'), s.logs);
  s.restore(); s = spy();
  ev(`auftritte = ${JSON.stringify(base())};`);
  w.validateAuftritte(true);
  t.check('silent=true ohne Meldung: ebenfalls weder Toast noch Log.', s.toasts.length === 0 && s.logs.length === 0, [s.toasts, s.logs]);
  w.validateAuftritte(false);
  t.check('silent=false ohne Meldung: Toast \"✓ Datencheck: keine Auffälligkeiten gefunden\" (kein Warnstatus).', s.toasts.length === 1 && s.toasts[0][0] === '✓ Datencheck: keine Auffälligkeiten gefunden' && s.toasts[0][1] !== false, s.toasts);
  t.check('... und der Log-Eintrag meldet keine Auffälligkeiten.', s.logs.length === 1 && String(s.logs[0][0]).includes('keine Auffälligkeiten'), s.logs);
  s.restore();

  // ── Auto-Fix ──
  const dupFree = JSON.stringify;
  const fixList = [
    mk({ nid: 1, location: '  Docks ' }),                                                    // Whitespace
    mk({ nid: 2, name: 'Rosa Mercur', location: 'Molotow' }),
    mk({ nid: 2, name: 'Rosa Mercur', time: '22:00', endTime: '22:30', location: 'Molotow' }), // gleiche nid -> Duplikat (auch bei anderen Werten)
    mk({ nid: 3, name: 'Blau Neon', day: 'Fr 17.09', time: '', endTime: '', location: '' }),
    { ...mk({ name: 'Blau Neon', day: 'Sa 18.09', time: '19:00', endTime: '19:30', location: 'Docks' }), nid: undefined },   // ohne nid
    { ...mk({ name: 'Blau Neon', day: 'Sa 18.09', time: '19:00', endTime: '19:30', location: 'Docks' }), nid: undefined },   // exakt gleich, ohne nid
  ];
  delete fixList[4].nid; delete fixList[5].nid;
  s = spy();
  ev(`auftritte = ${dupFree(fixList)};`);
  const fixes = Array.from(w.autoFixAuftritte());
  const after = JSON.parse(ev('JSON.stringify(auftritte)'));
  t.check('Auto-Fix: Leerzeichen der Location werden entfernt.', after[0].location === 'Docks' && fixes.some(f => f.includes('Location-Leerzeichen entfernt bei Nova Frequenz')), [after[0], fixes]);
  t.check('Auto-Fix: gleiche nid = Duplikat, das erste bleibt (auch wenn die Werte des zweiten abweichen).', after.filter(a => a.nid === 2).length === 1 && after.find(a => a.nid === 2).time === '20:00' && fixes.some(f => f.includes('Exaktes Duplikat entfernt: Rosa Mercur (Do 16.09 22:00)')), [after, fixes]);
  t.check('Auto-Fix: ohne nid gilt Künstler+Tag+Zeit+Ort als Schlüssel (einer von zwei bleibt).', after.filter(a => a.nid === undefined).length === 1 && fixes.some(f => f.includes('Exaktes Duplikat entfernt: Blau Neon (Sa 18.09 19:00)')), [after, fixes]);
  t.check('Auto-Fix: übrige Auftritte (auch TBA) und deren Reihenfolge bleiben unverändert (4 von 6, 3 Korrekturen).', after.length === 4 && fixes.length === 3 && after.map(a => a.nid).join() === '1,2,3,' , [after.map(a => a.nid), fixes.length]);
  t.check('Auto-Fix: gibt die Korrekturen zurück, merkt sie sich (lastAutoFixes) und loggt sie einmal.', JSON.stringify(Array.from(ev('lastAutoFixes'))) === JSON.stringify(fixes) && s.logs.length === 1 && String(s.logs[0][0]).includes('3 triviale'), s.logs);
  txt = panel().textContent;
  t.check('Das Panel zeigt die automatischen Korrekturen (Anzahl und Text).', txt.includes('3 automatisch behoben') && fixes.every(f => txt.includes(f)), txt);
  r = Array.from(w.validateAuftritte(true));
  t.check('Nach dem Auto-Fix meldet die Validierung keine Duplikate mehr.', !has(r, 'Exaktes Duplikat'), r);
  s.logs.length = 0;
  const fixes2 = Array.from(w.autoFixAuftritte());
  t.check('Zweiter Auto-Fix auf bereinigten Daten: nichts zu tun, kein Log, Panel ohne Korrektur-Abschnitt.', fixes2.length === 0 && s.logs.length === 0 && !panel().textContent.includes('automatisch behoben'), [fixes2, s.logs]);
  s.restore();

  // ── Verdrahtung: Button im Settings-Tab ──
  s = spy();
  ev(`auftritte = ${dupFree([mk({ nid: 1 }), mk({ nid: 1 }), mk({ name: 'Geisterband', nid: 9, day: 'Fr 17.09' })])};`);
  d.querySelector('button[onclick*="validateAuftritte(false)"]').click();
  t.check('Button \"Jetzt prüfen\": führt erst den Auto-Fix aus (Duplikat entfernt), dann die Prüfung mit Rückmeldung.', ev('auftritte.length') === 2 && s.toasts.length === 1 && s.toasts[0][0].startsWith('⚠️ Datencheck: 1 Auffälligkeit(en)'), [ev('auftritte.length'), s.toasts]);
  s.restore();

  // ── Verdrahtung: Start der App (99-main.js) ──
  const dataScript = `
const DATA_VERSION = 'test-validation';
const DAY_ORDER = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];
const RAW = [
  ['Act A', 'Pop', 'Berlin, DE', 'divers', 'https://example.org/a'],
  ['Act B', 'Pop', 'Wien, AT', 'divers', 'https://example.org/b'],
];
const RAW_AUFTRITTE = [
  ['Act A', 'Mi 15.09', '20:00', '20:45', 'Docks ', 1],
  ['Act A', 'Mi 15.09', '20:00', '20:45', 'Docks ', 1],
  ['Act B', 'Mi 15.09', '20:00', '20:45', 'Docks', 2],
  ['Ghost', 'Do 16.09', '20:00', '20:45', 'Docks', 3],
];
const VENUE_LOCATIONS = { 'Docks': { lat: 1, lng: 1 } };
const ANCHOR_AWARD_NOMINEES = [];
const SOUND_REFERENCES = [];
const RBF_EVENTS = [];
`;
  const app = await loadApp({ dataScript });
  const aw = app.window;
  const startFixes = Array.from(aw.eval('lastAutoFixes')), startIssues = Array.from(aw.eval('lastValidationIssues'));
  t.check('App-Start: Auto-Fix läuft (2 Location-Korrekturen + 1 Duplikat) und bereinigt auftritte (4 -> 3).', aw.eval('auftritte.length') === 3 && startFixes.length === 3 && aw.eval('auftritte.every(a => a.location === a.location.trim())'), [aw.eval('auftritte.length'), startFixes]);
  t.check('App-Start: stille Validierung läuft danach (Künstler fehlt, zwei Künstler am selben Ort), ohne Toast.', startIssues.length === 2 && startIssues.some(i => i.includes('„Ghost" (Auftritt) nicht in der Künstlerliste')) && startIssues.some(i => i.includes('mehrere Künstler gleichzeitig am selben Ort (Act A, Act B)')) && !app.document.getElementById('toast').classList.contains('show'), startIssues);
  const startPanel = app.document.getElementById('validationPanel').textContent;
  t.check('App-Start: das Panel im Settings-Tab ist schon befüllt.', startPanel.includes('3 automatisch behoben') && startPanel.includes('2 Auffälligkeit(en)'), startPanel);
  t.check('App-Start: kein \"App unvollständig geladen\"-Hinweis (js/16-validierung.js meldet sich an).', !app.document.getElementById('partsWarning') && aw.RBF_PARTS.includes('16-validierung'), aw.RBF_PARTS);

  t.finish();
})();

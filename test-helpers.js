// ── test-helpers.js ─────────────────────────────────────────────────────────
// Gemeinsame Hilfsfunktionen für die Testdateien in diesem Verzeichnis.
//
// Ziel: das in allen bisherigen test_*.js-Dateien praktisch identisch
// kopierte JSDOM-Setup (fs.readFileSync, VirtualConsole, JSDOM-Konstruktion,
// Warte-Timeout - ca. 20 Zeilen pro Datei) an einer einzigen Stelle pflegen.
//
// Schritt 1 (diese Datei): komplett eigenständig - keine bestehende
// Testdatei wurde angefasst, alle Testdateien laufen unverändert weiter genau wie
// vorher, unabhängig davon, ob diese Helper existieren.
// Schritt 2 (später, optional, separat zu entscheiden): bestehende
// Testdateien nach und nach hierauf umstellen, um die Duplikation
// tatsächlich zu entfernen. Diese Datei ist bewusst so geschnitten, dass
// eine einzelne Datei-Migration klein und risikoarm bleibt (Boilerplate
// raus, Prüf-Logik unangetastet).

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const INDEX_HTML_PATH = path.join(__dirname, 'index.html');
const DEFAULT_DATA_PATH = path.join(__dirname, 'rbf-data.test.js');
// App-Initialisierung läuft komplett synchron beim Skript-Parsing (kein
// DOMContentLoaded/load-Listener, keine Startup-Timer) - die Wartezeit hier
// ist daher reine Sicherheitsmarge, kein tatsächlich benötigter Init-Vorgang.
// War früher 300ms (spürbar bei 35+ Testdateien: ganzer Lauf ~76s); 50ms
// liefen in wiederholten Läufen des kompletten Bestands durchgehend stabil
// (auch bei 20ms keine Fehlschläge, 50ms als komfortabler Puffer gewählt).
const DEFAULT_INIT_DELAY_MS = 50;

/**
 * Lädt index.html + eine Testdatendatei (Standard: rbf-data.test.js) in ein
 * frisches JSDOM und wartet, bis die App fertig initialisiert ist.
 *
 * @param {object} [opts]
 * @param {string} [opts.dataScript]   - Eigener Testdaten-Code als String,
 *     ersetzt den Inhalt von rbf-data.test.js. Für Szenarien, die andere
 *     Fixture-Daten brauchen (z.B. test_country_abbreviation.js: volle statt
 *     abgekürzte Ländernamen) - identisches Muster wie bisher, nur zentral
 *     verfügbar statt in jeder Datei einzeln nachgebaut.
 * @param {string} [opts.dataPath]     - Alternativer Pfad zu einer
 *     Testdaten-Datei, statt rbf-data.test.js.
 * @param {string} [opts.walkScript]   - Inhalt von rbf-walk.js (Fußweg-Matrix,
 *     `const WALK_DISTANCES = {...}`). Standard: leer = Datei nicht vorhanden.
 * @param {function} [opts.transformHtml] - Verändert das fertig zusammengesetzte HTML vor dem
 *     Laden (z. B. um ein Skript wegzulassen und eine unvollständig geladene App zu simulieren).
 * @param {number} [opts.initDelayMs]  - Wartezeit nach dem Laden (ms).
 * @param {boolean} [opts.trackErrors] - Wenn true, werden window-'error'-
 *     Events in .errors gesammelt (für Rauchtests, die auf "keine
 *     unerwarteten Fehler" prüfen wollen, siehe test_e2e_smoke.js).
 * @returns {Promise<{dom, window, document, errors: string[]}>}
 */
async function loadApp(opts = {}) {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const dataScript = opts.dataScript !== undefined
    ? opts.dataScript
    : fs.readFileSync(opts.dataPath || DEFAULT_DATA_PATH, 'utf-8');

  // rbf-walk.js (optionale Fußweg-Matrix) wird wie rbf-data.js inline ersetzt -
  // sonst würde jsdom (resources: 'usable') die Datei echt aus dem Netz laden.
  // Standard: leer = "Datei nicht vorhanden" (App fällt auf Luftlinie zurück).
  const walkScript = opts.walkScript !== undefined ? opts.walkScript : '';
  // Funktions-Replacer statt String: sonst würden "$&"/"$'"-Muster im
  // eingebetteten Skript als Ersetzungsmuster missverstanden.
  const htmlForTest = html
    .replace(/<script src="rbf-data\.js"><\/script>/, () => `<script>${dataScript}</script>`)
    .replace(/<script src="rbf-walk\.js"><\/script>/, () => `<script>${walkScript}</script>`)
    // CSS und App-Skripte (css/*.css, js/*.js) ebenfalls inline einsetzen (aus demselben Grund, dazu
    // bleiben Tests wie d.querySelector('style') gültig). Reihenfolge der Skripte bleibt erhalten.
    .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (m, f) => `<style>${fs.readFileSync(path.join(__dirname, f), 'utf-8')}</style>`)
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(__dirname, f), 'utf-8')}</script>`);

  const errors = [];
  const vc = new VirtualConsole();
  vc.forwardTo(console);
  vc.on('jsdomError', e => errors.push(`jsdomError: ${e.message}`));

  const dom = new JSDOM(opts.transformHtml ? opts.transformHtml(htmlForTest) : htmlForTest, {
    url: 'https://scheissy.github.io/rbf2026/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc
  });

  if (opts.trackErrors) {
    dom.window.addEventListener('error', e => errors.push(`window error: ${e.error ? e.error.message : e.message}`));
  }

  await new Promise(resolve => setTimeout(resolve, opts.initDelayMs ?? DEFAULT_INIT_DELAY_MS));

  // Per Tipp ausgelöste Sprünge (runJump in index.html) laufen in der echten App
  // leicht verzögert und mit Tap-Schutz-Schild. Die Tests prüfen das Sprung-
  // VERHALTEN und erwarten ein sofortiges Ergebnis - deshalb standardmäßig
  // synchron. Das verzögerte Verhalten testet test_jump_tap_shield.js gezielt
  // (dort: window.__rbfSyncJumps = false).
  dom.window.__rbfSyncJumps = true;

  return { dom, window: dom.window, document: dom.window.document, errors };
}

/**
 * Simuliert einen echten App-Neustart: lädt eine ZWEITE, frische App-Instanz,
 * überträgt den localStorage-Stand einer bestehenden Instanz dorthin und
 * stößt den Ladevorgang (loadFromStorage()/loadFilterState()) manuell an -
 * die App liest localStorage nämlich nur einmal beim Start, das Setzen NACH
 * der Konstruktion würde sonst stillschweigend ignoriert.
 *
 * Wichtig: appSettings, selectedLocs, hiddenEvents, progSelectedGenres & Co.
 * sind top-level `let`-Variablen im Inline-Script und daher (wie in echten
 * Browsern auch) keine window-Properties - sie können also von außen nicht
 * direkt zurückgesetzt/gelesen werden. Genau deshalb der Umweg über eine
 * zweite, komplett frische Instanz statt eines In-Memory-Resets der ersten.
 * Bisher wurde dieses Muster in test_prog_genre_filter.js und
 * test_rbf_events_toggle.js jeweils separat von Hand nachgebaut.
 *
 * @param {Window} sourceWindow  - Die Instanz, aus der der Stand kommt.
 * @param {string[]} storageKeys - z.B. ['rbf2027_v1', 'rbf2027_filters_v1']
 * @param {object} [opts]        - Wie bei loadApp().
 */
async function reloadWithState(sourceWindow, storageKeys, opts = {}) {
  const saved = {};
  for (const key of storageKeys) {
    saved[key] = sourceWindow.localStorage.getItem(key);
  }
  const fresh = await loadApp(opts);
  for (const key of storageKeys) {
    if (saved[key] !== null) fresh.window.localStorage.setItem(key, saved[key]);
  }
  // Die App liest localStorage nur EINMAL beim Start (während der Konstruktion
  // oben in loadApp()) - da wir den gespeicherten Stand erst danach in die
  // frische Instanz schreiben, muss der Ladevorgang hier manuell nachgestoßen
  // werden. Beide Loader sind null-sicher (kein Fehler, wenn der jeweilige Key
  // nicht gesetzt wurde), daher unbedingt beide aufrufen statt selektiv nur
  // den zur übergebenen Key-Liste passenden.
  if (typeof fresh.window.loadFromStorage === 'function') fresh.window.loadFromStorage();
  if (typeof fresh.window.loadFilterState === 'function') fresh.window.loadFilterState();
  // applySettingsUI() synchronisiert die Checkbox-DOM-Elemente (z.B.
  // #settingShowRbfEvents) mit den gerade geladenen appSettings-Werten -
  // ohne diesen Aufruf würden die Checkboxen weiterhin ihren ALTEN
  // (Default-)Zustand von der Konstruktion der frischen Instanz zeigen.
  if (typeof fresh.window.applySettingsUI === 'function') fresh.window.applySettingsUI();
  return fresh;
}

/**
 * Minimaler Check-Helfer für konsistentes Pass/Fail-Tracking über eine ganze
 * Testdatei hinweg - ersetzt das bisherige manuelle Muster (lokale "pass"-
 * Variable + eigenständige console.error/console.log-Paare + finales
 * if/else + process.exit in jeder Datei).
 *
 * Beispiel:
 *   const { loadApp, createChecker } = require('./test-helpers');
 *   (async () => {
 *     const { window: w, document: d } = await loadApp();
 *     const t = createChecker();
 *     t.check('Beschreibung der Erwartung', irgendeineBedingung);
 *     t.check('Noch eine Erwartung', anderesBedingung, { debugInfo: '...' });
 *     t.finish(); // druckt Zusammenfassung + process.exit(0 oder 1)
 *   })();
 */
function createChecker() {
  let pass = true;
  let count = 0;
  return {
    check(description, condition, details) {
      count++;
      if (condition) {
        console.log(`OK: ${description}`);
      } else {
        console.error(`FEHLER: ${description}`, details !== undefined ? details : '');
        pass = false;
      }
      return condition;
    },
    get passed() { return pass; },
    get count() { return count; },
    finish() {
      console.log(pass ? `\n✅ ALLE ${count} PRÜFUNGEN BESTANDEN` : `\n❌ MINDESTENS EINE PRÜFUNG FEHLGESCHLAGEN (von ${count})`);
      process.exit(pass ? 0 : 1);
    }
  };
}

// ── Auswertung-Tab: gemeinsame Helfer ────────────────────────────────────────
// Die vier Festivaltage der Testdaten (rbf-data.test.js), chronologisch.
// War bis vor Kurzem in mehreren Testdateien identisch dupliziert.
const ALL_DAYS = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];

// Der (seit der dynamischen Tages-Auswahl einzige) Auswertungs-Bereich.
function auswBlock(d) { return d.querySelector('.ausw-block[data-ausw="auswahl"]'); }

// Setzt die Tages-Auswahl im Auswertung-Tab per simuliertem Klick (nicht
// direkt appSettings, damit derselbe Weg wie eine echte Nutzung getestet
// wird). Jeder Klick rendert den gesamten Inhalt neu - Buttons müssen daher
// nach jedem Klick neu geholt werden (deshalb hier jedes Mal frisch per
// dataset.day gesucht statt eine Referenz zu behalten).
function selectAuswertungDays(d, wantedDays) {
  ALL_DAYS.forEach(day => {
    const btn = [...d.querySelectorAll('.ausw-day-btn')].find(b => b.dataset.day === day);
    const isActive = btn.classList.contains('active');
    const wanted = wantedDays.includes(day);
    if (isActive !== wanted) btn.click();
  });
}

// ── Scroll-Anker-Tests: gemeinsames Layout-Mock ─────────────────────────────
// jsdom liefert standardmäßig überall Null-Rects (kein echtes Layout) - wir
// simulieren daher ein einfaches, gleichförmiges Zeilenlayout: jede Zeile, für
// die isRow(el) zutrifft, ist rowHeight hoch und in DOM-Reihenfolge gestapelt.
// "scrolledPast" ist die Anzahl an Zeilen, die bereits aus dem sichtbaren
// Bereich gescrollt sind (Zeile Nr. `scrolledPast`, 0-indiziert, liegt exakt
// an der Oberkante der Liste). isRow entscheidet zugleich, WELCHE Kinder der
// Liste überhaupt als Zeile zählen (in der Künstler-Übersicht z.B. nur echte
// Einträge über ihre id, in der Programm-Übersicht auch die Tages-Header).
function mockRowLayout(w, listEl, scrolledPast, isRow, opts = {}) {
  const rowHeight = opts.rowHeight || 50;
  const listTop = opts.listTop || 100;
  const width = opts.width || 300;
  const listHeight = opts.listHeight || 600;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this === listEl) return { top: listTop, bottom: listTop + listHeight, left: 0, right: width, width, height: listHeight };
    if (!isRow(this)) return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    const rows = [...listEl.children].filter(isRow);
    const idx = rows.indexOf(this);
    const top = listTop + (idx - scrolledPast) * rowHeight;
    return { top, bottom: top + rowHeight, left: 0, right: width, width, height: rowHeight };
  };
}

// ── Weitere kleine, mehrfach dupliziert gewesene Helfer ─────────────────────
// Unabhängige Referenz-Implementierung der Haversine-Formel (NICHT die der
// App!) - zur Kontrolle von haversineMeters()/walkMeters() in den
// Wegstrecke-Tests. refFormatMeters folgt demselben Rundungs-/Format-Schema
// wie formatMeters() in der App, ebenfalls unabhängig nachgebaut.
function refHaversineMeters(a, b) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function refFormatMeters(m) { return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`; }

// Aktive Tage im Programm-Filter (".day-btn"), z.B. für Reset-/Smart-Default-
// Tests - nicht zu verwechseln mit der Tages-Auswahl im Auswertung-Tab
// (".ausw-day-btn", siehe selectAuswertungDays oben).
function activeDays(d) {
  return [...d.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day);
}

// Künstlernamen in der aktuell gerenderten Programm-Liste, in DOM-Reihenfolge.
function namesInList(d) {
  return [...d.querySelectorAll('.prog-name')].map(el => el.textContent);
}

// ── Gemeinsame Test-Werkzeuge für Programm-/Dialog-Tests ────────────────────
// Früher in vielen Testdateien einzeln definiert (ev, fire, sleep, viewVisible,
// progRow/row, ridOf, detailOpen, Setup "alle Tage aktiv", Fake-Layout). Die
// Werkzeuge sind an das jeweilige Fenster w und Dokument d gebunden:
//   const H = createHelpers(w, d);
//   const { ev, fire, progRow } = H;
function createHelpers(w, d) {
  const ev = code => w.eval(code);
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const viewVisible = tab => !d.getElementById(`view-${tab}`).classList.contains('hidden');
  const chipVisible = () => d.getElementById('jumpBackChip').style.display !== 'none';
  // Programm-Zeile zu einem Auftritts-Schlüssel (z. B. 'nid:1'); undefined, wenn nicht in der Liste
  const progRow = skey => [...d.querySelectorAll('#progList .prog-item')].find(el => el.dataset.skey === skey);
  // Zeilen-Id (rid) aus dem Zeilen-Element bzw. direkt aus dem Auftritts-Schlüssel
  const ridOfRow = row => row.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  const ridOf = skey => ridOfRow(progRow(skey));
  // Ist die Detailansicht der Zeile aufgeklappt? (false, wenn die Zeile nicht in der Liste steht)
  const detailOpen = skey => { const r = progRow(skey); return !!r && !d.getElementById(`${ridOfRow(r)}-detail`).classList.contains('collapsed'); };
  // Standard-Setup: Programm-Liste mit allen Tagen und ab 08:00 aufbauen.
  //   reset: erst w.resetProgFilters(); switchTab: erst zum Programm-Tab wechseln;
  //   clearTimeTo: "Bis"-Zeit leeren
  const showAllProg = ({ reset = false, switchTab = false, clearTimeTo = false } = {}) => {
    if (reset) w.resetProgFilters();
    if (switchTab) w.switchTab('programm');
    d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
    d.getElementById('timeFrom').value = '08:00';
    if (clearTimeTo) d.getElementById('timeTo').value = '';
    w.renderProg();
  };
  // jsdom liefert überall Null-Rects. Simuliert ein einfaches Layout für Scroll-Tests: die
  // Listen sind listHeight hoch, ihre Kinder rowHeight hoch und in DOM-Reihenfolge gestapelt;
  // scrollTop der Listen ist frei setzbar. Gibt die Listen-Elemente zurück.
  const installFakeLayout = (listIds = ['artistList', 'progList'], rowHeight = 100, listHeight = 600) => {
    const lists = listIds.map(id => d.getElementById(id));
    lists.forEach(l => { let st = 0; Object.defineProperty(l, 'scrollTop', { get: () => st, set: v => { st = v; }, configurable: true }); });
    w.Element.prototype.getBoundingClientRect = function () {
      const mk = (top, h) => ({ top, bottom: top + h, left: 0, right: 300, width: 300, height: h });
      if (lists.includes(this)) return mk(0, listHeight);
      const p = this.parentElement;
      if (p && lists.includes(p)) return mk([...p.children].indexOf(this) * rowHeight - p.scrollTop, rowHeight);
      return mk(0, 0);
    };
    return lists;
  };
  return { ev, fire, sleep, viewVisible, chipVisible, progRow, ridOfRow, ridOf, detailOpen, showAllProg, installFakeLayout };
}

module.exports = { createHelpers, loadApp, reloadWithState, createChecker, INDEX_HTML_PATH, DEFAULT_DATA_PATH, ALL_DAYS, auswBlock, selectAuswertungDays, mockRowLayout, refHaversineMeters, refFormatMeters, activeDays, namesInList };

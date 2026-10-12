// ── js/02-storage.js ── localStorage, Filter-Persistenz, PWA-Registrierung ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('02-storage');

// ── LOCALSTORAGE ─────────────────────────────────────────────────────────────
// Zähler für "Daten haben sich geändert": wird bei JEDEM Speichern erhöht und
// dient (zusammen mit Filtern/Einstellungen) der Erkennung, ob die Programm-
// Liste beim Tabwechsel neu aufgebaut werden muss (siehe progListStale()).
let stateVersion = 0;


// ── SPEICHER-SCHEMA (Hauptdaten) ─────────────────────────────────────────────
// Das Speicherformat (localStorage-Key LS_KEY) ist bewusst unverändert geblieben:
// bestehende Speicherstände und Exporte müssen weiter lesbar sein. Neu ist nur,
// dass Speichern und Laden aus denselben Tabellen kommen statt aus zwei
// getrennt gepflegten Listen.
//
// Ein Künstler-Eintrag im Speicherstand (Kurzschlüssel). Die REIHENFOLGE ist Teil
// des Formats (JSON-Schlüsselreihenfolge) - nicht umsortieren.
const ARTIST_RECORD_SAVE = [
  ['n', d => d.name],
  ['rp', d => d.rp],
  ['rl', d => d.rl],
  ['s', d => d.gesehen],
  ['u', d => d.customUrl],
  ['manual', d => d.manual || false],
  ['edited', d => d.edited || false],
  ['genre', d => d.genre],
  ['herkunft', d => d.herkunft],
  ['geschlecht', d => d.geschlecht],
  ['rbfUrl', d => d.rbfUrl],
  ['h', d => d.ausgeblendet || false],
  ['c', d => d.kommentar || ''],
  ['rh', d => d.reinhoeren || false],
];
// Beim Laden: Eigenschaft in dataMap <- Wert aus dem Speicherstand (mit Begrenzung/Standardwert)
const ARTIST_RECORD_LOAD = [
  ['rp', r => Math.min(r.rp || 0, MAX)],
  ['rl', r => Math.min(r.rl || 0, MAX)],
  ['gesehen', r => r.s || ''],
  ['customUrl', r => r.u || ''],
  ['manual', r => r.manual || false],
  ['edited', r => r.edited || false],
  ['ausgeblendet', r => r.h || false],
  ['kommentar', r => (r.c || '').slice(0, MAX_COMMENT_LEN)],
  ['reinhoeren', r => r.rh || false],
];
function artistToRecord(d) {
  return Object.fromEntries(ARTIST_RECORD_SAVE.map(([key, get]) => [key, get(d)]));
}
function applyArtistRecord(target, r) {
  ARTIST_RECORD_LOAD.forEach(([prop, get]) => { target[prop] = get(r); });
}
// Nur Künstler mit mindestens einer Nutzer-Änderung werden gespeichert.
function artistHasUserData(d) {
  return d.rp > 0 || d.rl > 0 || d.gesehen || d.customUrl || d.manual || d.ausgeblendet || d.kommentar || d.reinhoeren;
}
// Von Hand angelegter Künstler (nicht in RAW), beim Laden wiederhergestellt.
function newManualArtist(name, r) {
  return { name: name, genre: r.genre || '', herkunft: r.herkunft || '', geschlecht: r.geschlecht || 'mixed', rbfUrl: r.rbfUrl || '', rp: 0, rl: 0, gesehen: '', customUrl: '', manual: true, edited: false, ausgeblendet: false, kommentar: '', reinhoeren: false };
}
// Weitere Teile des Hauptspeicherstands: Schlüssel im Speicherstand + Zugriff auf die
// jeweilige Variable. Reihenfolge = Reihenfolge im gespeicherten JSON. Beim Laden wird nur
// übernommen, was vorhanden (truthy) ist; die Einstellungen werden mit den Standardwerten verschmolzen.
const PERSISTED_STATE = [
  { key: 'showRatings', get: () => showRatings, set: v => { showRatings = v; } },
  { key: 'showDurations', get: () => showDurations, set: v => { showDurations = v; } },
  { key: 'planFlags', get: () => planFlags, set: v => { planFlags = v; } },
  { key: 'hiddenEvents', get: () => hiddenEvents, set: v => { hiddenEvents = v; } },
  { key: 'settings', get: () => appSettings, set: v => { appSettings = { ...appSettings, ...v }; } },
];

function saveToStorage() {
  stateVersion++;
  try {
    const payload = Object.values(dataMap).filter(artistHasUserData).map(artistToRecord);
    const auftrittePayload = auftritte.length ? auftritte : [];
    const data = { ratings: payload, auftritte: auftrittePayload, auftritteVersion: DATA_VERSION };
    PERSISTED_STATE.forEach(p => { data[p.key] = p.get(); });
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    document.getElementById('saveIndicator').textContent = '✓ gespeichert';
    setTimeout(() => document.getElementById('saveIndicator').textContent = '', 2000);
  } catch(e) { safeLog('Storage error', e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.ratings) {
      // Case-insensitive Fallback-Suche: wird nur gebraucht, wenn sich NUR die
      // Groß-/Kleinschreibung eines Namens geändert hat (z.B. "Meller" ->
      // "MELLER" in einem rbf-data.js-Update). dataMap wird bei jedem Start
      // komplett neu aus den aktuellen Daten aufgebaut - ein gespeicherter
      // Eintrag mit dem ALTEN Namen fände sonst keinen exakten Treffer mehr
      // und Bewertung/Gesehen-Status würden beim nächsten Speichern
      // stillschweigend verloren gehen. Nur bei GENAU einem Treffer greifen -
      // bei mehreren möglichen Kandidaten lieber nichts automatisch
      // zuordnen, als eventuell den falschen Künstler zu treffen.
      const lowerCaseIndex = new Map();
      Object.keys(dataMap).forEach(name => {
        const key = name.toLowerCase();
        lowerCaseIndex.set(key, (lowerCaseIndex.get(key) || 0) + 1 === 1 ? name : null);
      });
      data.ratings.forEach(r => {
        let targetName = r.n;
        if (!dataMap[targetName] && !r.manual) {
          const match = lowerCaseIndex.get((r.n || '').toLowerCase());
          if (match) {
            safeLog(`Künstlername "${r.n}" nicht mehr gefunden, aber eindeutige Schreibweisen-Änderung erkannt -> Bewertung/Status auf "${match}" übertragen.`);
            targetName = match;
          }
        }
        // restore manual artists that aren't in RAW
        if (!dataMap[targetName] && r.manual) dataMap[targetName] = newManualArtist(targetName, r);
        if (dataMap[targetName]) applyArtistRecord(dataMap[targetName], r);
      });
    }
    if (data.auftritte && data.auftritte.length) {
      if (data.auftritteVersion === DATA_VERSION) {
        auftritte = data.auftritte;
        updateLocFilter();
      } else {
        // Gespeicherter Stand ist älter als der aktuelle Code-Stand (neues Auftritte-
        // Update wurde ausgeliefert) -> verwerfen, es bleibt bei den frischen
        // RAW_AUFTRITTE-Daten (auftritte wurde bereits mit defaultAuftritte() befüllt).
        safeLog(`Auftrittsdaten-Update erkannt (${data.auftritteVersion || 'unbekannt'} -> ${DATA_VERSION}), alter lokaler Stand verworfen.`);
      }
    }
    PERSISTED_STATE.forEach(p => { if (data[p.key]) p.set(data[p.key]); });
  } catch(e) { safeLog('Load error', e); }
}

// ── FILTER-PERSISTENZ ─────────────────────────────────────────────────────────
// Speichert alle Filter-Einstellungen (Künstler- UND Programm-Übersicht) unter
// einem eigenen, kleinen localStorage-Key - bewusst getrennt vom Haupt-Payload
// (Bewertungen/Kommentare/Auftrittsdaten), damit jede Filteränderung (auch bei
// jedem Tastendruck in der Suche) nicht jedes Mal den kompletten, potenziell
// großen Datenbestand neu schreiben muss. Wird zentral am Ende von render()
// und renderProg() aufgerufen, deckt also automatisch jede Filteränderung ab,
// ohne dass jede einzelne Filter-Bedienstelle das selbst anstoßen müsste.
const LS_FILTERS_KEY = 'rbf2027_filters_v1';
// Die Filter-Felder als Tabelle: Schlüssel im Speicherstand (Reihenfolge = JSON-Reihenfolge),
// erwarteter Typ beim Laden und Lesen/Schreiben des jeweiligen Zustands. Typ passt nicht
// -> Feld wird beim Laden übersprungen. Mengen/Arrays werden beim Laden ERGÄNZT (nicht ersetzt).
const filterField = (key, type, read, write) => ({ key, type, read, write });
const filterInput = (key, id) => filterField(key, 'string', () => document.getElementById(id).value, v => { document.getElementById(id).value = v; });
const filterCheck = (key, id) => filterField(key, 'boolean', () => document.getElementById(id).checked, v => { document.getElementById(id).checked = v; });
// getSet: Funktion, die die Menge liefert (die Variable könnte neu zugewiesen werden)
const filterSet = (key, getSet) => filterField(key, 'array', () => [...getSet()], arr => arr.forEach(x => getSet().add(x)));
const FILTER_FIELDS = [
  filterInput('search', 'search'),
  filterInput('fGender', 'fGender'),
  filterField('kuenstlerSeenFilter', 'string', () => kuenstlerSeenFilter, v => { kuenstlerSeenFilter = v; }),
  filterSet('selectedGenres', () => selectedGenres),
  filterInput('fHerkunft', 'fHerkunft'),
  filterInput('fSoundRef', 'fSoundRef'),
  filterField('fHidden', 'boolean', () => statsAusgeblendetFilter, v => { statsAusgeblendetFilter = v; }),
  filterField('kuenstlerAvgFilter', 'number', () => kuenstlerAvgFilter, v => { kuenstlerAvgFilter = v; }),
  filterField('statsBewertetFilter', 'boolean', () => statsBewertetFilter, v => { statsBewertetFilter = v; }),
  filterField('statsUnbewertetFilter', 'boolean', () => statsUnbewertetFilter, v => { statsUnbewertetFilter = v; }),
  filterField('statsReinhoerenFilter', 'boolean', () => statsReinhoerenFilter, v => { statsReinhoerenFilter = v; }),
  filterField('activeDays', 'array',
    () => [...document.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day),
    arr => document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', arr.includes(b.dataset.day)))),
  filterInput('timeFrom', 'timeFrom'),
  filterInput('timeTo', 'timeTo'),
  filterSet('selectedLocs', () => selectedLocs),
  filterSet('progSelectedGenres', () => progSelectedGenres),
  filterField('progRatingFilter', 'number', () => progRatingFilter, v => { progRatingFilter = v; }),
  filterField('progShowRatingFilter', 'number', () => progShowRatingFilter, v => { progShowRatingFilter = v; }),
  filterInput('fProgStatus', 'fProgStatus'),
  filterCheck('fProgDuration', 'fProgDuration'),
  filterCheck('fProgPlanned', 'fProgPlanned'),
  filterCheck('progShowHidden', 'progShowHidden'),
];
const filterTypeOk = (type, v) => type === 'array' ? Array.isArray(v) : typeof v === type;
function saveFilterState() {
  if (!appSettings.persistFilters) return;
  try {
    const state = {};
    FILTER_FIELDS.forEach(f => { state[f.key] = f.read(); });
    localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(state));
  } catch (e) { safeLog('Filter-Speichern fehlgeschlagen:', e); }
}
// Stellt alle gespeicherten Filter-Einstellungen wieder her. Wird einmalig
// beim App-Start aufgerufen, NACH updateTagFilters()/buildTimeDropdowns()
// (damit die betroffenen <select>-Optionen/Tag-Buttons schon existieren) und
// VOR dem ersten render(). Setzt smartProgDefaultsApplied, damit der
// "automatisch auf 'jetzt' springen"-Mechanismus einen wiederhergestellten
// Zustand nicht sofort wieder überschreibt.
function loadFilterState() {
  if (!appSettings.persistFilters) return;
  try {
    const raw = localStorage.getItem(LS_FILTERS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    FILTER_FIELDS.forEach(f => { if (filterTypeOk(f.type, s[f.key])) f.write(s[f.key]); });
    document.getElementById('searchClear').style.display = document.getElementById('search').value ? 'flex' : 'none';
    smartProgDefaultsApplied = true;
  } catch (e) { safeLog('Filter-Laden fehlgeschlagen:', e); }
}
// Stellt alle gespeicherten Filter-Einstellungen wieder her. Wird einmalig
// beim App-Start aufgerufen, NACH updateTagFilters()/buildTimeDropdowns()
// (damit die betroffenen <select>-Optionen/Tag-Buttons schon existieren) und
// VOR dem ersten render(). Setzt smartProgDefaultsApplied, damit der
// "automatisch auf 'jetzt' springen"-Mechanismus einen wiederhergestellten
// Zustand nicht sofort wieder überschreibt.

// ── PWA REGISTRATION ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(e => safeLog('SW:', e));
}

// ── TABS ─────────────────────────────────────────────────────────────────────

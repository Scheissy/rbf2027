// ── js/02-storage.js ── localStorage, Filter-Persistenz, PWA-Registrierung ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('02-storage');

// ── LOCALSTORAGE ─────────────────────────────────────────────────────────────
// Zähler für "Daten haben sich geändert": wird bei JEDEM Speichern erhöht und
// dient (zusammen mit Filtern/Einstellungen) der Erkennung, ob die Programm-
// Liste beim Tabwechsel neu aufgebaut werden muss (siehe progListStale()).
let stateVersion = 0;
function saveToStorage() {
  stateVersion++;
  try {
    const payload = Object.values(dataMap)
      .filter(d => d.rp > 0 || d.rl > 0 || d.gesehen || d.customUrl || d.manual || d.ausgeblendet || d.kommentar || d.reinhoeren)
      .map(d => ({ n: d.name, rp: d.rp, rl: d.rl, s: d.gesehen, u: d.customUrl, manual: d.manual||false, edited: d.edited||false, genre: d.genre, herkunft: d.herkunft, geschlecht: d.geschlecht, rbfUrl: d.rbfUrl, h: d.ausgeblendet||false, c: d.kommentar||'', rh: d.reinhoeren||false }));
    const auftrittePayload = auftritte.length ? auftritte : [];
    localStorage.setItem(LS_KEY, JSON.stringify({ ratings: payload, auftritte: auftrittePayload, auftritteVersion: DATA_VERSION, showRatings, showDurations, planFlags, hiddenEvents, settings: appSettings }));
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
        if (!dataMap[targetName] && r.manual) {
          dataMap[targetName] = { name:targetName, genre:r.genre||'', herkunft:r.herkunft||'', geschlecht:r.geschlecht||'mixed', rbfUrl:r.rbfUrl||'', rp:0, rl:0, gesehen:'', customUrl:'', manual:true, edited:false, ausgeblendet:false, kommentar:'', reinhoeren:false };
        }
        if (dataMap[targetName]) {
          dataMap[targetName].rp = Math.min(r.rp || 0, MAX);
          dataMap[targetName].rl = Math.min(r.rl || 0, MAX);
          dataMap[targetName].gesehen = r.s || '';
          dataMap[targetName].customUrl = r.u || '';
          dataMap[targetName].manual = r.manual || false;
          dataMap[targetName].edited = r.edited || false;
          dataMap[targetName].ausgeblendet = r.h || false;
          dataMap[targetName].kommentar = (r.c || '').slice(0, MAX_COMMENT_LEN);
          dataMap[targetName].reinhoeren = r.rh || false;
        }
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
    if (data.showRatings) showRatings = data.showRatings;
    if (data.showDurations) showDurations = data.showDurations;
    if (data.planFlags) planFlags = data.planFlags;
    if (data.hiddenEvents) hiddenEvents = data.hiddenEvents;
    if (data.settings) appSettings = { ...appSettings, ...data.settings };
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
function saveFilterState() {
  if (!appSettings.persistFilters) return;
  try {
    const state = {
      search: document.getElementById('search').value,
      fGender: document.getElementById('fGender').value,
      kuenstlerSeenFilter,
      selectedGenres: [...selectedGenres],
      fHerkunft: document.getElementById('fHerkunft').value,
      fSoundRef: document.getElementById('fSoundRef').value,
      fHidden: statsAusgeblendetFilter,
      kuenstlerAvgFilter,
      statsBewertetFilter,
      statsUnbewertetFilter,
      statsReinhoerenFilter,
      activeDays: [...document.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day),
      timeFrom: document.getElementById('timeFrom').value,
      timeTo: document.getElementById('timeTo').value,
      selectedLocs: [...selectedLocs],
      progSelectedGenres: [...progSelectedGenres],
      progRatingFilter,
      progShowRatingFilter,
      fProgStatus: document.getElementById('fProgStatus').value,
      fProgDuration: document.getElementById('fProgDuration').checked,
      fProgPlanned: document.getElementById('fProgPlanned').checked,
      progShowHidden: document.getElementById('progShowHidden').checked
    };
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
    if (typeof s.search === 'string') document.getElementById('search').value = s.search;
    document.getElementById('searchClear').style.display = document.getElementById('search').value ? 'flex' : 'none';
    if (typeof s.fGender === 'string') document.getElementById('fGender').value = s.fGender;
    if (typeof s.kuenstlerSeenFilter === 'string') kuenstlerSeenFilter = s.kuenstlerSeenFilter;
    if (Array.isArray(s.selectedGenres)) s.selectedGenres.forEach(g => selectedGenres.add(g));
    if (typeof s.fHerkunft === 'string') document.getElementById('fHerkunft').value = s.fHerkunft;
    if (typeof s.fSoundRef === 'string') document.getElementById('fSoundRef').value = s.fSoundRef;
    if (typeof s.fHidden === 'boolean') statsAusgeblendetFilter = s.fHidden;
    if (typeof s.kuenstlerAvgFilter === 'number') kuenstlerAvgFilter = s.kuenstlerAvgFilter;
    if (typeof s.statsBewertetFilter === 'boolean') statsBewertetFilter = s.statsBewertetFilter;
    if (typeof s.statsUnbewertetFilter === 'boolean') statsUnbewertetFilter = s.statsUnbewertetFilter;
    if (typeof s.statsReinhoerenFilter === 'boolean') statsReinhoerenFilter = s.statsReinhoerenFilter;
    if (Array.isArray(s.activeDays)) {
      document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', s.activeDays.includes(b.dataset.day)));
    }
    if (typeof s.timeFrom === 'string') document.getElementById('timeFrom').value = s.timeFrom;
    if (typeof s.timeTo === 'string') document.getElementById('timeTo').value = s.timeTo;
    if (Array.isArray(s.selectedLocs)) s.selectedLocs.forEach(l => selectedLocs.add(l));
    if (Array.isArray(s.progSelectedGenres)) s.progSelectedGenres.forEach(g => progSelectedGenres.add(g));
    if (typeof s.progRatingFilter === 'number') progRatingFilter = s.progRatingFilter;
    if (typeof s.progShowRatingFilter === 'number') progShowRatingFilter = s.progShowRatingFilter;
    if (typeof s.fProgStatus === 'string') document.getElementById('fProgStatus').value = s.fProgStatus;
    if (typeof s.fProgDuration === 'boolean') document.getElementById('fProgDuration').checked = s.fProgDuration;
    if (typeof s.fProgPlanned === 'boolean') document.getElementById('fProgPlanned').checked = s.fProgPlanned;
    if (typeof s.progShowHidden === 'boolean') document.getElementById('progShowHidden').checked = s.progShowHidden;
    smartProgDefaultsApplied = true;
  } catch (e) { safeLog('Filter-Laden fehlgeschlagen:', e); }
}

// ── PWA REGISTRATION ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(e => safeLog('SW:', e));
}

// ── TABS ─────────────────────────────────────────────────────────────────────

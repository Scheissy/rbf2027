// ── js/01-data.js ── Daten, Hilfsfunktionen, Sonderveranstaltungen (RBF_EVENTS) ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('01-data');

// ── DATA ────────────────────────────────────────────────────────────────────


const LS_KEY = 'rbf2027_v1';
// Manche eingebetteten Browser (z.B. In-App-Browser von Social-Media-Apps) haben
// kein vollständiges console-Objekt (console.info/warn fehlen oder sind keine
// Funktion). Damit sowas nie die eigentliche App-Logik unterbricht, laufen alle
// Debug-Ausgaben über diese abgesicherte Wrapper-Funktion statt direkt console.*.
function safeLog(...args) {
  try { (console.log || (() => {}))(...args); } catch (e) {}
}
// Escaped einen String für die sichere Einbettung in einfach gequotete
// JS-String-Literale innerhalb von onclick-Attributen, z.B.
// onclick="foo('${escJs(name)}')" - überall dort nötig, wo Künstlernamen,
// Locations oder URLs (die selbst Apostrophe enthalten können, z.B. "Dov'è
// Liana") in generiertes HTML eingebettet werden.
function escJs(str) {
  return String(str).replace(/'/g, "\\'");
}

const MAX = 5;
const MAX_COMMENT_LEN = 250;
// Nur echte Web-Links (http/https) werden als externer Link übernommen - alles
// andere (leer, javascript:, Müll) wird verworfen.
function cleanExternalUrl(u) {
  const v = typeof u === 'string' ? u.trim() : '';
  // Anführungszeichen, Backslash und spitze Klammern gehören (unkodiert) nicht in
  // eine URL und würden das generierte HTML/JS stören -> verwerfen.
  return /^https?:\/\/[^\s"'<>\\]+$/i.test(v) ? v : '';
}
let dataMap = {};
RAW.forEach(r => {
  // RAW-Zeile: [Name, Genre, Herkunft, Geschlecht, RBF-URL, (optional) Discogs-URL]
  dataMap[r[0]] = { name:r[0], genre:r[1], herkunft:r[2], geschlecht:r[3], rbfUrl:r[4], discogsUrl:cleanExternalUrl(r[5]), rp:0, rl:0, gesehen:'', customUrl:'', manual:false, ausgeblendet:false, kommentar:'', reinhoeren:false };
});
// Von der offiziellen RBF-API übernommene (Teil-)Programmdaten: [Künstler, Tag, Zeit, Ende, Location]
// Zeit/Location sind leer ('') = vom Festival noch nicht final bestätigt (TBA).

function defaultAuftritte() {
  return RAW_AUFTRITTE.map(r => ({ name:r[0], day:r[1], time:r[2], endTime:r[3], location:r[4], nid:r[5] }));
}
let auftritte = defaultAuftritte();
let expandedRows = new Set();
let smartProgDefaultsApplied = false;
let progRatingFilter = 0; // Mindestbewertung im Programm-Filter (0 = alle)
// Auftritts-Bewertung: hängt an der konkreten Show (Tag+Zeit+Location), nicht am Künstler.
// Fließt bewusst NICHT in den Künstler-Bewertungsdurchschnitt (rp/rl) ein.
let showRatings = {};
// Auftritts-Dauer: wie lange der Auftritt tatsächlich verfolgt wurde, in
// 15-Minuten-Schritten von 0 bis 120 Minuten. Wie showRatings pro konkreter
// Show (showKey) gespeichert, nicht pro Künstler. Fehlt ein Key, wurde für
// diesen Auftritt keine Dauer eingetragen ("keine Angabe" != "0 Minuten").
let showDurations = {};
// Plan-Flag: markiert einzelne Auftritte (nicht Künstler!) als "das will ich
// mir vornehmen/einplanen" - unabhängig von Bewertung/Dauer/Gesehen-Status.
// Wie showRatings/showDurations pro konkreter Show (showKey) gespeichert.
// Fehlender Key = nicht markiert.
let planFlags = {};

// Ausgeblendete Sonderveranstaltungen: analog zu d.ausgeblendet bei Künstlern,
// aber pro Event (nicht pro Künstler) - da Events keinen eigenen dataMap-
// Eintrag haben, hier separat über das synthetische nid (z.B. "evt-0")
// gespeichert. Fehlender Key = nicht ausgeblendet (wie bei planFlags).
let hiddenEvents = {};

// ── RBF_EVENTS (Sonderveranstaltungen) ──────────────────────────────────────
// RBF_EVENTS kommt aus rbf-data.js: Veranstaltungen ohne einzelnen Künstler-
// Auftritt im klassischen Sinn (Award-Shows, Eröffnungsfeier, Podcasts etc.),
// die deshalb NICHT in RAW_AUFTRITTE stehen. Werden hier in ein zu
// RAW_AUFTRITTE-Einträgen kompatibles Format gebracht (inkl. synthetischer
// "nid", damit showKey()/Bewertung/Dauer/Plan-Flag ohne Sonderfall
// funktionieren) und NUR in der Programm-Übersicht mit angezeigt - die
// Künstler-Übersicht bleibt davon komplett unberührt, da "auftritte" selbst
// nicht verändert wird.
let rbfEvents = [];
function buildRbfEvents() {
  if (typeof RBF_EVENTS === 'undefined' || !Array.isArray(RBF_EVENTS)) { rbfEvents = []; return; }
  rbfEvents = RBF_EVENTS.map((e, i) => ({
    name: e.name,
    day: e.day,
    time: e.time || '',
    endTime: e.endTime || '',
    location: e.location || '',
    acts: Array.isArray(e.acts) ? e.acts : [],
    kategorie: e.kategorie === 'Musik' ? 'Musik' : 'Sonstiges',
    url: e.url || '',
    nid: `evt-${i}`,
    isEvent: true
  }));
}
// Gemeinsame Basis für alles, was in der Programm-Übersicht auftauchen soll -
// reguläre Auftritte UND Sonderveranstaltungen zusammen. Wird von der
// Filterlogik, der Location-Verwaltung und dem Location-Filter genutzt, damit
// Events dort konsistent mit einbezogen werden.
function allProgEntries() {
  const visibleEvents = rbfEvents.filter(e =>
    (e.kategorie !== 'Musik' || appSettings.showMusicEvents) &&
    (e.kategorie !== 'Sonstiges' || appSettings.showOtherEvents)
  );
  return auftritte.concat(visibleEvents);
}
let progShowRatingFilter = 0; // Mindest-Auftrittsbewertung im Programm-Filter (0 = alle)
let kuenstlerAvgFilter = 0; // Mindest-Durchschnittsbewertung im Künstlerübersicht-Filter (0 = alle)
let statsBewertetFilter = false; // "Nur bewertete Künstler" - über Klick auf Stat-Zeile "Bewertet"
let statsUnbewertetFilter = false; // "Nur unbewertete Künstler" (kein Promo-Rating) - über Klick auf Stat-Zeile "Unbewertet"
let statsReinhoerenFilter = false; // "Nur zum Reinhören markierte Künstler" - über Klick auf Stat-Zeile "Reinhören"
// "Nur ausgeblendete Künstler" - über Klick auf Stat-Zeile "Ausgeblendet".
// Ersetzt das frühere dreistufige Dropdown (Sichtbare/Ausgeblendete/Alle):
// Standard (false) blendet ausgeblendete Künstler weiterhin aus (wie vorher
// "Sichtbare"), aktiv (true) zeigt NUR die ausgeblendeten. Die dritte Option
// "Alle" gibt es bewusst nicht mehr - passt sich damit dem Verhalten der
// übrigen Schnell-Filter-Kacheln an.
let statsAusgeblendetFilter = false;
// Gesehen-Status-Filter: seit Einführung der Schnell-Filter-Kacheln
// "Gesehen"/"Bekannt"/"Unbekannt" in der Statistik-Leiste gibt es dafür kein
// eigenes Dropdown mehr (spart Platz in der Filter-Leiste) - der Zustand
// lebt jetzt rein hier, gesetzt/zurückgesetzt über filterByStat().
let kuenstlerSeenFilter = '';
// Anzeige-Einstellungen (Settings-Tab), geräteweise in localStorage gespeichert
let appSettings = { showMapsLinks: true, showListening: true, showSoundRef: true, hiddenLocations: [], persistFilters: true, showMusicEvents: true, showOtherEvents: true, progFiltersExpanded: false, showRbfEvents: true, auswertungSort: 'count', backChipMode: 'time', backChipSeconds: 15, durationInputMode: 'minutes' };
let selectedGenres = new Set(); // Mehrfachauswahl im Genre-Filter (leer = alle)
let selectedLocs = new Set(); // Mehrfachauswahl im Location-Filter der Programm-Übersicht (leer = alle)
// Eigener Genre-Mehrfachfilter für die Programm-Übersicht - analog zum
// Genre-Filter der Künstler-Übersicht (gleiches UI-Muster über
// makeMultiSelectFilter), aber bewusst mit eigenem Auswahl-Zustand statt
// geteilt mit "selectedGenres", damit die beiden Tabs sich nicht gegenseitig
// beeinflussen (genau wie der Location-Filter, der auch nur im Programm-Tab existiert).
let progSelectedGenres = new Set();
let locFilterOptions = []; // aktuell (nach Tag/Uhrzeit) verfügbare Locations fürs Modal
let allGenreTags = []; // aktuell vorkommende Genre-Tags, alphabetisch sortiert

function showKey(a) {
  if (a.nid !== undefined && a.nid !== null) return `nid:${a.nid}`;
  return `${a.name}|${a.day}|${a.time}|${a.location}`;
}

let currentTab = 'kuenstler';
let sortCol = 'name', sortDir = 1;


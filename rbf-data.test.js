// ── TEST-DATEN (rbf-data.js) ────────────────────────────────────────────────
// Nur zum lokalen Testen von index.html/sw.js – KEINE echten RBF2027-Daten.
// Deckt bewusst mehrere Sonderfälle ab: alle vier Geschlechter-Badges,
// Mehrfach-Genre ("A / B"), TBA-Auftritt (Zeit/Location leer), einen
// Auftritt nach Mitternacht (00:10 – testet timeSortValue()) sowie eine
// Location, die NICHT in VENUE_LOCATIONS steht (testet den Maps-Fallback).

const DATA_VERSION = 'test-1';

const DAY_ORDER = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];

// [Name, Genre, Herkunft, Geschlecht, RBF-Link]
const RAW = [
  ['Nova Frequenz',          'Electro / Pop',    'Berlin, DE',  'weiblich',      'https://example.org/artist/nova-frequenz'],
  ['Stahl & Beton',          'Techno',            'Hamburg, DE', 'männlich',      'https://example.org/artist/stahl-beton'],
  ['Kollektiv Nachtfalter',  'Indie / Alternative','Leipzig, DE','mixed',  'https://example.org/artist/kollektiv-nachtfalter'],
  ['Rosa Mercur',            'Pop',               'Wien, AT',    'divers', 'https://example.org/artist/rosa-mercur'],
  ['Blau Neon',              'Synthwave',         'Köln, DE',    'weiblich',      'https://example.org/artist/blau-neon'],
  ['Grauzone Sieben',        'Hip-Hop',           'Frankfurt, DE','männlich',     'https://example.org/artist/grauzone-sieben'],
  ['Funkeninsel',            'Reggae / Dub',      'Bremen, DE',  'mixed',  'https://example.org/artist/funkeninsel'],
  ['Lila Oktober',           'Folk',              'Hamburg, DE', 'weiblich',      'https://example.org/artist/lila-oktober'],
  ['Nordlicht Prozession',   'Post-Rock',         'Kiel, DE',    'mixed',  'https://example.org/artist/nordlicht-prozession'],
  ['DJ Mitternacht',         'Techno / House',    'Hamburg, DE', 'männlich',      'https://example.org/artist/dj-mitternacht'],
  // Bewusst mit Akzentzeichen im Namen (è) - testet die akzent-unabhängige
  // Suche (normalizeSearch()): "Dov'e Liana" (ohne Akzent) soll sie trotzdem finden.
  ["Dov'è Liana",            'Chanson / Pop',    'Italien, IT', 'weiblich',      'https://example.org/artist/dove-liana'],
];

// [Name, Tag, Zeit, Ende, Location, nid]
// Zeit/Location = '' bedeutet TBA (vom Festival noch nicht final bestätigt).
const RAW_AUFTRITTE = [
  ['Nova Frequenz',         'Mi 15.09', '20:00', '20:45', 'Docks',               1],
  ['Stahl & Beton',         'Mi 15.09', '22:00', '23:00', 'Molotow',             2],
  ['Kollektiv Nachtfalter', 'Do 16.09', '19:30', '20:15', 'Prinzenbar',          3],
  ['Rosa Mercur',           'Do 16.09', '21:00', '21:45', 'Docks',               4],
  ['Rosa Mercur',           'Fr 17.09', '',      '',      '',                    5], // TBA
  ['Blau Neon',             'Fr 17.09', '20:30', '21:15', 'Molotow',             6],
  ['Grauzone Sieben',       'Fr 17.09', '22:15', '23:00', 'Uebel & Gefährlich',  7],
  ['Funkeninsel',           'Sa 18.09', '18:00', '18:45', 'Fischauktionshalle',  8], // nicht in VENUE_LOCATIONS -> Fallback-Test
  ['Lila Oktober',          'Sa 18.09', '19:00', '19:40', 'Prinzenbar',          9],
  ['Nordlicht Prozession',  'Sa 18.09', '23:30', '00:15', 'Docks',              10],
  ['DJ Mitternacht',        'Sa 18.09', '00:10', '01:00', 'Molotow',            11], // nach Mitternacht -> muss NACH 23:30 einsortiert werden
  ["Dov'è Liana",           'Do 16.09', '18:30', '19:10', 'Prinzenbar',         12],
];

const VENUE_LOCATIONS = {
  'Docks':               { lat: 53.5497, lng: 9.9636 },
  'Molotow':              { address: 'Nobistor 14, 22767 Hamburg' },
  'Prinzenbar':           { lat: 53.5502, lng: 9.9622 },
  'Uebel & Gefährlich':   { address: 'Feldstraße 66, 22767 Hamburg' },
  // 'Fischauktionshalle' bewusst NICHT gelistet -> mapsUrl() muss auf
  // Namenssuche + ", Hamburg" zurückfallen.
};

// Namen der für den Anchor Award nominierten Künstler (aus den Teilnehmer-
// Daten via "_anchor_award_nominee"-Flag). Zum Testen zwei Beispiel-Namen.
const ANCHOR_AWARD_NOMINEES = ['Blau Neon', 'Nordlicht Prozession'];

// Soundreferenzen: einem Vergleichs-Act eine Kategorie-Kurzbeschreibung
// zuordnen. "Nova Frequenz" bewusst in ZWEI Einträgen, um den (seltenen aber
// möglichen) Mehrfach-Treffer-Fall zu testen.
const SOUND_REFERENCES = [
  { referenz: ['Robyn'], kategorie: 'Emotionaler, tanzbarer Elektro-Pop mit eingängigen Hooks', acts: ['Nova Frequenz', 'Blau Neon'] },
  { referenz: ['Beyoncé'], kategorie: "Kraftvolle R'n'B/Soul-Stimme mit Star-/Bühnenpotenzial", acts: ['Nova Frequenz'] },
];

// RBF_EVENTS: Sonderveranstaltungen ohne einzelnen Künstler-Auftritt (Award-
// Show, Talk/Podcast) - bewusst mit einem Act, der auch in RAW existiert
// (Nova Frequenz), einem, der NICHT existiert (Test für den Fallback), und
// einem Event ganz ohne acts.
// "Anchor Award Show" bewusst MIT url (testet die Veranstaltungs-Verlinkung),
// "RBF Podcast Live" bewusst OHNE url (testet den Fall ohne Link, kein Fehler).
const RBF_EVENTS = [
  { name: 'Anchor Award Show', day: 'Fr 17.09', time: '18:00', endTime: '19:30', location: 'St. Pauli Theater', acts: ['Nova Frequenz', 'Unbekannter Act'], kategorie: 'Musik', url: 'https://example.org/event/anchor-award-show' },
  { name: 'RBF Podcast Live', day: 'Do 16.09', time: '17:00', endTime: '17:45', location: 'Docks', acts: [], kategorie: 'Sonstiges' },
];

let lastAutoFixes = [];
let lastValidationIssues = [];

// Trimmt Whitespace in allen Textfeldern und entfernt exakte Duplikate im
// globalen `auftritte`-Array (das Array selbst lebt in index.html, wird hier
// nur mutiert). Nur Fälle ohne Interpretationsspielraum werden automatisch
// behoben – alles andere meldet validateAuftritte().
function autoFixAuftritte() {
  lastAutoFixes = [];
  if (typeof auftritte === 'undefined') return;
  auftritte.forEach(a => {
    ['name', 'day', 'time', 'endTime', 'location'].forEach(f => {
      if (typeof a[f] === 'string') {
        const trimmed = a[f].trim();
        if (trimmed !== a[f]) {
          lastAutoFixes.push(`Whitespace entfernt: ${f} bei "${a.name}"`);
          a[f] = trimmed;
        }
      }
    });
  });
  const seen = new Set();
  const before = auftritte.length;
  const deduped = auftritte.filter(a => {
    const key = `${a.name}|${a.day}|${a.time}|${a.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduped.length !== before) {
    lastAutoFixes.push(`${before - deduped.length} exakte Duplikat(e) entfernt`);
    auftritte.length = 0;
    auftritte.push(...deduped);
  }
}

// Prüft auf strukturelle Probleme (unbekannte Tage, kaputte Zeitformate,
// fehlende Maps-Einträge, Zeit-Überschneidungen). Schreibt das Ergebnis in
// lastValidationIssues und aktualisiert das Panel im Settings-Tab.
function validateAuftritte(silent) {
  lastValidationIssues = [];
  if (typeof auftritte !== 'undefined') {
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    auftritte.forEach(a => {
      if (a.day && !DAY_ORDER.includes(a.day)) {
        lastValidationIssues.push(`Unbekannter Tag "${a.day}" bei "${a.name}"`);
      }
      if (a.time && !timeRe.test(a.time)) {
        lastValidationIssues.push(`Ungültiges Zeitformat "${a.time}" bei "${a.name}"`);
      }
      if (a.location && !VENUE_LOCATIONS[a.location]) {
        lastValidationIssues.push(`Kein Maps-Eintrag für Location "${a.location}" (${a.name})`);
      }
    });
  }
  if (typeof updateValidationPanel === 'function') updateValidationPanel();
  if (!silent) safeLogSafe(`Datenqualität geprüft: ${lastAutoFixes.length} Auto-Fix(es), ${lastValidationIssues.length} offene Hinweis(e)`);
}

// Nutzt safeLog aus index.html falls vorhanden, sonst stiller No-Op-Fallback
// (safeLog ist erst nach dem Laden von rbf-data.js definiert, kann zum
// Zeitpunkt des Aufrufs hier aber bereits existieren, da alle Aufrufe erst
// nach dem vollständigen Laden beider Scripts erfolgen).
function safeLogSafe(msg) {
  if (typeof safeLog === 'function') safeLog(msg);
}

// Aktualisiert das Datenqualitäts-Panel im Settings-Tab (#validationPanel).
function updateValidationPanel() {
  const el = document.getElementById('validationPanel');
  if (!el) return;
  const fixesHtml = lastAutoFixes.length
    ? `<div style="margin-bottom:8px"><b>Automatisch behoben:</b><ul style="margin:4px 0 0 18px;padding:0">${lastAutoFixes.map(f => `<li>${f}</li>`).join('')}</ul></div>`
    : '';
  const issuesHtml = lastValidationIssues.length
    ? `<div><b>Offene Hinweise:</b><ul style="margin:4px 0 0 18px;padding:0">${lastValidationIssues.map(i => `<li>${i}</li>`).join('')}</ul></div>`
    : '<div style="opacity:.7">Keine offenen Hinweise ✓</div>';
  el.innerHTML = `<div style="font-size:12px;line-height:1.5;margin-top:8px">${fixesHtml}${issuesHtml}</div>`;
}

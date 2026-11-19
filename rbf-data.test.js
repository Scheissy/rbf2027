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
  ['Nova Frequenz',          'Electro / Pop',    'Berlin, DE',  'weiblich',      'https://example.org/artist/nova-frequenz', 'https://www.discogs.com/artist/123-Nova-Frequenz'],
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

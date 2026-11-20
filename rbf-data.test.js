// ── TEST-DATEN (rbf-data.js) ────────────────────────────────────────────────
// Nur zum lokalen Testen von index.html/sw.js – KEINE echten RBF2027-Daten.
// Deckt bewusst mehrere Sonderfälle ab: alle vier Geschlechter-Badges,
// Mehrfach-Genre ("A / B"), TBA-Auftritt (Zeit/Location leer), einen
// Auftritt nach Mitternacht (00:10 – testet timeSortValue()) sowie eine
// Location, die NICHT in VENUE_LOCATIONS steht (testet den Maps-Fallback).
// Herkunft = deutsche Ländernamen (wie in den echten Daten), Genres = echte Taxonomie, auch mit
// Schrägstrich im Label ("Hip-Hop/Rap", "Electronic/Live", "R'n'B/Soul"): " / " trennt, "/" nicht.
// Ab "Künstler 12" kommen Sonderfälle dazu (siehe Kommentare dort): GROSS-/Kleinschreibung, Ziffer am
// Anfang, Sonderzeichen, "The"/"MC"-Präfix, sehr langer Name, Namen die sich nur in Groß/Klein bzw.
// Akzent unterscheiden, Doppelauftritt am selben Tag, 15-Minuten- und 4-Stunden-Auftritt, Venues mit
// Präfix-Namen ("Hafen"/"Hafen Bar") und Sonderzeichen im Venue-Namen. Alles erfunden.

const DATA_VERSION = 'test-1';

const DAY_ORDER = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];

// [Name, Genre, Herkunft, Geschlecht, RBF-Link]
const RAW = [
  ['Nova Frequenz',          'Electronic/Live / Pop', 'Deutschland',  'weiblich',      'https://example.org/artist/nova-frequenz', 'https://www.discogs.com/artist/123-Nova-Frequenz'],
  ['Stahl & Beton',          'Electronic/DJ',     'Deutschland', 'männlich',      'https://example.org/artist/stahl-beton'],
  ['Kollektiv Nachtfalter',  'Indie / Alternative','Deutschland','mixed',  'https://example.org/artist/kollektiv-nachtfalter'],
  ['Rosa Mercur',            'Pop',               'Österreich',  'divers', 'https://example.org/artist/rosa-mercur'],
  ['Blau Neon',              'Electronic/Live',   'Deutschland / Frankreich', 'weiblich',      'https://example.org/artist/blau-neon'],
  ['Grauzone Sieben',        'Hip-Hop/Rap',       'Deutschland', 'männlich',     'https://example.org/artist/grauzone-sieben'],
  ['Funkeninsel',            'Global / Funk',     'Kap Verde',   'mixed',  'https://example.org/artist/funkeninsel'],
  ['Lila Oktober',           'Folk',              'UK',          'weiblich',      'https://example.org/artist/lila-oktober'],
  ['Nordlicht Prozession',   'Rock',              'Schweden / Norwegen', 'mixed',  'https://example.org/artist/nordlicht-prozession'],
  ['DJ Mitternacht',         'Electronic/DJ / Funk','Deutschland', 'männlich',      'https://example.org/artist/dj-mitternacht'],
  // Bewusst mit Akzentzeichen im Namen (è) - testet die akzent-unabhängige
  // Suche (normalizeSearch()): "Dov'e Liana" (ohne Akzent) soll sie trotzdem finden.
  ["Dov'è Liana",            'Singer-Songwriter / Pop', 'Italien',  'weiblich',      'https://example.org/artist/dove-liana'],

  // ── Sonderfälle (ab hier angehängt, bestehende Einträge oben bleiben unverändert) ──
  ['LAUTER LEISE',           'Punk',              'Deutschland', 'mixed',    'https://example.org/artist/lauter-leise'],                // komplett GROSS
  ['kleiner funkenflug',     'Singer-Songwriter', 'Schweiz',     'weiblich', 'https://example.org/artist/kleiner-funkenflug'],          // komplett klein, beginnt klein
  ['3 Takte Freiheit',       'Indie / Folk',      'Deutschland', 'männlich', 'https://example.org/artist/3-takte-freiheit'],            // Ziffer am Anfang
  ['M.O.N.D. (Live!)',       'Electronic/Live',   'Niederlande', 'mixed',    'https://example.org/artist/mond-live'],                   // Punkte, Klammern, "!"
  ['Zeit·Raum',              'Jazz',              'Dänemark',    'mixed',    'https://example.org/artist/zeit-raum'],                   // Mittelpunkt
  ['The Wunderlampen',       "R'n'B/Soul",        'UK',          'weiblich', 'https://example.org/artist/the-wunderlampen'],            // "The"-Präfix, Genre mit Apostroph + Schrägstrich
  ['MC Pegelstand',          'Hip-Hop/Rap / Funk','Deutschland', 'männlich', 'https://example.org/artist/mc-pegelstand'],               // "MC"-Präfix, Schrägstrich-Genre + Mehrfach
  ['Die Fabelhafte Welt der Nachtschwärmer und Mondlichtkapelle', 'Country', 'Deutschland / Österreich', 'mixed', 'https://example.org/artist/fabelhafte-welt'], // 7 Wörter, über 30 Zeichen
  // Zwei Namen, die sich nur in Groß-/Kleinschreibung unterscheiden (mit anderem Genre) ...
  ['Vesper Noir',            'Alternative',       'Frankreich',  'weiblich', 'https://example.org/artist/vesper-noir'],
  ['VESPER NOIR',            'Heavy Metal',       'Finnland',    'männlich', 'https://example.org/artist/vesper-noir-metal'],
  // ... und zwei, die sich nur im Akzent unterscheiden.
  ['Mélodie Océane',         "Pop / R'n'B/Soul",  'Frankreich',  'weiblich', 'https://example.org/artist/melodie-oceane'],
  ['Melodie Oceane',         'Global',            'Brasilien',   'weiblich', 'https://example.org/artist/melodie-oceane-global'],
  ['Tandem Orchester',       'Funk',              'Deutschland', 'mixed',    'https://example.org/artist/tandem-orchester'],            // zwei Auftritte am selben Tag
  ['Kurzschluss',            'Punk',              'Deutschland', 'männlich', 'https://example.org/artist/kurzschluss'],                 // 15-Minuten-Auftritt
  ['Marathon Sessions',      'Electronic/DJ',     'Deutschland', 'männlich', 'https://example.org/artist/marathon-sessions'],            // 4-Stunden-Auftritt
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

  // ── Sonderfälle (angehängt) ──
  ['LAUTER LEISE',          'Mi 15.09', '21:00', '21:30', 'Hafen',               13],
  ['Marathon Sessions',     'Mi 15.09', '15:00', '19:00', 'Hafen Bar',           14], // 4 Stunden
  ['kleiner funkenflug',    'Do 16.09', '20:00', '20:35', 'Hafen',               15],
  ['3 Takte Freiheit',      'Do 16.09', '22:15', '23:00', 'Kiez-Bühne® @ Hinterhof/Garten', 16],
  ['M.O.N.D. (Live!)',      'Do 16.09', '19:00', '19:30', 'Hafen Bar',           17],
  ['Mélodie Océane',        'Do 16.09', '21:30', '22:15', 'Prinzenbar',          18],
  ['Zeit·Raum',             'Fr 17.09', '21:45', '22:30', 'Prinzenbar',          19],
  ['Tandem Orchester',      'Fr 17.09', '18:00', '18:30', 'Prinzenbar',          20], // Doppelauftritt am selben Tag ...
  ['Tandem Orchester',      'Fr 17.09', '23:15', '23:50', 'Docks',               21], // ... anderer Zeitraum, andere Venue
  ['The Wunderlampen',      'Fr 17.09', '19:10', '19:55', 'Hafen',               22],
  ['Kurzschluss',           'Fr 17.09', '20:40', '20:55', 'Kiez-Bühne® @ Hinterhof/Garten', 23], // 15 Minuten
  ['Melodie Oceane',        'Fr 17.09', '17:20', '18:05', 'Molotow',             24],
  ['MC Pegelstand',         'Sa 18.09', '17:15', '17:50', 'Hafen Bar',           25],
  ['Die Fabelhafte Welt der Nachtschwärmer und Mondlichtkapelle', 'Sa 18.09', '21:00', '21:45', 'Molotow', 26],
  ['Vesper Noir',           'Sa 18.09', '19:30', '20:15', 'Hafen',               27],
  ['VESPER NOIR',           'Sa 18.09', '22:30', '23:20', 'Hafen Bar',           28],
];

const VENUE_LOCATIONS = {
  'Docks':               { lat: 53.5497, lng: 9.9636 },
  'Molotow':              { address: 'Nobistor 14, 22767 Hamburg' },
  'Prinzenbar':           { lat: 53.5502, lng: 9.9622 },
  'Uebel & Gefährlich':   { address: 'Feldstraße 66, 22767 Hamburg' },
  // Zwei Venues, bei denen der eine Name Präfix des anderen ist (Verwechslungs-/Substring-Test) ...
  'Hafen':                { lat: 53.5441, lng: 9.9702 },
  'Hafen Bar':            { lat: 53.5443, lng: 9.9706 },
  // ... und ein Venue-Name mit ®, @ und / (HTML-/Attribut-/URL-Behandlung).
  'Kiez-Bühne® @ Hinterhof/Garten': { address: 'Spielbudenplatz 1, 20359 Hamburg' },
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

#!/usr/bin/env node
// ── build-walk-matrix.js ─────────────────────────────────────────────────────
// Erzeugt rbf-walk.js: eine vorberechnete Fußweg-Matrix (Meter) zwischen allen
// Locations aus VENUE_LOCATIONS (rbf-data.js). Wird EINMAL lokal ausgeführt
// (und erneut, wenn sich Locations/Koordinaten ändern) - die App selbst rechnet
// danach komplett offline und ohne API-Schlüssel.
//
// Aufruf (jede aktuelle Node-Version; ab Node 18 wird das eingebaute fetch genutzt,
// bei älteren Versionen automatisch das eingebaute https-Modul):
//   node build-walk-matrix.js                       # liest rbf-data.js, schreibt rbf-walk.js
//   node build-walk-matrix.js --data rbf-data.js --out rbf-walk.js
//   node build-walk-matrix.js --base https://eigener-osrm-server/routed-foot
//   node build-walk-matrix.js --force               # schreibt trotz Plausibilitätsfehlern
//
// Routing: OSRM "Table"-Service (Fußgänger-Profil) - standardmäßig der öffentliche
// FOSSGIS-Server (routing.openstreetmap.de, max. 1 Anfrage/s, nicht-kommerziell,
// Quellenangabe © OpenStreetMap-Mitwirkende). Hier ist es EINE Anfrage.
//
// Erreichbarkeit testen: Diese Adresse im Browser öffnen - es muss JSON mit
// "code":"Ok" erscheinen (Docks -> Prinzenbar):
//   https://routing.openstreetmap.de/routed-foot/table/v1/foot/9.964525,53.549274;9.964696,53.548774?annotations=distance
//
// Locations OHNE lat/lng werden übersprungen (und am Ende aufgelistet); Locations
// mit identischen Koordinaten teilen sich einen Matrix-Punkt.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const https = require('https');

const DEFAULT_BASE = 'https://routing.openstreetmap.de/routed-foot';
const MAX_POINTS = 100;               // Table-Limit des öffentlichen Servers (typisch)
const SNAP_TOLERANCE_M = 75;          // Fußweg darf durch Straßen-Snapping leicht unter der Luftlinie liegen
const USER_AGENT = 'rbf2027-app/1.0 build-walk-matrix (https://scheissy.github.io/rbf2026/)';

// Ersatz für fetch() auf älteren Node-Versionen (< 18): nur GET, folgt bis zu 3
// Weiterleitungen, liefert das für das Skript nötige Minimum {ok, status, json()}.
function nodeFetch(url, opts = {}, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const mod = String(url).startsWith('https:') ? https : http;
    const req = mod.get(url, { headers: opts.headers || {} }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(nodeFetch(new URL(res.headers.location, url).toString(), opts, redirectsLeft - 1));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Zeitüberschreitung (30 s) bei der Routing-Anfrage.')));
  });
}

function haversineMeters(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// rbf-data.js enthält top-level `const`s -> im vm-Kontext als Ausdruck am Ende abfragen.
function extractVenueLocations(code) {
  const sandbox = { document: { getElementById: () => null } };
  const v = vm.runInNewContext(code + '\n;VENUE_LOCATIONS', sandbox);
  if (!v || typeof v !== 'object') throw new Error('VENUE_LOCATIONS nicht gefunden oder kein Objekt.');
  return v;
}

function buildPoints(venues) {
  const points = [];
  const venueIndex = {};
  const byKey = {};
  const skipped = [];
  for (const [name, v] of Object.entries(venues)) {
    const lat = Number(v && v.lat), lng = Number(v && v.lng);
    if (!v || v.lat == null || v.lng == null || !isFinite(lat) || !isFinite(lng)) { skipped.push(name); continue; }
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (byKey[key] === undefined) { byKey[key] = points.length; points.push({ lat, lng }); }
    venueIndex[name.trim()] = byKey[key];
  }
  return { points, venueIndex, skipped };
}

function tableUrl(base, points) {
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');   // OSRM: lng,lat
  return `${base.replace(/\/$/, '')}/table/v1/foot/${coords}?annotations=distance`;
}

// fetch() wirft bei Verbindungsproblemen nur ein nichtssagendes "fetch failed" -
// die eigentliche Ursache steckt in err.cause (bzw. err.code beim https-Fallback).
function explainFetchError(err, base) {
  const cause = (err && err.cause) || err || {};
  const code = cause.code || '';
  const detail = [code, cause.message && cause.message !== code && cause.message !== (err && err.message) ? cause.message : ''].filter(Boolean).join(' - ');
  const host = (() => { try { return new URL(base).host; } catch (e) { return base; } })();
  let hint;
  if (/^(ENOTFOUND|EAI_AGAIN)$/.test(code)) {
    hint = `Der Servername "${host}" lässt sich nicht auflösen (DNS). Internetverbindung, VPN oder DNS-Einstellungen prüfen.`;
  } else if (/CERT|SELF_SIGNED|TLS|SSL|VERIFY|SIGNATURE|ISSUER/.test(code)) {
    hint = 'Das TLS-Zertifikat des Servers wird nicht akzeptiert. Typisch bei Virenscanner/Firmen-Proxy mit HTTPS-Prüfung. Versuch: `node --use-system-ca build-walk-matrix.js` (nutzt den Windows-Zertifikatsspeicher) oder die Zertifikatsdatei per Umgebungsvariable NODE_EXTRA_CA_CERTS angeben.';
  } else if (/^(ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|ESOCKETTIMEDOUT)$/.test(code) || /Zeitüberschreitung/.test(cause.message || '')) {
    hint = `Zeitüberschreitung beim Verbinden mit "${host}". Firewall/Proxy blockiert evtl. die Verbindung, oder der Server ist gerade überlastet - später erneut versuchen.`;
  } else if (/^(ECONNREFUSED|ECONNRESET|EPIPE|UND_ERR_SOCKET)$/.test(code)) {
    hint = `Die Verbindung zu "${host}" wurde abgelehnt oder abgebrochen. Firewall/Virenscanner/Proxy prüfen oder später erneut versuchen.`;
  } else {
    hint = 'Ursache unbekannt. Prüfen, ob die Adresse im Browser erreichbar ist (Browser-Test im Skriptkopf).';
  }
  return `Keine Verbindung zum Routing-Server (${host})${detail ? ': ' + detail : ''}\n${hint}\nFalls du einen Proxy nutzt: Node verwendet HTTP(S)_PROXY nicht automatisch (in neueren Versionen: Umgebungsvariable NODE_USE_ENV_PROXY=1 setzen).`;
}

function parseTable(json, n) {
  if (!json || json.code !== 'Ok') throw new Error(`Routing-Antwort nicht "Ok": ${json && json.code}${json && json.message ? ' - ' + json.message : ''}`);
  const d = json.distances;
  if (!Array.isArray(d) || d.length !== n || d.some(r => !Array.isArray(r) || r.length !== n))
    throw new Error(`Distanz-Matrix hat nicht die erwartete Größe ${n}x${n}.`);
  const bad = [];
  d.forEach((row, i) => row.forEach((m, j) => { if (typeof m !== 'number' || !isFinite(m)) bad.push(`${i}->${j}`); }));
  if (bad.length) throw new Error(`${bad.length} Paar(e) ohne Route (z.B. ${bad.slice(0, 3).join(', ')}) - Koordinate evtl. nicht erreichbar.`);
  return d.map(row => row.map(m => Math.round(m)));
}

// Verhindert, dass eine falsche Antwort (z.B. Auto- statt Fußgänger-Profil)
// unbemerkt in die App wandert.
function sanityCheck(points, meters) {
  const errors = [], warnings = [];
  const n = points.length;
  let impossible = 0, asym = 0, pairs = 0, highRatio = 0, ratioSum = 0, ratioCount = 0;
  for (let i = 0; i < n; i++) {
    if (meters[i][i] !== 0) errors.push(`Diagonale ist nicht 0 bei Punkt ${i}.`);
    for (let j = i + 1; j < n; j++) {
      const a = meters[i][j], b = meters[j][i];
      const air = haversineMeters(points[i], points[j]);
      pairs++;
      if (Math.min(a, b) + SNAP_TOLERANCE_M < air) impossible++;
      if (Math.max(a, b) > 100 && Math.abs(a - b) > 0.25 * Math.max(a, b)) asym++;
      if (air > 150) { ratioSum += ((a + b) / 2) / air; ratioCount++; if (Math.max(a, b) > 4 * air + 200) highRatio++; }
    }
  }
  if (impossible) errors.push(`${impossible} Fußweg(e) sind deutlich kürzer als die Luftlinie - Koordinaten/Server prüfen.`);
  if (pairs && asym / pairs > 0.15) errors.push(`${asym} von ${pairs} Paaren sind stark asymmetrisch - vermutlich kein Fußgänger-Profil (Einbahnstraßen?).`);
  if (highRatio) warnings.push(`${highRatio} Paar(e) mit Umweg > 4x Luftlinie (Barrieren wie Bahnlinien/Wasser?) - bitte stichprobenartig prüfen.`);
  return { errors, warnings, meanRatio: ratioCount ? ratioSum / ratioCount : null };
}

function renderWalkFile({ venueIndex, meters, generated, source }) {
  const rows = meters.map(r => '    [' + r.join(',') + ']').join(',\n');
  return `// ── Fußweg-Matrix (rbf-walk.js) ─────────────────────────────────────────────
// AUTOMATISCH erzeugt von build-walk-matrix.js - NICHT von Hand bearbeiten.
// venues: Location-Name -> Matrix-Index (gleiche Koordinaten = gleicher Index)
// meters[von][nach]: Fußweg in Metern (gerundet)
const WALK_DISTANCES = {
  generated: ${JSON.stringify(generated)},
  source: ${JSON.stringify(source)},
  venues: ${JSON.stringify(venueIndex)},
  meters: [
${rows}
  ]
};
`;
}

async function run(opts = {}) {
  const dataPath = opts.dataPath || path.join(__dirname, 'rbf-data.js');
  const outPath = opts.outPath || path.join(__dirname, 'rbf-walk.js');
  const base = opts.base || DEFAULT_BASE;
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : nodeFetch);
  const log = opts.log || (() => {});

  const venues = extractVenueLocations(fs.readFileSync(dataPath, 'utf-8'));
  const { points, venueIndex, skipped } = buildPoints(venues);
  if (points.length < 2) throw new Error('Weniger als 2 Locations mit Koordinaten - nichts zu berechnen.');
  if (points.length > MAX_POINTS) throw new Error(`${points.length} Punkte überschreiten das Table-Limit (${MAX_POINTS}) - Anfrage müsste aufgeteilt werden.`);
  log(`${Object.keys(venues).length} Locations, ${Object.keys(venueIndex).length} mit Koordinaten, ${points.length} eindeutige Punkte.`);

  let res;
  try {
    res = await fetchImpl(tableUrl(base, points), { headers: { 'User-Agent': USER_AGENT } });
  } catch (e) {
    throw new Error(explainFetchError(e, base));
  }
  if (!res.ok) throw new Error(`Routing-Server antwortete mit HTTP ${res.status}.`);
  const meters = parseTable(await res.json(), points.length);

  const check = sanityCheck(points, meters);
  check.warnings.forEach(w => log('WARNUNG: ' + w));
  if (check.errors.length && !opts.force) throw new Error('Plausibilitätsprüfung fehlgeschlagen:\n - ' + check.errors.join('\n - ') + '\n(Mit --force trotzdem schreiben.)');
  check.errors.forEach(e => log('FEHLER (übergangen wegen --force): ' + e));

  const generated = (opts.now ? opts.now() : new Date()).toISOString().slice(0, 10);
  const source = 'OSRM Fußgänger-Profil (' + base + '), © OpenStreetMap-Mitwirkende';
  fs.writeFileSync(outPath, renderWalkFile({ venueIndex, meters, generated, source }), 'utf-8');
  return { outPath, points: points.length, venues: Object.keys(venueIndex).length, skipped, meanRatio: check.meanRatio, warnings: check.warnings };
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--data') o.dataPath = argv[++i];
    else if (argv[i] === '--out') o.outPath = argv[++i];
    else if (argv[i] === '--base') o.base = argv[++i];
    else if (argv[i] === '--force') o.force = true;
    else throw new Error(`Unbekanntes Argument: ${argv[i]}`);
  }
  return o;
}

module.exports = { explainFetchError, nodeFetch, haversineMeters, extractVenueLocations, buildPoints, tableUrl, parseTable, sanityCheck, renderWalkFile, run, DEFAULT_BASE };

if (require.main === module) {
  run({ ...parseArgs(process.argv.slice(2)), log: m => console.log(m) })
    .then(r => {
      console.log(`✅ ${r.outPath} geschrieben (${r.points} Punkte, ${r.venues} Locations${r.meanRatio ? `, Ø Umwegfaktor ${r.meanRatio.toFixed(2)}` : ''}).`);
      if (r.skipped.length) console.log(`ℹ️  Ohne Koordinaten übersprungen (${r.skipped.length}): ${r.skipped.join(' | ')}`);
    })
    .catch(e => { console.error('❌ ' + e.message); process.exit(1); });
}

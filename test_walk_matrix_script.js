const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { loadApp, createChecker } = require('./test-helpers');
const bwm = require('./build-walk-matrix');

// Testet build-walk-matrix.js OHNE echtes Netz: fetch wird durch einen
// simulierten OSRM-Table-Server ersetzt (Fußweg = 1,3 x Luftlinie).
// Ob der ECHTE Server erreichbar ist / passende Daten liefert, prüft der
// Sanity-Check des Skripts bei der echten Ausführung (hier nicht testbar).
const DATA = `const VENUE_LOCATIONS={
  "Docks":{"lat":53.549274,"lng":9.964525,"address":"Spielbudenplatz 19"},
  "Prinzenbar":{"lat":53.548774,"lng":9.964696},
  "Molotow":{"lat":53.550220812527,"lng":9.9565170694518},
  "Molotow Top Ten Bar":{"lat":53.550220812527,"lng":9.9565170694518},
  "Knust":{"lat":53.558177,"lng":9.967824},
  "Ohne Koordinaten":{"address":"Heiligengeistfeld, 20359 Hamburg"}
};
const RAW=[];
function irgendwas(){ return document.getElementById('x'); }`;

const tmp = path.join(os.tmpdir(), `rbf-walk-test-${process.pid}`);
fs.mkdirSync(tmp, { recursive: true });
const dataPath = path.join(tmp, 'rbf-data.js');
fs.writeFileSync(dataPath, DATA);

// Simulierter Server: liest die Koordinaten aus der URL (lng,lat;...) und baut die Matrix.
function fakeServer(mutate) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const coords = decodeURIComponent(url.split('/foot/')[1].split('?')[0]).split(';').map(c => { const [lng, lat] = c.split(',').map(Number); return { lat, lng }; });
    let distances = coords.map((a, i) => coords.map((b, j) => i === j ? 0 : bwm.haversineMeters(a, b) * 1.3));
    let body = { code: 'Ok', distances };
    if (mutate) body = mutate(body, coords) || body;
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}
const out = name => path.join(tmp, name);
const rejects = async (p) => { try { await p; return null; } catch (e) { return e.message; } };

(async () => {
  const t = createChecker();

  // ── Erfolgsfall ────────────────────────────────────────────────────────
  const srv = fakeServer();
  const logs = [];
  const res = await bwm.run({ dataPath, outPath: out('ok.js'), fetchImpl: srv.fetchImpl, log: m => logs.push(m), now: () => new Date('2026-09-21T12:00:00Z') });
  t.check('Genau EINE Anfrage an den Routing-Server (Table-Service, Fußgänger-Profil, Distanzen).',
    srv.calls.length === 1 && /\/table\/v1\/foot\//.test(srv.calls[0].url) && srv.calls[0].url.includes('annotations=distance'), srv.calls.map(c => c.url));
  t.check('Anfrage sendet einen identifizierenden User-Agent (Nutzungsregel des öffentlichen Servers).', /rbf2027-app/.test(srv.calls[0].opts.headers['User-Agent']));
  t.check('Koordinaten werden in OSRM-Reihenfolge lng,lat übergeben (Docks zuerst).', srv.calls[0].url.includes('/foot/9.964525,53.549274;'));
  t.check('Locations mit identischen Koordinaten teilen sich einen Punkt (6 Locations -> 4 Punkte), ohne Koordinaten werden übersprungen.',
    res.points === 4 && res.venues === 5 && JSON.stringify(res.skipped) === '["Ohne Koordinaten"]', res);

  const file = fs.readFileSync(out('ok.js'), 'utf-8');
  const W = vm.runInNewContext(file + '\n;WALK_DISTANCES');
  t.check('Erzeugte Datei enthält Datum, Quellenangabe (© OpenStreetMap), Venues und Matrix.',
    W.generated === '2026-09-21' && /OpenStreetMap/.test(W.source) && W.venues.Docks === 0 && Array.isArray(W.meters) && W.meters.length === 4);
  t.check('Alias-Locations (Molotow / Top Ten Bar) haben denselben Index; Location ohne Koordinaten fehlt.',
    W.venues['Molotow'] === W.venues['Molotow Top Ten Bar'] && !('Ohne Koordinaten' in W.venues));
  const n = W.meters.length;
  let symmetric = true, diagZero = true, integers = true;
  for (let i = 0; i < n; i++) { if (W.meters[i][i] !== 0) diagZero = false; for (let j = 0; j < n; j++) { if (W.meters[i][j] !== W.meters[j][i]) symmetric = false; if (!Number.isInteger(W.meters[i][j])) integers = false; } }
  t.check('Matrix ist n x n, symmetrisch, Diagonale 0, ganze Meter.', symmetric && diagZero && integers);
  const expectedDP = Math.round(bwm.haversineMeters({ lat: 53.549274, lng: 9.964525 }, { lat: 53.548774, lng: 9.964696 }) * 1.3);
  t.check('Docks -> Prinzenbar entspricht dem (simulierten) Serverwert.', W.meters[W.venues.Docks][W.venues.Prinzenbar] === expectedDP, { erwartet: expectedDP });

  // ── Kompatibilität: die App kann die erzeugte Datei direkt nutzen ─────────
  {
    const { window: w } = await loadApp({ walkScript: file });
    const m = w.walkMeters('Docks', 'Prinzenbar');
    t.check('Die App liest die erzeugte Datei und liefert Matrix-Werte (exact=true).', m && m.meters === expectedDP && m.exact === true, m);
    t.check('App und Skript rechnen die Luftlinie identisch (Haversine).',
      Math.abs(w.haversineMeters({ lat: 53.549274, lng: 9.964525 }, { lat: 53.558177, lng: 9.967824 }) - bwm.haversineMeters({ lat: 53.549274, lng: 9.964525 }, { lat: 53.558177, lng: 9.967824 })) < 1e-9);
  }

  // ── Fehlerfälle: nichts Falsches in die App schreiben ────────────────────
  let msg = await rejects(bwm.run({ dataPath, outPath: out('e1.js'), fetchImpl: fakeServer(() => ({ code: 'InvalidQuery', message: 'kaputt' })).fetchImpl }));
  t.check('Antwort-Code ungleich "Ok" bricht ab, es wird keine Datei geschrieben.', !!msg && /InvalidQuery/.test(msg) && !fs.existsSync(out('e1.js')), msg);

  msg = await rejects(bwm.run({ dataPath, outPath: out('e2.js'), fetchImpl: fakeServer(b => { b.distances[0][1] = null; b.distances[1][0] = null; return b; }).fetchImpl }));
  t.check('Paare ohne Route (null) brechen ab.', !!msg && /ohne Route/.test(msg) && !fs.existsSync(out('e2.js')), msg);

  msg = await rejects(bwm.run({ dataPath, outPath: out('e3.js'), fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) }));
  t.check('HTTP-Fehler (z.B. 429 Rate-Limit) bricht mit klarer Meldung ab.', !!msg && /429/.test(msg), msg);

  // Auto-Profil: Einbahnstraßen -> stark asymmetrisch
  const carLike = b => { b.distances = b.distances.map((r, i) => r.map((m, j) => i < j ? m : m * 2)); return b; };
  msg = await rejects(bwm.run({ dataPath, outPath: out('e4.js'), fetchImpl: fakeServer(carLike).fetchImpl }));
  t.check('Stark asymmetrische Matrix (Auto- statt Fußgänger-Profil) wird abgelehnt.', !!msg && /asymmetrisch/.test(msg) && !fs.existsSync(out('e4.js')), msg);
  const forced = await bwm.run({ dataPath, outPath: out('e4b.js'), fetchImpl: fakeServer(carLike).fetchImpl, force: true, log: () => {} });
  t.check('Mit --force wird trotz Plausibilitätsfehlern geschrieben.', fs.existsSync(out('e4b.js')) && forced.points === 4);

  // Unmögliche Wege (deutlich kürzer als Luftlinie)
  const tooShort = b => { b.distances = b.distances.map((r, i) => r.map((m, j) => i === j ? 0 : m * 0.3)); return b; };
  msg = await rejects(bwm.run({ dataPath, outPath: out('e5.js'), fetchImpl: fakeServer(tooShort).fetchImpl }));
  t.check('Fußwege deutlich kürzer als die Luftlinie werden als unplausibel abgelehnt.', !!msg && /kürzer als die Luftlinie/.test(msg), msg);

  // Hilfsfunktionen
  t.check('tableUrl: --base wird ohne doppelten Schrägstrich verwendet.',
    bwm.tableUrl('https://x.example/routed-foot/', [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]) === 'https://x.example/routed-foot/table/v1/foot/2,1;4,3?annotations=distance');
  const many = {}; for (let i = 0; i < 101; i++) many['V' + i] = { lat: 53 + i * 0.001, lng: 9.9 };
  fs.writeFileSync(out('many.js'), 'const VENUE_LOCATIONS=' + JSON.stringify(many) + ';');
  msg = await rejects(bwm.run({ dataPath: out('many.js'), outPath: out('e6.js'), fetchImpl: fakeServer().fetchImpl }));
  t.check('Mehr als 100 Punkte werden mit klarer Meldung abgelehnt (Table-Limit).', !!msg && /Limit/.test(msg), msg);

  // ── Verständliche Fehlermeldungen bei Verbindungsproblemen ───────────────
  {
    const mk = (code, message) => async () => { const e = new TypeError('fetch failed'); e.cause = Object.assign(new Error(message || code), { code }); throw e; };
    const run1 = f => rejects(bwm.run({ dataPath, outPath: out('net.js'), fetchImpl: f, base: 'https://routing.example.org/routed-foot' }));
    let m = await run1(mk('ENOTFOUND', 'getaddrinfo ENOTFOUND routing.example.org'));
    t.check('DNS-Fehler: Ursache (ENOTFOUND) und Host stehen in der Meldung, nicht nur "fetch failed".', /ENOTFOUND/.test(m) && /routing\.example\.org/.test(m) && /DNS/.test(m), m);
    m = await run1(mk('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));
    t.check('Zertifikatsfehler: Meldung nennt die Ursache und den Hinweis --use-system-ca / NODE_EXTRA_CA_CERTS.', /UNABLE_TO_VERIFY_LEAF_SIGNATURE/.test(m) && /--use-system-ca/.test(m) && /NODE_EXTRA_CA_CERTS/.test(m), m);
    m = await run1(mk('UND_ERR_CONNECT_TIMEOUT'));
    t.check('Zeitüberschreitung: Meldung nennt Firewall/Proxy als mögliche Ursache.', /Zeitüberschreitung/.test(m) && /Firewall/.test(m), m);
    m = await run1(mk('ECONNRESET'));
    t.check('Abgebrochene Verbindung: Meldung nennt Firewall/Virenscanner.', /ECONNRESET/.test(m) && /Virenscanner/.test(m), m);
    m = await run1(async () => { throw new TypeError('fetch failed'); });
    t.check('Auch ohne err.cause bleibt die Meldung nutzbar (Proxy-Hinweis, kein Absturz).', /Keine Verbindung/.test(m) && /NODE_USE_ENV_PROXY/.test(m), m);
    t.check('Es wird keine Datei geschrieben, wenn die Verbindung scheitert.', !fs.existsSync(out('net.js')));
  }

  // ── Fallback für Node < 18 (ohne globales fetch) ────────────────────────
  // Lokaler HTTP-Server statt echtem Netz: prüft nodeFetch() direkt und den
  // kompletten Skriptlauf mit entferntem global.fetch (= alte Node-Version).
  {
    const seen = [];
    const server = http.createServer((req, res) => {
      seen.push({ url: req.url, ua: req.headers['user-agent'] });
      if (req.url === '/redir') { res.writeHead(302, { Location: '/json' }); return res.end(); }
      if (req.url === '/json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"hallo":"welt"}'); }
      if (req.url === '/limit') { res.writeHead(429); return res.end('zu viele Anfragen'); }
      const m = req.url.match(/^\/routed-foot\/table\/v1\/foot\/([^?]+)\?annotations=distance$/);
      if (m) {
        const c = decodeURIComponent(m[1]).split(';').map(x => { const [lng, lat] = x.split(',').map(Number); return { lat, lng }; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ code: 'Ok', distances: c.map((a, i) => c.map((b, j) => i === j ? 0 : bwm.haversineMeters(a, b) * 1.3)) }));
      }
      res.writeHead(404); res.end();
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;

    const j = await bwm.nodeFetch(`${base}/json`, { headers: { 'User-Agent': 'test-agent' } });
    t.check('nodeFetch liefert {ok, status, json()} und sendet die übergebenen Header.',
      j.ok === true && j.status === 200 && (await j.json()).hallo === 'welt' && seen[0].ua === 'test-agent', seen[0]);
    const r = await bwm.nodeFetch(`${base}/redir`);
    t.check('nodeFetch folgt einer Weiterleitung.', r.ok && (await r.json()).hallo === 'welt');
    const l = await bwm.nodeFetch(`${base}/limit`);
    t.check('nodeFetch meldet HTTP-Fehler als ok=false mit Statuscode (z.B. 429).', l.ok === false && l.status === 429);

    const savedFetch = global.fetch;
    global.fetch = undefined; // simuliert Node < 18
    let result, err = null;
    try { result = await bwm.run({ dataPath, outPath: out('nofetch.js'), base: `${base}/routed-foot`, log: () => {} }); } catch (e) { err = e; }
    global.fetch = savedFetch;
    t.check('Ohne globales fetch (alte Node-Version) läuft das Skript über den https/http-Fallback komplett durch.',
      !err && result && result.points === 4 && fs.existsSync(out('nofetch.js')), err && err.message);
    await new Promise(r2 => server.close(r2));
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  t.finish();
})();

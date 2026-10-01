const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createChecker } = require('./test-helpers');

// Führt sw.js in einer minimalen Service-Worker-Sandbox WIRKLICH aus (nicht
// nur ein Syntax-/Regex-Check) und simuliert die 'fetch'-Events selbst -
// insbesondere den konkret gemeldeten Fall: das Netz antwortet gar nicht
// (weder Erfolg noch Fehler), z.B. bei "verbunden, aber ohne funktionierendes
// Internet" (Festival-WLAN/Mobilfunk, Captive Portal). Ohne Zeitlimit hinge
// respondWith() dann für immer, wodurch die Seite nie ankommt - genau das
// "hängt am Startbildschirm"-Problem aus der Anfrage.
//
// setTimeout wird in der Sandbox auf wenige Millisekunden gedeckelt, damit
// der Test nicht wirklich NETWORK_TIMEOUT_MS (4s) lang warten muss - die
// REIHENFOLGE (Netz schneller als Timeout, oder umgekehrt) bleibt dabei exakt
// erhalten, nur die absolute Dauer wird für den Test verkürzt.
function loadSW(fetchImpl) {
  const listeners = {};
  const cacheStore = new Map(); // url -> Response
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const keyOf = req => typeof req === 'string' ? req : req.url;
  const caches = {
    open: async () => ({ put: async (req, res) => { cacheStore.set(keyOf(req), res); } }),
    match: async req => cacheStore.get(keyOf(req)),
    keys: async () => [...cacheStore.keys()],
    delete: async () => true,
  };
  const cappedSetTimeout = (fn, ms) => setTimeout(fn, Math.min(ms, 5));
  const sandbox = { self, caches, fetch: fetchImpl, Promise, setTimeout: cappedSetTimeout, clearTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf-8'), sandbox);
  return { fetchHandler: listeners.fetch, cacheStore };
}

function makeReq(url, mode = 'navigate') {
  return { url, mode, destination: mode === 'navigate' ? 'document' : '', clone() { return this; } };
}
// Simuliert ein FetchEvent; respondWith() speichert das übergebene Promise.
function dispatch(fetchHandler, req) {
  let responded;
  fetchHandler({ request: req, respondWith: p => { responded = p; } });
  return responded;
}
function fakeResponse(url, ok = true, body = url) {
  return { ok, url, clone() { return this; }, _body: body };
}
// Ein fetch(), das NIE antwortet (weder Erfolg noch Fehler) - genau der
// gemeldete Fall (schlechtes WLAN/Mobilfunk, Captive Portal).
function hangingFetch() { return new Promise(() => {}); }

(async () => {
  const t = createChecker();

  // ── 1) Der eigentliche Bug: hängendes Netz darf die Antwort NICHT
  // unbegrenzt blockieren - mit vorhandenem Cache muss zeitnah (nach dem
  // gedeckelten Timeout) aus dem Cache geantwortet werden. ──────────────────
  {
    const { fetchHandler, cacheStore } = loadSW(hangingFetch);
    cacheStore.set('https://app.example/index.html', fakeResponse('https://app.example/index.html', true, 'ALTE-VERSION'));
    const req = makeReq('https://app.example/index.html');
    const res = await dispatch(fetchHandler, req);
    t.check('Bei hängendem Netz (nie antwortend) wird trotz vorhandenem Cache-Eintrag zeitnah geantwortet, statt für immer zu warten.',
      !!res && res._body === 'ALTE-VERSION');
  }

  // ── 2) Genauso für rbf-data.js (Datendatei), nicht nur für index.html. ────
  {
    const { fetchHandler, cacheStore } = loadSW(hangingFetch);
    cacheStore.set('https://app.example/rbf-data.js', fakeResponse('https://app.example/rbf-data.js', true, 'ALTE-DATEN'));
    const res = await dispatch(fetchHandler, makeReq('https://app.example/rbf-data.js', ''));
    t.check('Auch rbf-data.js hängt bei totem Netz nicht - der Cache-Stand wird zeitnah ausgeliefert.',
      !!res && res._body === 'ALTE-DATEN');
  }

  // ── 3) Funktionierendes Netz liefert weiterhin die frische Antwort
  // (kein unnötiger Umweg über den Cache, wenn das Netz eigentlich geht). ──
  {
    let calls = 0;
    const fetchImpl = async () => { calls++; return fakeResponse('https://app.example/index.html', true, 'NEUE-VERSION'); };
    const { fetchHandler, cacheStore } = loadSW(fetchImpl);
    cacheStore.set('https://app.example/index.html', fakeResponse('https://app.example/index.html', true, 'ALTE-VERSION'));
    const res = await dispatch(fetchHandler, makeReq('https://app.example/index.html'));
    t.check('Bei einem funktionierenden Netz wird weiterhin die frische Antwort ausgeliefert, nicht die alte aus dem Cache.',
      res._body === 'NEUE-VERSION' && calls === 1);
  }

  // ── 4) Ein schneller, "sauberer" Netzfehler (z.B. echter Flugmodus) fällt
  // weiterhin korrekt auf den Cache zurück (war schon vorher so, darf durch
  // die Timeout-Änderung nicht kaputtgehen). ───────────────────────────────
  {
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
    const { fetchHandler, cacheStore } = loadSW(fetchImpl);
    cacheStore.set('https://app.example/index.html', fakeResponse('https://app.example/index.html', true, 'ALTE-VERSION'));
    const res = await dispatch(fetchHandler, makeReq('https://app.example/index.html'));
    t.check('Ein schneller Netzfehler (z.B. Flugmodus) fällt weiterhin korrekt auf den Cache zurück.', res._body === 'ALTE-VERSION');
  }

  // ── 5) Erfolgreiche Netzantwort aktualisiert den Cache. ──────────────────
  {
    const fetchImpl = async () => fakeResponse('https://app.example/rbf-data.js', true, 'FRISCH');
    const { fetchHandler, cacheStore } = loadSW(fetchImpl);
    await dispatch(fetchHandler, makeReq('https://app.example/rbf-data.js', ''));
    t.check('Eine erfolgreiche Netzantwort wird im Cache gespeichert.', cacheStore.get('https://app.example/rbf-data.js')._body === 'FRISCH');
  }

  // ── 6) Eine Fehlerantwort (z.B. 404) darf sich NIE im Cache festsetzen -
  // ein vorhandener guter Cache-Eintrag bleibt unangetastet. ───────────────
  {
    const fetchImpl = async () => fakeResponse('https://app.example/rbf-data.js', false, 'FEHLERSEITE');
    const { fetchHandler, cacheStore } = loadSW(fetchImpl);
    cacheStore.set('https://app.example/rbf-data.js', fakeResponse('https://app.example/rbf-data.js', true, 'GUTER-STAND'));
    const res = await dispatch(fetchHandler, makeReq('https://app.example/rbf-data.js', ''));
    t.check('Eine Fehlerantwort (res.ok=false) wird nicht in den Cache geschrieben.', cacheStore.get('https://app.example/rbf-data.js')._body === 'GUTER-STAND');
  }

  // ── 7) Hängendes Netz OHNE jeden Cache-Eintrag: dann bleibt nur, doch auf
  // das Netz zu warten (kann bei echtem Erstlaunch nicht anders sein) - die
  // Antwort darf aber nicht mit einem Fehler abbrechen, sobald das Netz
  // (irgendwann) doch noch antwortet. ──────────────────────────────────────
  {
    let resolveFetch;
    const fetchImpl = () => new Promise(resolve => { resolveFetch = resolve; });
    const { fetchHandler, cacheStore } = loadSW(fetchImpl);
    const resPromise = dispatch(fetchHandler, makeReq('https://app.example/index.html'));
    // Kurz warten (mehr als das gedeckelte Timeout), Antwort muss noch ausstehen.
    await new Promise(r => setTimeout(r, 20));
    resolveFetch(fakeResponse('https://app.example/index.html', true, 'ENDLICH-DA'));
    const res = await resPromise;
    t.check('Ohne jeden Cache-Eintrag wird auf das Netz gewartet und die Antwort kommt an, sobald es doch noch reagiert.',
      res._body === 'ENDLICH-DA');
  }

  // ── 8) Auch im Timeout-Fall aktualisiert eine SPÄTER doch noch erfolgreiche
  // Netzantwort den Cache im Hintergrund (fürs nächste Mal). ───────────────
  {
    let resolveFetch;
    const fetchImpl = () => new Promise(resolve => { resolveFetch = resolve; });
    const { fetchHandler, cacheStore } = loadSW(fetchImpl);
    cacheStore.set('https://app.example/index.html', fakeResponse('https://app.example/index.html', true, 'ALTE-VERSION'));
    const res = await dispatch(fetchHandler, makeReq('https://app.example/index.html'));
    t.check('Timeout-Fall liefert zunächst die alte Cache-Version.', res._body === 'ALTE-VERSION');
    resolveFetch(fakeResponse('https://app.example/index.html', true, 'NACHTRÄGLICH-FRISCH'));
    await new Promise(r => setTimeout(r, 10)); // Hintergrund-Update abwarten
    t.check('Sobald das Netz danach doch noch antwortet, wird der Cache trotzdem noch aktualisiert (für den nächsten Start).',
      cacheStore.get('https://app.example/index.html')._body === 'NACHTRÄGLICH-FRISCH');
  }

  // ── 9) Statische Assets (Icons/Manifest): unverändertes Cache-first-
  // Verhalten, vom Timeout-Fix nicht betroffen. ────────────────────────────
  {
    const fetchImpl = async () => fakeResponse('https://app.example/icon-192.png', true, 'ICON');
    const { fetchHandler, cacheStore } = loadSW(fetchImpl);
    cacheStore.set('https://app.example/icon-192.png', fakeResponse('https://app.example/icon-192.png', true, 'ALTES-ICON'));
    const res = await dispatch(fetchHandler, makeReq('https://app.example/icon-192.png', ''));
    t.check('Statische Assets werden weiterhin sofort aus dem Cache geliefert (Cache-first, unverändert).', res._body === 'ALTES-ICON');
  }

  t.finish();
})();

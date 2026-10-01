const CACHE = 'rbf2026-v6';
const ASSETS = ['./index.html', './rbf-data.js', './rbf-walk.js', './manifest.json', './icon-192.png', './icon-512.png'];
// Wie lange auf das Netz gewartet wird, bevor auf den Cache zurückgefallen
// wird (siehe fetchWithTimeout unten) - siehe dortiger Kommentar zur Begründung.
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', e => {
  // Jede Datei einzeln cachen statt addAll(): so blockiert eine einzelne
  // (temporär) nicht erreichbare Datei nicht die komplette SW-Installation -
  // sonst würde z.B. ein kurzzeitiges 404 direkt nach dem Deploy einer neuen
  // Datei dazu führen, dass der Service Worker dauerhaft gar nicht erst
  // aktiv wird.
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(url =>
        fetch(url).then(res => { if (res.ok) return c.put(url, res); }).catch(() => {})
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Startet fetch(req), bricht es aber NICHT ab - liefert stattdessen spätestens
// nach ms Millisekunden `null`, falls das Netz bis dahin weder geantwortet
// noch (schnell) fehlgeschlagen ist. Der eigentliche fetch() läuft im
// Hintergrund einfach weiter und aktualisiert bei Erfolg trotzdem noch den
// Cache (siehe Aufrufer) - für den NÄCHSTEN Start ist der Inhalt dann aktuell,
// auch wenn der JETZIGE Start schon (aus dem Cache) weitergemacht hat.
//
// Der Grund für dieses Zeitlimit: ein echtes "kein Netz" (z.B. Flugmodus)
// lässt fetch() sofort fehlschlagen - das war schon vorher kein Problem.
// Der eigentliche Bug betraf den Fall "verbunden, aber ohne funktionierendes
// Internet" (schwaches Festival-WLAN/Mobilfunk, Captive Portal o.ä.): dort
// bleibt fetch() oft minutenlang ohne jede Antwort hängen, bevor der Browser
// selbst einen Fehler meldet - respondWith() wartete bisher genauso lange,
// wodurch die komplette Seite (index.html) nie ankam und die App am
// Startbildschirm hängen blieb.
function fetchWithTimeout(req, ms, onSuccess) {
  const networkPromise = fetch(req).then(res => { onSuccess(res); return res; }).catch(() => null);
  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), ms));
  return { networkPromise, raced: Promise.race([networkPromise, timeoutPromise]) };
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const isHTML = req.mode === 'navigate' ||
                 req.destination === 'document' ||
                 req.url.endsWith('.html') ||
                 req.url.endsWith('/');
  // rbf-data.js enthält die Künstler-/Auftrittsdaten und wird bei jedem
  // Daten-Update ausgetauscht - genau wie index.html soll das SOFORT
  // ankommen, nicht erst nach Ablauf des Cache-first-Verhaltens.
  // rbf-walk.js (vorberechnete Fußweg-Matrix, optional) wird zusammen mit den
  // Locations-Daten aktualisiert und deshalb genauso behandelt.
  const isDataFile = req.url.endsWith('/rbf-data.js') || req.url.endsWith('/rbf-walk.js');

  if (isHTML || isDataFile) {
    // App-Shell + Datendatei: zuerst das Netz fragen, damit Updates schnell
    // ankommen - aber höchstens NETWORK_TIMEOUT_MS lang warten, danach sofort
    // auf den Cache zurückfallen (siehe fetchWithTimeout oben). Nur
    // erfolgreiche Antworten (res.ok) werden gecacht - eine Fehlerseite
    // (404 o.ä.) darf sich nie im Cache festsetzen, sonst würde sie immer
    // wieder ausgeliefert, auch nachdem der eigentliche Fehler längst
    // behoben ist.
    const { networkPromise, raced } = fetchWithTimeout(req, NETWORK_TIMEOUT_MS, res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
    });
    e.respondWith(
      raced.then(res => {
        if (res) return res; // Netz war schnell genug (Erfolg oder schneller Fehlschlag bereits behandelt)
        // Timeout: sofort auf den Cache zurückfallen, ohne das Netz abzubrechen
        // (die obige onSuccess-Aktualisierung greift trotzdem noch, falls die
        // Antwort später doch noch eintrifft).
        return caches.match(req).then(cached => {
          if (cached) return cached;
          if (isHTML) return caches.match('./index.html').then(fallback => fallback || networkPromise);
          // Kein Cache vorhanden (z.B. allererster Start) - dann bleibt nur,
          // doch noch auf das Netz zu warten.
          return networkPromise;
        });
      })
    );
  } else {
    // Statische Assets (Icons, Manifest): Cache-first fürs schnelle Laden,
    // im Hintergrund trotzdem aktualisieren (auch hier nur bei Erfolg). Ist
    // bereits ein Cache-Eintrag vorhanden, wird NIE auf das Netz gewartet -
    // das Timeout-Problem oben betrifft nur den network-first-Zweig.
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});

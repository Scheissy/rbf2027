const fs = require('fs');
const path = require('path');
const { loadApp, createChecker } = require('./test-helpers');

// Schützt die Aufteilung der App in index.html + css/app.css + js/*.js:
//  - index.html enthält nur noch Markup und Verweise (kein Inline-<style>/-<script>),
//  - die Skript-Reihenfolge in index.html entspricht RBF_EXPECTED_PARTS (99-main.js),
//  - jede Datei existiert, meldet sich unter ihrem eigenen Namen an und steht im Service-Worker-Cache,
//  - keine Datei wächst wieder zu einem Monolithen,
//  - die App startet ohne Ladefehler, und eine unvollständig geladene App warnt sichtbar.
(async () => {
  const t = createChecker();
  const read = f => fs.readFileSync(path.join(__dirname, f), 'utf-8');
  const html = read('index.html');
  const sw = read('sw.js');
  const lines = s => s.split('\n').length;

  // ───────── 1) index.html ─────────
  t.check('index.html enthält kein Inline-<style> mehr, sondern verweist auf css/app.css.',
    !/<style[\s>]/.test(html) && html.includes('<link rel="stylesheet" href="css/app.css">'));
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => m[1]);
  t.check('index.html enthält keine Inline-Skripte (jedes <script> hat ein src).', scriptTags.length > 0 && scriptTags.every(a => /\bsrc="/.test(a)), scriptTags);
  const srcs = scriptTags.map(a => (a.match(/src="([^"]+)"/) || [])[1]);
  t.check('Die Daten-Skripte (rbf-data.js, rbf-walk.js) werden vor allen App-Skripten geladen.', srcs[0] === 'rbf-data.js' && srcs[1] === 'rbf-walk.js' && srcs.slice(2).every(s => s.startsWith('js/')), srcs);
  const jsFiles = srcs.filter(s => s.startsWith('js/'));
  const names = jsFiles.map(s => s.replace(/^js\//, '').replace(/\.js$/, ''));
  t.check('Mehrere thematische Skripte (mindestens 8), das letzte ist js/99-main.js (Start-Code).', jsFiles.length >= 8 && jsFiles[jsFiles.length - 1] === 'js/99-main.js', jsFiles);
  t.check('Die Dateinamen sind nach Ladereihenfolge nummeriert (aufsteigend sortiert).', JSON.stringify(names) === JSON.stringify([...names].sort()));
  t.check('index.html ist nur noch Markup (unter 700 Zeilen).', lines(html) < 700, lines(html));

  // ───────── 2) Dateien ─────────
  const expected = JSON.parse((read('js/99-main.js').match(/const RBF_EXPECTED_PARTS = (\[.*?\]);/) || [])[1] || '[]');
  t.check('RBF_EXPECTED_PARTS in 99-main.js entspricht exakt den Skript-Tags (Namen und Reihenfolge).', JSON.stringify(expected) === JSON.stringify(names), { expected, names });
  let registrationsOk = true; const problems = [];
  for (const n of names) {
    const file = `js/${n}.js`;
    if (!fs.existsSync(path.join(__dirname, file))) { registrationsOk = false; problems.push('fehlt: ' + file); continue; }
    const code = read(file);
    const reg = [...code.matchAll(/\(window\.RBF_PARTS = window\.RBF_PARTS \|\| \[\]\)\.push\('([^']+)'\);/g)].map(m => m[1]);
    if (reg.length !== 1 || reg[0] !== n) { registrationsOk = false; problems.push(`${file}: Anmeldung ${JSON.stringify(reg)}`); }
    const firstCode = code.split('\n').slice(0, 3).join('\n');
    if (!/^\/\/ ── js\//.test(firstCode) || !firstCode.includes('push(')) { registrationsOk = false; problems.push(`${file}: Kopfzeilen fehlen`); }
  }
  t.check('Jede Datei existiert, hat Kopfzeilen und meldet sich genau einmal unter ihrem eigenen Namen an.', registrationsOk, problems);
  const big = names.map(n => [n, lines(read(`js/${n}.js`))]).filter(([, c]) => c > 700);
  t.check('Keine JS-Datei hat mehr als 700 Zeilen (kein neuer Monolith).', big.length === 0, big);
  t.check('css/app.css existiert und enthält das Stylesheet (mehr als 300 Zeilen).', fs.existsSync(path.join(__dirname, 'css/app.css')) && lines(read('css/app.css')) > 300);

  // ───────── 3) Service Worker ─────────
  const assets = (sw.match(/const ASSETS = \[([^\]]*)\]/) || [])[1] || '';
  const inAssets = f => assets.includes(`'./${f}'`);
  t.check('Service Worker cacht index.html, css/app.css und jede js-Datei vorab (ASSETS).', inAssets('index.html') && inAssets('css/app.css') && jsFiles.every(inAssets), jsFiles.filter(f => !inAssets(f)));
  // rbf-walk.js (vorberechnete Fußweg-Matrix) ist optional und darf fehlen
  const missingAssets = [...assets.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(f => f !== 'rbf-walk.js' && !fs.existsSync(path.join(__dirname, f)));
  t.check('ASSETS enthält keine Dateien, die es nicht gibt (rbf-walk.js ist optional).', missingAssets.length === 0, missingAssets);
  const cacheName = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
  t.check('Cache-Name wurde bei der Aufteilung erhöht (nicht mehr "rbf2027-v1").', !!cacheName && cacheName !== 'rbf2027-v1', cacheName);

  // ───────── 4) Start der App ─────────
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  t.check('Die App startet ohne Lade-/Skriptfehler (auch keine Vorwärtsverweise zwischen den Dateien).', errors.length === 0, errors);
  t.check('Alle Teile haben sich in der Ladereihenfolge angemeldet (window.RBF_PARTS).', JSON.stringify(w.RBF_PARTS) === JSON.stringify(names), w.RBF_PARTS);
  t.check('Vollständig geladen: keine Warnung sichtbar.', !d.getElementById('partsWarning'));
  t.check('Die App ist initialisiert (Künstlerliste gerendert, Tabs vorhanden).', d.querySelectorAll('#artistList .artist-item').length > 0 && d.querySelectorAll('.bottomnav .nav-btn').length === 4);
  t.check('Die Stylesheet-Regeln sind wirksam eingebunden (Test-Helfer bettet css/app.css inline ein).', d.querySelector('style') && d.querySelector('style').textContent.includes('.prog-item'));

  // ───────── 5) Vollständigkeitsprüfung ─────────
  t.check('checkAppParts mit vollständiger Liste meldet nichts und legt keine Warnung an.', w.checkAppParts(expected).length === 0 && !d.getElementById('partsWarning'));
  const saved = w.RBF_PARTS.slice();
  w.RBF_PARTS.splice(w.RBF_PARTS.indexOf('11-sprung'), 1);
  const missing = w.checkAppParts(expected);
  t.check('Fehlt ein Teil (hier 11-sprung), wird er gemeldet ...', JSON.stringify(missing) === JSON.stringify(['11-sprung']), missing);
  const banner = d.getElementById('partsWarning');
  t.check('... und eine sichtbare Warnung mit dem Namen des fehlenden Teils erscheint (role=alert, ohne CSS-Datei lesbar).',
    !!banner && banner.getAttribute('role') === 'alert' && banner.textContent.includes('11-sprung') && /position:\s*fixed/.test(banner.style.cssText) && /background/.test(banner.style.cssText));
  w.RBF_PARTS.length = 0; saved.forEach(p => w.RBF_PARTS.push(p));

  // ───────── 6) Unvollständig geladene App: Warnung schon beim Start ─────────
  // Ein Skript fehlt vollständig (z. B. Datei nicht im Cache, 404 nach teilweisem Update).
  console.log('(Hinweis: Die folgenden Skriptfehler in der Ausgabe gehören zum simulierten Ausfall eines Teils und sind erwartet.)');
  {
    const broken = await loadApp({ trackErrors: true, transformHtml: h => h.replace(/<script>[^]*?<\/script>/g, m => m.includes("push('11-sprung')") ? '' : m) });
    const bw = broken.document.getElementById('partsWarning');
    t.check('Fehlt beim Start ein Teil (11-sprung), erscheint die Warnung automatisch - ohne dass jemand checkAppParts aufruft.', !!bw && bw.textContent.includes('11-sprung') && !broken.window.RBF_PARTS.includes('11-sprung'), bw && bw.textContent);
    t.check('Die Warnung nennt nur den wirklich fehlenden Teil.', !!bw && !/\b(01-data|99-main|10-programm)\b/.test(bw.textContent));
  }

  t.finish();
})();

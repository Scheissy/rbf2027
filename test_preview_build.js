const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createChecker } = require('./test-helpers');

// Schützt den Preview-Build (build-preview.py): preview.html wird aus
// index.html + rbf-data.test.js erzeugt und muss (a) ohne Fehler laufen,
// (b) den In-Memory-Ersatz statt echtem localStorage nutzen und (c) dieselben
// Features wie index.html enthalten (z.B. den Auswertung-Tab) - damit die
// Preview nie stillschweigend hinter der echten App zurückbleibt.
(async () => {
  const t = createChecker();
  const out = path.join(os.tmpdir(), `rbf-preview-${process.pid}.html`);
  execFileSync('python3', [path.join(__dirname, 'build-preview.py'), path.join(__dirname, 'index.html'),
    path.join(__dirname, 'rbf-data.test.js'), out], { stdio: 'pipe' });
  const html = fs.readFileSync(out, 'utf-8');

  t.check('Kein echter localStorage-Aufruf mehr in der Preview (nur __previewStorage).',
    !/\blocalStorage\.(getItem|setItem|removeItem)\(/.test(html.replace(/\/\/[^\n]*/g, '')));
  t.check('Testdaten sind inline eingebettet, keine externen <script src> (rbf-data.js/rbf-walk.js) mehr.',
    !html.includes('<script src="rbf-data.js">') && !html.includes('<script src="rbf-walk.js">') && html.includes('const RAW_AUFTRITTE'));

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://example.org/preview/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  dom.window.addEventListener('error', e => errors.push(e.error ? e.error.message : e.message));
  await new Promise(r => setTimeout(r, 300));
  const w = dom.window, d = w.document;

  t.check('Preview startet ohne JS-Fehler.', errors.length === 0, errors);
  t.check('Preview enthält dieselben 4 Tabs wie die App (inkl. Auswertung).',
    JSON.stringify([...d.querySelectorAll('.bottomnav .nav-btn')].map(b => b.id)) ===
    JSON.stringify(['nav-kuenstler', 'nav-programm', 'nav-auswertung', 'nav-io']));

  w.setRating('Nova Frequenz', 'rp', 4);
  w.setShowDuration('x', 'nid:1', '45');
  w.saveToStorage();
  t.check('Speichern nutzt den In-Memory-Ersatz: echtes localStorage bleibt leer.', w.localStorage.length === 0, w.localStorage.length);
  w.loadFromStorage();
  w.switchTab('auswertung');
  t.check('Speichern/Laden-Zyklus funktioniert in der Preview (Auswertung zeigt den besuchten Auftritt).',
    d.querySelector('.ausw-block[data-ausw="auswahl"] .ausw-kpi-val').textContent === '1');
  t.check('Keine JS-Fehler nach Speichern/Laden/Tab-Wechsel.', errors.length === 0, errors);

  fs.unlinkSync(out);
  t.finish();
})();

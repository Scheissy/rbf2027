const { createChecker } = require('./test-helpers');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runMutations } = require('./mutation-check');

// Mini-Projekt in einem Temp-Ordner: Quelldatei a.js liefert 1, der "Test" t.js schlägt fehl, wenn nicht.
const t = createChecker();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mutcheck-'));
const A = path.join(root, 'a.js');
const SRC = "module.exports = 1; // Kommentar\nmodule.exports.x = 'ok';\n";
fs.writeFileSync(A, SRC);
fs.writeFileSync(path.join(root, 't.js'), "if (require('./a.js') !== 1) process.exit(1);\n");
fs.writeFileSync(path.join(root, 't_ok.js'), "process.exit(0);\n");
const cfg = (muts, tests = ['t.js']) => ({ tests, mutations: muts });
const M = (name, old, nw) => ({ name, file: 'a.js', old, new: nw });
const status = r => r.map(x => x.status).join();

// 1) Erkennt eine Mutation, die der Test bemerkt
let r = runMutations(cfg([M('wirksam', 'module.exports = 1;', 'module.exports = 2;')]), root);
t.check('Eine vom Test bemerkte Mutation wird als "detected" gemeldet.', status(r) === 'detected', r);
t.check('Die Quelldatei ist danach unverändert wiederhergestellt.', fs.readFileSync(A, 'utf8') === SRC);

// 2) Erkennt eine Testlücke
r = runMutations(cfg([M('wirkungslos', '// Kommentar', '// anderer Kommentar')]), root);
t.check('Eine vom Test NICHT bemerkte Mutation wird als "undetected" gemeldet (Testlücke).', status(r) === 'undetected', r);
t.check('... auch dann ist die Datei wiederhergestellt.', fs.readFileSync(A, 'utf8') === SRC);

// 3) Anker fehlt
r = runMutations(cfg([M('Anker fehlt', 'gibt es nicht', 'x')]), root);
t.check('Fehlt die zu ersetzende Textstelle, wird das als "anchor-missing" gemeldet (kein Absturz, nichts verändert).', status(r) === 'anchor-missing' && fs.readFileSync(A, 'utf8') === SRC, r);

// 4) Mehrere Mutationen in einer Konfiguration, jede einzeln gegen die Originaldatei
r = runMutations(cfg([M('a', 'module.exports = 1;', 'module.exports = 2;'), M('b', "'ok'", "'kaputt'"), M('c', '// Kommentar', '// x')]), root);
t.check('Mehrere Mutationen: jede wird einzeln gegen die Originaldatei geprüft (detected, undetected, undetected).', status(r) === 'detected,undetected,undetected', r);

// 5) Mehrere Tests: es genügt, wenn EINER fehlschlägt
r = runMutations(cfg([M('zwei Tests', 'module.exports = 1;', 'module.exports = 2;')], ['t_ok.js', 't.js']), root);
t.check('Mit mehreren Tests genügt es, wenn einer die Mutation bemerkt.', status(r) === 'detected', r);

// 6) Wiederherstellung auch bei Fehler im Test-Aufruf (nicht existierende Testdatei)
r = runMutations(cfg([M('fehlender Test', 'module.exports = 1;', 'module.exports = 2;')], ['gibt_es_nicht.js']), root);
t.check('Fehlt die Testdatei, gilt das als erkannt (Prozess scheitert) und die Quelldatei bleibt unverändert.', fs.readFileSync(A, 'utf8') === SRC);

// 7) Kommandozeile: Exit-Code und --root
const cli = (cfgObj) => {
  const cf = path.join(root, 'cfg.json'); fs.writeFileSync(cf, JSON.stringify(cfgObj));
  return spawnSync(process.execPath, [path.join(__dirname, 'mutation-check.js'), cf, '--root', root], { encoding: 'utf8' });
};
let c = cli(cfg([M('wirksam', 'module.exports = 1;', 'module.exports = 2;')]));
t.check('CLI: alle Mutationen erkannt -> Exit-Code 0 und Zusammenfassung "keine Lücken".', c.status === 0 && /1 von 1 Mutationen erkannt - keine Lücken/.test(c.stdout), c.stdout);
c = cli(cfg([M('wirkungslos', '// Kommentar', '// x')]));
t.check('CLI: eine Testlücke -> Exit-Code 1 und der Name wird genannt.', c.status === 1 && /wirkungslos/.test(c.stdout), c.stdout);
c = cli(cfg([M('Anker fehlt', 'nope', 'x')]));
t.check('CLI: fehlender Anker -> Exit-Code 1.', c.status === 1);
c = spawnSync(process.execPath, [path.join(__dirname, 'mutation-check.js')], { encoding: 'utf8' });
t.check('CLI ohne Konfiguration: Hinweis zur Verwendung und Exit-Code 2.', c.status === 2 && /Aufruf/.test(c.stderr));
t.check('Nach allen CLI-Läufen ist die Quelldatei noch unverändert.', fs.readFileSync(A, 'utf8') === SRC);

// 8) Die mitgelieferte Konfiguration verweist auf existierende Dateien und Ankertexte (Schutz vor veralteten Mutationen)
const real = JSON.parse(fs.readFileSync(path.join(__dirname, 'mutations_modals.json'), 'utf8'));
const stale = real.mutations.filter(m => !fs.readFileSync(path.join(__dirname, m.file), 'utf8').includes(m.old)).map(m => m.name);
t.check('mutations_modals.json: alle Ankertexte stehen im aktuellen Code (keine veralteten Mutationen).', stale.length === 0, stale);
t.check('mutations_modals.json: alle genannten Tests existieren.', real.tests.every(f => fs.existsSync(path.join(__dirname, f))));

fs.rmSync(root, { recursive: true, force: true });
t.finish();

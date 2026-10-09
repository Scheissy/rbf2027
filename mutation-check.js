#!/usr/bin/env node
// Mutationskontrolle: prüft, ob die Tests einen absichtlich eingebauten Fehler
// ("Mutation") wirklich bemerken. Pro Mutation wird in einer Datei eine Textstelle
// ersetzt, der angegebene Test ausgeführt und die Datei danach IMMER wiederhergestellt.
//   erkannt        = mindestens ein Test schlägt fehl (gewünscht)
//   NICHT ERKANNT  = alle Tests bleiben grün -> Testlücke
//   Anker fehlt    = die zu ersetzende Textstelle steht nicht (mehr) in der Datei
// Aufruf:  node mutation-check.js mutations_modals.json [--root <Ordner>]
// Konfiguration (JSON):
//   { "tests": ["test_modal_mechanics.js"],
//     "mutations": [ { "name": "...", "file": "js/05-filter.js", "old": "...", "new": "..." } ] }
// Exit-Code 1, wenn eine Mutation nicht erkannt wurde oder ein Anker fehlt.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function runMutations(config, root = process.cwd(), { timeoutMs = 180000, log = () => {} } = {}) {
  const results = [];
  const restore = new Map();
  const restoreAll = () => { for (const [file, content] of restore) fs.writeFileSync(file, content, 'utf8'); restore.clear(); };
  process.once('exit', restoreAll);
  try {
    for (const m of config.mutations) {
      const file = path.join(root, m.file);
      const original = fs.readFileSync(file, 'utf8');
      const i = original.indexOf(m.old);
      if (i === -1) { results.push({ name: m.name, status: 'anchor-missing' }); log(`!! Anker fehlt: ${m.name}`); continue; }
      restore.set(file, original);
      fs.writeFileSync(file, original.slice(0, i) + m.new + original.slice(i + m.old.length), 'utf8');
      let detected = false;
      try {
        for (const test of config.tests) {
          const r = spawnSync(process.execPath, [path.join(root, test)], { cwd: root, timeout: timeoutMs, stdio: 'ignore' });
          if (r.status !== 0) { detected = true; break; }
        }
      } finally { fs.writeFileSync(file, original, 'utf8'); restore.delete(file); }
      results.push({ name: m.name, status: detected ? 'detected' : 'undetected' });
      log(`${m.name}: ${detected ? 'erkannt' : 'NICHT ERKANNT'}`);
    }
  } finally { restoreAll(); process.removeListener('exit', restoreAll); }
  return results;
}

function main(argv) {
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1]) : process.cwd();
  const cfgPath = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--root');
  if (!cfgPath) { console.error('Aufruf: node mutation-check.js <konfiguration.json> [--root <Ordner>]'); return 2; }
  const config = JSON.parse(fs.readFileSync(path.resolve(cfgPath), 'utf8'));
  const results = runMutations(config, root, { log: console.log });
  const bad = results.filter(r => r.status !== 'detected');
  console.log(`\n${results.length - bad.length} von ${results.length} Mutationen erkannt` + (bad.length ? ` - ${bad.length} Lücke(n)/Fehler: ${bad.map(b => b.name).join('; ')}` : ' - keine Lücken'));
  return bad.length ? 1 : 0;
}

module.exports = { runMutations };
if (require.main === module) process.exit(main(process.argv.slice(2)));

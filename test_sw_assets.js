const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createChecker } = require('./test-helpers');

// Schützt die Service-Worker-Anbindung der optionalen Fußweg-Matrix (rbf-walk.js):
// vorab cachen, Network-First wie rbf-data.js, und Cache-Name wurde bei der
// strukturellen Änderung hochgezählt.
(async () => {
  const t = createChecker();
  const code = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf-8');
  let parses = true;
  try { new vm.Script(code); } catch (e) { parses = false; }
  t.check('sw.js ist syntaktisch gültig.', parses);
  t.check('rbf-walk.js steht in der ASSETS-Liste (wird bei der Installation vorab gecacht).', /const ASSETS = \[[^\]]*'\.\/rbf-walk\.js'/.test(code));
  t.check('rbf-walk.js wird wie rbf-data.js Network-First behandelt (isDataFile).', /isDataFile\s*=[^;]*rbf-data\.js[^;]*rbf-walk\.js/.test(code));
  const cache = (code.match(/const CACHE = '([^']+)'/) || [])[1];
  t.check(`Cache-Name wurde hochgezählt (nicht mehr "rbf2026-v4"): "${cache}".`, !!cache && cache !== 'rbf2026-v4');
  t.finish();
})();

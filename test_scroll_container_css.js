const fs = require('fs');
const path = require('path');
const { createChecker } = require('./test-helpers');

// Kein echter Layout-/Scroll-Test (jsdom berechnet kein CSS-Flexbox-Layout,
// daher lässt sich das eigentliche Scroll-Verhalten hiermit NICHT verifizieren
// - das muss im echten Browser geprüft werden). Dieser Test schützt nur die
// konkrete CSS-Regel selbst vor versehentlichem Verlust: #artistList und
// .prog-list liegen jeweils als Flex-Kind in einem äußeren .view-Container,
// der SELBST ebenfalls overflow-y:auto hat. Ohne "min-height: 0" wächst ein
// Flex-Kind mit eigenem overflow-y:auto über seinen zugewiesenen Platz
// hinaus (Default ist min-height:auto) - dann scrollt in der Praxis der
// ÄUSSERE Container statt des inneren, und jede JS-Scroll-Erhaltung, die auf
// das innere Element zielt (z.B. renderKuenstlerPreservingAnchor()), greift
// ins Leere. Genau das war die Ursache für "es wird trotz Fix immer noch
// wild gesprungen".
const css = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

(async () => {
  const t = createChecker();

  const artistListRule = css.match(/#artistList\s*\{[^}]*\}/);
  t.check('#artistList-Regel existiert.', !!artistListRule);
  t.check('#artistList hat "min-height: 0" (verhindert, dass der äußere .view-Container statt dessen scrollt).',
    !!artistListRule && /min-height:\s*0\b/.test(artistListRule[0]), artistListRule && artistListRule[0]);

  const progListRule = css.match(/\.prog-list\s*\{[^}]*\}/);
  t.check('.prog-list-Regel existiert.', !!progListRule);
  t.check('.prog-list hat "min-height: 0" (dieselbe Falle wie bei #artistList, konsistent behoben).',
    !!progListRule && /min-height:\s*0\b/.test(progListRule[0]), progListRule && progListRule[0]);

  t.finish();
})();

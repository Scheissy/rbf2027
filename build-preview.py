#!/usr/bin/env python3
"""Erzeugt preview.html aus index.html + rbf-data.test.js (Chat-Preview-Build).

- ersetzt <script src="rbf-data.js"> durch die inline eingebetteten Testdaten
  (und <script src="rbf-walk.js"> durch rbf-walk.test.js, falls vorhanden - sonst entfällt es)
- stellt dem Haupt-Script den In-Memory-Ersatz __previewStorage voran
- ersetzt die localStorage-Aufrufe der App-Logik durch __previewStorage
Aufruf: python3 build-preview.py [index.html] [rbf-data.test.js] [preview.html] [rbf-walk.test.js]
"""
import sys, re, os
idx, data, out, walk = (sys.argv[1:5] + [None]*4)[:4]
idx = idx or 'index.html'; data = data or 'rbf-data.test.js'; out = out or 'preview.html'
walk = walk or 'rbf-walk.test.js'   # optional: fehlt die Datei, bleibt die Preview ohne Fußweg-Matrix (Luftlinie)
s = open(idx, encoding='utf-8').read()
d = open(data, encoding='utf-8').read()

STORAGE = '''// ── PREVIEW-BUILD: In-Memory-Ersatz für localStorage ────────────────────────
// Nur fuer die Chat-Vorschau/Artifact-Sandbox (echtes localStorage dort nicht
// zuverlaessig nutzbar) - Build-Schritt, NICHT Teil der echten index.html.
// Die echte App verwendet ganz normal localStorage.
const __previewStorage = (() => {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
})();

'''
DATA_TAG = '<script src="rbf-data.js"></script>\n'
WALK_TAG = '<script src="rbf-walk.js"></script>\n'   # nur in neueren index.html-Ständen vorhanden
has_walk_tag = WALK_TAG in s
marker = DATA_TAG + (WALK_TAG if has_walk_tag else '') + '<script>\n'
assert s.count(marker) == 1, 'rbf-data.js-Script-Tag (+ rbf-walk.js) + Haupt-<script> nicht eindeutig gefunden'
walk_inline = ''
if has_walk_tag and os.path.exists(walk):
    walk_inline = '<script>\n' + open(walk, encoding='utf-8').read() + '\n</script>\n'
s = s.replace(marker, '<script>\n' + d + '\n</script>\n' + walk_inline + '<script>\n' + STORAGE)

# Nur die App-Logik-Aufrufe ersetzen (Zeile mit LS_KEY / LS_FILTERS_KEY)
n_before = len(re.findall(r'\blocalStorage\.', s))
s, n = re.subn(r'\blocalStorage\.(getItem|setItem|removeItem)\((LS_KEY|LS_FILTERS_KEY)', r'__previewStorage.\1(\2', s)
left = len(re.findall(r'\blocalStorage\.(?:getItem|setItem|removeItem)\(', s))
assert left == 0, f'{left} unersetzte localStorage-Aufrufe übrig'
open(out, 'w', encoding='utf-8').write(s)
print(f'preview.html gebaut: {n} localStorage-Aufrufe ersetzt')

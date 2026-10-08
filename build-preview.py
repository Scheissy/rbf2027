#!/usr/bin/env python3
"""Erzeugt preview.html aus index.html + rbf-data.test.js (Chat-Preview-Build).

Die App besteht aus index.html + css/app.css + js/*.js (+ rbf-data.js, rbf-walk.js). Die Preview
muss EINE einzige, selbständige Datei sein. Deshalb:
- css/*.css wird als <style> eingebettet, jedes js/*.js als <script> (Reihenfolge wie in index.html)
- <script src="rbf-data.js"> wird durch die inline eingebetteten Testdaten ersetzt
  (und <script src="rbf-walk.js"> durch rbf-walk.test.js, falls vorhanden - sonst entfällt es)
- vor den App-Skripten kommt der In-Memory-Ersatz __previewStorage
- die localStorage-Aufrufe der App-Logik werden durch __previewStorage ersetzt
Aufruf: python3 build-preview.py [index.html] [rbf-data.test.js] [preview.html] [rbf-walk.test.js]
"""
import sys, re, os
idx, data, out, walk = (sys.argv[1:5] + [None]*4)[:4]
idx = idx or 'index.html'; data = data or 'rbf-data.test.js'; out = out or 'preview.html'
walk = walk or 'rbf-walk.test.js'   # optional: fehlt die Datei, bleibt die Preview ohne Fußweg-Matrix (Luftlinie)
base = os.path.dirname(os.path.abspath(idx))   # css/ und js/ liegen neben index.html
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

def read_part(rel):
    p = os.path.join(base, rel)
    assert os.path.exists(p), f'Datei fehlt: {rel}'
    return open(p, encoding='utf-8').read()

# 1) CSS einbetten (Funktions-Ersatz statt String: kein Backslash-/$-Problem im Inhalt)
css_re = re.compile(r'<link rel="stylesheet" href="(css/[^"]+)">')
s = css_re.sub(lambda m: '<style>\n' + read_part(m.group(1)).rstrip('\n') + '\n</style>', s)

# 2) Daten- und Fußweg-Skript
DATA_TAG = '<script src="rbf-data.js"></script>'
WALK_TAG = '<script src="rbf-walk.js"></script>'
assert s.count(DATA_TAG) == 1, 'rbf-data.js-Script-Tag nicht eindeutig gefunden'
walk_inline = ''
if WALK_TAG in s and os.path.exists(walk):
    walk_inline = '<script>\n' + open(walk, encoding='utf-8').read() + '\n</script>\n'
s = s.replace(DATA_TAG, '<script>\n' + d + '\n</script>')
s = s.replace(WALK_TAG + '\n', walk_inline).replace(WALK_TAG, walk_inline.rstrip('\n'))

# 3) App-Skripte einbetten; der Speicher-Ersatz kommt vor das erste App-Skript
js_re = re.compile(r'<script src="(js/[^"]+)"></script>')
js_tags = js_re.findall(s)
assert js_tags, 'keine js/*.js-Skripte in index.html gefunden'
first = [True]
def inline_js(m):
    body = read_part(m.group(1)).rstrip('\n')
    prefix = '<script>\n' + STORAGE + '</script>\n' if first[0] else ''
    first[0] = False
    return prefix + '<script>\n' + body + '\n</script>'
s = js_re.sub(inline_js, s)
assert '<script src=' not in s, 'es blieben externe <script src> übrig'

# Nur die App-Logik-Aufrufe ersetzen (Zeile mit LS_KEY / LS_FILTERS_KEY)
s, n = re.subn(r'\blocalStorage\.(getItem|setItem|removeItem)\((LS_KEY|LS_FILTERS_KEY)', r'__previewStorage.\1(\2', s)
left = len(re.findall(r'\blocalStorage\.(?:getItem|setItem|removeItem)\(', s))
assert left == 0, f'{left} unersetzte localStorage-Aufrufe übrig'
open(out, 'w', encoding='utf-8').write(s)
print(f'preview.html gebaut: {n} localStorage-Aufrufe ersetzt, {len(js_tags)} Skripte eingebettet')

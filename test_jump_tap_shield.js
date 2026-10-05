const { loadApp, createChecker } = require('./test-helpers');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const ev = code => w.eval(code);
  w.__rbfSyncJumps = false;                       // echtes (verzögertes) Verhalten testen

  const shield = () => d.getElementById('jumpShield');
  const shieldOn = () => shield().style.display !== 'none';
  const busy = () => d.body.classList.contains('jump-busy');
  const viewVisible = tab => !d.getElementById(`view-${tab}`).classList.contains('hidden');
  const calls = { prog: 0, artist: 0 };
  const origProg = w.jumpToProgShow, origArtist = w.jumpToArtist;
  w.jumpToProgShow = function () { calls.prog++; return origProg.apply(this, arguments); };
  w.jumpToArtist = function () { calls.artist++; return origArtist.apply(this, arguments); };

  w.switchTab('kuenstler');
  w.resetKuenstlerFilters();
  w.render();
  w.toggleExpand('Nova Frequenz');
  const dayEl = d.querySelector('#artistList .show-day');
  const timeEl = d.querySelector('#artistList .show-time');

  // ───────── 1) Rückmeldung und Verzögerung ─────────
  t.check('Ausgangslage: kein Schild, kein "Springe"-Hinweis.', !shieldOn() && !busy());
  dayEl.click();
  t.check('Direkt nach dem Tipp: Rückmeldung "Springe …" (body.jump-busy) ist aktiv.', busy());
  t.check('Direkt nach dem Tipp: Schild über der App ist aktiv.', shieldOn());
  t.check('Der eigentliche Sprung startet erst NACH kurzer Pause (Rückmeldung kann gezeichnet werden): noch im Künstler-Tab.', viewVisible('kuenstler') && calls.prog === 0);

  t.check('Die Startverzögerung reicht für mindestens einen Bildaufbau (>= 16 ms), damit die Rückmeldung wirklich gezeichnet wird.', ev('JUMP_START_DELAY_MS') >= 16, ev('JUMP_START_DELAY_MS'));

  // ───────── 2) Weitere Tipps während des Sprungs werden ignoriert ─────────
  timeEl.click();
  dayEl.click();
  await sleep(120);
  t.check('Nach der Pause ist der Sprung erfolgt (Programm-Tab sichtbar).', viewVisible('programm') && !viewVisible('kuenstler'));
  t.check('Zusätzliche Tipps auf Tag/Zeit während des Sprungs lösen KEINEN zweiten Sprung aus.', calls.prog === 1, calls);
  t.check('Nach dem Sprung ist der "Springe"-Hinweis weg ...', !busy());
  t.check('... das Schild bleibt aber noch kurz stehen (fängt nachgelieferte Tipps ab).', shieldOn());

  // ───────── 3) Schild bleibt kurz, danach frei ─────────
  await sleep(250);
  t.check('250 ms nach dem Sprung: Schild noch aktiv (Haltezeit 450 ms).', shieldOn());
  await sleep(350);
  t.check('Nach der Haltezeit ist das Schild weg und die App wieder bedienbar.', !shieldOn() && !busy());

  // ───────── 4) Neuer Sprung danach wieder möglich ─────────
  w.switchTab('programm');
  const rosa = ev("artistShowsSorted('Rosa Mercur')").length;
  t.check('Testdaten: Rosa Mercur hat mehrere Termine (Terminliste vorhanden).', rosa >= 2);
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  w.renderProg();
  const rosaRow = [...d.querySelectorAll('#progList .prog-item')].find(el => el.querySelector('.prog-name').textContent.startsWith('Rosa Mercur'));
  const rid = rosaRow.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  w.toggleProgRating(rid);
  const term = [...d.getElementById(`${rid}-terms`).querySelectorAll('.prog-term')].find(r => !r.classList.contains('current'));
  const progBefore = calls.prog;
  term.click();
  t.check('Tipp auf einen Termin der Terminliste läuft ebenfalls über den Tap-Schutz.', busy() && shieldOn() && calls.prog === progBefore);
  await sleep(120);
  t.check('... und führt dann den Sprung genau einmal aus.', calls.prog === progBefore + 1, calls);
  await sleep(500);
  t.check('Danach ist alles wieder frei.', !shieldOn() && !busy());

  // ───────── 5) Weitere Einstiegspunkte nutzen den Tap-Schutz ─────────
  const artistBtn = d.getElementById(`${rid}-detail`).innerHTML;
  t.check('"👤 Zum Künstler" läuft über runJump.', /runJump\(\(\)=>jumpToArtist\(/.test(artistBtn));
  t.check('Zurück-Chip läuft über runJump.', d.getElementById('jumpBackLabel').getAttribute('onclick') === 'runJump(jumpBack)');
  w.switchTab('kuenstler');
  if (!ev("expandedRows.has('Nova Frequenz')")) w.toggleExpand('Nova Frequenz');
  t.check('Tag und Zeit in der Künstler-Übersicht laufen über runJump.', d.querySelector('#artistList .show-day').getAttribute('onclick').includes('runJump(()=>jumpToProgShow(') && d.querySelector('#artistList .show-time').getAttribute('onclick').includes('runJump(()=>jumpToProgShow('));

  // ───────── 6) Der Zurück-Chip-Tipp selbst ─────────
  w.jumpToProgShow('nid:1');                       // direkt (synchron) springen -> Chip erscheint
  const chipVisible = () => d.getElementById('jumpBackChip').style.display !== 'none';
  t.check('Ausgangslage: Zurück-Chip sichtbar.', chipVisible() && viewVisible('programm'));
  d.getElementById('jumpBackLabel').click();
  t.check('Tipp auf den Zurück-Chip: Rückmeldung + Schild sofort, Rückkehr erst nach der Pause.', busy() && shieldOn() && viewVisible('programm'));
  await sleep(120);
  t.check('Danach ist man zurück im Künstler-Tab, der Chip ist weg.', viewVisible('kuenstler') && !chipVisible());
  await sleep(500);

  // ───────── 7) Robustheit ─────────
  const before = shieldOn();
  w.runJump(() => { throw new Error('absichtlicher Testfehler'); });
  await sleep(120);
  t.check('Wirft ein Sprung einen Fehler, bleibt die App nicht blockiert (kein "Springe" hängen).', !busy());
  await sleep(500);
  t.check('... und das Schild verschwindet trotzdem wieder.', !shieldOn() && before === false);
  let ran = 0;
  w.runJump(() => { ran++; });
  w.runJump(() => { ran++; });
  await sleep(120);
  t.check('runJump ignoriert einen zweiten Aufruf, solange der erste läuft.', ran === 1, ran);
  await sleep(500);

  // ───────── 8) Synchroner Modus (Standard in allen anderen Tests) ─────────
  w.__rbfSyncJumps = true;
  let sync = 0;
  w.runJump(() => { sync++; });
  t.check('Mit __rbfSyncJumps läuft runJump sofort und ohne Schild.', sync === 1 && !shieldOn() && !busy());

  // ───────── 9) Optik: Schild deckt alles ab, fängt Tipps ab ─────────
  const css = d.querySelector('style').textContent;
  t.check('Schild: fixed, ganzer Bildschirm (inset 0), über allen anderen Ebenen (z-index >= 2000).', /\.jump-shield\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*z-index:\s*2000/.test(css));
  t.check('Schild schluckt Tipps selbst (kein pointer-events: none).', !/\.jump-shield\s*\{[^}]*pointer-events:\s*none/.test(css));
  t.check('Der "Springe …"-Hinweis fängt selbst keine Tipps ab (pointer-events: none).', /body\.jump-busy::after\s*\{[^}]*pointer-events:\s*none/.test(css));
  const zs = [...css.matchAll(/z-index:\s*(\d+)/g)].map(m => +m[1]).filter(z => z < 2000);
  t.check('Kein anderes Element liegt über dem Schild.', Math.max(...zs) < 2000);

  t.finish();
})();

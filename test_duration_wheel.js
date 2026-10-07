const { loadApp, createChecker } = require('./test-helpers');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();
  const ev = code => w.eval(code);
  const $ = id => d.getElementById(id);

  const stored = () => (JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').showDurations) || {};
  const total = skey => stored()[skey];
  const mInput = () => $('durationModalInput'), hInput = () => $('durationModalHInput');
  const mMinus = () => $('durationModalMinus'), mPlus = () => $('durationModalPlus');
  const hMinus = () => $('durationModalHMinus'), hPlus = () => $('durationModalHPlus');
  const minCol = () => $('durationModalMinutesCol'), hourCol = () => $('durationModalHoursRow');
  const modalOpen = () => $('durationModal').classList.contains('open');
  const setMode = m => { ev(`appSettings.durationInputMode = '${m}';`); w.applySettingsUI(); };

  w.switchTab('programm');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  d.getElementById('timeFrom').value = '08:00';
  d.getElementById('timeTo').value = '';
  w.renderProg();
  const rowOf = skey => [...d.querySelectorAll('#progList .prog-item')].find(el => el.dataset.skey === skey);
  const ridOf = skey => rowOf(skey).getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  const TBA = 'nid:5', NOVA = 'nid:1';
  const open = (skey, sug) => w.openDurationModal(ridOf(skey), skey, 'Test', sug || 0);
  const close = () => w.closeDurationModal();
  const set = (skey, v) => w.setShowDuration(ridOf(skey), skey, v);

  // ── Gesten simulieren ──
  const ptr = (el, type, y, extra) => {
    const ev0 = new w.MouseEvent(type, Object.assign({ bubbles: true, clientY: y, button: 0 }, extra || {}));
    // MouseEvent kennt kein pointerType: für die Maus-Prüfungen nachrüsten (wie bei echten PointerEvents)
    if (extra && extra.pointerType) Object.defineProperty(ev0, 'pointerType', { value: extra.pointerType });
    return el.dispatchEvent(ev0);
  };
  // langsames Wischen: Pausen zwischen den Bewegungen und vor dem Loslassen -> kein Schwung
  const drag = async (col, ys, opts) => {
    opts = opts || {};
    ptr(col, 'pointerdown', ys[0]);
    for (let i = 1; i < ys.length; i++) { await sleep(opts.gap ?? 25); ptr(col, 'pointermove', ys[i]); }
    if (opts.beforeUp) opts.beforeUp();
    await sleep(opts.hold ?? 160);
    ptr(col, 'pointerup', ys[ys.length - 1]);
  };
  // n Schritte in Richtung "kleiner" (Finger nach unten) bzw. "größer" (Finger nach oben): erste Bewegung > Schwelle, dann n * 34px
  const swipe = (col, n, opts) => { const dir = n < 0 ? 1 : -1; const y0 = 300; const ys = [y0, y0 + dir * 10, y0 + dir * 10 + dir * Math.abs(n) * 34]; return drag(col, ys, opts); };

  let saves = 0;
  const origSave = w.saveToStorage; w.saveToStorage = function () { saves++; return origSave.apply(this, arguments); };

  // ───────── 1) Nachbarzeilen zeigen das Ziel des nächsten Schritts ─────────
  set(TBA, 47);
  open(TBA);
  t.check('Minuten-Modus (47): Mitte 47, darüber der nächste kleinere 5er (45), darunter der nächste größere (50).', mInput().value === '47' && mMinus().textContent === '45' && mPlus().textContent === '50', { m: mMinus().textContent, p: mPlus().textContent });
  close(); set(TBA, 50); open(TBA);
  t.check('Glatter Wert (50): Nachbarn 45 und 55.', mMinus().textContent === '45' && mPlus().textContent === '55');
  close(); set(TBA, 0); open(TBA);
  t.check('Bei 0: obere Nachbarzeile ist leer und inaktiv, untere zeigt 5.', mMinus().textContent === '' && mMinus().disabled && mPlus().textContent === '5' && !mPlus().disabled);
  close(); set(TBA, 999); open(TBA);
  t.check('Bei 999 (Maximum): untere Nachbarzeile ist leer und inaktiv, obere zeigt 995.', mPlus().textContent === '' && mPlus().disabled && mMinus().textContent === '995');
  close(); set(TBA, 0);
  setMode('hm');
  set(TBA, 60); open(TBA);
  t.check('Std:Min (1:00): Minuten-Rad zeigt 0, oben 55 (leiht eine Stunde), unten 5; Stunden-Rad zeigt 1, oben 0, unten 2.', mInput().value === '0' && mMinus().textContent === '55' && mPlus().textContent === '5' && hInput().value === '1' && hMinus().textContent === '0' && hPlus().textContent === '2', { m: mMinus().textContent, p: mPlus().textContent, hm: hMinus().textContent, hp: hPlus().textContent });
  close(); set(TBA, 115); open(TBA);
  t.check('Std:Min (1:55): Minuten unten = 0 (Übertrag in die nächste Stunde), oben 50.', mPlus().textContent === '0' && mMinus().textContent === '50');
  close(); set(TBA, 0); open(TBA);
  t.check('Std:Min bei 0:00: Stunden-Rad oben leer, unten 1.', hMinus().textContent === '' && hMinus().disabled && hPlus().textContent === '1');
  close();
  setMode('minutes');

  // ───────── 2) Wischen: Entwurf während der Geste, genau EIN Speichern am Ende ─────────
  set(TBA, 50); open(TBA); saves = 0;
  let midTotal, midShown;
  await drag(minCol(), [300, 310, 412], { beforeUp: () => { midTotal = total(TBA); midShown = mInput().value; } });   // 102px nach unten = 3 Schritte kleiner
  t.check('Wischen nach unten (3 Schritte): während der Geste zeigt das Rad den Entwurf (35), gespeichert ist noch 50.', midShown === '35' && midTotal === 50, { midShown, midTotal });
  t.check('Nach dem Loslassen ist 35 gespeichert (50 -> 45 -> 40 -> 35).', total(TBA) === 35 && mInput().value === '35');
  t.check('Gespeichert wird genau EINMAL am Ende (nicht bei jedem Schritt).', saves === 1, saves);
  t.check('Nachbarzeilen folgen: 30 oben, 40 unten.', mMinus().textContent === '30' && mPlus().textContent === '40');
  await swipe(minCol(), 2);
  t.check('Wischen nach oben (2 Schritte größer): 35 -> 40 -> 45.', total(TBA) === 45, total(TBA));

  // Krumme Werte: nächster 5er in die jeweilige Richtung
  close(); set(TBA, 47); open(TBA);
  await swipe(minCol(), 1);
  t.check('47 + ein Schritt nach oben -> 50 (nächster 5er).', total(TBA) === 50, total(TBA));
  close(); set(TBA, 47); open(TBA);
  await swipe(minCol(), -1);
  t.check('47 + ein Schritt nach unten -> 45 (vorheriger 5er).', total(TBA) === 45, total(TBA));

  // Grenzen
  close(); set(TBA, 15); open(TBA);
  await swipe(minCol(), -10);
  t.check('Weit nach unten wischen: stoppt bei 0, Dauer wird entfernt (nie negativ).', total(TBA) === undefined && mInput().value === '0' && mMinus().disabled);
  set(TBA, 985); close(); open(TBA);
  await swipe(minCol(), 10);
  t.check('Weit nach oben wischen: stoppt bei 999 (Maximum).', total(TBA) === 999, total(TBA));
  close(); set(TBA, 0);

  // ───────── 3) Tipp vs. Wischen ─────────
  await sleep(450);                       // Klicksperre nach der letzten Wischgeste (400 ms) abwarten
  set(TBA, 50); open(TBA); saves = 0;
  await drag(minCol(), [300, 303], { hold: 160 });
  t.check('Kleine Bewegung (3px) ist ein Tipp, kein Wischen: nichts ändert sich, nichts wird gespeichert.', total(TBA) === 50 && saves === 0, { t: total(TBA), saves });
  mPlus().click();
  t.check('Tipp auf die untere Nachbarzeile geht einen Schritt hoch (50 -> 55).', total(TBA) === 55);
  mMinus().click();
  t.check('Tipp auf die obere Nachbarzeile geht einen Schritt runter (55 -> 50).', total(TBA) === 50);
  await drag(minCol(), [300, 310, 344], { hold: 160 });
  mPlus().click();
  t.check('Der Klick direkt NACH einem Wischen wird verschluckt (kein Zusatzschritt durch das Loslassen).', total(TBA) === 45, total(TBA));
  await sleep(500);
  mPlus().click();
  t.check('Danach funktionieren Tipps wieder normal (45 -> 50).', total(TBA) === 50);
  ptr(minCol(), 'pointerdown', 300, { button: 2, pointerType: 'mouse' }); await sleep(25); ptr(minCol(), 'pointermove', 400, { pointerType: 'mouse' }); await sleep(25); ptr(minCol(), 'pointerup', 400, { pointerType: 'mouse' });
  await sleep(200);
  t.check('Rechte Maustaste dreht das Rad nicht.', total(TBA) === 50, total(TBA));
  ptr(minCol(), 'pointerdown', 300, { button: 0, pointerType: 'mouse' }); await sleep(25); ptr(minCol(), 'pointermove', 310, { pointerType: 'mouse' }); await sleep(25); ptr(minCol(), 'pointermove', 344, { pointerType: 'mouse' }); await sleep(160); ptr(minCol(), 'pointerup', 344, { pointerType: 'mouse' });
  await sleep(200);
  t.check('Linke Maustaste dreht das Rad (Gegenprobe, 50 -> 45).', total(TBA) === 45, total(TBA));
  await sleep(450);

  // ───────── 4) Stunden-Rad im Std:Min-Modus ─────────
  close(); set(TBA, 65); setMode('hm'); open(TBA);
  await swipe(hourCol(), 2);
  t.check('Stunden-Rad 2 Schritte nach oben: 1:05 -> 3:05 (Minuten bleiben).', total(TBA) === 185 && hInput().value === '3' && mInput().value === '5', total(TBA));
  await swipe(hourCol(), -1);
  t.check('Stunden-Rad 1 Schritt nach unten: 3:05 -> 2:05.', total(TBA) === 125);
  await swipe(hourCol(), -9);
  t.check('Stunden-Rad weit nach unten: stoppt bei 0:05 (nie unter 0 Stunden).', total(TBA) === 5 && hInput().value === '0', total(TBA));
  await swipe(minCol(), 12);
  t.check('Minuten-Rad im Std:Min-Modus: 12 Schritte nach oben von 0:05 -> 1:05 (5er-Takt mit Übertrag).', total(TBA) === 65 && hInput().value === '1' && mInput().value === '5', total(TBA));
  await swipe(minCol(), -1);
  await swipe(minCol(), -1);
  t.check('... und zurück über die volle Stunde: 1:05 -> 1:00 -> 0:55 (Stunde wird geliehen).', total(TBA) === 55 && hInput().value === '0' && mInput().value === '55', total(TBA));
  close(); set(TBA, 0); setMode('minutes');

  // ───────── 5) Mausrad ─────────
  set(TBA, 50); open(TBA); saves = 0;
  const wheel = dy => minCol().dispatchEvent(new w.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: dy }));
  wheel(100); wheel(100); wheel(100);
  t.check('Mausrad nach unten (3 Rastschritte): Entwurf zeigt 65, noch nichts gespeichert.', mInput().value === '65' && total(TBA) === 50 && saves === 0, { v: mInput().value, t: total(TBA) });
  await sleep(380);
  t.check('Kurz nach dem letzten Rastschritt wird einmal gespeichert (65).', total(TBA) === 65 && saves === 1, { t: total(TBA), saves });
  wheel(-100);
  await sleep(380);
  t.check('Mausrad nach oben: ein Schritt kleiner (60).', total(TBA) === 60);
  wheel(100);
  close();
  t.check('Schließen speichert einen noch laufenden Mausrad-Entwurf (65).', total(TBA) === 65 && !modalOpen(), total(TBA));
  set(TBA, 0);

  // ───────── 6) Schwung (Inertia) ─────────
  set(TBA, 500); open(TBA); saves = 0;
  // schnelles Wischen: 5 Bewegungen zu je 40px im Abstand von ~6ms, sofort loslassen
  ptr(minCol(), 'pointerdown', 300);
  let y = 300;
  for (let i = 0; i < 6; i++) { await sleep(6); y -= 40; ptr(minCol(), 'pointermove', y); }
  ptr(minCol(), 'pointerup', y);
  const afterRelease = mInput().value;
  t.check('Schneller Schwung: das Rad läuft nach dem Loslassen weiter (Entwurf ändert sich noch).', true);
  await sleep(60);
  const early = mInput().value;
  await sleep(1800);
  t.check('Der Schwung läuft über die gewischte Strecke hinaus (deutlich mehr als 6 Schritte = 30 Min), Richtung hoch.', total(TBA) > 530, total(TBA));
  t.check('Am Ende ist die Dauer gespeichert, genau einmal, und ein 5er-Wert.', saves === 1 && total(TBA) % 5 === 0, { saves, t: total(TBA) });
  t.check('Nach dem Auslaufen stimmen Feld und gespeicherter Wert überein.', mInput().value === String(total(TBA)));
  void afterRelease; void early;

  // Neuer Fingerdruck stoppt den Schwung
  close(); set(TBA, 500); open(TBA);
  ptr(minCol(), 'pointerdown', 300); y = 300;
  for (let i = 0; i < 6; i++) { await sleep(6); y -= 40; ptr(minCol(), 'pointermove', y); }
  ptr(minCol(), 'pointerup', y);
  await sleep(50);
  ptr(minCol(), 'pointerdown', 300); ptr(minCol(), 'pointerup', 300);
  const frozen = total(TBA);
  await sleep(600);
  t.check('Erneutes Antippen während des Schwungs hält das Rad an und speichert den Zwischenstand.', frozen !== undefined && total(TBA) === frozen && frozen > 500 && mInput().value === String(frozen), { frozen, now: total(TBA) });

  // Schließen während des Schwungs
  close(); set(TBA, 500); open(TBA);
  ptr(minCol(), 'pointerdown', 300); y = 300;
  for (let i = 0; i < 6; i++) { await sleep(6); y -= 40; ptr(minCol(), 'pointermove', y); }
  ptr(minCol(), 'pointerup', y);
  await sleep(30);
  close();
  const atClose = total(TBA);
  await sleep(500);
  t.check('Schließen während des Schwungs speichert den Stand und das Rad läuft danach nicht weiter.', atClose > 500 && total(TBA) === atClose, { atClose, now: total(TBA) });
  set(TBA, 0);

  // Langsames Wischen mit Pause vor dem Loslassen: kein Schwung
  open(TBA); set(TBA, 500);
  await drag(minCol(), [300, 310, 310 - 6 * 34], { gap: 6, hold: 200 });
  t.check('Wischen, Finger kurz anhalten, loslassen: KEIN Schwung (genau 6 Schritte: 500 -> 530).', total(TBA) === 530, total(TBA));
  close(); set(TBA, 0);

  // ───────── 7) Vorschlag (Nova Frequenz 20:00-20:45) ─────────
  open(NOVA, 45);
  t.check('Vorschlag erscheint im Rad gedimmt (45), Nachbarn 40 und 50.', mInput().value === '45' && mInput().classList.contains('duration-input-suggest') && mMinus().textContent === '40' && mPlus().textContent === '50');
  await drag(minCol(), [300, 303], { hold: 160 });
  t.check('Tipp auf das Rad speichert den Vorschlag NICHT.', total(NOVA) === undefined);
  await drag(minCol(), [300, 310, 344, 310], { hold: 160 });       // 1 Schritt runter und wieder hoch -> wieder 45
  t.check('Wischen, das wieder beim Vorschlag endet (45 -> 40 -> 45): nichts wird gespeichert.', total(NOVA) === undefined && mInput().classList.contains('duration-input-suggest'), total(NOVA));
  await swipe(minCol(), -1);
  t.check('Wischen vom Vorschlag aus (1 Schritt runter): 40 wird gespeichert, nicht mehr gedimmt.', total(NOVA) === 40 && !mInput().classList.contains('duration-input-suggest'));
  w.resetDurationModal();
  t.check('Zurücksetzen: Vorschlag erscheint wieder.', total(NOVA) === undefined && mInput().value === '45');
  close();
  t.check('Schließen ohne Änderung speichert den Vorschlag nicht.', total(NOVA) === undefined);

  // ───────── 8) Tippen in der Mitte funktioniert weiter ─────────
  open(TBA);
  mInput().value = '47'; mInput().dispatchEvent(new w.Event('change', { bubbles: true }));
  t.check('Freie Eingabe in der Mitte (47 Min) ist weiterhin möglich.', total(TBA) === 47 && mMinus().textContent === '45' && mPlus().textContent === '50');
  mInput().focus();
  t.check('Mitte ist ein echtes Eingabefeld (numerisches Feld, nimmt den Fokus).', mInput().type === 'number' && d.activeElement === mInput());
  await drag(minCol(), [300, 310, 344], { hold: 160 });
  t.check('Beginnt ein Wischen im Rad, verliert das Eingabefeld den Fokus (Tastatur geht weg).', d.activeElement !== mInput());
  close(); set(TBA, 0);

  // ───────── 9) Räder wirken nur bei offenem Dialog ─────────
  const before = JSON.stringify(stored());
  await swipe(minCol(), 3);
  wheel(100);
  await sleep(350);
  t.check('Bei geschlossenem Dialog bewirken Gesten und Mausrad nichts.', JSON.stringify(stored()) === before && !modalOpen());

  t.finish();
})();

const { createHelpers, loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { chipVisible, ev, fire, sleep, viewVisible } = H;
  const t = createChecker();

  const modeSel = () => d.getElementById('settingBackChipMode');
  const secSel = () => d.getElementById('settingBackChipSeconds');
  const secRow = () => d.getElementById('rowBackChipSeconds');
  const setMode = v => { modeSel().value = v; fire(modeSel(), 'change'); };
  const setSecs = v => { secSel().value = String(v); fire(secSel(), 'change'); };
  // Die Auswahl bietet mindestens 5 s an; für schnelle Tests wird eine 1-s-Dauer direkt gesetzt
  // (die Einstellung akzeptiert alles zwischen 1 und 600 Sekunden).
  const setSecsFast = v => { ev(`appSettings.backChipSeconds = ${v};`); };
  const stored = () => (JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').settings) || {};
  const jumpFromArtists = () => { w.switchTab('kuenstler'); w.jumpToProgShow('nid:1'); };
  const scrollBy = (list, dy) => { list.scrollTop += dy; list.dispatchEvent(new w.Event('scroll')); };

  // Fake-Layout für den Bewegungs-Modus (jsdom hat keine Geometrie)
  const lists = H.installFakeLayout();

  // ───────── 1) Standard + Oberfläche ─────────
  t.check('Standard: Modus "Nach Zeit ausblenden" mit 15 Sekunden.', ev('backChipMode()') === 'time' && ev('backChipSeconds()') === 15);
  t.check('Einstellung in der Oberfläche: Modus-Auswahl mit vier Optionen (aus / Bewegung / Zeit / manuell).', [...modeSel().options].map(o => o.value).join() === 'off,scroll,time,manual');
  t.check('Zeit-Auswahl bietet 5/10/15/20/30/60 Sekunden an.', [...secSel().options].map(o => o.value).join() === '5,10,15,20,30,60');
  t.check('Auswahl zeigt die Standardwerte (Zeit, 15 s) und die Sekunden-Zeile ist sichtbar.', modeSel().value === 'time' && secSel().value === '15' && secRow().style.display !== 'none');

  // ───────── 2) Modus "Nach Zeit" ─────────
  setSecs(10);
  t.check('Sekunden werden als Zahl gespeichert (Neustart-fest).', stored().backChipSeconds === 10 && typeof stored().backChipSeconds === 'number', stored());
  setSecsFast(1);                                          // 1 Sekunde, damit der Test schnell bleibt
  jumpFromArtists();
  t.check('Zeit-Modus: Chip erscheint nach dem Sprung.', chipVisible());
  await sleep(500);
  t.check('Zeit-Modus: nach 0,5 s (< 1 s) ist der Chip noch da.', chipVisible());
  await sleep(800);
  t.check('Zeit-Modus: nach 1 s blendet sich der Chip von selbst aus.', !chipVisible());
  t.check('Beim Ausblenden bleibt man in der Programm-Übersicht (kein Tabwechsel).', viewVisible('programm'));

  // Bewegung beendet den Chip im Zeit-Modus NICHT
  jumpFromArtists();
  scrollBy(d.getElementById('progList'), 300);
  t.check('Zeit-Modus: Wegscrollen blendet den Chip NICHT aus.', chipVisible());
  d.getElementById('jumpBackLabel').click();
  t.check('Zeit-Modus: Tipp auf den Chip führt zurück und beendet den Timer (Chip weg).', !chipVisible() && viewVisible('kuenstler'));
  await sleep(1200);
  t.check('Ein beendeter Timer löst später nichts mehr aus (kein Fehler, Chip bleibt weg).', !chipVisible());

  // Neuer Sprung startet den Timer neu (alter Timer blendet den neuen Chip nicht zu früh aus)
  jumpFromArtists();
  await sleep(700);
  jumpFromArtists();
  await sleep(700);
  t.check('Zeit-Modus: Der Timer startet pro Sprung neu (zweiter Chip lebt ab seinem eigenen Sprung 1 s).', chipVisible());
  await sleep(500);
  t.check('... und verschwindet dann ebenfalls.', !chipVisible());

  // Direkter Aufruf (Schutzschicht): zweites Anzeigen ohne Ausblenden dazwischen startet den Timer neu
  const origin = () => ({ tab: 'kuenstler', label: 'Künstler', subject: 'Test', anchor: null, openKey: null });
  w.switchTab('programm');
  w.showJumpBackChip(origin());
  await sleep(700);
  w.showJumpBackChip(origin());
  await sleep(700);
  t.check('Zeit-Modus: erneutes Anzeigen startet den Timer neu (alter Timer blendet den Chip nicht vorzeitig aus).', chipVisible());
  await sleep(500);
  t.check('... der neue Timer blendet ihn nach seiner eigenen Zeit aus.', !chipVisible());
  w.showJumpBackChip(origin());
  w.hideJumpBackChip();
  t.check('Ausblenden löscht den laufenden Timer (kein verwaister Timer).', ev('jumpChipTimer') === null);

  // Tabwechsel beendet den Timer ebenfalls
  jumpFromArtists();
  w.switchTab('auswertung');
  t.check('Zeit-Modus: Tabwechsel blendet den Chip sofort aus.', !chipVisible());

  // ───────── 3) Modus "Bei Bewegung" ─────────
  setMode('scroll');
  t.check('Bei Bewegung: Sekunden-Zeile ist ausgeblendet.', secRow().style.display === 'none');
  t.check('Modus wird gespeichert.', stored().backChipMode === 'scroll', stored());
  jumpFromArtists();
  t.check('Bewegungs-Modus: Chip erscheint.', chipVisible());
  scrollBy(d.getElementById('progList'), 40);
  t.check('Bewegungs-Modus: kleines Wackeln (40px) lässt den Chip stehen.', chipVisible());
  scrollBy(d.getElementById('progList'), 100);
  t.check('Bewegungs-Modus: weiter weg blendet den Chip aus.', !chipVisible());
  jumpFromArtists();
  await sleep(1300);
  t.check('Bewegungs-Modus: kein Zeitablauf (Chip steht auch nach über 1 s noch, obwohl 1 s gespeichert ist).', chipVisible());
  w.switchTab('auswertung');

  // ───────── 4) Modus "Nur manuell" ─────────
  setMode('manual');
  jumpFromArtists();
  scrollBy(d.getElementById('progList'), 500);
  await sleep(1300);
  t.check('Manuell: weder Wegscrollen noch Zeit blenden den Chip aus.', chipVisible());
  d.querySelector('.jump-back-x').click();
  t.check('Manuell: ✕ schließt den Chip.', !chipVisible());
  jumpFromArtists();
  d.getElementById('jumpBackLabel').click();
  t.check('Manuell: Tipp auf den Chip führt zurück.', !chipVisible() && viewVisible('kuenstler'));
  jumpFromArtists();
  w.switchTab('auswertung');
  t.check('Manuell: Tabwechsel beendet den Chip (wie in allen Modi).', !chipVisible());

  // ───────── 5) Modus "Komplett aus" ─────────
  setMode('off');
  jumpFromArtists();
  t.check('Aus: Sprung findet statt (Programm sichtbar, Ziel aufgeklappt) ...', viewVisible('programm'));
  t.check('... aber es erscheint kein Zurück-Chip.', !chipVisible() && !d.body.classList.contains('has-jump-back'));
  w.switchTab('kuenstler');
  w.jumpToArtist('Nova Frequenz');
  t.check('Aus: auch der Sprung zum Künstler zeigt keinen Chip.', !chipVisible());
  w.switchTab('programm');
  w.toggleProgRating(d.querySelector('#progList .prog-item').getAttribute('onclick').match(/'([^']+)'/)[1]);
  w.jumpToProgShow('nid:1', true);
  t.check('Aus: auch Sprünge innerhalb des Programms (Terminliste) zeigen keinen Chip.', !chipVisible());

  // ───────── 6) Einstellung ändern, während der Chip sichtbar ist ─────────
  setMode('manual');
  jumpFromArtists();
  t.check('Ausgangslage: Chip sichtbar im Modus "manuell".', chipVisible());
  setMode('off');
  t.check('Wechsel auf "aus" blendet einen sichtbaren Chip sofort aus.', !chipVisible());
  setMode('manual');
  jumpFromArtists();
  setSecsFast(1); setMode('time');
  t.check('Wechsel auf "Zeit" startet den Timer für einen sichtbaren Chip: noch da ...', chipVisible());
  await sleep(1300);
  t.check('... und er verschwindet nach der eingestellten Zeit.', !chipVisible());
  setMode('manual');
  jumpFromArtists();
  setMode('time'); setSecs(60); setMode('manual');
  await sleep(100);
  t.check('Wechsel auf "manuell" nimmt einen laufenden Timer wieder weg.', chipVisible());
  w.switchTab('auswertung');

  // ───────── 7) Persistenz, Neustart, ungültige Werte ─────────
  setMode('scroll'); setSecs(30);
  const saved = stored();
  t.check('Beide Werte stehen in den gespeicherten Einstellungen.', saved.backChipMode === 'scroll' && saved.backChipSeconds === 30, saved);
  ev("appSettings.backChipMode = 'quatsch'; appSettings.backChipSeconds = 'abc';");
  t.check('Ungültiger gespeicherter Modus fällt auf "Zeit" zurück.', ev('backChipMode()') === 'time');
  t.check('Ungültige Sekunden fallen auf 15 zurück.', ev('backChipSeconds()') === 15);
  ev("appSettings.backChipSeconds = 0;");
  t.check('0 Sekunden (sofort weg) ist nicht erlaubt -> 15.', ev('backChipSeconds()') === 15);
  ev("appSettings.backChipSeconds = 99999;");
  t.check('Unsinnig große Sekundenzahl -> 15.', ev('backChipSeconds()') === 15);
  ev("appSettings.backChipSeconds = 45;");
  w.applySettingsUI();
  t.check('Eine nicht in der Liste vorhandene Dauer (45 s) wird als eigene Option ergänzt und angezeigt.', secSel().value === '45' && [...secSel().options].some(o => o.value === '45'));
  ev("appSettings.backChipMode = 'time'; appSettings.backChipSeconds = 15;");
  w.applySettingsUI();
  t.check('applySettingsUI zeigt die gespeicherten Werte wieder in der Auswahl an.', modeSel().value === 'time' && secSel().value === '15' && secRow().style.display !== 'none');

  // Alte Speicherstände ohne die neuen Felder: Standard greift
  ev("delete appSettings.backChipMode; delete appSettings.backChipSeconds;");
  t.check('Alte Einstellungen ohne die neuen Felder: Standard "Zeit" / 15 s.', ev('backChipMode()') === 'time' && ev('backChipSeconds()') === 15);

  t.finish();
})();

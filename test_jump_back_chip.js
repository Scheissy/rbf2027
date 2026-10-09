const { createHelpers, loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { detailOpen, ev, progRow, ridOfRow: ridOf, viewVisible } = H;
  const t = createChecker();
  // Dieser Test prüft das Verhalten "bei Bewegung ausblenden" (Standard der App ist seit der
  // Einstellung "nach Zeit"; die Modi testet test_back_chip_setting.js).
  ev("appSettings.backChipMode = 'scroll';");

  // ── Fake-Layout: jsdom hat keine Geometrie. Jede Zeile in progList/artistList
  // ist 100px hoch, die Liste 600px; scrollTop ist frei setzbar.
  const lists = H.installFakeLayout();

  let list;
  const chip = () => d.getElementById('jumpBackChip');
  const chipVisible = () => chip().style.display !== 'none';
  const label = () => d.getElementById('jumpBackLabel').textContent;
  const toastText = () => (d.getElementById('toast') || {}).textContent || '';
  const keyOfTop = (listId, sel) => {
    const list = d.getElementById(listId);
    return [...list.children].filter(el => el.matches(sel)).find(el => el.getBoundingClientRect().bottom > 0);
  };

  t.check('Chip existiert und ist anfangs unsichtbar.', !!chip() && !chipVisible());

  // ───────── A) Künstler -> Programm -> zurück ─────────
  w.switchTab('kuenstler');
  w.resetKuenstlerFilters();
  w.render();
  w.toggleExpand('Nova Frequenz');
  const artistList = d.getElementById('artistList');
  artistList.scrollTop = 250;                       // Zeile 2 ist oben, 50px angeschnitten
  const topBefore = keyOfTop('artistList', '.artist-item');
  const topBeforeId = topBefore.id;
  const offsetBefore = topBefore.getBoundingClientRect().top;
  t.check('Ausgangslage: gescrollt, oberste Zeile um -50px verschoben.', offsetBefore === -50 && artistList.scrollTop === 250, { offsetBefore });

  w.jumpToProgShow('nid:1');
  t.check('Nach dem Sprung ins Programm erscheint der Chip.', viewVisible('programm') && chipVisible());
  t.check('Chip nennt Ausgangs-Tab und Act: "← Künstler: Nova Frequenz".', label() === '← Künstler: Nova Frequenz', label());
  t.check('Body-Klasse für die Toast-Verschiebung ist gesetzt.', d.body.classList.contains('has-jump-back'));

  artistList.scrollTop = 0;                         // simuliert: Scrollstelle ging beim Verlassen verloren
  w.jumpBack();
  t.check('Tipp auf den Chip führt zurück in die Künstler-Übersicht.', viewVisible('kuenstler') && !viewVisible('programm'));
  t.check('Chip ist danach weg.', !chipVisible() && !d.body.classList.contains('has-jump-back'));
  t.check('Scrollstelle ist wiederhergestellt (gleiche Zeile, gleicher Versatz).',
    artistList.scrollTop === 250 && keyOfTop('artistList', '.artist-item').id === topBeforeId, { st: artistList.scrollTop });
  t.check('Der aufgeklappte Künstler ist weiterhin aufgeklappt.', ev("expandedRows.has('Nova Frequenz')"));

  // ───────── B) Programm -> Künstler -> zurück (mit offener Zeile) ─────────
  H.showAllProg({ switchTab: true, clearTimeTo: true });
  const progList = d.getElementById('progList');
  const rows = [...progList.children];
  const itemIdx = rows.findIndex(el => el.classList.contains('prog-item') && el.dataset.skey === 'nid:2');
  t.check('Ausgangslage: Programmliste mit nid:2 vorhanden.', itemIdx >= 0);
  w.toggleProgRating(ridOf(progRow('nid:2')));      // Zeile öffnen, von der aus gesprungen wird
  progList.scrollTop = Math.max(0, itemIdx * 100 - 40);
  const pTop = keyOfTop('progList', '.prog-item');
  const pKey = pTop.dataset.skey, pOffset = pTop.getBoundingClientRect().top;
  const toArtist = [...d.getElementById(`${ridOf(progRow('nid:2'))}-detail`).querySelectorAll('button')].find(b => b.textContent.includes('Zum Künstler'));
  toArtist.click();
  t.check('Nach "Zum Künstler" erscheint der Chip im Künstler-Tab.', viewVisible('kuenstler') && chipVisible());
  const entryName = ev("allProgEntries().find(x => showKey(x) === 'nid:2').name");
  t.check('Chip nennt "← Programm: <Act der Ausgangszeile>".', label() === `← Programm: ${entryName}`, label());

  progList.scrollTop = 0;
  w.jumpBack();
  t.check('Tipp auf den Chip führt zurück ins Programm.', viewVisible('programm') && !viewVisible('kuenstler') && !chipVisible());
  t.check('Die vorher geöffnete Programm-Zeile ist wieder aufgeklappt.', detailOpen('nid:2'));
  const pTopAfter = keyOfTop('progList', '.prog-item');
  t.check('Programm-Scrollstelle ist wiederhergestellt (gleiche Zeile, gleicher Versatz).',
    pTopAfter.dataset.skey === pKey && pTopAfter.getBoundingClientRect().top === pOffset, { key: pTopAfter.dataset.skey, pKey, off: pTopAfter.getBoundingClientRect().top, pOffset });

  // ───────── C) Event-Act-Chip: Betreff = Event ─────────
  ev("appSettings.showRbfEvents = true; appSettings.showMusicEvents = true; appSettings.showOtherEvents = true;");
  w.renderProg();
  const evRow = [...d.querySelectorAll('#progList .prog-item')].find(el => el.textContent.includes('Anchor Award Show'));
  w.toggleProgRating(ridOf(evRow));
  const actChip = [...d.getElementById(`${ridOf(evRow)}-detail`).querySelectorAll('.badge-link')][0];
  actChip.click();
  t.check('Sprung über Event-Act-Chip: Chip nennt das Event als Betreff.', label() === '← Programm: Anchor Award Show', label());

  // ───────── D) Chip verschwindet ─────────
  d.querySelector('.jump-back-x').click();
  t.check('✕ schließt den Chip, bleibt im Künstler-Tab.', !chipVisible() && viewVisible('kuenstler'));
  w.switchTab('programm');
  w.jumpToArtist('Nova Frequenz');
  t.check('Chip wieder da nach neuem Sprung.', chipVisible());
  w.switchTab('auswertung');
  t.check('Manueller Tabwechsel (Auswertung) beendet den Chip.', !chipVisible() && !d.body.classList.contains('has-jump-back'));
  w.switchTab('programm');
  w.jumpToArtist('Nova Frequenz');
  w.switchTab('kuenstler');
  t.check('Manueller Tabwechsel in den Ziel-Tab beendet den Chip ebenfalls.', !chipVisible());

  // ───────── E) Nur eine Ebene + Fehlsprünge ─────────
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  w.jumpToArtist('Nova Frequenz');
  t.check('Jeder Sprung ersetzt die gemerkte Stelle (Chip zeigt den letzten Ausgang: Programm).', label().startsWith('← Programm'), label());
  w.jumpBack();
  t.check('Zurück geht genau eine Ebene (ins Programm, danach kein Chip mehr).', viewVisible('programm') && !chipVisible());
  w.switchTab('kuenstler');
  ev("appSettings.hiddenLocations = ['Docks'];");
  w.jumpToProgShow('nid:1');
  t.check('Fehlgeschlagener Sprung (Location ausgeblendet) erzeugt keinen Chip.', !chipVisible() && viewVisible('kuenstler'));
  ev("appSettings.hiddenLocations = [];");
  w.jumpToProgShow('nid:does-not-exist');
  t.check('Unbekannter Auftritt erzeugt keinen Chip.', !chipVisible());
  w.switchTab('programm');
  w.jumpToArtist('Gibt Es Nicht');
  t.check('Unbekannter Künstler erzeugt keinen Chip.', !chipVisible());
  w.jumpBack();
  t.check('jumpBack() ohne gemerkte Stelle ist ein No-op.', viewVisible('programm'));

  // Chip bleibt bei Sprung aus demselben Tab aus (kein Tabwechsel -> nichts zurückzugehen)
  w.switchTab('programm');
  w.jumpToProgShow('nid:1');
  t.check('Sprung innerhalb des Programm-Tabs erzeugt keinen Chip.', !chipVisible());

  // Filter werden bei "Zurück" nicht angefasst
  w.switchTab('kuenstler');
  w.resetKuenstlerFilters();
  d.getElementById('fGender').value = ev("dataMap['Nova Frequenz'].geschlecht");
  w.render();
  const genderBefore = d.getElementById('fGender').value;
  w.jumpToProgShow('nid:1');
  w.jumpBack();
  t.check('Künstler-Filter sind nach dem Hin- und Rücksprung unverändert.', d.getElementById('fGender').value === genderBefore);


  // ───────── F) Chip blendet sich aus, sobald man die Sprungposition verlässt ─────────
  const scrollBy = (list, dy) => { list.scrollTop += dy; list.dispatchEvent(new w.Event('scroll')); };
  // Programm-Ziel
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  t.check('Ausgangslage F1: Chip sichtbar nach Sprung ins Programm.', chipVisible());
  list = d.getElementById('progList');
  list.dispatchEvent(new w.Event('scroll'));
  t.check('Scroll-Event ohne Bewegung (z. B. der Sprung-Scroll selbst) blendet den Chip nicht aus.', chipVisible());
  scrollBy(list, 40);
  t.check('Kleines Wackeln (40px) lässt den Chip stehen.', chipVisible());
  scrollBy(list, 60);
  t.check('Weiter weg als 80px von der Sprungposition (100px) blendet den Chip aus.', !chipVisible() && !d.body.classList.contains('has-jump-back'));
  scrollBy(list, -100);
  t.check('Zurückscrollen bringt den Chip nicht wieder.', !chipVisible());

  // Hochscrollen zählt genauso wie Runterscrollen
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  list = d.getElementById('progList');
  scrollBy(list, -120);
  t.check('Auch Wegscrollen nach oben blendet den Chip aus.', !chipVisible());

  // Künstler-Ziel
  w.switchTab('programm');
  w.jumpToArtist('Nova Frequenz');
  t.check('Ausgangslage F2: Chip sichtbar nach Sprung zum Künstler.', chipVisible());
  list = d.getElementById('artistList');
  scrollBy(list, 30);
  t.check('Künstler-Liste: 30px lassen den Chip stehen.', chipVisible());
  scrollBy(list, 200);
  t.check('Künstler-Liste: weit weg blendet den Chip aus.', !chipVisible());

  // Ein Sprung startet die Überwachung neu; alte Listener bleiben nicht hängen
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  w.switchTab('programm');                      // beendet Chip + Überwachung
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:2');
  list = d.getElementById('progList');
  scrollBy(list, 40);
  t.check('Nach erneutem Sprung gilt die NEUE Landeposition (40px reichen nicht).', chipVisible());
  scrollBy(list, 50);
  t.check('...und ab 90px Abstand von der neuen Landeposition verschwindet er.', !chipVisible());

  // Tippen auf den Chip nach kleinem Scroll funktioniert noch
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  list = d.getElementById('progList');
  scrollBy(list, 30);
  w.jumpBack();
  t.check('Nach kleinem Scroll bringt der Chip weiterhin zurück.', viewVisible('kuenstler') && !chipVisible());

  // Liste wird neu aufgebaut (Ziel-Zeile verschwindet) -> Chip weg
  w.switchTab('kuenstler');
  w.jumpToProgShow('nid:1');
  list = d.getElementById('progList');
  d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.day === 'Sa 18.09'));
  w.renderProg();
  list.dispatchEvent(new w.Event('scroll'));
  t.check('Ist die Ziel-Zeile nach einem Filterwechsel weg, blendet sich der Chip beim nächsten Scrollen aus.', !chipVisible());

  t.finish();
})();

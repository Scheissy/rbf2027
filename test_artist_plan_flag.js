const { createHelpers, loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { ev, progRow } = H;
  const t = createChecker();

  const flags = () => ev('JSON.stringify(planFlags)') && JSON.parse(ev('JSON.stringify(planFlags)'));
  const item = name => d.getElementById(`item-${name}`);
  const showRows = name => [...item(name).querySelectorAll('.show-row')];
  const flagBtn = (name, i) => showRows(name)[i].querySelector('.plan-flag-btn');
  const indicator = name => item(name).querySelector('.artist-row .plan-ind');
  const expanded = name => ev(`expandedRows.has(${JSON.stringify(name)})`);
  const stored = () => (JSON.parse(w.localStorage.getItem('rbf2027_v1') || '{}').planFlags) || {};
  const sortedShows = name => ev(`auftritte.filter(a => a.name === ${JSON.stringify(name)}).sort((a,b) => dayIndex(a.day)-dayIndex(b.day)||timeSortValue(a.time)-timeSortValue(b.time)).map(showKey)`);

  w.switchTab('kuenstler');
  w.resetKuenstlerFilters();
  w.render();

  // ───────── 1) Auftrittszeile: Ziel-Flag am Anfang ─────────
  w.toggleExpand('Nova Frequenz');
  const novaRow = showRows('Nova Frequenz')[0];
  const first = novaRow.firstElementChild;
  t.check('Das Ziel-Flag ist das ERSTE Element der Auftrittszeile (vor dem Tag).', first.classList.contains('plan-flag-btn') && first.textContent === '🎯');
  t.check('Danach folgen unverändert Tag, Zeit, Location, Sterne.', ['show-day', 'show-time', 'show-loc', 'stars'].every((c, i) => novaRow.children[i + 1].classList.contains(c)));
  t.check('Flag kennt seinen Auftritt (data-skey = nid:1) und ist anfangs aus.', first.dataset.skey === 'nid:1' && !first.classList.contains('active'));
  t.check('Tag und Zeit sind weiterhin Sprungziele ins Programm.', novaRow.querySelector('.show-day').getAttribute('onclick').includes("jumpToProgShow('nid:1')") && novaRow.querySelector('.show-time').getAttribute('onclick').includes("jumpToProgShow('nid:1')"));
  t.check('Ohne Ziel zeigt die Künstlerzeile kein Ziel-Icon.', !indicator('Nova Frequenz'));

  // ───────── 2) Setzen in der Künstler-Übersicht ─────────
  flagBtn('Nova Frequenz', 0).click();
  t.check('Klick setzt das Ziel für diesen Auftritt (planFlags + gespeichert).', flags()['nid:1'] === true && stored()['nid:1'] === true, { f: flags(), s: stored() });
  t.check('Button der Auftrittszeile ist danach aktiv (gold).', flagBtn('Nova Frequenz', 0).classList.contains('active'));
  t.check('Der Tipp klappt die Künstlerzeile NICHT zu (bleibt aufgeklappt).', expanded('Nova Frequenz') && showRows('Nova Frequenz').length === 1);
  t.check('Künstlerzeile zeigt jetzt das kleine Ziel-Icon.', !!indicator('Nova Frequenz') && indicator('Nova Frequenz').textContent === '🎯');
  t.check('Das Icon ist reine Anzeige (kein Button) und steht vor Herkunft/Geschlecht.',
    indicator('Nova Frequenz').tagName === 'SPAN' && indicator('Nova Frequenz').nextElementSibling.classList.contains('artist-country'));

  // Zugeklappt bleibt das Icon sichtbar
  w.toggleExpand('Nova Frequenz');
  t.check('Zugeklappt: Icon bleibt sichtbar, Auftrittszeilen sind weg.', !expanded('Nova Frequenz') && !!indicator('Nova Frequenz') && showRows('Nova Frequenz').length === 0);
  w.toggleExpand('Nova Frequenz');

  // ───────── 3) Synchron zur Programm-Übersicht ─────────
  H.showAllProg({ switchTab: true, clearTimeTo: true });
  const progFlag = skey => progRow(skey).querySelector('.plan-flag-btn');
  t.check('Programm zeigt das in der Künstler-Übersicht gesetzte Ziel als aktiv.', progFlag('nid:1').classList.contains('active'));

  progFlag('nid:1').click();                      // in der Programm-Übersicht wieder entfernen
  t.check('Entfernen im Programm: planFlags geleert.', flags()['nid:1'] === undefined && stored()['nid:1'] === undefined);
  t.check('Programm-Button ist inaktiv.', !progFlag('nid:1').classList.contains('active'));
  t.check('Künstler-Übersicht (im Hintergrund) folgt: Icon weg ...', !indicator('Nova Frequenz'));
  t.check('... und Button in der Auftrittszeile inaktiv, Zeile bleibt aufgeklappt.', !flagBtn('Nova Frequenz', 0).classList.contains('active') && expanded('Nova Frequenz'));
  progFlag('nid:1').click();                      // wieder setzen (Programm -> Künstler)
  t.check('Setzen im Programm: Künstler-Icon + Button erscheinen/aktiv.', !!indicator('Nova Frequenz') && flagBtn('Nova Frequenz', 0).classList.contains('active'));
  progFlag('nid:1').click();

  // Setzen in der Künstler-Übersicht aktualisiert den (noch gerenderten) Programm-Button live
  w.switchTab('kuenstler');
  flagBtn('Nova Frequenz', 0).click();
  t.check('Setzen in der Künstler-Übersicht zieht den Programm-Button ohne Neu-Rendern mit (aktiv).', progFlag('nid:1').classList.contains('active'));
  flagBtn('Nova Frequenz', 0).click();
  t.check('Entfernen in der Künstler-Übersicht zieht den Programm-Button ebenfalls mit (inaktiv).', !progFlag('nid:1').classList.contains('active'));

  // ───────── 4) Mehrere Auftritte eines Künstlers ─────────
  const rosaKeys = sortedShows('Rosa Mercur');
  t.check('Testdaten: Rosa Mercur hat mindestens 2 Auftritte.', rosaKeys.length >= 2, rosaKeys);
  w.switchTab('kuenstler');
  w.toggleExpand('Rosa Mercur');
  t.check('Alle Auftrittszeilen von Rosa Mercur haben ein Flag, anfangs aus.', showRows('Rosa Mercur').length === rosaKeys.length && showRows('Rosa Mercur').every(r => r.firstElementChild.classList.contains('plan-flag-btn') && !r.firstElementChild.classList.contains('active')));
  flagBtn('Rosa Mercur', 1).click();
  t.check('Ziel am 2. Auftritt: nur dieser Button aktiv, Icon in der Künstlerzeile da.', flagBtn('Rosa Mercur', 1).classList.contains('active') && !flagBtn('Rosa Mercur', 0).classList.contains('active') && !!indicator('Rosa Mercur'));
  t.check('Gesetzt wurde genau der Auftritt dieser Zeile.', flags()[rosaKeys[1]] === true && !flags()[rosaKeys[0]], flags());
  flagBtn('Rosa Mercur', 0).click();
  t.check('Beide Auftritte als Ziel: beide Buttons aktiv, ein Icon (nicht doppelt).', showRows('Rosa Mercur').every(r => r.firstElementChild.classList.contains('active')) && item('Rosa Mercur').querySelectorAll('.artist-row .plan-ind').length === 1);
  flagBtn('Rosa Mercur', 1).click();
  t.check('Einer wieder entfernt: Icon bleibt, solange noch ein Auftritt Ziel ist.', !!indicator('Rosa Mercur') && flagBtn('Rosa Mercur', 0).classList.contains('active') && !flagBtn('Rosa Mercur', 1).classList.contains('active'));
  flagBtn('Rosa Mercur', 0).click();
  t.check('Letztes Ziel entfernt: Icon verschwindet.', !indicator('Rosa Mercur') && Object.keys(flags()).length === 0, flags());

  // ───────── 5) Filter "Nur als Ziel markierte" im Programm ─────────
  w.switchTab('programm');
  w.renderProg();
  progFlag(rosaKeys[0]) && progFlag(rosaKeys[0]).click();
  d.getElementById('fProgPlanned').checked = true;
  w.renderProg();
  t.check('Ausgangslage: Filter "Nur als Ziel markierte" zeigt genau den markierten Auftritt.', !!progRow(rosaKeys[0]) && d.querySelectorAll('#progList .prog-item').length === 1);
  w.switchTab('kuenstler');
  flagBtn('Rosa Mercur', 0).click();             // in der Künstler-Übersicht entfernen
  t.check('Entfernen in der Künstler-Übersicht bei aktivem Programm-Filter: Programm-Liste ist aktualisiert (Zeile weg).', !progRow(rosaKeys[0]));
  t.check('Künstler-Übersicht ist ebenfalls aktuell (Icon weg, Button aus).', !indicator('Rosa Mercur') && !flagBtn('Rosa Mercur', 0).classList.contains('active'));
  d.getElementById('fProgPlanned').checked = false;

  // ───────── 6) Namen mit Sonderzeichen ─────────
  const stahlKey = ev("showKey(auftritte.find(a => a.name === 'Stahl & Beton'))");
  w.toggleExpand('Stahl & Beton');
  flagBtn('Stahl & Beton', 0).click();
  t.check('Name mit Sonderzeichen ("Stahl & Beton"): Ziel lässt sich setzen, Icon erscheint.', flags()[stahlKey] === true && !!indicator('Stahl & Beton'));
  flagBtn('Stahl & Beton', 0).click();
  t.check('... und wieder entfernen.', flags()[stahlKey] === undefined && !indicator('Stahl & Beton'));

  // ───────── 7) Optik: passt in die Zeile ─────────
  const css = d.querySelector('style').textContent;
  t.check('Flag in der Auftrittszeile ist klein (18px) wie die anderen Zeilen-Icons.', /\.show-row \.plan-flag-btn\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/.test(css));
  t.check('Ziel-Icon der Künstlerzeile hat dieselbe Größe wie Kommentar-/Sound-Icon (18px).', /\.plan-ind\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/.test(css) && /\.comment-icon-btn\s*\{[^}]*width:\s*18px/.test(css));
  t.check('Das Icon ist nicht schrumpfbar (flex-shrink: 0), der Name wird zuerst gekürzt.', /\.plan-ind\s*\{[^}]*flex-shrink:\s*0/.test(css));

  t.finish();
})();

const { createHelpers, loadApp, createChecker } = require('./test-helpers');

// Konsequentes Escaping: bösartige/ungewöhnliche Daten (Anführungszeichen, spitze Klammern, &, Backslash,
// Skript-Versuche, javascript:-Links) werden in allen Ansichten als TEXT dargestellt, nie als Markup
// oder Code ausgeführt - und die Bedienelemente funktionieren trotzdem.
(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const { ev } = H;
  const t = createChecker();

  const NAME = `Evil "A" <img id="pwn1" src=x onerror="window.__pwned=1"> & 'B' \\ end`;
  const LOC = `Loc <b id="pwn2">x</b> "q" 'a' & \\`;
  const GENRE = `Genre <i id="pwn3">g</i>`;
  const HERK = `Ort <u id="pwn4">h</u>, DE`;
  const COMMENT = `<img id="pwn5" src=x onerror="window.__pwned=5"> Kommentar`;
  const BAD_URL = 'javascript:window.__pwned=6';
  const REF = `Ref <img id="pwn7" src=x onerror="window.__pwned=7">`;

  // Bösartige Daten einspielen: ein Künstler mit zwei Auftritten
  w.eval(`
    dataMap[${JSON.stringify(NAME)}] = { name: ${JSON.stringify(NAME)}, genre: ${JSON.stringify(GENRE)}, herkunft: ${JSON.stringify(HERK)}, geschlecht: 'weiblich', rbfUrl: ${JSON.stringify(BAD_URL)}, discogsUrl: '', rp: 0, rl: 0, gesehen: '', customUrl: ${JSON.stringify(BAD_URL)}, manual: true, ausgeblendet: false, kommentar: ${JSON.stringify(COMMENT)}, reinhoeren: false };
    auftritte.push({ name: ${JSON.stringify(NAME)}, day: 'Do 16.09', time: '21:00', endTime: '22:00', location: ${JSON.stringify(LOC)}, nid: 9001 });
    auftritte.push({ name: ${JSON.stringify(NAME)}, day: 'Fr 17.09', time: '20:00', endTime: '21:00', location: ${JSON.stringify(LOC)}, nid: 9002 });
    updateTagFilters(); updateLocFilter && updateLocFilter();
  `);
  w.soundReferencesFor = () => [{ referenz: [REF], kategorie: `<i id="pwn8">kat</i>` }];
  // Eingeschleust wäre: Elemente mit den Test-Ids (pwn1 ...), <img>-Elemente, onerror-Attribute, zusätzliche
  // Skript-Elemente. (Der bösartige Text darf als Text bzw. als maskiertes Handler-Argument vorkommen.)
  const baseScripts = d.querySelectorAll('script').length;
  const hostile = () => [...d.querySelectorAll('[id^="pwn"], img, [onerror]')].concat(d.querySelectorAll('script').length === baseScripts ? [] : [d.createElement('script')]);
  const noInjection = (label) => t.check(`${label}: kein eingeschleustes Markup/Skript im DOM.`, hostile().length === 0 && w.__pwned === undefined && !d.querySelector('a[href^="javascript:" i]'), { ids: [...hostile()].map(e => e.id || e.tagName), pwned: w.__pwned });

  // ───────── Künstler-Übersicht ─────────
  w.switchTab('kuenstler'); w.resetKuenstlerFilters();
  ev("selectedGenres.clear();"); d.getElementById('search').value = 'evil';
  w.render();
  const item = d.getElementById(`item-${NAME}`);
  t.check('Künstler-Liste: die Zeile des bösartigen Künstlers existiert; ihre Id ist der rohe Name (Suche per getElementById geht).', !!item);
  noInjection('Künstler-Liste (zugeklappt)');
  t.check('Künstler-Liste: der Name erscheint als Text.', !!item && item.querySelector('.artist-name').textContent.includes(NAME));
  ev(`expandedRows.add(${JSON.stringify(NAME)});`); w.renderArtistItem(NAME);
  noInjection('Künstler-Liste (aufgeklappt)');
  const det = d.getElementById(`item-${NAME}`);
  t.check('Aufgeklappt: Genre, Location und Tag erscheinen als Text, nicht als Markup.', det.querySelector('.detail-genre').textContent === GENRE && [...det.querySelectorAll('.show-row')].every(r => r.textContent.includes(LOC)) && det.querySelectorAll('.show-row').length === 2);
  t.check('Aufgeklappt: Links mit javascript:-Adresse werden entschärft (kein href mit Skript).', ![...det.querySelectorAll('a')].some(a => /^\s*javascript:/i.test(a.getAttribute('href') || '')));
  // Bedienung mit bösartigem Namen: Sterne, Ausblenden, Reinhören, Kommentar
  const star = [...det.querySelectorAll('.stars')][0].querySelector('span');
  star.click();
  t.check('Sterne-Klick mit bösartigem Namen setzt die Bewertung (Handler hält Anführungszeichen/Backslash aus).', ev(`dataMap[${JSON.stringify(NAME)}].rp`) > 0);
  [...d.getElementById(`item-${NAME}`).querySelectorAll('.detail-link-btn')].find(b => /Reinhören/.test(b.textContent)).click();
  t.check('Sterne-Klick aktualisiert auch die Mini-Sterne in der Künstlerzeile (Id mit rohem Namen auffindbar).', !!d.getElementById(`avg-mini-${NAME}`) && d.getElementById(`avg-mini-${NAME}`).innerHTML.length > 0);
  const cArea = d.getElementById(`item-${NAME}`).querySelector('textarea');
  cArea.value = 'Hallo Welt'; cArea.dispatchEvent(new w.Event('input', { bubbles: true }));
  t.check('Kommentar tippen bei Namen mit Anführungszeichen/Apostroph/Backslash: wird gespeichert und der Zähler zählt (früher: Id passte nicht zur Suche).', ev(`dataMap[${JSON.stringify(NAME)}].kommentar`) === 'Hallo Welt' && d.getElementById(`comment-count-${NAME}`).textContent === '10/250', d.getElementById(`comment-count-${NAME}`) && d.getElementById(`comment-count-${NAME}`).textContent);
  ev(`dataMap[${JSON.stringify(NAME)}].kommentar = ${JSON.stringify(COMMENT)};`);
  w.renderArtistItem(NAME);
  t.check('Reinhören-Button mit bösartigem Namen funktioniert.', ev(`dataMap[${JSON.stringify(NAME)}].reinhoeren`) === true);
  const cmtBtn = d.getElementById(`item-${NAME}`).querySelector('.comment-icon-btn');
  t.check('Kommentar-Symbol erscheint und öffnet das Modal mit dem Kommentar als Text.', !!cmtBtn && (cmtBtn.click(), d.getElementById('commentModalText').textContent === COMMENT));
  w.closeModal('commentModal');
  const hideBtn = [...d.getElementById(`item-${NAME}`).querySelectorAll('.detail-link-btn')].find(b => /Ausblenden/.test(b.textContent));
  hideBtn.click();
  t.check('Ausblenden-Button mit bösartigem Namen funktioniert.', ev(`dataMap[${JSON.stringify(NAME)}].ausgeblendet`) === true);
  ev(`dataMap[${JSON.stringify(NAME)}].ausgeblendet = false;`);
  w.openSoundRefModal(NAME);
  noInjection('Soundreferenz-Modal');
  t.check('Soundreferenz-Modal: Referenz und Kategorie als Text.', d.getElementById('soundRefModalBody').textContent.includes(REF));
  w.closeModal('soundRefModal');

  // ───────── Programm-Übersicht ─────────
  H.showAllProg({ switchTab: true, reset: true });
  const prow = d.querySelector(`#progList .prog-item[data-skey="nid:9001"]`);
  t.check('Programm-Liste: die Zeile des bösartigen Auftritts ist vorhanden.', !!prow);
  noInjection('Programm-Liste (zugeklappt)');
  t.check('Programm-Zeile: Name und Location als Text.', prow.querySelector('.prog-name').textContent.includes(NAME) && prow.querySelector('.prog-loc').textContent.includes(LOC));
  const rid = H.ridOf('nid:9001');
  w.toggleProgRating(rid);
  noInjection('Programm-Detailansicht');
  const pdet = d.getElementById(`${rid}-detail`);
  t.check('Programm-Detail: Links ohne javascript:-Adresse, "Zum Künstler"-Button vorhanden.', ![...pdet.querySelectorAll('a')].some(a => /^\s*javascript:/i.test(a.getAttribute('href') || '')) && [...pdet.querySelectorAll('button')].some(b => /Zum Künstler/.test(b.textContent)));
  const terms = d.getElementById(`${rid}-terms`);
  t.check('Terminliste: Tag und Location als Text, zwei Termine.', !!terms && terms.querySelectorAll('.prog-term').length === 2 && terms.textContent.includes(LOC));
  [...pdet.querySelectorAll('button')].find(b => /Zum Künstler/.test(b.textContent)).click();
  t.check('"Zum Künstler" mit bösartigem Namen springt in die Künstler-Übersicht.', H.viewVisible('kuenstler') && !!d.getElementById(`item-${NAME}`));
  H.showAllProg({ switchTab: true, reset: true });
  const rid2 = H.ridOf('nid:9001'); w.toggleProgRating(rid2);
  const termRow = [...d.getElementById(`${rid2}-terms`).querySelectorAll('.prog-term')].find(r => !r.classList.contains('current'));
  termRow.click();
  t.check('Terminliste: Klick auf den anderen Termin springt dorthin (Schlüssel im Handler korrekt maskiert).', H.detailOpen('nid:9002'));
  noInjection('Nach Sprung');
  ev("appSettings.showRbfEvents = true;");

  // Sonderveranstaltung mit bösartigem Tag, Kategorie, Act-Namen und Link (Programm-Liste mit Tages-Überschrift)
  const DAYBAD = 'Sa 18.09<i id="pwn9">d</i>';
  const origFiltered = w.getFilteredAuftritte;
  w.getFilteredAuftritte = () => [{ name: 'Ev "x"', day: DAYBAD, time: '20:00', endTime: '', location: LOC, acts: [NAME, '<img id="pwn10" src=x onerror="window.__pwned=10">'], kategorie: 'Musik <u id="pwn11">k</u>', url: 'javascript:window.__pwned=12', nid: 'evt-99', isEvent: true }];
  w.switchTab('programm'); w.renderProg();
  noInjection('Programm-Liste mit Sonderveranstaltung');
  t.check('Tages-Überschrift zeigt den bösartigen Tag als Text.', d.querySelector('#progList .prog-day-header').textContent === DAYBAD);
  const erow = d.querySelector('#progList .prog-item');
  w.toggleProgRating(erow.getAttribute('onclick').match(/'([^']+)'/)[1]);
  noInjection('Sonderveranstaltung (Detailansicht)');
  const chips = [...d.querySelectorAll('#progList .prog-detail .badge')];
  t.check('Act-Chips der Sonderveranstaltung zeigen die Namen als Text (auch der Skript-Versuch).', chips.some(c => c.textContent === NAME) && chips.some(c => c.textContent.includes('<img id="pwn10"')));
  t.check('Sonderveranstaltung: Link mit javascript:-Adresse wird entschärft.', ![...d.querySelectorAll('#progList a')].some(a => /^\s*javascript:/i.test(a.getAttribute('href') || '')));
  w.getFilteredAuftritte = origFiltered;
  w.eval(`SOUND_REFERENCES.push({ referenz: [${JSON.stringify(REF)}], kategorie: 'k' });`);
  w.updateTagFilters();
  t.check('Herkunft-Auswahl: der bösartige Herkunftswert steht als Wert/Text in der Auswahl (nicht als Markup).', ev(`splitTags(${JSON.stringify(HERK)})`).every(tag => [...d.getElementById('fHerkunft').options].some(o => o.value === tag)));
  noInjection('Soundreferenz-Auswahl (Filter)');
  t.check('Soundreferenz-Auswahl: Eintrag erscheint als Text.', [...d.getElementById('fSoundRef').options].some(o => o.textContent === REF && o.value === REF));

  // ───────── Filter-Dialoge und Chips ─────────
  ev(`selectedLocs.add(${JSON.stringify(LOC)}); progSelectedGenres.add(${JSON.stringify(GENRE)}); selectedGenres.add(${JSON.stringify(GENRE)});`);
  w.openLocModal(); noInjection('Location-Filter-Dialog');
  t.check('Location-Dialog: die bösartige Location erscheint als Text.', [...d.querySelectorAll('#locModal .genre-check-label')].some(l => l.textContent === LOC));
  const locRow = [...d.querySelectorAll('#locModal .genre-check-row')].find(r => r.textContent.includes(LOC));
  t.check('Location-Dialog: Tipp auf die Zeile schaltet sie um (Handler hält Sonderzeichen aus).', (() => { const before = ev(`selectedLocs.has(${JSON.stringify(LOC)})`); locRow.click(); return ev(`selectedLocs.has(${JSON.stringify(LOC)})`) !== before; })());
  w.closeModal('locModal');
  w.openProgGenreModal(); noInjection('Programm-Genre-Dialog'); w.closeModal('progGenreModal');
  w.openGenreModal(); noInjection('Genre-Dialog'); w.closeModal('genreModal');
  w.openLocManageModal(); noInjection('Locations-verwalten-Dialog');
  t.check('Locations verwalten: Location als Text.', [...d.querySelectorAll('#locManageModal .genre-check-label')].some(l => l.textContent === LOC));
  const mrow = [...d.querySelectorAll('#locManageModal .genre-check-row')].find(r => r.textContent.includes(LOC));
  mrow.click();
  t.check('Locations verwalten: Umschalten mit bösartigem Ortsnamen funktioniert.', ev(`appSettings.hiddenLocations.includes(${JSON.stringify(LOC)})`) === true);
  ev("appSettings.hiddenLocations = [];"); w.closeModal('locManageModal');
  w.updateProgChips && w.updateProgChips(); noInjection('Filter-Chips');
  ev("selectedLocs.clear(); progSelectedGenres.clear(); selectedGenres.clear();");

  // ───────── Auswertung ─────────
  ev(`planFlags['nid:9001'] = true; showDurations['nid:9001'] = 60; showRatings['nid:9001'] = 4; dataMap[${JSON.stringify(NAME)}].gesehen = 'ja';`);
  w.switchTab('auswertung');
  noInjection('Auswertung');

  // ───────── Die Helfer selbst ─────────
  t.check('escapeHtml maskiert & < > " \' und wandelt Nicht-Texte (Zahlen) in Text.', w.escapeHtml(`&<>"'`) === '&amp;&lt;&gt;&quot;&#39;' && w.escapeHtml(5) === '5' && w.escapeHtml('') === '');
  const tricky = ['a\'b', 'a"b', 'a\\b', 'a\\\'b', 'zeile1\nzeile2', 'cr\rx', 'u2028\u2028x', '</script><b>', '&quot;&amp;', 'Ümläut ñ 日本', "'; alert(1); '", '\\'];
  t.check('escJs: das Ergebnis ergibt in einem einfach gequoteten JS-String wieder genau den Originaltext (Round-Trip).', tricky.every(x => w.eval(`'${w.escJs(x)}'`) === x), tricky.filter(x => w.eval(`'${w.escJs(x)}'`) !== x));
  const clicked = []; w.__probe = v => clicked.push(v);
  const holder = d.createElement('div'); d.body.appendChild(holder);
  tricky.forEach(x => { holder.innerHTML = `<button onclick="__probe('${w.jsArg(x)}')">x</button>`; holder.firstChild.click(); });
  t.check('jsArg: in einem echten onclick-Attribut kommt der Originaltext als Argument an (auch mit Anführungszeichen, Backslash, Umbruch, Entities).', clicked.length === tricky.length && clicked.every((v, i) => v === tricky[i]), clicked.filter((v, i) => v !== tricky[i]));
  holder.remove();
  t.check('safeUrl: normale Links bleiben, Skript-Schemas (auch groß, mit Leerraum/Tab/Umbruch) werden leer.', w.safeUrl('https://x.org/a?b=1') === 'https://x.org/a?b=1' && w.safeUrl('http://x.org') === 'http://x.org' && w.safeUrl('') === '' && w.safeUrl(null) === '' && ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', '  javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', '\u0001javascript:alert(1)', 'data:text/html,x', 'vbscript:x'].every(u => w.safeUrl(u) === ''));
  const ids = ['Nova Frequenz', 'Stahl & Beton', "Dov'è", 'a_b', 'a b', 'a-b', 'A', 'a', 'é', 'Evil "x"', 'a\\b', ''];
  const safe = ids.map(x => w.idSafe(x));
  t.check('idSafe: Ergebnis enthält nur [A-Za-z0-9_-] und ist eindeutig (verschiedene Namen -> verschiedene Ids, auch "a_b" vs. "a b").', safe.every(s => /^[A-Za-z0-9_-]*$/.test(s)) && new Set(safe).size === ids.length, safe);
  t.check('idSafe: Beispiel "Stahl & Beton" -> keine Leerzeichen/Sonderzeichen mehr, einfache Namen bleiben.', !/[ &]/.test(w.idSafe('Stahl & Beton')) && w.idSafe('Nova') === 'Nova');

  t.check('Während des gesamten Durchlaufs gab es keine JavaScript-Fehler.', errors.length === 0, errors);
  t.finish();
})();

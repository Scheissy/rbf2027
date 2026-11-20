const { loadApp, createHelpers, createChecker } = require('./test-helpers');

// Die Sonderfälle des Mini-Datensatzes (rbf-data.test.js, ab "Sonderfälle"): Genres mit Schrägstrich im Namen,
// deutsche Ländernamen mit Mehrfachländern, GROSS-/klein-/Akzent-Namen, Ziffer/Sonderzeichen/Präfix am Namen,
// sehr langer Name, Doppelauftritt am selben Tag, Venues mit Präfix-Namen und Sonderzeichen. Der Test prüft die
// DATEN-Annahmen und das Verhalten der App an genau diesen Fällen (Trenner " / " vs. "/" im Genre, Sortierung
// nach Gebietsschema, akzent-/groß-klein-unabhängige Suche, exakter Location-Filter, Escaping im Venue-Namen).
(async () => {
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const { ev, fire } = H;
  const t = createChecker();

  const arr = x => Array.from(x);
  const sameSet = (a, b) => JSON.stringify(arr(a).sort()) === JSON.stringify(arr(b).sort());
  const taxonomy = ['Indie', 'Pop', 'Alternative', 'Rock', 'Hip-Hop/Rap', 'Electronic/Live', 'Punk', 'Singer-Songwriter', 'Folk', "R'n'B/Soul", 'Heavy Metal', 'Electronic/DJ', 'Funk', 'Jazz', 'Global', 'Country'];

  const search = v => { d.getElementById('search').value = v; };
  const kNames = () => arr(ev('getSorted(getFiltered()).map(x => x.name)'));
  const resetK = () => { search(''); ev("selectedGenres.clear(); document.getElementById('fHerkunft').value = '';"); ev("sortCol = 'name'; sortDir = 1;"); };
  const showAllProg = () => { w.switchTab('programm'); w.resetProgFilters(); d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active')); d.getElementById('timeFrom').value = '08:00'; d.getElementById('timeTo').value = ''; w.renderProg(); };
  const progNames = () => arr(d.querySelectorAll('.prog-name')).map(e => e.textContent.replace(/\s+/g, ' ').trim());
  const hasName = (list, n) => list.some(x => x.startsWith(n));

  // ───────── 1) Datenvertrag ─────────
  const all = arr(ev('Object.values(dataMap)'));
  t.check('Alle Künstler stehen in der Künstlerliste (26 Einträge, keine Namens-Kollision in dataMap).', all.length === 26 && ev('RAW.length') === 26, [all.length, ev('RAW.length')]);
  t.check('Namen, die sich nur in Groß-/Kleinschreibung unterscheiden, sind getrennte Einträge mit eigenen Daten ("Vesper Noir" Alternative, "VESPER NOIR" Heavy Metal).', ev("dataMap['Vesper Noir'].genre") === 'Alternative' && ev("dataMap['VESPER NOIR'].genre") === 'Heavy Metal');
  t.check('... ebenso die Namen, die sich nur im Akzent unterscheiden ("Mélodie Océane" / "Melodie Oceane").', ev("dataMap['Mélodie Océane'].herkunft") === 'Frankreich' && ev("dataMap['Melodie Oceane'].herkunft") === 'Brasilien');
  const tagsOf = field => { const s = new Set(); all.forEach(x => arr(w.splitTags(x[field])).forEach(g => s.add(g))); return [...s]; };
  const genreTags = tagsOf('genre');
  t.check('Alle Genre-Werte stammen aus der echten 16er-Taxonomie.', genreTags.every(g => taxonomy.includes(g)), genreTags.filter(g => !taxonomy.includes(g)));
  t.check('Die Schrägstrich-Genres sind im Datensatz als GANZE Werte da (Hip-Hop/Rap, Electronic/Live, Electronic/DJ, R\'n\'B/Soul) ...', ['Hip-Hop/Rap', 'Electronic/Live', 'Electronic/DJ', "R'n'B/Soul"].every(g => genreTags.includes(g)), genreTags);
  t.check('... und es gibt keine Bruchstücke davon (Rap, Live, DJ, Soul, Electronic, R\'n\'B, Hip-Hop).', ['Rap', 'Live', 'DJ', 'Soul', 'Electronic', "R'n'B", 'Hip-Hop'].every(g => !genreTags.includes(g)), genreTags);
  t.check('Herkunft: nur Ländernamen (kein "Stadt, Land"-Format), mit Mehrfachländern "A / B".', all.every(x => !x.herkunft.includes(',')) && all.some(x => x.herkunft.includes(' / ')), all.map(x => x.herkunft));

  // ───────── 2) splitTags: " / " trennt, "/" ohne Leerzeichen nicht ─────────
  const cases = [
    ['Hip-Hop/Rap', ['Hip-Hop/Rap']],
    ['Electronic/Live / Pop', ['Electronic/Live', 'Pop']],
    ["Pop / R'n'B/Soul", ['Pop', "R'n'B/Soul"]],
    ['Hip-Hop/Rap / Funk', ['Hip-Hop/Rap', 'Funk']],
    ['Deutschland / Frankreich', ['Deutschland', 'Frankreich']],
    ['  Pop  /  Rock  ', ['Pop', 'Rock']],
    ['Pop', ['Pop']],
    ['', []], [undefined, []], [null, []], [' / ', []],
  ];
  cases.forEach(([inp, exp]) => t.check(`splitTags(${JSON.stringify(inp)}) = ${JSON.stringify(exp)}`, JSON.stringify(arr(w.splitTags(inp))) === JSON.stringify(exp), arr(w.splitTags(inp))));

  // ───────── 3) Genre-Filter mit Schrägstrich-Labels ─────────
  resetK();
  w.renderGenreModalList && w.renderGenreModalList();
  const tags = arr(ev('allGenreTags'));
  t.check('Genre-Liste der App: ganze Labels, alphabetisch (de), keine Bruchstücke.', tags.includes('Hip-Hop/Rap') && tags.includes("R'n'B/Soul") && !tags.includes('Rap') && !tags.includes('Soul') && JSON.stringify(tags) === JSON.stringify([...tags].sort((a, b) => a.localeCompare(b, 'de'))), tags);
  w.toggleGenreSelection('Hip-Hop/Rap');
  t.check('Künstler-Tab, Filter "Hip-Hop/Rap": genau Grauzone Sieben und MC Pegelstand (auch als Zweitgenre).', JSON.stringify(kNames()) === JSON.stringify(['Grauzone Sieben', 'MC Pegelstand']), kNames());
  w.toggleGenreSelection('Hip-Hop/Rap');
  w.toggleGenreSelection('Electronic/Live');
  const live = kNames();
  w.toggleGenreSelection('Electronic/Live'); w.toggleGenreSelection('Electronic/DJ');
  const dj = kNames();
  w.toggleGenreSelection('Electronic/DJ');
  t.check('"Electronic/Live" und "Electronic/DJ" sind verschiedene Filter (kein gemeinsames "Electronic").', sameSet(live, ['Nova Frequenz', 'Blau Neon', 'M.O.N.D. (Live!)']) && sameSet(dj, ['Stahl & Beton', 'DJ Mitternacht', 'Marathon Sessions']), { live, dj });
  w.toggleGenreSelection('Funk');
  t.check('"Funk" trifft nur Künstler mit dem Genre Funk (Namen mit "Funk" zählen nicht, Mehrfach-Genres schon).', sameSet(kNames(), ['Funkeninsel', 'DJ Mitternacht', 'MC Pegelstand', 'Tandem Orchester']), kNames());
  w.toggleGenreSelection('Funk');
  search('rap');
  t.check('Textsuche "rap" findet die Hip-Hop/Rap-Künstler über den Genre-Text.', sameSet(kNames(), ['Grauzone Sieben', 'MC Pegelstand']), kNames());
  resetK();

  // Per Klick im Modal (Genre mit Apostroph UND Schrägstrich im Namen: Escaping in onclick)
  showAllProg();
  w.openProgGenreModal();
  const soulRow = arr(d.querySelectorAll('#progGenreModalList .genre-check-row')).find(r => r.textContent.includes("R'n'B/Soul"));
  t.check('Programm-Genre-Modal: Zeile "R\'n\'B/Soul" ist da, Text unverfälscht.', !!soulRow && soulRow.textContent.trim().endsWith("R'n'B/Soul"), soulRow && soulRow.textContent);
  if (soulRow) soulRow.click();
  t.check('Klick auf die Zeile wählt genau dieses Genre aus (Apostroph/Schrägstrich im onclick heil).', ev('progSelectedGenres.size') === 1 && ev("progSelectedGenres.has(\"R'n'B/Soul\")"), arr(ev('[...progSelectedGenres]')));
  w.closeModal('progGenreModal');
  t.check('Programm-Liste zeigt danach nur The Wunderlampen und Mélodie Océane.', sameSet(progNames().filter(n => !/Anchor Award|Podcast/.test(n)).map(n => n.replace(/\s*(⚓|weiblich|männlich|mixed|divers).*$/, '').trim()), ['The Wunderlampen', 'Mélodie Océane']), progNames());
  w.resetProgFilters();

  // ───────── 4) Herkunft ─────────
  resetK();
  const opts = arr(d.querySelectorAll('#fHerkunft option')).map(o => o.value).filter(Boolean);
  t.check('Herkunfts-Auswahl: einzelne Länder (Deutschland, Frankreich, Kap Verde ...), nie die Kombination "Deutschland / Frankreich".', opts.includes('Frankreich') && opts.includes('Deutschland') && opts.includes('Kap Verde') && !opts.some(o => o.includes(' / ')), opts);
  ev("document.getElementById('fHerkunft').value = 'Frankreich'");
  t.check('Herkunft "Frankreich" trifft auch Künstler mit mehreren Ländern (Blau Neon: Deutschland / Frankreich).', JSON.stringify(kNames()) === JSON.stringify(['Blau Neon', 'Mélodie Océane', 'Vesper Noir']), kNames());
  resetK();
  w.render();
  const countryOf = n => { const row = arr(d.querySelectorAll('#artistList .artist-row')).find(r => r.querySelector('.artist-name') && r.querySelector('.artist-name').textContent.trim().startsWith(n)); return row && row.querySelector('.artist-country') && row.querySelector('.artist-country').textContent.trim(); };
  t.check('Künstler-Zeile kürzt die Herkunft ab, auch bei mehreren Ländern ("Deutschland / Frankreich" -> "DE / FR", "Kap Verde" -> "CV", "UK" bleibt).', countryOf('Blau Neon') === 'DE / FR' && countryOf('Funkeninsel') === 'CV' && countryOf('Lila Oktober') === 'UK', [countryOf('Blau Neon'), countryOf('Funkeninsel'), countryOf('Lila Oktober')]);

  // ───────── 5) Namen: Sortierung und Suche ─────────
  const sorted = kNames();
  const ix = n => sorted.indexOf(n);
  t.check('Sortierung nach Namen folgt dem Gebietsschema, nicht ASCII: "Die Fabelhafte ..." vor "DJ Mitternacht".', ix('Die Fabelhafte Welt der Nachtschwärmer und Mondlichtkapelle') !== -1 && ix('Die Fabelhafte Welt der Nachtschwärmer und Mondlichtkapelle') < ix('DJ Mitternacht'), sorted);
  t.check('Klein geschriebener Name sortiert zwischen den Großgeschriebenen ("kleiner funkenflug" vor "Kollektiv Nachtfalter", nicht am Ende).', ix('kleiner funkenflug') !== -1 && ix('kleiner funkenflug') < ix('Kollektiv Nachtfalter') && ix('kleiner funkenflug') > ix('Funkeninsel'), sorted);
  t.check('GROSS geschriebener Name: "LAUTER LEISE" vor "Lila Oktober".', ix('LAUTER LEISE') !== -1 && ix('LAUTER LEISE') < ix('Lila Oktober'), sorted);
  t.check('Name mit Ziffer am Anfang ("3 Takte Freiheit") steht ganz vorn.', ix('3 Takte Freiheit') === 0, sorted.slice(0, 3));
  t.check('Namen, die sich nur in Groß/Klein oder Akzent unterscheiden, stehen direkt nebeneinander.', Math.abs(ix('Vesper Noir') - ix('VESPER NOIR')) === 1 && Math.abs(ix('Mélodie Océane') - ix('Melodie Oceane')) === 1, sorted);
  const q = s => { search(s); const r = kNames(); search(''); return r; };
  t.check('Suche "melodie" findet beide Schreibweisen (mit und ohne Akzent).', sameSet(q('melodie'), ['Mélodie Océane', 'Melodie Oceane']), q('melodie'));
  t.check('Suche "mélodie" (mit Akzent) findet ebenfalls beide.', sameSet(q('mélodie'), ['Mélodie Océane', 'Melodie Oceane']), q('mélodie'));
  t.check('Suche "VESPER noir" findet Groß- und Kleinschreibung-Variante.', sameSet(q('VESPER noir'), ['Vesper Noir', 'VESPER NOIR']), q('VESPER noir'));
  t.check('Suche findet Sonderzeichen-Namen: "m.o.n.d", "zeit·raum".', sameSet(q('m.o.n.d'), ['M.O.N.D. (Live!)']) && sameSet(q('zeit·raum'), ['Zeit·Raum']), [q('m.o.n.d'), q('zeit·raum')]);
  t.check('Suche "3 takte" findet den Namen mit Ziffer am Anfang, "wunderlampen" den mit "The"-Präfix.', sameSet(q('3 takte'), ['3 Takte Freiheit']) && sameSet(q('wunderlampen'), ['The Wunderlampen']));
  t.check('Suche "nachtschwarmer" (ohne Umlaut) findet den langen Namen mit "ä".', sameSet(q('nachtschwarmer'), ['Die Fabelhafte Welt der Nachtschwärmer und Mondlichtkapelle']), q('nachtschwarmer'));
  w.render();
  const domNames = arr(d.querySelectorAll('#artistList .artist-name')).map(e => e.textContent.trim());
  t.check('Der 59 Zeichen lange Name wird in der Künstler-Übersicht vollständig ausgegeben (kein Abschneiden im Text).', domNames.some(n => n.startsWith('Die Fabelhafte Welt der Nachtschwärmer und Mondlichtkapelle')), domNames.slice(0, 5));

  // ───────── 6) Doppelauftritt am selben Tag ─────────
  const tandem = arr(ev("artistShowsSorted('Tandem Orchester').map(a => [a.day, a.time, a.location].join('|'))"));
  t.check('Zwei Auftritte am selben Tag, chronologisch (18:00 Prinzenbar, 23:15 Docks).', JSON.stringify(tandem) === JSON.stringify(['Fr 17.09|18:00|Prinzenbar', 'Fr 17.09|23:15|Docks']), tandem);
  t.check('Hinweis auf weitere Termine: am ersten Auftritt ja, am letzten nein.', ev("hasLaterShow(auftritte.find(a => a.nid === 20))") === true && ev("hasLaterShow(auftritte.find(a => a.nid === 21))") === false);
  showAllProg();
  t.check('Beide Auftritte stehen am Freitag in der Programm-Liste.', progNames().filter(n => n.startsWith('Tandem Orchester')).length === 2, progNames());

  // ───────── 7) Validierung der Testdaten ─────────
  const issues = arr(w.validateAuftritte(true));
  t.check('Die Sonderfälle sind datentechnisch sauber: nur die beabsichtigten Auffälligkeiten (Maps-Fallback der Fischauktionshalle, 4-Stunden-Auftritt).', issues.length === 2 && issues.some(i => i.includes('Fischauktionshalle') && i.includes('Maps-Eintrag')) && issues.some(i => i.includes('Marathon Sessions') && i.includes('lange Show') && i.includes('(4h)')), issues);

  // ───────── 8) Venues: Präfix-Namen und Sonderzeichen ─────────
  const locNames = arr(ev('allLocationNames()'));
  t.check('Venue-Liste enthält "Hafen" und "Hafen Bar" getrennt, der kürzere Name zuerst.', locNames.indexOf('Hafen') !== -1 && locNames.indexOf('Hafen Bar') === locNames.indexOf('Hafen') + 1, locNames);
  const onlyLoc = (...locs) => { showAllProg(); locs.forEach(l => w.toggleLocSelection(l)); const r = progNames().filter(n => !/Anchor Award|Podcast/.test(n)).map(n => n.replace(/\s*(⚓|weiblich|männlich|mixed|divers).*$/, '').trim()); w.resetProgFilters(); return r; };
  t.check('Location-Filter "Hafen" trifft NUR "Hafen" (nicht "Hafen Bar"): vier Auftritte.', sameSet(onlyLoc('Hafen'), ['LAUTER LEISE', 'kleiner funkenflug', 'The Wunderlampen', 'Vesper Noir']), onlyLoc('Hafen'));
  t.check('Location-Filter "Hafen Bar" trifft NUR "Hafen Bar": vier Auftritte.', sameSet(onlyLoc('Hafen Bar'), ['Marathon Sessions', 'M.O.N.D. (Live!)', 'MC Pegelstand', 'VESPER NOIR']), onlyLoc('Hafen Bar'));
  t.check('Beide zusammen: acht Auftritte.', onlyLoc('Hafen', 'Hafen Bar').length === 8, onlyLoc('Hafen', 'Hafen Bar'));
  const odd = 'Kiez-Bühne® @ Hinterhof/Garten';
  showAllProg();
  w.openLocModal();
  const oddRow = arr(d.querySelectorAll('#locModalList .genre-check-row')).find(r => r.textContent.includes('Kiez-Bühne'));
  t.check('Location-Modal zeigt den Venue-Namen mit ®, @ und / unverfälscht.', !!oddRow && oddRow.textContent.trim() === odd, oddRow && oddRow.textContent);
  if (oddRow) oddRow.click();
  w.closeModal('locModal');
  const oddNames = progNames().filter(n => !/Anchor Award|Podcast/.test(n)).map(n => n.replace(/\s*(⚓|weiblich|männlich|mixed|divers).*$/, '').trim());
  t.check('Klick im Modal wählt genau diese Venue (Escaping im onclick heil): "3 Takte Freiheit" und "Kurzschluss".', sameSet(oddNames, ['3 Takte Freiheit', 'Kurzschluss']), oddNames);
  t.check('Die Location steht in den Zeilen vollständig und unverfälscht.', arr(d.querySelectorAll('#progList')).some(el => el.textContent.includes(odd)));
  const url = w.mapsUrl(odd);
  t.check('Maps-Link der Venue: Adresse (Spielbudenplatz 1, 20359 Hamburg) korrekt URL-kodiert.', url === 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Spielbudenplatz 1, 20359 Hamburg'), url);
  const rowEl = arr(d.querySelectorAll('#progList .prog-item')).find(r => r.textContent.includes('Kurzschluss'));
  const rid = rowEl.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  w.toggleProgRating(rid);
  const mapLink = rowEl.querySelector('[onclick*="openMaps"]') || d.getElementById(`${rid}-detail`).querySelector('[onclick*="openMaps"]');
  let opened = null; const origOpen = w.open; w.open = u => { opened = u; return null; };
  if (mapLink) mapLink.click();
  w.open = origOpen;
  t.check('Klick auf den Maps-Link öffnet genau diese Adresse (Venue-Name mit Sonderzeichen heil durch onclick).', !!mapLink && opened === url, { found: !!mapLink, opened });
  w.resetProgFilters();

  // ───────── 9) Nichts davon wirft Fehler ─────────
  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

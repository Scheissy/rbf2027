const { createHelpers, loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const H = createHelpers(w, d);
  const { ev } = H;
  const t = createChecker();

  const detailOf = name => {
    w.switchTab('kuenstler');
    w.resetKuenstlerFilters();
    w.render();
    if (!ev(`expandedRows.has(${JSON.stringify(name)})`)) w.toggleExpand(name);
    return d.getElementById(`item-${name}`).querySelector('.artist-detail');
  };
  const links = det => [...det.querySelectorAll('.detail-links a')];

  // ───────── 1) Datenmodell: optionales 6. Element der RAW-Zeile ─────────
  t.check('Künstler mit Discogs-URL in den Daten: discogsUrl ist übernommen.', ev("dataMap['Nova Frequenz'].discogsUrl") === 'https://www.discogs.com/artist/123-Nova-Frequenz');
  t.check('Künstler ohne 6. Element: discogsUrl ist leer (kein undefined).', ev("dataMap['Stahl & Beton'].discogsUrl") === '');
  t.check('Alle bisherigen Felder bleiben unverändert (rbfUrl, genre).', ev("dataMap['Nova Frequenz'].rbfUrl") === 'https://example.org/artist/nova-frequenz' && ev("dataMap['Nova Frequenz'].genre") === 'Electro / Pop');

  // ───────── 2) Bereinigung ─────────
  const clean = v => w.cleanExternalUrl(v);
  t.check('https-Link wird übernommen.', clean('https://www.discogs.com/artist/1') === 'https://www.discogs.com/artist/1');
  t.check('http-Link wird übernommen, Leerraum drumherum entfernt.', clean('  http://www.discogs.com/artist/1 \n') === 'http://www.discogs.com/artist/1');
  t.check('Leerer String, undefined, null, Zahl -> kein Link.', clean('') === '' && clean(undefined) === '' && clean(null) === '' && clean(42) === '');
  t.check('javascript:/data:/mailto:-Links werden verworfen.', clean('javascript:alert(1)') === '' && clean('data:text/html,x') === '' && clean('mailto:a@b.de') === '');
  t.check('Text ohne Schema oder mit Leerzeichen mitten im Link wird verworfen.', clean('www.discogs.com/artist/1') === '' && clean('https://exa mple.org') === '');
  t.check('Links mit Anführungszeichen, Backslash oder spitzen Klammern werden verworfen (stören sonst HTML/JS).', ['https://x.org/a"b', "https://x.org/a'b", 'https://x.org/a\\b', 'https://x.org/<b>'].every(v => clean(v) === ''));
  t.check('Prozent-kodierte Sonderzeichen sind erlaubt.', clean('https://www.discogs.com/artist/1-Stahl%20%26%20Beton') === 'https://www.discogs.com/artist/1-Stahl%20%26%20Beton');

  // ───────── 3) Anzeige in der Künstler-Detailansicht ─────────
  const nova = detailOf('Nova Frequenz');
  const novaLinks = links(nova);
  t.check('Mit Discogs-Link: zwei Links in der Kopfzeile (RBF + Discogs).', novaLinks.length === 2, novaLinks.map(a => a.textContent));
  t.check('RBF-Link ist bei vorhandenem Discogs-Link gekürzt ("↗ RBF"), Platz für längere Genres.', novaLinks[0].textContent.trim() === '↗ RBF');
  t.check('Discogs-Link steht direkt neben dem RBF-Link und heißt "↗ Discogs".', novaLinks[1].textContent.trim() === '↗ Discogs' && novaLinks[1].classList.contains('detail-link-discogs'));
  t.check('RBF-Link zeigt weiterhin auf die RBF-Seite.', novaLinks[0].getAttribute('href') === 'https://example.org/artist/nova-frequenz');
  t.check('Discogs-Link zeigt auf das hinterlegte Profil, öffnet extern (target _blank, noopener).', novaLinks[1].getAttribute('href') === 'https://www.discogs.com/artist/123-Nova-Frequenz' && novaLinks[1].target === '_blank' && /noopener/.test(novaLinks[1].rel));
  t.check('Discogs-Link läuft wie der RBF-Link über openExternal.', novaLinks[1].getAttribute('onclick').includes("openExternal(event,'https://www.discogs.com/artist/123-Nova-Frequenz')"));
  t.check('Beide Links stehen in der Kopfzeile neben dem Genre (gleiche Zeile wie .detail-genre).', nova.querySelector('.detail-genre').parentElement === nova.querySelector('.detail-links').parentElement);
  t.check('Link-Gruppe schrumpft/umbricht nicht (flex-shrink 0, nowrap), das Genre gibt nach.', /\.detail-links\s*\{[^}]*flex-shrink:\s*0[^}]*white-space:\s*nowrap/.test(d.querySelector('style').textContent));

  const stahl = detailOf('Stahl & Beton');
  const stahlLinks = links(stahl);
  t.check('Ohne Discogs-Link: nur der RBF-Link, unverändert beschriftet "↗ RBF-Seite öffnen".', stahlLinks.length === 1 && stahlLinks[0].textContent.trim() === '↗ RBF-Seite öffnen', stahlLinks.map(a => a.textContent));
  t.check('Ohne Discogs-Link kein Discogs-Element (und kein leerer Platzhalter).', !stahl.querySelector('.detail-link-discogs') && !/Discogs/.test(stahl.querySelector('.detail-links').textContent));

  // ───────── 4) Eigene URL (customUrl) und Sonderzeichen ─────────
  ev("dataMap['Nova Frequenz'].customUrl = 'https://example.org/custom/nova';");
  const nova2 = detailOf('Nova Frequenz'); w.renderArtistItem('Nova Frequenz');
  const nova2Links = links(d.getElementById('item-Nova Frequenz').querySelector('.artist-detail'));
  t.check('Eigene RBF-URL (customUrl) hat weiter Vorrang beim RBF-Link; Discogs bleibt daneben.', nova2Links[0].getAttribute('href') === 'https://example.org/custom/nova' && nova2Links[1].textContent.trim() === '↗ Discogs');
  ev("dataMap['Nova Frequenz'].customUrl = '';");

  ev("dataMap['Nova Frequenz'].discogsUrl = \"https://www.discogs.com/artist/1?x=\\\"a&b'c\";");
  w.renderArtistItem('Nova Frequenz');
  const trick = d.getElementById('item-Nova Frequenz').querySelector('.detail-link-discogs');
  t.check('Link mit Anführungszeichen/&/Apostroph bricht das Markup nicht (href bleibt vollständig, ein Link-Element).', !!trick && trick.getAttribute('href') === "https://www.discogs.com/artist/1?x=\"a&b'c" && d.getElementById('item-Nova Frequenz').querySelectorAll('.detail-link-discogs').length === 1);
  t.check('... und der onclick-Aufruf ist durch Escaping gültig (Apostroph maskiert, Anführungszeichen als Entity).', trick.getAttribute('onclick').includes("\\'c") && trick.getAttribute('onclick').includes('x="a&b'));
  ev("dataMap['Nova Frequenz'].discogsUrl = 'https://www.discogs.com/artist/123-Nova-Frequenz';");
  w.renderArtistItem('Nova Frequenz');

  // ───────── 5) Datenbasis: Zeilen ohne 6. Element dürfen nie brechen ─────────
  t.check('Alle Künstler laden fehlerfrei; nur Nova Frequenz hat in den Testdaten einen Discogs-Link.', ev("Object.values(dataMap).filter(x => x.discogsUrl).map(x => x.name).join()") === 'Nova Frequenz');
  t.check('Ausgeblendete Künstler und die übrigen Detailbereiche (Gesehen, Kommentar, Ausblenden) sind unverändert vorhanden.', !!nova.querySelector('.detail-ratings-row') && !!nova.querySelector('.detail-link-btn'));

  t.finish();
})();

const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  w.currentTab = 'programm';
  w.renderProg();

  // ── Regressionscheck: Event-URL-Verlinkung (aus vorheriger Änderung) ──────
  // Die Detailansicht wird seit der Performance-Optimierung erst beim Aufklappen
  // gebaut - geprüft wird deshalb der Inhalt der aufgeklappten Detailansicht
  // der jeweiligen Zeile (nicht mehr das HTML der gesamten Liste).
  {
    const detailOf = name => {
      const row = [...d.querySelectorAll('#progList .prog-item')].find(el => el.querySelector('.prog-name').textContent.includes(name));
      const rid = row.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
      w.toggleProgRating(rid);
      const html = d.getElementById(`${rid}-detail`).innerHTML;
      w.toggleProgRating(rid);
      return html;
    };
    const anchor = detailOf('Anchor Award Show'), podcast = detailOf('RBF Podcast Live'), nova = detailOf('Nova Frequenz');
    t.check('Event MIT url ("Anchor Award Show") zeigt weiterhin den Veranstaltungs-Link.',
      anchor.includes('href="https://example.org/event/anchor-award-show"') && anchor.includes('↗ Veranstaltung öffnen'));
    t.check('Event OHNE url ("RBF Podcast Live") zeigt weiterhin keinen Veranstaltungs-Link.',
      podcast.length > 0 && !podcast.includes('↗ Veranstaltung öffnen'));
    t.check('Regulärer Künstler-Auftritt verlinkt weiterhin zur Künstlerseite.',
      nova.includes('href="https://example.org/artist/nova-frequenz"') && nova.includes('↗ RBF-Seite öffnen'));
  }

  // Testdaten enthalten "RBF Podcast Live" (Do 16.09, ohne url). Wir suchen
  // dessen nid über allProgEntries(), um toggleEventHidden() gezielt für
  // genau dieses Event aufzurufen.
  const entries = w.allProgEntries();
  const podcastEvent = entries.find(e => e.name === 'RBF Podcast Live');
  if (!t.check('Testevent "RBF Podcast Live" gefunden.', !!podcastEvent)) return t.finish();
  const nid = podcastEvent.nid;

  // 1) Vor dem Ausblenden: Event ist sichtbar (Standard-Filter: Ausgeblendete NICHT anzeigen)
  w.renderProg();
  let listHtml = d.getElementById('progList').innerHTML;
  t.check('Event ist initial sichtbar.', listHtml.includes('RBF Podcast Live'));

  // 2) Ausblenden auslösen
  // Hinweis: `hiddenEvents` ist eine Top-Level `let`-Variable im Inline-Script
  // und daher (wie in echten Browsern auch) keine Property von `window` -
  // wir prüfen den Effekt deshalb ausschließlich über das gerenderte DOM.
  w.toggleEventHidden(nid);

  // 3) Nach dem Ausblenden: Event verschwindet aus der Standard-Ansicht
  //    (progShowHidden-Checkbox ist per Default nicht angehakt)
  listHtml = d.getElementById('progList').innerHTML;
  t.check('"Ausgeblendete anzeigen" ist standardmäßig aus.', !d.getElementById('progShowHidden').checked);
  t.check('Ausgeblendetes Event verschwindet aus der gefilterten Liste.', !listHtml.includes('RBF Podcast Live'));

  // 4) "Ausgeblendete Künstler/Events mit anzeigen" aktivieren -> Event kommt zurück, mit Badge
  d.getElementById('progShowHidden').checked = true;
  w.renderProg();
  listHtml = d.getElementById('progList').innerHTML;
  t.check('Event erscheint wieder, wenn "Anzeigen" aktiviert wurde.', listHtml.includes('RBF Podcast Live'));
  const hasHiddenBadge = /RBF Podcast Live[\s\S]{0,300}?🙈/.test(listHtml) || /🙈[\s\S]{0,300}?RBF Podcast Live/.test(listHtml);
  t.check('Ausgeblendetes Event erscheint mit 🙈-Badge, wenn "Anzeigen" aktiv ist.', hasHiddenBadge);

  // 5) Regulärer Künstler-Auftritt (Nova Frequenz) bleibt vom Event-Ausblenden unberührt
  t.check('Regulärer Künstler-Auftritt bleibt unberührt.', listHtml.includes('Nova Frequenz'));

  // 6) Wieder einblenden -> Event ist regulär (ohne Anzeigen-Haken) sichtbar
  d.getElementById('progShowHidden').checked = false;
  w.toggleEventHidden(nid);
  listHtml = d.getElementById('progList').innerHTML;
  t.check('Event ist nach dem Zurücksetzen wieder regulär sichtbar.', listHtml.includes('RBF Podcast Live'));

  // 7) Persistenz: ausblenden, speichern, Programm-Tab neu rendern nach
  //    simuliertem Reload (loadFromStorage() liest aus echtem jsdom-localStorage)
  w.toggleEventHidden(nid);
  w.saveToStorage();
  w.loadFromStorage(); // liest u.a. hiddenEvents zurück (Effekt nur intern, kein DOM-Trigger)
  w.renderProg();
  listHtml = d.getElementById('progList').innerHTML;
  t.check('hiddenEvents wird korrekt persistiert/geladen (Event bleibt nach Reload ausgeblendet).', !listHtml.includes('RBF Podcast Live'));

  t.finish();
})();

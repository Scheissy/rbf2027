// ── js/06-bewertung.js ── Sterne-Bewertungen, Ziel-Markierung (Plan-Flag) ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('06-bewertung');

// ── STARS ─────────────────────────────────────────────────────────────────────
// Gemeinsamer Generator für klickbare Bewertungs-Sterne. Unterscheiden sich
// nur in CSS-Klasse und dem aufgerufenen Setter (als String, da er direkt ins
// onclick-Attribut des generierten HTML eingebettet wird).
function ratingStarsHTML(val, cssClass, onclickFor) {
  return Array.from({ length: MAX }, (_, i) => {
    const n = i + 1;
    return `<span class="${cssClass}${n <= val ? ' on' : ''}" onclick="${onclickFor(n)}">★</span>`;
  }).join('');
}
function starsHTML(name, field) {
  const val = dataMap[name] ? dataMap[name][field] : 0;
  const nj = escJs(name);
  return ratingStarsHTML(val, 'star', n => `setRating('${nj}','${field}',${n})`);
}
// Führt render() der Künstlerliste aus, ohne dass dabei die Scrollposition
// verloren geht: render() ersetzt das innerHTML des scrollenden Containers
// selbst, was scrollTop sonst hart auf 0 zurücksetzt (spürbar v.a. auf dem
// Handy: eine aufgeklappte Detailansicht wirkt dann wie "zugeklappt", ist
// aber nur aus dem sichtbaren Bereich gescrollt). Einmaliges, synchrones
// Rücksetzen reicht auf manchen mobilen Browsern nicht zuverlässig aus, wenn
// noch eine Momentum-Scroll-Bewegung im Gange ist und den gesetzten Wert
// gleich wieder überschreibt - daher zusätzlich ein zweiter Versuch im
// nächsten Frame.
function renderKuenstlerPreservingScroll() {
  const list = document.getElementById('artistList');
  const prevScroll = list.scrollTop;
  render();
  list.scrollTop = prevScroll;
  requestAnimationFrame(() => { list.scrollTop = prevScroll; });
}

// Für Filter-/Suchänderungen reicht der reine Pixel-Offset oben NICHT aus:
// ändert sich dabei die Ergebnismenge selbst (z.B. durch Hinzufügen einer
// weiteren Genre-Auswahl werden plötzlich mehr/andere Künstler eingeblendet),
// zeigt derselbe Pixel-Offset auf einmal auf eine völlig andere Stelle in der
// neuen Liste - genau das ist das gemeldete "man landet plötzlich woanders".
// Stattdessen wird der Künstler gemerkt, dessen Zeile vor dem Rendern zuerst
// (mindestens teilweise) sichtbar war (jede Zeile trägt "item-<Name>" als
// ID, siehe render()), und nach dem Rendern - falls dieser Künstler weiterhin
// in der gefilterten Liste vorkommt - wieder an dieselbe relative Position im
// sichtbaren Bereich gescrollt. Ist er jetzt rausgefiltert, wird bewusst ganz
// nach oben gescrollt - ein geänderter Filter zeigt dann die neue Ergebnis-
// liste von Anfang an, statt an einer für die neue Liste beliebigen Stelle.
// Gemeinsames Scroll-Anker-Muster für Künstler- UND Programm-Übersicht: merkt
// sich den ersten sichtbaren Eintrag VOR dem Neu-Rendern über einen stabilen
// Schlüssel (nicht über die Position - die kann sich durch einen Filter
// ändern), rendert neu, und richtet die Scroll-Position danach wieder exakt
// an diesem Eintrag aus. Ist der Anker selbst nicht mehr vorhanden, kann
// optional findNeighborKeys(anchorKey) eine Liste von Ersatz-Schlüsseln
// liefern (der Reihe nach probiert, erster Treffer gewinnt) - ohne diesen
// Parameter (Künstler-Übersicht) wird stattdessen ganz nach oben gescrollt.
//
//   listId:          ID des scrollenden Containers
//   isRowEl(el):     welche Kinder des Containers überhaupt als "Zeile"
//                    zählen (z.B. Tages-Header ausschließen)
//   keyOf(el):       Element -> stabiler Schlüssel, unabhängig von der Position
//   renderFn():      die eigentliche, ungeschützte Render-Funktion
//   findNeighborKeys(anchorKey): optional, siehe oben
function preserveScrollAnchor(listId, isRowEl, keyOf, renderFn, findNeighborKeys) {
  const list = document.getElementById(listId);
  const listRect = list.getBoundingClientRect();
  let anchorKey = null, anchorOffset = 0;
  for (const item of list.children) {
    if (!isRowEl(item)) continue;
    const r = item.getBoundingClientRect();
    if (r.bottom > listRect.top) {
      anchorKey = keyOf(item);
      anchorOffset = r.top - listRect.top;
      break;
    }
  }
  renderFn();
  const findItem = key => [...list.children].find(el => isRowEl(el) && keyOf(el) === key);
  let target = anchorKey ? findItem(anchorKey) : null;
  if (!target && anchorKey && findNeighborKeys) {
    for (const key of findNeighborKeys(anchorKey)) {
      target = findItem(key);
      if (target) break;
    }
  }
  if (target) {
    const newListRect = list.getBoundingClientRect();
    const newR = target.getBoundingClientRect();
    list.scrollTop += (newR.top - newListRect.top) - anchorOffset;
    return;
  }
  list.scrollTop = 0;
}
function renderKuenstlerPreservingAnchor() {
  preserveScrollAnchor('artistList',
    el => el.id && el.id.startsWith('item-'),
    el => el.id.slice(5),
    render);
}
function setRating(name, field, val) {
  if (!dataMap[name]) return;
  dataMap[name][field] = (dataMap[name][field] === val) ? 0 : val;
  saveToStorage();
  // Ist der Künstler-Ø-Filter aktiv, kann sich die Listenzugehörigkeit durch
  // die geänderte Bewertung ändern -> volle Neu-Filterung nötig.
  if (currentTab === 'kuenstler' && kuenstlerAvgFilter > 0) {
    renderKuenstlerPreservingScroll();
    return;
  }
  const el = document.getElementById(`sr-${field}-${name}`);
  if (el) el.innerHTML = starsHTML(name, field);
  const avgEl = document.getElementById(`avg-mini-${name}`);
  if (avgEl) avgEl.outerHTML = avgMiniStarsHTML(dataMap[name]);
  updateStats();
}
// Gemeinsamer Generator für nicht-klickbare "Mini-Sterne"-Anzeigen (Künstler-
// Durchschnitt in der Programm-Übersicht bzw. Auftritts-Bewertungs-Zusammenfassung).
// Unterscheiden sich nur in der CSS-Klasse für die eigene Akzentfarbe.
// Unterstützt halb ausgefüllte Sterne (z.B. bei einem Durchschnitt von 3.5) -
// bei ganzzahligen Werten (Auftritts-Bewertung, nie ein Durchschnitt) kann der
// "half"-Zustand nie eintreten, daher unkritisch für diesen Anwendungsfall.
function miniStarsHTML(val, cssClass) {
  return Array.from({ length: MAX }, (_, i) => {
    const diff = val - i;
    const state = diff >= 1 ? ' on' : diff >= 0.5 ? ' half' : '';
    return `<span class="${cssClass}${state}">★</span>`;
  }).join('');
}
function miniStars(val) {
  return miniStarsHTML(val, 'prog-mini-star');
}
// Editierbare Sterne innerhalb der Programm-Detailansicht (eigener Klick-Handler,
// da derselbe Künstler mit mehreren Auftritten gleichzeitig in der Liste stehen kann).
// WICHTIG: "name" ist hier IMMER der rohe (unescapte) Künstlername - für den
// dataMap-Lookup nötig. Das Escaping für den onclick-Aufbau passiert bewusst
// erst intern (analog zu starsHTML()/planFlagHTML()) - vorher wurde hier teils
// der bereits escapte Name übergeben, was den dataMap-Lookup bei Namen mit
// Apostroph (z.B. "Dov'è Liana") stillschweigend fehlschlagen ließ, UND beim
// Neu-Zeichnen nach einem Klick teils der rohe Name direkt (unescaped) in den
// nächsten onclick eingebaut wurde, was dessen JS-Syntax brach - beides zusammen
// war der Grund, warum die Bewertung für Künstler mit Sonderzeichen weder
// angezeigt noch nach dem ersten Setzen geändert werden konnte.
function progStarsHTML(rid, name, field) {
  const val = dataMap[name] ? dataMap[name][field] : 0;
  const nameEsc = escJs(name);
  return ratingStarsHTML(val, 'star', n => `setProgRating('${rid}','${nameEsc}','${field}',${n})`);
}
// Auftritts-Bewertung: eigenständige Sterne-Skala pro konkreter Show (nicht pro Künstler).
// Fließt bewusst NICHT in dataMap/rp/rl bzw. den Bewertungsdurchschnitt ein.
function progShowStarsHTML(rid, skey) {
  const val = showRatings[skey] || 0;
  const keyEsc = escJs(skey);
  return ratingStarsHTML(val, 'star star-show', n => `setShowRating('${rid}','${keyEsc}',${n})`);
}
function miniStarsShow(val) {
  return miniStarsHTML(val, 'show-mini-star');
}
// Blendet die gemeinsame Zeile aus Auftritts-Bewertung + Dauer in der
// eingeklappten Programm-Zeile ein/aus, je nachdem ob mindestens eine der
// beiden Angaben aktuell gesetzt ist. Wird von setShowRating() UND
// setShowDuration() aufgerufen, da beide Werte in derselben Zeile stehen.
function updateShowMetaRowVisibility(rid) {
  const row = document.getElementById(`${rid}-showmetarow`);
  if (!row) return;
  // Ist die Detailansicht gerade aufgeklappt, bleibt die Kopfzeilen-Anzeige
  // ausgeblendet - Bewertung & Dauer sind dort ja schon (editierbar) zu sehen,
  // eine zusätzliche Anzeige wäre nur doppelter, unnötiger Platzverbrauch
  // (gerade auf dem Handy relevant).
  const detail = document.getElementById(`${rid}-detail`);
  if (detail && !detail.classList.contains('collapsed')) { row.style.display = 'none'; return; }
  const ss = document.getElementById(`${rid}-showsummary`);
  const ds = document.getElementById(`${rid}-durationsummary`);
  const visible = (ss && ss.style.display !== 'none') || (ds && ds.style.display !== 'none');
  row.style.display = visible ? '' : 'none';
}
// Zeilen-Markierung "besucht" (Namensfarbe + Seitenstreifen) nach einer
// Änderung von Dauer/Auftritts-Bewertung ohne Neu-Rendern nachziehen.
function updateProgRowVisited(rid, skey) {
  // Die Markierung hängt am Künstler: alle sichtbaren Zeilen mit demselben
  // Namen werden mitgezogen, nicht nur die bearbeitete.
  const entry = auswertungEntries().find(x => showKey(x) === skey);
  const name = entry ? entry.name : null;
  const visited = name !== null ? artistsWithVisitedShows().has(name)
    : ((showDurations[skey] || 0) > 0 || (showRatings[skey] || 0) > 0);
  const rids = (name !== null && progRidsByName[name]) || [rid];
  rids.forEach(r => {
    const rowEl = document.getElementById(`${r}-row`);
    if (rowEl) rowEl.classList.toggle('prog-item-visited', visited);
  });
  refreshTermineLists(skey);
}
function setShowRating(rid, skey, n) {
  showRatings[skey] = (showRatings[skey] === n) ? 0 : n;
  if (!showRatings[skey]) delete showRatings[skey];
  saveToStorage();
  const starsEl = document.getElementById(`${rid}-show`);
  if (starsEl) starsEl.innerHTML = progShowStarsHTML(rid, skey);
  const val = showRatings[skey] || 0;
  const summaryEl = document.getElementById(`${rid}-showsummary`);
  if (summaryEl) {
    summaryEl.style.display = val ? '' : 'none';
    summaryEl.innerHTML = miniStarsShow(val);
  }
  updateShowMetaRowVisibility(rid);
  updateProgRowVisited(rid, skey);
}

// ── AUFTRITTS-DAUER ─────────────────────────────────────────────────────────
// Formatiert Minuten als "45 Min" / "1h" / "1h 15min" für Anzeige & Eingabefeld.
// ── PLAN-FLAG ─────────────────────────────────────────────────────────────────
// Markiert einzelne Auftritte als "eingeplant" - direkt aus der eingeklappten
// Zeile heraus umschaltbar (kein Aufklappen nötig), daher immer sichtbar
// (anders als z.B. das Kommentar-Icon, das nur bei vorhandenem Inhalt
// erscheint). Grau/gedimmt = nicht markiert, volle Farbe = markiert.
function planFlagHTML(rid, skey) {
  const flagged = !!planFlags[skey];
  return `<button type="button" class="plan-flag-btn${flagged ? ' active' : ''}" id="${rid}-planflag" data-skey="${escapeHtml(skey)}" onclick="event.stopPropagation();togglePlanFlag('${rid}','${escJs(skey)}')" title="${flagged ? 'Als Ziel markiert' : 'Als Ziel markieren'}">🎯</button>`;
}
function togglePlanFlag(rid, skey) {
  const wasFlagged = !!planFlags[skey];
  if (wasFlagged) delete planFlags[skey];
  else planFlags[skey] = true;
  saveToStorage();
  // Das Ziel-Flag gehört zum einzelnen Auftritt und wird in beiden Übersichten
  // angezeigt (Programm: links unter der Zeit, Künstler: am Anfang der
  // Auftrittszeile + kleines Ziel-Icon in der Künstlerzeile). Deshalb werden
  // ALLE Buttons dieses Auftritts und die Künstlerzeile mitgezogen, egal von
  // wo aus umgeschaltet wurde.
  document.querySelectorAll('.plan-flag-btn').forEach(btn => {
    if (btn.dataset.skey !== skey) return;
    btn.outerHTML = planFlagHTML(btn.id.replace(/-planflag$/, ''), skey);
  });
  const entry = auftritte.find(x => showKey(x) === skey);
  if (entry && dataMap[entry.name]) renderArtistItem(entry.name);
  refreshTermineLists(skey);
  // Wird das Flag entfernt, während der "Nur als Ziel markierte"-Filter aktiv
  // ist, muss die Zeile aus der Programm-Liste verschwinden -> volle
  // Neu-Filterung nötig (gleiches Muster wie beim Dauer-Filter).
  if (document.getElementById('fProgPlanned').checked && wasFlagged) renderProg();
}
// Kleines Ziel-Icon in der (auch zugeklappten) Künstlerzeile: erscheint, sobald
// mindestens ein Auftritt des Künstlers als Ziel markiert ist. Reine Anzeige -
// der Tipp klappt wie überall in der Zeile die Auftritte auf, umgeschaltet wird
// in der Auftrittszeile.
function planIconHTML(name) {
  const any = auftritte.some(a => a.name === name && planFlags[showKey(a)]);
  return any ? `<span class="plan-ind" title="Mindestens ein Auftritt ist als Ziel markiert">🎯</span>` : '';
}


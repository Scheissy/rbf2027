// ── js/14-programmliste.js ── Programm-Zeilen: Detailansicht, Listenaufbau, Cache ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('14-programmliste');

// Merkt sich, welche rids (Zeilen-Ids) in der aktuell gerenderten Programm-
// Liste zu welchem Künstlernamen gehören. Notwendig, weil ein Künstler mit
// mehreren Auftritten gleichzeitig mehrfach in der Liste stehen kann - beim
// Ändern der (künstlerbezogenen) Bewertung/des Gesehen-Status müssen ALLE
// seine sichtbaren Zeilen aktualisiert werden, nicht nur die angeklickte.
let progRidsByName = {};

// Detailansicht einer Programm-Zeile. Wird NICHT mehr für alle Zeilen vorab
// gebaut (das waren ~70 % des gesamten Listen-HTMLs und der Hauptgrund für die
// Wartezeit beim Wechsel/Sprung ins Programm), sondern erst beim Aufklappen
// (siehe toggleProgRating) - und dabei jedes Mal frisch aus dem aktuellen
// Zustand, nie veraltet. Es ist immer nur eine Detailansicht gleichzeitig offen.
function progDetailHTML(a, rid) {
  const d = dataMap[a.name];
  const skey = showKey(a);
  const nj = escJs(a.name);
  const skeyEsc = escJs(skey);
  return `
      ${d ? `<div class="prog-detail-row prog-detail-row-split" onclick="event.stopPropagation()">
        <div class="prog-detail-pair"><span class="prog-detail-label">Promo</span><div class="stars stars-sm" id="${rid}-rp">${progStarsHTML(rid,a.name,'rp')}</div></div>
        ${appSettings.showListening ? `<div class="prog-detail-pair"><span class="prog-detail-label">Listening</span><div class="stars stars-sm" id="${rid}-rl">${progStarsHTML(rid,a.name,'rl')}</div></div>` : ''}
      </div>
      <div class="prog-detail-row" onclick="event.stopPropagation()"><span class="prog-detail-label">Gesehen</span>${seenButtonsHTML(a.name, d, rid)}</div>
      <div style="display:flex;gap:6px 14px;align-items:center;flex-wrap:wrap;margin-top:6px">
        <a class="prog-detail-link" style="margin-top:0" href="${d.customUrl || d.rbfUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();return openExternal(event,'${escJs(d.customUrl || d.rbfUrl)}')">↗ RBF-Seite öffnen</a>
        <button type="button" class="prog-detail-link-btn" onclick="event.stopPropagation();runJump(()=>jumpToArtist('${nj}'))">👤 Zum Künstler</button>
        <button type="button" class="prog-detail-link-btn" onclick="event.stopPropagation();toggleHidden('${nj}')">${d.ausgeblendet ? '👁 Einblenden' : '🙈 Ausblenden'}</button>
      </div>` : (a.isEvent ? `<div class="prog-detail-row">
        <div class="detail-label">${a.kategorie === 'Musik' ? '🎵' : '🎪'} Sonderveranstaltung · ${a.kategorie}</div>
        ${a.acts && a.acts.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${a.acts.map(n => {
          const dd = dataMap[n];
          return dd ? `<span class="badge badge-link ${genderBadgeClass(dd.geschlecht)}" style="font-size:10px" role="button" title="Zum Künstler" onclick="event.stopPropagation();runJump(()=>jumpToArtist('${escJs(n)}'))">${n}</span>` : `<span class="badge" style="font-size:10px;background:var(--surface2);color:var(--text2)">${n}</span>`;
        }).join('')}</div>` : ''}
      </div>
      <div style="display:flex;gap:14px;align-items:center;margin-top:6px">
        ${a.url ? `<a class="prog-detail-link" style="margin-top:0" href="${a.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();return openExternal(event,'${escJs(a.url)}')">↗ Veranstaltung öffnen</a>` : ''}
        <button type="button" class="prog-detail-link-btn" onclick="event.stopPropagation();toggleEventHidden('${escJs(a.nid)}')">${hiddenEvents[a.nid] ? '👁 Einblenden' : '🙈 Ausblenden'}</button>
      </div>` : `<div class="prog-detail-row">Künstler nicht in der Liste gefunden.</div>`)}
      <div class="prog-detail-divider"></div>
      <div class="prog-detail-row prog-detail-row-split" onclick="event.stopPropagation()">
        <div class="prog-detail-pair"><span class="prog-detail-label">Auftritt</span><div class="stars stars-sm" id="${rid}-show">${progShowStarsHTML(rid,skey)}</div></div>
        <div class="prog-detail-pair"><span class="prog-detail-label">Dauer</span>${durationButtonHTML(rid, skeyEsc, nj, skey, suggestedDurationMin(a))}</div>
      </div>
      ${termineSectionHTML(a, rid)}
    `;
}

// Merkt sich nach jedem Listenaufbau, für welchen Stand er gemacht wurde. Beim
// Wechsel in den Programm-Tab (und bei Sprüngen) wird die Liste nur dann neu
// aufgebaut, wenn sich seitdem Daten, Einstellungen oder Programm-Filter
// geändert haben - der Listenaufbau ist der teuerste Schritt und war bisher bei
// JEDEM Tabwechsel fällig. Alles, was die Zeilen beeinflusst, läuft über
// saveToStorage() (stateVersion), appSettings oder die Filter-Werte.
let lastProgRenderSig = null;
let progScrollMemo = 0;
function progRenderSignature() {
  return [stateVersion, auftritte.length, Object.keys(dataMap).length,
    JSON.stringify(appSettings), JSON.stringify(snapshotProgFilters()),
    document.getElementById('progShowHidden').checked].join('|');
}
function progListStale() { return lastProgRenderSig !== progRenderSignature(); }
function renderProgCore() {
  renderProgCoreImpl();
  lastProgRenderSig = progRenderSignature();
}
// ── PROGRAMM-FILTER (Prädikate) ──────────────────────────────────────────────
// Zentrale Filterlogik der Programm-Übersicht - von renderProg() UND
// updateProgTotalTime() genutzt, damit beide immer exakt dieselben Auftritte
// als "aktuell sichtbar" behandeln. Jede Bedingung ist ein eigenes, einzeln
// testbares Prädikat (true = der Auftritt bleibt sichtbar); ein Auftritt ist
// sichtbar, wenn ALLE Prädikate zutreffen. test(a, f, d):
//   a = Auftritt, f = einmal eingelesener Filterzustand (readProgFilterState),
//   d = Künstler-Eintrag aus dataMap (bei Sonderveranstaltungen undefined).
function readProgFilterState() {
  return {
    days: activeDays(),
    fromVal: document.getElementById('timeFrom').value,
    toVal: document.getElementById('timeTo').value,
    showHidden: document.getElementById('progShowHidden').checked,
    minRating: progRatingFilter,
    statusVal: document.getElementById('fProgStatus').value,
    durationOnly: document.getElementById('fProgDuration').checked,
    plannedOnly: document.getElementById('fProgPlanned').checked,
  };
}
const PROG_FILTERS = [
  { id: 'day', test: (a, f) => f.days.includes(a.day) },
  // Globaler Settings-Schalter (Settings-Tab): Sonderveranstaltungen komplett
  // aus der Programm-Übersicht ausblenden, unabhängig von den beiden
  // Musik-/Sonstige-Events-Checkboxen darunter (die regeln nur die
  // Feinauswahl, wenn Events grundsätzlich angezeigt werden).
  { id: 'rbfEvents', test: a => !(a.isEvent && !appSettings.showRbfEvents) },
  // Persistente Locations-Verwaltung (Settings): komplett ausgeblendete
  // Locations gelten immer, unabhängig vom temporären Location-Filter oben
  // - bewusst NICHT Teil von "Filter zurücksetzen", da es sich eher um eine
  // dauerhafte Anzeige-Einstellung handelt als um einen Sitzungsfilter.
  { id: 'hiddenLocation', test: a => !appSettings.hiddenLocations.includes(a.location) },
  { id: 'location', test: a => !(selectedLocs.size > 0 && !selectedLocs.has(a.location)) },
  // Gleicher Haken wie bei ausgeblendeten Künstlern, gilt hier zusätzlich
  // für einzeln ausgeblendete Sonderveranstaltungen (hiddenEvents statt
  // d.ausgeblendet, da Events keinen dataMap-Eintrag haben).
  { id: 'hidden', test: (a, f, d) => f.showHidden || !((d && d.ausgeblendet) || (a.isEvent && hiddenEvents[a.nid])) },
  { id: 'time', test: (a, f) => {
    if (!a.time) return true;   // Auftritte ohne Uhrzeit (TBA) werden vom Zeitfilter nie ausgeblendet
    if (f.fromVal && timeSortValue(a.time) < timeSortValue(f.fromVal)) return false;
    if (f.toVal && timeSortValue(a.time) > timeSortValue(f.toVal)) return false;
    return true;
  } },
  { id: 'avgRating', test: (a, f, d) => !(f.minRating > 0 && avgRating(d) < f.minRating) },
  // Events haben kein Genre (nur Künstler-Auftritte) - bei aktivem Filter
  // fallen sie damit konsequent raus, genau wie sie es bei den anderen
  // künstler-spezifischen Filtern (Bewertung, Status) bereits tun.
  { id: 'genre', test: (a, f, d) => !(progSelectedGenres.size > 0 && (!d || !splitTags(d.genre).some(g => progSelectedGenres.has(g)))) },
  { id: 'showRating', test: a => !(progShowRatingFilter > 0 && (showRatings[showKey(a)] || 0) < progShowRatingFilter) },
  // Status: Künstler-Status (gesehen/bekannt/unbekannt); Events haben keinen -> fallen bei aktivem Status-Filter raus
  { id: 'status', test: (a, f, d) => d ? seenFilterMatches(f.statusVal, d.gesehen) : !['ja', 'bekannt', 'unbekannt'].includes(f.statusVal) },
  { id: 'duration', test: (a, f) => !(f.durationOnly && showDurations[showKey(a)] === undefined) },
  { id: 'planned', test: (a, f) => !(f.plannedOnly && !planFlags[showKey(a)]) },
];
function getFilteredAuftritte() {
  const f = readProgFilterState();
  return allProgEntries().filter(a => {
    const d = dataMap[a.name];
    return PROG_FILTERS.every(p => p.test(a, f, d));
  });
}

// ── EINE PROGRAMM-ZEILE ──────────────────────────────────────────────────────
// Die zugeklappte Zeile ist in drei Teile gegliedert (Zeit, Info, rechte Spalte);
// die Detailansicht entsteht erst beim Aufklappen (siehe progDetailHTML).
// Vereinheitlichter "ist ausgeblendet"-Zustand: Künstler über d.ausgeblendet,
// Sonderveranstaltungen über hiddenEvents[a.nid] - beide teilen sich dieselbe
// Optik (Badge, gedimmte Zeile) und denselben Filter-Haken.
function progIsHidden(a, d) {
  return (d && d.ausgeblendet) || (a.isEvent && !!hiddenEvents[a.nid]);
}
function progTimeColHTML(a, rid, skey) {
  return `<div class="prog-time-col">
        <div class="prog-time-val">${a.time ? a.time + (a.endTime ? `<br><span style="opacity:.55;font-size:11px">–${a.endTime}</span>` : '') : '<span style="opacity:.55">TBA</span>'}</div>
        ${planFlagHTML(rid, skey)}
      </div>`;
}
function progInfoHTML(a, d, rid, skey) {
  const gc = d ? genderBadgeClass(d.geschlecht) : '';
  const showRating = showRatings[skey] || 0;
  const duration = showDurations[skey];
  const nj = escJs(a.name);
  const isHidden = progIsHidden(a, d);
  return `<div class="prog-info">
        <div class="prog-name">${a.isEvent ? (a.kategorie === 'Musik' ? '🎵 ' : '🎪 ') : ''}${a.name}${anchorBadgeHTML(a.name, true)}${d ? ` <span class="badge ${gc}" style="font-size:9px">${d.geschlecht}</span>` : ''}${isHidden ? ' <span class="badge b-hidden" style="font-size:9px">🙈</span>' : ''}${commentIconHTML(a.name, nj, d, rid)}${soundRefIconHTML(a.name)}</div>
        <div class="prog-meta">${d ? d.genre + ' · ' + d.herkunft : (a.isEvent ? `Sonderveranstaltung · ${a.kategorie}` : '')}</div>
        <div class="prog-loc">${a.location ? (appSettings.showMapsLinks ? `📍 <a href="${mapsUrl(a.location)}" target="_blank" rel="noopener noreferrer" onclick="return openMaps(event,'${escJs(a.location)}')">${a.location}</a>` : `📍 ${a.location}`) : `📍 <span style="opacity:.6">TBA</span>`}</div>
        <div class="prog-show-meta-row" id="${rid}-showmetarow" style="${(showRating || duration !== undefined) ? '' : 'display:none'}">
          <div class="prog-showrating-summary" id="${rid}-showsummary" style="${showRating ? '' : 'display:none'}">${miniStarsShow(showRating)}</div>
          <div class="prog-duration-summary" id="${rid}-durationsummary" style="${duration !== undefined ? '' : 'display:none'}">${duration !== undefined ? `⏱ ${formatDuration(duration)}` : ''}</div>
        </div>
      </div>`;
}
function progRightColHTML(a, d, rid) {
  const vals = d ? [d.rp, d.rl].filter(v => v > 0) : [];
  const avg = avgRating(d);
  return `<div class="prog-right-col">
        <div class="prog-avg-badge${vals.length ? ' has-rating' : ''}" id="${rid}-summary" title="${vals.length ? `Künstler-Ø-Bewertung: ${avg.toFixed(1)}` : ''}">${miniStars(avg)}</div>
        <div class="prog-rating-arrow" id="${rid}-arrow">▸</div>
        ${hasLaterShow(a) ? '<div class="prog-more-ind" title="Weitere Termine danach" aria-label="Weitere Termine danach">📅</div>' : ''}
      </div>`;
}
// Gesamte zugeklappte Zeile. data-skey: stabiler Zeilen-Schlüssel für die Scroll-Anker-
// Erhaltung in renderProg() - im Gegensatz zu "rid" bleibt er unabhängig von der
// Position in der (durch Filter veränderlichen) Liste gleich. visitedNames: Künstler
// mit >= 1 besuchtem Auftritt (grüne Markierung).
function progRowHTML(a, rid, visitedNames) {
  const d = dataMap[a.name];
  const skey = showKey(a);
  const isHidden = progIsHidden(a, d);
  const visited = visitedNames.has(a.name);
  return `<div class="prog-item${isHidden ? ' prog-item-hidden' : ''}${visited ? ' prog-item-visited' : ''}" id="${rid}-row" data-skey="${escapeHtml(skey)}" onclick="toggleProgRating('${rid}')">
      ${progTimeColHTML(a, rid, skey)}
      ${progInfoHTML(a, d, rid, skey)}
      ${progRightColHTML(a, d, rid)}
    </div>
    <div class="prog-detail collapsed" id="${rid}-detail"></div>`;
}
// Merkt sich, welche Zeile (rid) zu welchem Auftritt/Künstler gehört (siehe progRidsByName).
function registerProgRow(a, rid) {
  if (!progRidsByName[a.name]) progRidsByName[a.name] = [];
  progRidsByName[a.name].push(rid);
  progEntryByRid[rid] = a;
}

function renderProgCoreImpl() {
  const list = document.getElementById('progList');
  openProgRid = null;
  progRidsByName = {};
  progEntryByRid = {};
  const visitedNames = artistsWithVisitedShows();
  updateLocFilter();
  updateProgGenreChips();
  updateProgFiltersActiveIndicator();
  if (!allProgEntries().length) {
    list.innerHTML = `<div class="prog-empty"><div class="icon">📅</div>Noch keine Auftrittsdaten hinterlegt.</div>`;
    updateProgTotalTime();
    saveFilterState();
    return;
  }
  let filtered = getFilteredAuftritte();
  filtered.sort((a,b) => dayIndex(a.day) - dayIndex(b.day) || timeSortValue(a.time) - timeSortValue(b.time) || a.name.localeCompare(b.name));
  updateProgTotalTime();
  if (!filtered.length) { list.innerHTML = `<div class="prog-empty">Keine Auftritte für diese Filter.</div>`; saveFilterState(); return; }
  let html = '', lastDay = '';
  filtered.forEach((a, i) => {
    if (a.day !== lastDay) { html += `<div class="prog-day-header">${a.day}</div>`; lastDay = a.day; }
    const rid = `progr-${i}`;
    registerProgRow(a, rid);
    html += progRowHTML(a, rid, visitedNames);
  });
  list.innerHTML = html;
  saveFilterState();
}
// Ersetzt die frühere direkte Programm-Liste-Renderfunktion: hält die
// Scroll-Position am selben Auftritt fest, auch wenn sich durch eine
// Filteränderung die Zusammensetzung der Liste ändert (Analogon zu
// renderKuenstlerPreservingAnchor() für die Künstler-Übersicht). Da praktisch
// jede Filter-UND Status-Änderung (Bewertung, Ziel-Flag, Ausblenden, ...) über
// diese eine Funktion läuft, profitieren alle Aufrufer automatisch - ohne
// jede einzelne Stelle im Code einzeln umstellen zu müssen.
// Ersetzt die frühere direkte Programm-Liste-Renderfunktion: hält die
// Scroll-Position am selben Auftritt fest, auch wenn sich durch eine
// Filteränderung die Zusammensetzung der Liste ändert (siehe
// preserveScrollAnchor() oben). Wird der Anker selbst herausgefiltert, sucht
// findNeighborKeys() abwechselnd einen späteren und einen früheren zeitlichen
// Nachbarn, bis einer gefunden wird, der die neuen Filter noch erfüllt - so
// bleibt immer ein Eintrag "aus der zeitlichen Umgebung" sichtbar, statt ganz
// nach oben zu springen. Da praktisch jede Filter- UND Status-Änderung
// (Bewertung, Ziel-Flag, Ausblenden, ...) über diese eine Funktion läuft,
// profitieren alle Aufrufer automatisch - ohne jede einzelne Stelle im Code
// einzeln umstellen zu müssen.
function renderProg() {
  preserveScrollAnchor('progList',
    el => el.classList && el.classList.contains('prog-item'),
    el => el.dataset.skey,
    renderProgCore,
    anchorKey => {
      // Chronologische Referenzreihenfolge (identisch zur Sortierung in
      // renderProgCore, aber bewusst über ALLE Einträge statt der gefilterten
      // Liste) - unabhängig davon, welcher Filter sich gerade geändert hat.
      const chronological = allProgEntries().slice()
        .sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || timeSortValue(a.time) - timeSortValue(b.time) || a.name.localeCompare(b.name));
      const anchorIndex = chronological.findIndex(a => showKey(a) === anchorKey);
      if (anchorIndex === -1) return [];
      const keys = [];
      for (let dist = 1; dist < chronological.length; dist++) {
        const after = chronological[anchorIndex + dist];
        const before = chronological[anchorIndex - dist];
        if (after) keys.push(showKey(after));
        if (before) keys.push(showKey(before));
      }
      return keys;
    });
}

function resetAuftritteToDefault() {
  auftritte = defaultAuftritte();
  autoFixAuftritte();
  updateLocFilter(); saveToStorage(); render();
  if (currentTab === 'programm') renderProg();
  validateAuftritte(true);
  toast(`Auftritte zurückgesetzt: ${auftritte.length} offizielle Einträge geladen ✓`);
}


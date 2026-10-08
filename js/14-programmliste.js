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
    const d = dataMap[a.name];
    const gc = d ? genderBadgeClass(d.geschlecht) : '';
    const vals = d ? [d.rp, d.rl].filter(v => v > 0) : [];
    const avg = avgRating(d);
    const rid = `progr-${i}`;
    if (!progRidsByName[a.name]) progRidsByName[a.name] = [];
    progRidsByName[a.name].push(rid);
    progEntryByRid[rid] = a;
    const skey = showKey(a);
    const showRating = showRatings[skey] || 0;
    const duration = showDurations[skey];
    const nj = escJs(a.name);
    const skeyEsc = escJs(skey);
    // Vereinheitlichter "ist ausgeblendet"-Zustand: Künstler über d.ausgeblendet,
    // Sonderveranstaltungen über hiddenEvents[a.nid] - beide teilen sich
    // dieselbe Optik (Badge, gedimmte Zeile) und denselben Filter-Haken oben.
    const isHidden = (d && d.ausgeblendet) || (a.isEvent && !!hiddenEvents[a.nid]);
    // data-skey: stabiler Zeilen-Schlüssel für die Scroll-Anker-Erhaltung in
    // renderProg() (siehe dort) - im Gegensatz zu "rid" bleibt er unabhängig
    // von der Position in der (durch Filter veränderlichen) Liste gleich.
    const visited = visitedNames.has(a.name);   // Künstler mit >= 1 besuchtem Auftritt
    html += `<div class="prog-item${isHidden ? ' prog-item-hidden' : ''}${visited ? ' prog-item-visited' : ''}" id="${rid}-row" data-skey="${escapeHtml(skey)}" onclick="toggleProgRating('${rid}')">
      <div class="prog-time-col">
        <div class="prog-time-val">${a.time ? a.time + (a.endTime ? `<br><span style="opacity:.55;font-size:11px">–${a.endTime}</span>` : '') : '<span style="opacity:.55">TBA</span>'}</div>
        ${planFlagHTML(rid, skey)}
      </div>
      <div class="prog-info">
        <div class="prog-name">${a.isEvent ? (a.kategorie === 'Musik' ? '🎵 ' : '🎪 ') : ''}${a.name}${anchorBadgeHTML(a.name, true)}${d ? ` <span class="badge ${gc}" style="font-size:9px">${d.geschlecht}</span>` : ''}${isHidden ? ' <span class="badge b-hidden" style="font-size:9px">🙈</span>' : ''}${commentIconHTML(a.name, nj, d, rid)}${soundRefIconHTML(a.name)}</div>
        <div class="prog-meta">${d ? d.genre + ' · ' + d.herkunft : (a.isEvent ? `Sonderveranstaltung · ${a.kategorie}` : '')}</div>
        <div class="prog-loc">${a.location ? (appSettings.showMapsLinks ? `📍 <a href="${mapsUrl(a.location)}" target="_blank" rel="noopener noreferrer" onclick="return openMaps(event,'${escJs(a.location)}')">${a.location}</a>` : `📍 ${a.location}`) : `📍 <span style="opacity:.6">TBA</span>`}</div>
        <div class="prog-show-meta-row" id="${rid}-showmetarow" style="${(showRating || duration !== undefined) ? '' : 'display:none'}">
          <div class="prog-showrating-summary" id="${rid}-showsummary" style="${showRating ? '' : 'display:none'}">${miniStarsShow(showRating)}</div>
          <div class="prog-duration-summary" id="${rid}-durationsummary" style="${duration !== undefined ? '' : 'display:none'}">${duration !== undefined ? `⏱ ${formatDuration(duration)}` : ''}</div>
        </div>
      </div>
      <div class="prog-right-col">
        <div class="prog-avg-badge${vals.length ? ' has-rating' : ''}" id="${rid}-summary" title="${vals.length ? `Künstler-Ø-Bewertung: ${avg.toFixed(1)}` : ''}">${miniStars(avg)}</div>
        <div class="prog-rating-arrow" id="${rid}-arrow">▸</div>
        ${hasLaterShow(a) ? '<div class="prog-more-ind" title="Weitere Termine danach" aria-label="Weitere Termine danach">📅</div>' : ''}
      </div>
    </div>
    <div class="prog-detail collapsed" id="${rid}-detail"></div>`;
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


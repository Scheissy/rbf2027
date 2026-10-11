// ── js/09-kuenstler.js ── Künstler-Übersicht: Aufklappen, Rendern, Statistikleiste ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('09-kuenstler');

// ── EXPAND ────────────────────────────────────────────────────────────────────
function toggleExpand(name) {
  if (expandedRows.has(name)) expandedRows.delete(name);
  else expandedRows.add(name);
  renderArtistItem(name);
}
// ── KÜNSTLERZEILE ────────────────────────────────────────────────────────────
// Zugeklappt: Kopfzeile (artistRowHTML). Aufgeklappt zusätzlich die Detailansicht
// (artistDetailHTML) mit der Liste der Auftritte (artistShowsHTML / artistShowRowHTML).
function artistRowHTML(d, name, nj, isExp, hasShows) {
  const gc = genderBadgeClass(d.geschlecht);
  return `<div class="artist-row${d.ausgeblendet ? ' artist-row-hidden' : ''}" onclick="toggleExpand('${nj}')">
    <div class="artist-expand">${hasShows ? (isExp ? '▾' : '▸') : '·'}</div>
    <div class="artist-name">${d.name}${avgMiniStarsHTML(d)}</div>
    ${anchorBadgeHTML(d.name)}
    ${commentIconHTML(name, nj, d)}
    ${soundRefIconHTML(name)}
    ${d.ausgeblendet ? '<span class="badge b-hidden">🙈</span>' : ''}
    ${d.reinhoeren ? '<span class="badge b-reinhoeren">🎧</span>' : ''}
    ${planIconHTML(name)}
    <div class="artist-country">${shortenHerkunft(d.herkunft)}</div>
    <div class="badge ${gc}" title="${d.geschlecht}">${shortenGeschlecht(d.geschlecht)}</div>
  </div>`;
}
function artistShowRowHTML(s, idx, nj) {
  const skey = showKey(s);
  const srid = `art-${nj}-${idx}`;
  const locHtml = s.location ? (appSettings.showMapsLinks ? `<a href="${mapsUrl(s.location)}" target="_blank" rel="noopener noreferrer" onclick="return openMaps(event,'${escJs(s.location)}')">${s.location}</a>` : s.location) : '<span style="opacity:.6">TBA</span>';
  return `<div class="show-row">${planFlagHTML(srid, skey)}<div class="show-day show-jump" role="button" title="Im Programm anzeigen" onclick="event.stopPropagation();runJump(()=>jumpToProgShow('${escJs(skey)}'))">${s.day}</div><div class="show-time show-jump" role="button" title="Im Programm anzeigen" onclick="event.stopPropagation();runJump(()=>jumpToProgShow('${escJs(skey)}'))">${s.time ? s.time + (s.endTime ? '–' + s.endTime : '') : '<span style="opacity:.6">TBA</span>'}</div><div class="show-loc">${locHtml}</div><div class="stars stars-sm" id="${srid}-show">${progShowStarsHTML(srid,skey)}</div></div>`;
}
function artistShowsHTML(nj, shows) {
  if (!shows.length) return '<div class="no-shows">Noch keine Auftrittsdaten</div>';
  return shows.sort((a,b) => dayIndex(a.day)-dayIndex(b.day)||timeSortValue(a.time)-timeSortValue(b.time))
    .map((s, idx) => artistShowRowHTML(s, idx, nj)).join('');
}
function artistDetailHTML(d, name, nj, showsHtml) {
  return `<div class="artist-detail" id="detail-${name}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px">
        <div class="detail-genre">${d.genre}</div>
        <div class="detail-links">
          <a class="detail-link" style="margin-top:0" href="${d.customUrl || d.rbfUrl}" target="_blank" rel="noopener noreferrer" onclick="return openExternal(event,'${escJs(d.customUrl || d.rbfUrl)}')">${d.discogsUrl ? '↗ RBF' : '↗ RBF-Seite öffnen'}</a>
          ${d.discogsUrl ? `<a class="detail-link detail-link-discogs" style="margin-top:0" href="${escapeHtml(d.discogsUrl)}" target="_blank" rel="noopener noreferrer" onclick="return openExternal(event,'${escapeHtml(escJs(d.discogsUrl))}')">↗ Discogs</a>` : ''}
        </div>
      </div>
      <div class="detail-section detail-ratings-row">
        <div class="detail-rating-col">
          <div class="detail-label">Rating Promo</div>
          <div class="stars" id="sr-rp-${name}">${starsHTML(name,'rp')}</div>
        </div>
        ${appSettings.showListening ? `<div class="detail-rating-col">
          <div class="detail-label">Rating Listening</div>
          <div class="stars" id="sr-rl-${name}">${starsHTML(name,'rl')}</div>
        </div>` : ''}
      </div>
      <div class="detail-section">
        <div class="detail-label">Gesehen</div>
        ${seenButtonsHTML(name, d)}
      </div>
      <div class="detail-section">
        <div class="detail-label">Kommentar</div>
        ${commentHTML(nj, d)}
      </div>
      <div class="detail-section">
        <button type="button" class="detail-link-btn" onclick="toggleHidden('${nj}')">${d.ausgeblendet ? '👁 Einblenden' : '🙈 Ausblenden'}</button>
        <button type="button" class="detail-link-btn" onclick="toggleReinhoeren('${nj}')">${d.reinhoeren ? '🎧 Entfernen' : '🎧 Reinhören'}</button>
      </div>
      <div class="detail-section">
        <div class="detail-label">Auftritte</div>
        <div class="shows-list">${showsHtml}</div>
      </div>
    </div>`;
}

function renderArtistItem(name) {
  const d = dataMap[name];
  const container = document.getElementById(`item-${name}`);
  if (!container) return;
  const isExp = expandedRows.has(name);
  const shows = auftritte.filter(a => a.name === name);
  const nj = escJs(name);
  let html = artistRowHTML(d, name, nj, isExp, shows.length > 0);
  if (isExp) html += artistDetailHTML(d, name, nj, artistShowsHTML(nj, shows));
  container.innerHTML = html;
}

// ── RENDER ARTISTS ────────────────────────────────────────────────────────────
// Zeigt/versteckt das X im Suchfeld je nach Inhalt und rendert die Liste neu.
function onSearchInput() {
  document.getElementById('searchClear').style.display = document.getElementById('search').value ? 'flex' : 'none';
  render();
}
function clearSearch() {
  const input = document.getElementById('search');
  input.value = '';
  document.getElementById('searchClear').style.display = 'none';
  input.focus();
  render();
}

function render() {
  const rows = getSorted(getFiltered());
  const list = document.getElementById('artistList');
  if (!rows.length) {
    list.innerHTML = '<div class="no-results">Keine Ergebnisse.</div>';
    updateStats();
    saveFilterState();
    return;
  }
  list.innerHTML = rows.map(d => `<div class="artist-item" id="item-${d.name}"></div>`).join('');
  rows.forEach(d => renderArtistItem(d.name));
  updateStats();
  saveFilterState();
}

// Prüft, ob in der Künstler-Übersicht aktuell irgendein Filter von seinem
// Standardwert abweicht - unabhängig davon, ob er die Liste gerade tatsächlich
// einschränkt (z.B. "Ausgeblendete" bei 0 ausgeblendeten Künstlern wäre
// technisch "aktiv", auch wenn sich an der Anzahl nichts ändert).
function kuenstlerFiltersActive() {
  return !!(
    document.getElementById('search').value ||
    document.getElementById('fGender').value ||
    kuenstlerSeenFilter ||
    selectedGenres.size > 0 ||
    document.getElementById('fHerkunft').value ||
    document.getElementById('fSoundRef').value ||
    statsAusgeblendetFilter ||
    kuenstlerAvgFilter > 0 ||
    statsBewertetFilter ||
    statsUnbewertetFilter ||
    statsReinhoerenFilter
  );
}
function updateStats() {
  const all = Object.values(dataMap), f = getFiltered();
  const fSeenVal = kuenstlerSeenFilter;
  const cls = active => 'stat stat-clickable' + (active ? ' stat-active' : '');
  const statsEl = document.getElementById('stats');
  document.getElementById('filterResetBtn').classList.toggle('show', kuenstlerFiltersActive());
  // Scrollposition merken: sonst springt die Leiste bei jedem Re-Render
  // (z.B. direkt nach Klick auf eine nach rechts gescrollte Kachel) auf
  // Anfang zurück, weil innerHTML komplett neu aufgebaut wird.
  const prevScroll = statsEl.scrollLeft;
  statsEl.innerHTML =
    `<div class="stat stat-clickable" onclick="filterByStat('gesamt')">Gesamt: <b>${all.length}</b></div>
     <div class="stat">Angezeigt: <b>${f.length}</b></div>
     <div class="stat">Auftritte: <b>${auftritte.length}</b></div>
     <div class="${cls(statsBewertetFilter)}" onclick="filterByStat('bewertet')">Bewertet: <b>${all.filter(d => d.rp > 0 || d.rl > 0).length}</b></div>
     <div class="${cls(statsUnbewertetFilter)}" onclick="filterByStat('unbewertet')">Unbewertet: <b>${all.filter(d => !(d.rp > 0)).length}</b></div>
     <div class="${cls(statsReinhoerenFilter)}" onclick="filterByStat('reinhoeren')">🎧 Reinhören: <b>${all.filter(d => d.reinhoeren).length}</b></div>
     <div class="${cls(fSeenVal === 'ja')}" onclick="filterByStat('ja')">Gesehen: <b>${all.filter(d => d.gesehen === 'ja').length}</b></div>
     <div class="${cls(fSeenVal === 'bekannt')}" onclick="filterByStat('bekannt')">Bekannt: <b>${all.filter(d => d.gesehen === 'bekannt' || d.gesehen === 'ja').length}</b></div>
     <div class="${cls(fSeenVal === 'unbekannt')}" onclick="filterByStat('unbekannt')">Unbekannt: <b>${all.filter(d => d.gesehen === '').length}</b></div>
     <div class="${cls(statsAusgeblendetFilter)}" onclick="filterByStat('ausgeblendet')">🙈 Ausgeblendet: <b>${all.filter(d => d.ausgeblendet).length}</b></div>`;
  statsEl.scrollLeft = prevScroll;
  updateStatsbarFades();
}

// Blendet links/rechts einen Fade-Overlay mit Pfeil ein, wenn in der jeweiligen
// Richtung noch weiterer (horizontal verdeckter) Inhalt in der Statistik-Leiste
// liegt - sonst ist auf dem Handy nicht erkennbar, dass überhaupt gescrollt
// werden kann.
function updateStatsbarFades() {
  const el = document.getElementById('stats');
  const left = document.getElementById('statsFadeLeft');
  const right = document.getElementById('statsFadeRight');
  if (!el || !left || !right) return;
  const maxScroll = el.scrollWidth - el.clientWidth;
  left.classList.toggle('show', el.scrollLeft > 4);
  right.classList.toggle('show', maxScroll > 4 && el.scrollLeft < maxScroll - 4);
}

// Setzt alle Künstler-Filter zurück und wendet danach optional genau ein
// Kriterium an ("isolierte" Ansicht per Klick auf die Statistik-Zeile).
function resetKuenstlerFilters() {
  document.getElementById('search').value = '';
  document.getElementById('searchClear').style.display = 'none';
  document.getElementById('fGender').value = '';
  kuenstlerSeenFilter = '';
  selectedGenres.clear();
  updateGenreChips();
  document.getElementById('fHerkunft').value = '';
  document.getElementById('fSoundRef').value = '';
  statsAusgeblendetFilter = false;
  kuenstlerAvgFilter = 0;
  renderKuenstlerAvgFilterStars();
  statsBewertetFilter = false;
  statsUnbewertetFilter = false;
  statsReinhoerenFilter = false;
}
// Statistik-Kacheln der Künstler-Übersicht als Filter: pro Art ein Schalter. isOn() = ist der
// Filter gerade aktiv, turnOn() setzt ihn. "Gesamt" ist ohnehin nie "aktiv" markiert und fehlt hier.
const STAT_FILTERS = {
  bewertet: { isOn: () => statsBewertetFilter, turnOn: () => { statsBewertetFilter = true; } },
  unbewertet: { isOn: () => statsUnbewertetFilter, turnOn: () => { statsUnbewertetFilter = true; } },
  reinhoeren: { isOn: () => statsReinhoerenFilter, turnOn: () => { statsReinhoerenFilter = true; } },
  ausgeblendet: { isOn: () => statsAusgeblendetFilter, turnOn: () => { statsAusgeblendetFilter = true; } },
};
['ja', 'bekannt', 'unbekannt'].forEach(kind => {
  STAT_FILTERS[kind] = { isOn: () => kuenstlerSeenFilter === kind, turnOn: () => { kuenstlerSeenFilter = kind; } };
});
function filterByStat(kind) {
  // Zweiter Klick auf einen bereits aktiven Filter hebt ihn wieder auf
  // (Vergleich MUSS vor resetKuenstlerFilters() passieren, da der Reset die
  // Flags ja gerade zurücksetzt).
  const stat = STAT_FILTERS[kind];
  const wasActive = !!stat && stat.isOn();
  resetKuenstlerFilters();
  if (stat && !wasActive) stat.turnOn();
  render();
  const activeEl = document.querySelector('#stats .stat-active');
  if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}


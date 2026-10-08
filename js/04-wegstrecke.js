// ── js/04-wegstrecke.js ── Wegstrecke (Fußweg-Matrix, Luftlinie) ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('04-wegstrecke');

// ── WEGSTRECKE ───────────────────────────────────────────────────────────────
// Strecke = Weg zwischen aufeinanderfolgenden BESUCHTEN Auftritten eines Tages
// (chronologisch, Zeiten nach Mitternacht korrekt einsortiert). Wege zu Hotel,
// Essen o.ä. sind unbekannt - das Ergebnis ist also eine Untergrenze. Es gibt
// bewusst keine Wege über Tagesgrenzen hinweg; "Gesamt" ist die Summe der Tage.
// Quelle 1 (exakt): WALK_DISTANCES aus rbf-walk.js = vorberechnete Fußweg-Matrix
// in Metern (erzeugt von build-walk-matrix.js). Die Datei ist OPTIONAL: fehlt
// sie - oder fehlt eine Location darin - fällt die Berechnung auf die Luftlinie
// (Haversine) aus VENUE_LOCATIONS zurück und wird als solche gekennzeichnet.
function walkDataAvailable() {
  return typeof WALK_DISTANCES !== 'undefined' && !!WALK_DISTANCES && !!WALK_DISTANCES.venues && Array.isArray(WALK_DISTANCES.meters);
}
function haversineMeters(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function walkVenueIndex(loc) {
  if (!walkDataAvailable()) return -1;
  const i = WALK_DISTANCES.venues[loc];
  return Number.isInteger(i) ? i : -1;
}
function venueCoords(loc) {
  const v = (typeof VENUE_LOCATIONS !== 'undefined' && VENUE_LOCATIONS) ? VENUE_LOCATIONS[loc] : null;
  if (!v || v.lat == null || v.lng == null) return null;
  const lat = Number(v.lat), lng = Number(v.lng);
  return (isFinite(lat) && isFinite(lng)) ? { lat, lng } : null;
}
function venueHasGeo(loc) { return walkVenueIndex(loc) >= 0 || !!venueCoords(loc); }
// { meters, exact } - exact=true: Fußweg-Matrix (oder identischer Ort), false:
// Luftlinie. null, wenn für eine der beiden Locations gar keine Koordinaten da sind.
function walkMeters(locA, locB) {
  const a = (locA || '').trim(), b = (locB || '').trim();
  if (!a || !b) return null;
  if (a === b) return { meters: 0, exact: true };
  const ia = walkVenueIndex(a), ib = walkVenueIndex(b);
  if (ia >= 0 && ib >= 0) {
    const row = WALK_DISTANCES.meters[ia];
    const m = row ? row[ib] : undefined;
    if (typeof m === 'number' && isFinite(m)) return { meters: m, exact: true };
  }
  const ca = venueCoords(a), cb = venueCoords(b);
  if (ca && cb) return { meters: Math.round(haversineMeters(ca, cb)), exact: false };
  return null;
}
function formatMeters(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
// Ergebnis: meters (Summe), legs (Anzahl Wechsel), airLegs (davon nur Luftlinie),
// skipped (besuchte Auftritte ohne Uhrzeit oder ohne Koordinaten - nicht in der
// Kette; wegen Dreiecksungleichung bleibt die Summe trotzdem eine Untergrenze).
function walkStats(entries) {
  const byDay = {};
  entries.filter(isShowVisited).forEach(a => { (byDay[a.day] = byDay[a.day] || []).push(a); });
  let meters = 0, legs = 0, airLegs = 0, skipped = 0;
  const legList = []; // einzelne Wegstrecken (für "Größte Wege" in der Auswertung)
  Object.values(byDay).forEach(list => {
    const stops = list
      .filter(a => a.time && venueHasGeo((a.location || '').trim()))
      .sort((x, y) => timeSortValue(x.time) - timeSortValue(y.time));
    skipped += list.length - stops.length;
    for (let i = 1; i < stops.length; i++) {
      const w = walkMeters(stops[i - 1].location, stops[i].location);
      if (!w) { skipped++; continue; }
      meters += w.meters;
      legs++;
      if (!w.exact) airLegs++;
      legList.push({ day: stops[i].day, from: stops[i - 1], to: stops[i], meters: w.meters, exact: w.exact });
    }
  });
  const kind = legs === 0 ? 'none' : airLegs === 0 ? 'walk' : airLegs === legs ? 'air' : 'mixed';
  return { meters, legs, airLegs, skipped, kind, legList };
}
// Eine Zeile in "Größte Wege": von welchem zu welchem Auftritt, wie weit -
// mit Hinweis, falls diese EINZELNE Strecke (anders als der Rest) nur als
// Luftlinie vorliegt (z.B. weil für eine der beiden Locations keine
// Fußweg-Matrix-Daten vorhanden sind, siehe walkMeters()).
function auswWalkLegLineHTML(leg) {
  const fromTime = leg.from.time ? escapeHtml(leg.from.time) : 'TBA';
  const toTime = leg.to.time ? escapeHtml(leg.to.time) : 'TBA';
  return `<div class="ausw-expand-item">
    <span class="ausw-expand-time">${escapeHtml(leg.day)} · ${fromTime} → ${toTime}</span>
    <span class="ausw-expand-name">${escapeHtml(leg.from.name)} → ${escapeHtml(leg.to.name)}</span>
    <span class="ausw-expand-meta">${formatMeters(leg.meters)}${leg.exact ? '' : ' <i>(Luftlinie)</i>'}</span>
  </div>`;
}

// Eine Zeile (Location ODER Genre) - identisches Markup, nur der Name und
// die äußere Klasse (für die Zuordnung zum jeweiligen Abschnitt) wechseln.
function auswRowHTML(item, nameField, outerClass, barPct, mode, agg) {
  const meta = mode === 'rating'
    ? (item.ratingCount > 0 ? `${item.ratingCount}×` : '')
    : mode === 'duration'
      ? (agg === 'avg' ? (item.durationCount > 0 ? `${item.durationCount}×` : '') : `${item.count}×`)
      : (item.minutes > 0 ? formatDuration(item.minutes) : '');
  const main = mode === 'rating'
    ? (item.avgRating === null ? '–' : item.avgRating.toFixed(1))
    : mode === 'duration'
      ? (agg === 'avg' ? (item.durationCount > 0 ? formatDuration(Math.round(item.minutes / item.durationCount)) : '–') : (item.minutes > 0 ? formatDuration(item.minutes) : '–'))
      : `${item.count}×`;
  return `<div class="${outerClass}" data-count="${item.count}" data-minutes="${item.minutes}" data-avg-rating="${item.avgRating === null ? '' : item.avgRating}">
    <div class="ausw-loc-head" onclick="toggleAuswDetail(this)"><span>${escapeHtml(item[nameField])}</span><span><span class="ausw-loc-meta">${meta}</span><span class="ausw-loc-main">${main}</span><span class="ausw-expand-arrow">▸</span></span></div>
    <div class="ausw-bar"><div class="ausw-bar-fill" style="width:${barPct(item)}%"></div></div>
    <div class="ausw-expand-detail collapsed">${item.entries.map(auswEntryLineHTML).join('')}</div>
  </div>`;
}
// Balken-Prozentsatz für eine ganze Liste (Locations ODER Genres, je mit
// eigenem Höchstwert) - siehe auswRowHTML für die Erklärung der Skalen.
function auswMakeBarPct(list, mode, agg) {
  const metricOf = l => {
    if (mode === 'duration') return agg === 'avg' ? (l.durationCount ? l.minutes / l.durationCount : null) : l.minutes;
    if (mode === 'rating') return l.avgRating;
    return l.count;
  };
  const isAbsoluteRatingBar = mode === 'rating';
  const barMax = isAbsoluteRatingBar ? null : (list.length ? (metricOf(list[0]) || 0) : 0);
  return l => {
    if (isAbsoluteRatingBar) return l.avgRating === null ? 0 : Math.round(l.avgRating / 5 * 100);
    const v = metricOf(l);
    return (barMax > 0 && v) ? Math.round(v / barMax * 100) : 0;
  };
}
// Kennzahlen-Kacheln + Strecke-Hinweis, ganz oben im Block.
function auswKpisHTML(s, walk) {
  const kpi = (val, label, attrs = '') => `<div class="ausw-kpi"${attrs}><div class="ausw-kpi-val">${val}</div><div class="ausw-kpi-label">${label}</div></div>`;
  const walkLabel = { none: 'Strecke', walk: 'Fußweg', air: 'Luftlinie', mixed: 'Weg (teils Luftlinie)' }[walk.kind];
  const walkNote = walk.skipped > 0
    ? `<div class="ausw-note">ℹ️ ${walk.skipped === 1 ? '1 besuchter Auftritt ist' : `${walk.skipped} besuchte Auftritte sind`} (ohne Uhrzeit oder Koordinaten) in der Strecke nicht enthalten.</div>`
    : '';
  return `<div class="ausw-kpis">
        ${kpi(s.visitedCount, 'Auftritte besucht')}
        ${kpi(s.totalMinutes > 0 ? formatDuration(s.totalMinutes) : '–', 'Zeit vor Ort')}
        ${kpi(s.avgRating !== null ? s.avgRating.toFixed(1) : '–', 'Ø Bewertung')}
        ${kpi(walk.legs > 0 ? formatMeters(walk.meters) : '–', walkLabel, ` data-walk-kind="${walk.kind}"`)}
      </div>
      ${walkNote}`;
}
// Sortier-Umschalter (Häufigkeit/Dauer/Bewertung + ggf. Summe/Durchschnitt) -
// steht direkt vor den Locations, die er (zusammen mit den Genres) steuert.
function auswSortTogglesHTML(mode, agg) {
  return `<div class="ausw-sort"><span class="ausw-sort-label">📍 Locations/Genres sortieren nach</span>
        <div class="ausw-sort-btns">
          <button class="ausw-sort-btn${mode === 'count' ? ' active' : ''}" data-sort="count" onclick="setAuswertungSort('count')">Häufigkeit</button>
          <button class="ausw-sort-btn${mode === 'duration' ? ' active' : ''}" data-sort="duration" onclick="setAuswertungSort('duration')">Dauer</button>
          <button class="ausw-sort-btn${mode === 'rating' ? ' active' : ''}" data-sort="rating" onclick="setAuswertungSort('rating')">Bewertung</button>
        </div></div>
      <div class="ausw-note">Bei Gleichstand zählt die jeweils andere Größe, danach der Name.</div>
      ${agg !== null ? `<div class="ausw-sort"><span class="ausw-sort-label">Anzeigen als</span>
        <div class="ausw-sort-btns">
          <button class="ausw-sort-btn${agg === 'sum' ? ' active' : ''}" data-agg="sum" onclick="setAuswertungAgg('sum')">Summe</button>
          <button class="ausw-sort-btn${agg === 'avg' ? ' active' : ''}" data-agg="avg" onclick="setAuswertungAgg('avg')">Durchschnitt</button>
        </div></div>` : ''}`;
}
// Ein aggregierter Abschnitt (Locations ODER Genres) - Überschrift plus
// entweder die Zeilenliste oder eine Leer-Meldung.
function auswGroupSectionHTML(heading, emptyMsg, listClass, list, nameField, outerClass, mode, agg) {
  if (list.length === 0) return `<div class="ausw-sub">${heading}</div>\n      <div class="ausw-empty">${emptyMsg}</div>`;
  const barPct = auswMakeBarPct(list, mode, agg);
  return `<div class="ausw-sub">${heading}</div>
      <div class="${listClass}">${list.map(item => auswRowHTML(item, nameField, outerClass, barPct, mode, agg)).join('')}</div>`;
}
// Bewertungsverteilung (5 -> 1 Sterne), jede Stufe mit Anzahl-Balken und
// (falls > 0 Einträge) aufklappbarer Detail-Liste.
function auswRatingDistHTML(s) {
  if (s.ratingCount === 0) return `<div class="ausw-sub">⭐ Bewertungsverteilung</div>\n      <div class="ausw-empty">Noch keine Bewertungen abgegeben.</div>`;
  const distMax = Math.max(...s.ratingDist);
  const rows = [5, 4, 3, 2, 1].map(n => {
    const c = s.ratingDist[n - 1];
    return `<div class="ausw-dist-entry">
              <div class="ausw-dist-row" data-stars="${n}" data-count="${c}" onclick="${c > 0 ? 'toggleAuswDetail(this)' : ''}">
                <span class="ausw-dist-star">${n} ★</span>
                <div class="ausw-dist-bar-wrap"><div class="ausw-bar"><div class="ausw-bar-fill" style="width:${distMax > 0 ? Math.round(c / distMax * 100) : 0}%"></div></div></div>
                <span class="ausw-dist-count">${c}</span>
                ${c > 0 ? '<span class="ausw-expand-arrow">▸</span>' : '<span class="ausw-expand-arrow-spacer"></span>'}
              </div>
              ${c > 0 ? `<div class="ausw-expand-detail collapsed">${s.ratingEntries[n - 1].map(auswEntryLineHTML).join('')}</div>` : ''}
            </div>`;
  }).join('');
  return `<div class="ausw-sub">⭐ Bewertungsverteilung</div>
      <div class="ausw-dist-list">${rows}</div>`;
}
// Die 5 größten einzelnen Wegstrecken (siehe walkStats()) - steht bewusst am
// Ende des Blocks, damit die Zahlen (Locations/Genres/Bewertung) zuerst kommen.
function auswWalkLegsHTML(walk) {
  if (walk.legs === 0) return `<div class="ausw-sub">🚶 Größte Wege</div>\n      <div class="ausw-empty">Keine Wege berechenbar.</div>`;
  const top5 = walk.legList.slice()
    .sort((a, b) => b.meters - a.meters || dayIndex(a.day) - dayIndex(b.day) || timeSortValue(a.to.time) - timeSortValue(b.to.time))
    .slice(0, 5);
  return `<div class="ausw-sub">🚶 Größte Wege</div>
      <div class="ausw-walklegs-list">${top5.map(auswWalkLegLineHTML).join('')}</div>`;
}

function auswertungBlockHTML(title, id, entries) {
  const s = auswertungStats(entries);
  let body;
  if (!s.visitedCount) {
    body = '<div class="ausw-empty">Noch keine besuchten Auftritte.</div>';
  } else {
    const mode = auswertungSortMode();
    const agg = auswertungAggMode(mode); // nur bei 'duration' nicht null
    const walk = walkStats(entries);
    body = [
      auswKpisHTML(s, walk),
      auswSortTogglesHTML(mode, agg),
      auswGroupSectionHTML('📍 Locations', 'Keine Locations vorhanden.', 'ausw-loc-list', s.locations, 'location', 'ausw-loc', mode, agg),
      auswGroupSectionHTML('🎵 Genres', 'Keine Genre-Angaben vorhanden.', 'ausw-genre-list', s.genres, 'genre', 'ausw-genre', mode, agg),
      auswRatingDistHTML(s),
      auswWalkLegsHTML(walk),
    ].join('\n      ');
  }
  return `<div class="io-section ausw-block" data-ausw="${escapeHtml(id)}"><div class="io-section-title">${escapeHtml(title)}</div>${body}</div>`;
}
function renderAuswertung() {
  const el = document.getElementById('auswertungContent');
  if (!el) return;
  const view = document.getElementById('view-auswertung');
  const scroll = view ? view.scrollTop : 0; // Scroll-Position erhalten (Neu-Rendern bei jedem Klick)
  const selectedDays = auswertungSelectedDays();
  const entries = auswertungEntries().filter(a => selectedDays.includes(a.day));
  let html = `<div class="ausw-header">
    <div class="ausw-header-title">📊 Auswertung</div>
    <button type="button" class="info-icon-btn" onclick="event.stopPropagation();openAuswertungInfoModal()" title="Wie funktioniert die Auswertung?" aria-label="Erklärung zur Auswertung">ⓘ</button>
  </div>`;
  html += `<div class="ausw-daypicker"><span class="ausw-sort-label">📅 Tage auswählen</span>
      <div class="day-btns">${DAY_ORDER.map(day => `<button type="button" class="day-btn ausw-day-btn${selectedDays.includes(day) ? ' active' : ''}" data-day="${escapeHtml(day)}" onclick="toggleAuswertungDay(this)">${escapeHtml(day)}</button>`).join('')}</div>
    </div>`;
  if (selectedDays.length === 0) {
    html += `<div class="ausw-empty">Kein Tag ausgewählt - bitte mindestens einen Tag antippen.</div>`;
  } else {
    html += auswertungBlockHTML(auswertungSelectionTitle(selectedDays), 'auswahl', entries);
  }
  // Scroll-Position erhalten (Pixel-Offset): der Inhalt wird bei jeder Interaktion
  // (Tage-/Sortier-Wahl) komplett neu gerendert, der Nutzer soll nicht nach oben springen.
  el.innerHTML = html;
  if (view) view.scrollTop = scroll;
}
// Dauerhafte Ansichts-Einstellung (kein Filter): überlebt Reload und wird von
// "Filter zurücksetzen"/"Jetzt" nicht berührt.
function setAuswertungSort(mode) {
  appSettings.auswertungSort = (mode === 'duration' || mode === 'rating') ? mode : 'count';
  saveToStorage();
  renderAuswertung();
}

function switchTab(tab) {
  // Jeder Tabwechsel beendet den Zurück-Chip (siehe jumpBack()); die Sprung-
  // Funktionen setzen ihn erst NACH ihrem switchTab() neu.
  hideJumpBackChip();
  // Scrollstelle der Programm-Liste vor dem Verstecken merken (siehe unten).
  if (currentTab === 'programm' && tab !== 'programm') {
    const pl = document.getElementById('progList');
    if (pl) progScrollMemo = pl.scrollTop;
  }
  currentTab = tab;
  ['kuenstler','programm','auswertung','io'].forEach(t => {
    const el = document.getElementById(`view-${t}`);
    if (t === tab) {
      el.classList.remove('hidden');
      el.style.display = (t === 'programm' || t === 'kuenstler') ? 'flex' : '';
    } else {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
    document.getElementById(`nav-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'programm') {
    if (!smartProgDefaultsApplied) { applySmartProgDefaults(); smartProgDefaultsApplied = true; }
    if (progListStale()) renderProg();
    else { const pl = document.getElementById('progList'); if (pl && progScrollMemo) pl.scrollTop = progScrollMemo; }
  }
  if (tab === 'auswertung') renderAuswertung();
}

// Präzise Standortdaten (GPS-Koordinaten bzw. Adresse) der bekannten RBF-Venues,
// direkt von der offiziellen RBF-Location-Datenbank übernommen. Damit landet
// der Maps-Link exakt am richtigen Gebäude statt bei einer unsicheren Namenssuche
// (wichtig v.a. bei mehrdeutigen Namen wie "25 Club" oder temporären Bühnen).
function mapsUrl(location) {
  const v = VENUE_LOCATIONS[location.trim()];
  let query;
  if (v && v.lat && v.lng) query = `${v.lat},${v.lng}`;
  else if (v && v.address) query = v.address;
  else query = location + ', Hamburg';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function openMaps(e, location) {
  e.stopPropagation();
  e.preventDefault();
  window.open(mapsUrl(location), '_blank', 'noopener,noreferrer');
  return false;
}

// Öffnet einen Link zuverlässig in einem neuen Tab/Fenster (Systembrowser).
// In installierten PWAs (standalone) ignoriert Android target="_blank" oft und
// navigiert stattdessen innerhalb der App weiter - window.open() umgeht das.
function openExternal(e, url) {
  e.preventDefault();
  window.open(url, '_blank', 'noopener,noreferrer');
  return false;
}


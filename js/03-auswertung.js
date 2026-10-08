// ── js/03-auswertung.js ── Auswertung (Statistik-Tab) ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('03-auswertung');

// ── AUSWERTUNG ───────────────────────────────────────────────────────────────
// Ein Auftritt gilt als "besucht", sobald eine Dauer eingetragen ODER eine
// Auftritts-Bewertung gesetzt wurde (eines von beiden genügt). Bewusst NICHT
// der künstlerbezogene Gesehen-Status: die Auswertung orientiert sich an der
// einzelnen Show (showKey), nicht am Künstler.
function isShowVisited(a) {
  const k = showKey(a);
  return (showDurations[k] || 0) > 0 || (showRatings[k] || 0) > 0;
}
// Namen aller Künstler/Veranstaltungen mit mindestens EINEM besuchten Auftritt.
// Basis ist bewusst die ungefilterte Auswertungs-Liste: Ein besuchter Auftritt
// markiert die übrigen Auftritte des Künstlers auch dann, wenn er selbst durch
// Programm-Filter (Tag, Uhrzeit, Location ...) gerade nicht in der Liste steht.
function artistsWithVisitedShows() {
  return new Set(auswertungEntries().filter(isShowVisited).map(a => a.name));
}
// Basis der Auswertung: ALLE Auftritte (+ Sonderveranstaltungen, solange der
// globale Settings-Schalter an ist) - bewusst ungefiltert, d.h. weder
// Programm-Filter noch dauerhaft ausgeblendete Locations noch Ausblenden-
// Flags verfälschen die Auswertung (ein besuchter Auftritt bleibt besucht).
function auswertungEntries() {
  return auftritte.concat(appSettings.showRbfEvents ? rbfEvents : []);
}
// Dynamische Tages-Auswahl: welche Tage fließen in DIE EINE Übersicht ein.
// undefined (noch nie gewählt) -> Default: alle Tage (= "Gesamt"). Ändert sich
// DAY_ORDER durch ein Datenupdate so stark, dass NICHTS Gespeichertes mehr
// gültig ist, fällt es ebenfalls auf "alle Tage" zurück, statt eine technische
// Leerauswahl zu zeigen, die der Nutzer so nie getroffen hat. Eine bewusst vom
// Nutzer gewählte leere Auswahl (explizit alle Tage abgewählt) bleibt dagegen leer.
function auswertungSelectedDays() {
  const stored = appSettings.auswertungDays;
  if (!Array.isArray(stored)) return DAY_ORDER.slice();
  const valid = stored.filter(day => DAY_ORDER.includes(day));
  return (valid.length === 0 && stored.length > 0) ? DAY_ORDER.slice() : valid;
}
function toggleAuswertungDay(btn) {
  btn.classList.toggle('active');
  const active = [...btn.parentElement.querySelectorAll('.ausw-day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day);
  appSettings.auswertungDays = DAY_ORDER.filter(day => active.includes(day)); // chronologisch, unabhängig von der Klickreihenfolge
  saveToStorage();
  renderAuswertung();
}
function auswertungSelectionTitle(days) {
  if (days.length === 0) return 'Auswahl';
  if (days.length === DAY_ORDER.length) return 'Gesamt';
  return days.join(' + ');
}
// Sortierung des Location-Rankings: Hauptkriterium + Tie-Breaker.
//   'count':    Häufigkeit, bei Gleichstand Gesamtdauer, danach Name
//   'duration': Gesamtdauer, bei Gleichstand Häufigkeit, danach Name
function auswertungSortMode() {
  const m = appSettings.auswertungSort;
  return (m === 'duration' || m === 'rating') ? m : 'count';
}
// Zweite Achse NUR für "Dauer" relevant: Summe vs. Durchschnitt pro Location.
// Bei "Häufigkeit" ergibt das keinen Sinn (eine Anzahl hat keinen sinnvollen
// Durchschnitt). Bei "Bewertung" WÜRDE es technisch gehen, ist aber bewusst
// wieder entfernt: die Summe von Sternebewertungen ist keine aussagekräftige
// Größe (im Gegensatz zur Summe von Minuten) - Bewertung zeigt daher immer
// den Durchschnitt, wie schon vor der kurzzeitigen Erweiterung.
function auswertungAggMode(mode) {
  if (mode === 'duration') return appSettings.auswertungDurationAgg === 'avg' ? 'avg' : 'sum';
  return null;
}
function setAuswertungAgg(agg) {
  if (auswertungSortMode() !== 'duration') return;
  appSettings.auswertungDurationAgg = agg === 'avg' ? 'avg' : 'sum';
  saveToStorage();
  renderAuswertung();
}
// Locations ohne Bewertung (avgRating === null) landen im Bewertungs-Modus
// immer am Ende, Locations ohne Dauer im Durchschnitts-Modus ebenso -
// unabhängig vom Vorzeichen der jeweiligen Skala.
// Generischer Vergleicher für aggregierte Auswertungs-Zeilen (Locations UND
// Genres teilen sich dieselbe Form: count/minutes/durationCount/ratingSum/
// ratingCount/avgRating + ein Namensfeld). nameKey wählt das Namensfeld für
// den letzten Tie-Breaker (alphabetisch).
function compareAggregated(mode, nameKey) {
  const agg = auswertungAggMode(mode);
  return (x, y) => {
    if (mode === 'duration') {
      const xv = agg === 'avg' ? (x.durationCount ? x.minutes / x.durationCount : -1) : x.minutes;
      const yv = agg === 'avg' ? (y.durationCount ? y.minutes / y.durationCount : -1) : y.minutes;
      return (yv - xv) || (y.count - x.count) || x[nameKey].localeCompare(y[nameKey], 'de');
    }
    if (mode === 'rating') {
      const xr = x.avgRating === null ? -1 : x.avgRating, yr = y.avgRating === null ? -1 : y.avgRating;
      return (yr - xr) || (y.count - x.count) || x[nameKey].localeCompare(y[nameKey], 'de');
    }
    return (y.count - x.count) || (y.minutes - x.minutes) || x[nameKey].localeCompare(y[nameKey], 'de');
  };
}
function compareLocations(mode) { return compareAggregated(mode, 'location'); }
function compareGenres(mode) { return compareAggregated(mode, 'genre'); }
function auswertungStats(entries, sortMode) {
  const visited = entries.filter(isShowVisited);
  let totalMinutes = 0, ratingSum = 0, ratingCount = 0;
  const ratingDist = [0, 0, 0, 0, 0]; // Index 0 = 1 Stern ... Index 4 = 5 Sterne
  const ratingEntries = [[], [], [], [], []]; // dieselbe Indizierung: welche Auftritte stecken dahinter
  const byLoc = {}, byGenre = {};
  const chronoCompare = (x, y) => dayIndex(x.day) - dayIndex(y.day) || timeSortValue(x.time) - timeSortValue(y.time) || x.name.localeCompare(y.name, 'de');
  // Trägt einen Auftritt in eine Gruppe (Location ODER Genre) ein - identische
  // Feldstruktur für beide, damit compareAggregated()/die Anzeige beides
  // gleich behandeln kann.
  function addTo(map, key, nameField, a, dur, r) {
    const e = map[key] || (map[key] = { [nameField]: key, count: 0, minutes: 0, durationCount: 0, ratingSum: 0, ratingCount: 0, entries: [] });
    e.count++;
    e.minutes += dur;
    if (dur > 0) e.durationCount++;
    e.entries.push(a);
    if (r > 0) { e.ratingSum += r; e.ratingCount++; }
  }
  visited.forEach(a => {
    const k = showKey(a);
    const dur = showDurations[k] || 0, r = showRatings[k] || 0;
    totalMinutes += dur;
    addTo(byLoc, (a.location || '').trim() || 'Ohne Location', 'location', a, dur, r);
    // Ein Auftritt mit mehreren Genres ("Electro / Pop") zählt in JEDEM davon
    // separat - exakt wie beim Genre-Mehrfachfilter in der Programm-Übersicht
    // (toggleProgGenreSelection()), nicht als ein zusammengesetztes Genre.
    // Sonderveranstaltungen und Künstler ohne Genre-Angabe laufen unter
    // "Ohne Genre" (analog zu "Ohne Location").
    const artistData = dataMap[a.name];
    const genreTags = artistData && artistData.genre ? splitTags(artistData.genre) : [];
    (genreTags.length ? genreTags : ['Ohne Genre']).forEach(g => addTo(byGenre, g, 'genre', a, dur, r));
    if (r > 0) {
      ratingSum += r; ratingCount++;
      const bucket = Math.min(Math.max(Math.round(r), 1), 5) - 1;
      ratingDist[bucket]++;
      ratingEntries[bucket].push(a);
    }
  });
  const finalize = (map, compareFn) => Object.values(map).map(e => ({ ...e, avgRating: e.ratingCount ? e.ratingSum / e.ratingCount : null, entries: e.entries.slice().sort(chronoCompare) })).sort(compareFn);
  const mode = sortMode || auswertungSortMode();
  const locations = finalize(byLoc, compareLocations(mode));
  const genres = finalize(byGenre, compareGenres(mode));
  return { visitedCount: visited.length, totalMinutes, avgRating: ratingCount ? ratingSum / ratingCount : null, ratingCount, ratingDist, ratingEntries: ratingEntries.map(list => list.slice().sort(chronoCompare)), locations, genres };
}
// Eine Zeile in einer aufgeklappten Detail-Liste (welche Auftritte hinter
// einer Zahl in der Auswertung stecken) - zeigt Tag/Zeit, Name und, falls
// vorhanden, Dauer und Auftritts-Bewertung. Rein informativ, keine Aktionen.
function auswEntryLineHTML(a) {
  const k = showKey(a);
  const dur = showDurations[k], r = showRatings[k] || 0;
  const metaParts = [];
  if (dur) metaParts.push(`⏱ ${formatDuration(dur)}`);
  if (r > 0) metaParts.push(`<span class="ausw-expand-stars">${miniStarsShow(r)}</span>`);
  return `<div class="ausw-expand-item">
    <span class="ausw-expand-time">${escapeHtml(a.day)} · ${a.time ? escapeHtml(a.time) : 'TBA'}</span>
    <span class="ausw-expand-name">${a.isEvent ? (a.kategorie === 'Musik' ? '🎵 ' : '🎪 ') : ''}${escapeHtml(a.name)}</span>
    ${metaParts.length ? `<span class="ausw-expand-meta">${metaParts.join(' ')}</span>` : ''}
  </div>`;
}
// Klappt die Detail-Liste einer Auswertungs-Zeile (Location oder Bewertungs-
// stufe) auf/zu - rein clientseitig, kein Neu-Rendern, kein Speichern, genau
// wie das Auf-/Zuklappen einzelner Programm-Einträge. headEl ist die anklick-
// bare Kopfzeile, deren Elternelement genau EINE .ausw-expand-detail enthält.
function toggleAuswDetail(headEl) {
  const detail = headEl.parentElement.querySelector('.ausw-expand-detail');
  if (!detail) return;
  const collapsed = detail.classList.toggle('collapsed');
  const arrow = headEl.querySelector('.ausw-expand-arrow');
  if (arrow) arrow.textContent = collapsed ? '▸' : '▾';
}


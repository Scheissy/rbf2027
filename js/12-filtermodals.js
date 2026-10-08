// ── js/12-filtermodals.js ── Location-/Genre-Filter (Programm), Locations verwalten ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('12-filtermodals');

// ── LOCATION-MEHRFACHFILTER ──────────────────────────────────────────────────
const locModalApi = makeMultiSelectFilter({
  getOptions: () => locFilterOptions,
  selected: selectedLocs,
  modalListId: 'locModalList', modalId: 'locModal', chipsId: 'locChips', btnId: 'locFilterBtn',
  emptyLabel: 'Keine Locations vorhanden.',
  allLabel: '📍 Alle Locations',
  countLabel: n => `📍 Location (${n})`,
  toggleFnName: 'toggleLocSelection', removeChipFnName: 'removeLocChip', resetFnName: 'resetLocFilter',
  onChange: () => renderProg()
});
function renderLocModalList() { locModalApi.render(); }
function toggleLocSelection(l) { locModalApi.toggle(l); }
function removeLocChip(l) { locModalApi.removeChip(l); }
function resetLocFilter() { locModalApi.reset(); }
function updateLocChips() { locModalApi.updateChips(); }
function openLocModal() { locModalApi.open(); }

// ── GENRE-MEHRFACHFILTER (Programm-Übersicht) ───────────────────────────────
// Nutzt dieselbe globale Genre-Liste (allGenreTags) wie der Künstler-Tab,
// da sich Genres nicht nach Tag/Uhrzeit richten (anders als Locations) - nur
// die Auswahl selbst (progSelectedGenres) ist eigenständig.
const progGenreModalApi = makeMultiSelectFilter({
  getOptions: () => allGenreTags,
  selected: progSelectedGenres,
  modalListId: 'progGenreModalList', modalId: 'progGenreModal', chipsId: 'progGenreChips', btnId: 'progGenreFilterBtn',
  emptyLabel: 'Keine Genres vorhanden.',
  allLabel: '🎵 Alle Genres',
  countLabel: n => `🎵 Genre (${n})`,
  toggleFnName: 'toggleProgGenreSelection', removeChipFnName: 'removeProgGenreChip', resetFnName: 'resetProgGenreFilter',
  onChange: () => renderProg()
});
function toggleProgGenreSelection(g) { progGenreModalApi.toggle(g); }
function removeProgGenreChip(g) { progGenreModalApi.removeChip(g); }
function resetProgGenreFilter() { progGenreModalApi.reset(); }
function updateProgGenreChips() { progGenreModalApi.updateChips(); }
function openProgGenreModal() { progGenreModalApi.open(); }

// ── LOCATIONS VERWALTEN (Settings) ─────────────────────────────────────────────
// Persistente, geräteweite Anzeige-Einstellung: welche Locations sollen in der
// Programm-Übersicht überhaupt jemals erscheinen? Anders als der temporäre
// Location-Filter oben (der bei "Filter zurücksetzen" wieder aufgehoben wird)
// ist das eine dauerhafte Einstellung, in appSettings gespeichert. Betrifft
// bewusst NUR die Programm-Übersicht - die Künstler-Übersicht (inkl. der
// Auftritts-Liste in der Detailansicht) zeigt immer alle Auftritte, unabhängig
// von dieser Einstellung.
function allLocationNames() {
  return [...new Set(allProgEntries().map(a => a.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}
function renderLocManageModalList() {
  const el = document.getElementById('locManageModalList');
  if (!el) return;
  const locs = allLocationNames();
  if (!locs.length) { el.innerHTML = '<div style="color:var(--text2);font-size:13px">Keine Locations vorhanden.</div>'; return; }
  el.innerHTML = locs.map(l => {
    const visible = !appSettings.hiddenLocations.includes(l);
    const lj = escJs(l);
    return `<div class="genre-check-row${visible ? ' checked' : ''}" onclick="toggleLocVisibility('${lj}')">
      <div class="genre-check-box">${visible ? '✓' : ''}</div>
      <div class="genre-check-label">${l}</div>
    </div>`;
  }).join('');
}
function toggleLocVisibility(l) {
  const idx = appSettings.hiddenLocations.indexOf(l);
  if (idx === -1) appSettings.hiddenLocations.push(l);
  else appSettings.hiddenLocations.splice(idx, 1);
  saveToStorage();
  renderLocManageModalList();
  if (currentTab === 'programm') renderProg();
}
function resetLocManage() {
  appSettings.hiddenLocations = [];
  saveToStorage();
  renderLocManageModalList();
  if (currentTab === 'programm') renderProg();
}
function openLocManageModal() {
  renderLocManageModalList();
  openModal('locManageModal');
}


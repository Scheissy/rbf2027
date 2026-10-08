// ── js/05-filter.js ── Toast, Filter/Sortierung, Mehrfachauswahl-Filter, Genre-Filter (Künstler) ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('05-filter');

// ── MODALS (gemeinsame Mechanik) ────────────────────────────────────────────
// Alle Bottom-Sheets (".modal-backdrop") öffnen/schließen über dieselben Funktionen
// statt je Modal eigener Wrapper. Im Markup: Hintergrund mit
// onclick="modalBackdropClick(event)", Schließen-Button mit onclick="closeModal('<id>')".
// Ein Tipp auf den abgedunkelten Hintergrund (nicht auf die Karte darin) schließt das
// Modal. Ausnahme: der Dauer-Dialog (durationModal) hat bewusst keinen Hintergrund-Tipp
// und eigene Schließ-Logik (siehe js/07-dauer.js).
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function modalBackdropClick(e) {
  const el = e.target;
  if (el && el.classList && el.classList.contains('modal-backdrop')) closeModal(el.id);
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = ok ? 'var(--border)' : '#e74c3c';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── FILTER / SORT ─────────────────────────────────────────────────────────────
// Badge-Farbklasse je nach Geschlecht: männlich/weiblich/divers = Einzelperson,
// mixed = Band/Gruppe mit unterschiedlichen Geschlechtern.
function genderBadgeClass(g) {
  return g === 'männlich' ? 'b-m' : g === 'weiblich' ? 'b-w' : g === 'divers' ? 'b-d' : 'b-x';
}
// Prüft, ob ein Künstler für den Anchor Award nominiert ist. Die eigentliche
// Nominierten-Liste (ANCHOR_AWARD_NOMINEES, Array von Künstlernamen, exakt
// wie RAW[i][0]) kommt aus rbf-data.js - typeof-Check, damit die App auch
// läuft, falls das Array dort mal (noch) nicht existiert.
function isAnchorNominee(name) {
  return typeof ANCHOR_AWARD_NOMINEES !== 'undefined' && Array.isArray(ANCHOR_AWARD_NOMINEES) && ANCHOR_AWARD_NOMINEES.includes(name);
}
function anchorBadgeHTML(name, small) {
  if (!isAnchorNominee(name)) return '';
  return ` <span class="badge b-anchor"${small ? ' style="font-size:9px"' : ''} title="Anchor Award Nominierung">⚓</span>`;
}
// Zerlegt Werte wie "Pop / Rock" oder "USA / UK" in einzelne, getrimmte Teile
function splitTags(val) {
  return (val || '').split('/').map(s => s.trim()).filter(Boolean);
}

// Kurzformen für die Geschlecht-Badge in der Künstler-Übersicht: "m" allein
// wäre zwischen "männlich" und "mixed" mehrdeutig, daher bewusst "mix" statt
// "m" für gemischte Formationen. Die unterschiedliche Badge-Farbe
// (genderBadgeClass) unterscheidet die vier Fälle zusätzlich voneinander.
// Analog zu shortenHerkunft() nur für die Künstler-Übersicht gedacht - in
// der Programm-Übersicht bleibt der volle Wert stehen.
const GESCHLECHT_ABBREVIATIONS = { 'weiblich': 'w', 'männlich': 'm', 'divers': 'd', 'mixed': 'mix' };
function shortenGeschlecht(geschlecht) {
  return GESCHLECHT_ABBREVIATIONS[geschlecht] || geschlecht;
}
// bzw. ISO 3166-1), für die platzsparende Herkunfts-Anzeige in der Künstler-
// Übersicht auf dem Handy. Unbekannte Werte (inkl. bereits abgekürzter Codes
// wie "DE") bleiben unverändert - diese Liste deckt bewusst nur gängige
// Herkunftsländer ab, keine vollständige Länderliste.
const COUNTRY_ABBREVIATIONS = {
  'Deutschland': 'DE', 'Österreich': 'AT', 'Schweiz': 'CH',
  'Vereinigtes Königreich': 'UK', 'Großbritannien': 'UK', 'England': 'UK',
  'Vereinigte Staaten': 'USA', 'Vereinigte Staaten von Amerika': 'USA',
  'Frankreich': 'FR', 'Niederlande': 'NL', 'Belgien': 'BE', 'Dänemark': 'DK',
  'Schweden': 'SE', 'Norwegen': 'NO', 'Finnland': 'FI', 'Island': 'IS',
  'Polen': 'PL', 'Tschechien': 'CZ', 'Tschechische Republik': 'CZ',
  'Slowakei': 'SK', 'Ungarn': 'HU', 'Italien': 'IT', 'Spanien': 'ES',
  'Portugal': 'PT', 'Griechenland': 'GR', 'Irland': 'IE', 'Kanada': 'CA',
  'Australien': 'AU', 'Neuseeland': 'NZ', 'Japan': 'JP', 'Südkorea': 'KR',
  'Brasilien': 'BR', 'Mexiko': 'MX', 'Argentinien': 'AR', 'Südafrika': 'ZA',
  'Russland': 'RU', 'Ukraine': 'UA', 'Rumänien': 'RO', 'Bulgarien': 'BG',
  'Kroatien': 'HR', 'Slowenien': 'SI', 'Serbien': 'RS', 'Litauen': 'LT',
  'Lettland': 'LV', 'Estland': 'EE', 'Türkei': 'TR', 'Israel': 'IL',
  'Indien': 'IN', 'China': 'CN',
  'Afghanistan': 'AFG', 'Marokko': 'MA', 'Zypern': 'CY', 'Luxemburg': 'LUX',
  'Nigeria': 'NG', 'Kolumbien': 'CO', 'Libanon': 'LB', 'Syrien': 'SY',
  'Färöer-Inseln': 'FO', 'Färöer': 'FO', 'Pakistan': 'PK', 'Suriname': 'SR',
  'Palästina': 'PS', 'Tunesien': 'TN', 'Kirgistan': 'KG', 'Kap Verde': 'CV'
};

// Kürzt NUR den Länderanteil eines Herkunft-Werts ("Stadt, Land" oder nur
// "Land") für die Anzeige - der zugrunde liegende dataMap-Wert bleibt
// unangetastet, daher greifen Suche/Filter weiterhin auf den vollen Namen.
// Zusammengesetzte Länder (z.B. "Deutschland / Australien" bei Acts mit
// mehreren Herkunftsländern) werden über splitTags() einzeln aufgeteilt und
// jedes Land für sich abgekürzt - gerade dort bringt eine Kürzung am meisten,
// da diese Fälle sonst besonders lang werden.
// Bewusst nur in der Künstler-Übersicht verwendet (dort ist auf dem Handy
// wenig Platz); in der Programm-Übersicht bleibt der volle Name stehen.
function shortenHerkunft(herkunft) {
  if (!herkunft) return herkunft;
  const abbreviateCountryPart = part => splitTags(part).map(c => COUNTRY_ABBREVIATIONS[c] || c).join(' / ');
  const idx = herkunft.lastIndexOf(',');
  if (idx === -1) return abbreviateCountryPart(herkunft);
  const city = herkunft.slice(0, idx).trim();
  const country = herkunft.slice(idx + 1).trim();
  return `${city}, ${abbreviateCountryPart(country)}`;
}

// Normalisiert einen String für die Suche: Kleinschreibung + Entfernung von
// Akzenten/diakritischen Zeichen (é/è/ê -> e, ü -> u, ñ -> n, ...), damit eine
// Suche nach "Dov'e Liana" auch "Dov'è Liana" findet - nicht nur für dieses
// eine Zeichen hartkodiert, sondern generisch über Unicode-Normalisierung
// (NFD zerlegt z.B. "è" in "e" + einen separaten Akzent-Codepunkt, den wir
// dann herausfiltern).
function normalizeSearch(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getFiltered() {
  const q = normalizeSearch(document.getElementById('search').value);
  const fg = document.getElementById('fGender').value;
  const fs = kuenstlerSeenFilter;
  const fHerkunft = document.getElementById('fHerkunft').value;
  const fSoundRef = document.getElementById('fSoundRef').value;
  return Object.values(dataMap).filter(d => {
    if (q && !normalizeSearch(d.name).includes(q) && !normalizeSearch(d.genre).includes(q) && !normalizeSearch(d.herkunft).includes(q)) return false;
    if (fg && d.geschlecht !== fg) return false;
    if (fs === 'ja' && d.gesehen !== 'ja') return false;
    if (fs === 'bekannt' && d.gesehen !== 'bekannt' && d.gesehen !== 'ja') return false; // "gesehen" ist immer auch "bekannt"
    if (fs === 'unbekannt' && d.gesehen !== '') return false;
    if (selectedGenres.size > 0 && !splitTags(d.genre).some(g => selectedGenres.has(g))) return false;
    if (fHerkunft && !splitTags(d.herkunft).includes(fHerkunft)) return false;
    if (fSoundRef && !soundReferencesFor(d.name).some(r => (r.referenz || []).includes(fSoundRef))) return false;
    if (statsAusgeblendetFilter ? !d.ausgeblendet : d.ausgeblendet) return false;
    if (kuenstlerAvgFilter > 0 && avgRating(d) < kuenstlerAvgFilter) return false;
    if (statsBewertetFilter && !(d.rp > 0 || d.rl > 0)) return false;
    if (statsUnbewertetFilter && d.rp > 0) return false;
    if (statsReinhoerenFilter && !d.reinhoeren) return false;
    return true;
  });
}

// Baut die Genre-/Herkunft-Dropdowns aus allen im Datensatz vorkommenden
// Einzelwerten (Teilmengen von "Pop / Rock" etc.) auf, alphabetisch sortiert.
function updateTagFilters() {
  const genreSet = new Set(), herkunftSet = new Set();
  Object.values(dataMap).forEach(d => {
    splitTags(d.genre).forEach(g => genreSet.add(g));
    splitTags(d.herkunft).forEach(h => herkunftSet.add(h));
  });
  allGenreTags = [...genreSet].sort((a, b) => a.localeCompare(b, 'de'));
  // Ausgewählte Genres, die es nicht mehr gibt (z.B. nach CSV-Änderungen), entfernen
  [...selectedGenres].forEach(g => { if (!genreSet.has(g)) selectedGenres.delete(g); });
  renderGenreModalList();
  updateGenreChips();
  const herkunftSel = document.getElementById('fHerkunft');
  const curHerkunft = herkunftSel.value;
  herkunftSel.innerHTML = `<option value="">Alle Herkünfte</option>` +
    [...herkunftSet].sort((a, b) => a.localeCompare(b, 'de')).map(h => `<option value="${h}"${h === curHerkunft ? ' selected' : ''}>${shortenHerkunft(h)}</option>`).join('');
  // Soundreferenz-Filter: Optionsliste kommt direkt aus SOUND_REFERENCES
  // (rbf-data.js), nicht aus dataMap - die Liste wächst unabhängig von den
  // Künstlerdaten selbst, daher hier bewusst eine eigene, dynamische
  // Befüllung statt einer festen Werteliste.
  const soundRefSel = document.getElementById('fSoundRef');
  if (soundRefSel) {
    const curSoundRef = soundRefSel.value;
    const refNames = new Set();
    if (typeof SOUND_REFERENCES !== 'undefined' && Array.isArray(SOUND_REFERENCES)) {
      SOUND_REFERENCES.forEach(r => (r.referenz || []).forEach(n => refNames.add(n)));
    }
    soundRefSel.innerHTML = `<option value="">🔊 Referenz wählen</option>` +
      [...refNames].sort((a, b) => a.localeCompare(b, 'de')).map(n => `<option value="${n}"${n === curSoundRef ? ' selected' : ''}>${n}</option>`).join('');
  }
}
// ── MEHRFACHAUSWAHL-FILTER (Genre, Location) ────────────────────────────────
// Gemeinsamer Baukasten für "Mehrfachauswahl per Modal + Chips"-Filter.
// Genre- und Location-Filter bestanden bisher aus je sechs praktisch
// wortgleichen Funktionen (nur Optionsliste/Auswahl-Set/DOM-Ids unterschieden
// sich) - hier auf eine gemeinsame Implementierung zurückgeführt. Erzeugt für
// eine Konfiguration die komplette render/toggle/removeChip/reset/
// updateChips/open-Logik (Schließen und Hintergrund-Tipp: gemeinsame Modal-Mechanik oben). Die global aufrufbaren
// Funktionsnamen (aus den generierten onclick-Attributen heraus referenziert)
// bleiben als dünne Wrapper bestehen, damit sich am Verhalten nichts ändert.
function makeMultiSelectFilter(opts) {
  const { getOptions, selected, modalListId, modalId, chipsId, btnId, emptyLabel, allLabel, countLabel, toggleFnName, removeChipFnName, resetFnName, onChange } = opts;
  function render() {
    const el = document.getElementById(modalListId);
    if (!el) return;
    const options = getOptions();
    if (!options.length) { el.innerHTML = `<div style="color:var(--text2);font-size:13px">${emptyLabel}</div>`; return; }
    el.innerHTML = options.map(v => {
      const checked = selected.has(v);
      const vj = escJs(v);
      return `<div class="genre-check-row${checked ? ' checked' : ''}" onclick="${toggleFnName}('${vj}')">
        <div class="genre-check-box">${checked ? '✓' : ''}</div>
        <div class="genre-check-label">${v}</div>
      </div>`;
    }).join('');
  }
  function toggle(v) {
    if (selected.has(v)) selected.delete(v); else selected.add(v);
    render();
    updateChips();
    onChange();
  }
  function removeChip(v) {
    selected.delete(v);
    updateChips();
    render();
    onChange();
  }
  function reset() {
    selected.clear();
    updateChips();
    render();
    onChange();
  }
  function updateChips() {
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = selected.size ? countLabel(selected.size) : allLabel;
    const wrap = document.getElementById(chipsId);
    if (!wrap) return;
    if (!selected.size) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    wrap.style.display = 'flex';
    const chips = [...selected].sort((a, b) => a.localeCompare(b, 'de'))
      .map(v => `<span class="filter-chip">${v}<span class="filter-chip-x" onclick="${removeChipFnName}('${escJs(v)}')">✕</span></span>`).join('');
    wrap.innerHTML = chips + (selected.size > 1 ? `<span class="filter-chip-reset" onclick="${resetFnName}()">Alle zurücksetzen</span>` : '');
  }
  function open() {
    render();
    openModal(modalId);
  }
  return { render, toggle, removeChip, reset, updateChips, open };
}

// ── GENRE-MEHRFACHFILTER ────────────────────────────────────────────────────
const genreModalApi = makeMultiSelectFilter({
  getOptions: () => allGenreTags,
  selected: selectedGenres,
  modalListId: 'genreModalList', modalId: 'genreModal', chipsId: 'genreChips', btnId: 'fGenreBtn',
  emptyLabel: 'Keine Genres vorhanden.',
  allLabel: '🎵 Alle Genres',
  countLabel: n => `🎵 Genre (${n})`,
  toggleFnName: 'toggleGenreSelection', removeChipFnName: 'removeGenreChip', resetFnName: 'resetGenreFilter',
  onChange: () => renderKuenstlerPreservingAnchor()
});
function openGenreModal() { genreModalApi.open(); }
function renderGenreModalList() { genreModalApi.render(); }
function toggleGenreSelection(g) { genreModalApi.toggle(g); }
function removeGenreChip(g) { genreModalApi.removeChip(g); }
function resetGenreFilter() { genreModalApi.reset(); }
function updateGenreChips() { genreModalApi.updateChips(); }

function getSorted(arr) {
  return [...arr].sort((a, b) => {
    let av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
    return String(av).localeCompare(String(bv), 'de') * sortDir;
  });
}


// ── js/10-programm.js ── Programm-Übersicht: Zeit-Auswahl, Einstellungen, Filter, Liste ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('10-programm');

// ── PROGRAMM ──────────────────────────────────────────────────────────────────
function buildTimeDropdowns() {
  const slots = [];
  for (let h = 8; h <= 28; h++) for (let m = 0; m < 60; m += 30) {
    const hh = h % 24;
    slots.push(`${String(hh).padStart(2,'0')}:${m === 0 ? '00' : '30'}`);
  }
  const seen = new Set(), uniq = [];
  slots.forEach(s => { if (!seen.has(s)) { seen.add(s); uniq.push(s); } });
  document.getElementById('timeFrom').innerHTML = uniq.map(s => `<option>${s}</option>`).join('');
  document.getElementById('timeTo').innerHTML = `<option value="">– Ende –</option>` + uniq.map(s => `<option>${s}</option>`).join('');
  // 08:00 = Beginn des Festival-Zeitfensters (siehe getFestivalContext()) und
  // zugleich der erste Dropdown-Eintrag - einheitlicher "kein Zeitfilter"-
  // Ausgangswert, identisch zu dem, den resetProgFilters() setzt.
  document.getElementById('timeFrom').value = '08:00';
}

function toggleSetting(key, val) {
  appSettings[key] = val;
  if (key === 'showSoundRef') {
    updateSoundRefFilterVisibility();
    // Beim Ausschalten aktiven Filter mitzurücksetzen - sonst würde unsichtbar
    // weiterhin nach einer Referenz gefiltert, ohne dass man das UI-Element
    // dafür überhaupt noch sieht.
    if (!val) {
      const sel = document.getElementById('fSoundRef');
      if (sel) sel.value = '';
    }
  }
  if (key === 'persistFilters' && !val) {
    // Beim Ausschalten den bereits gespeicherten Filter-Zustand aktiv
    // löschen - sonst könnte ein späteres erneutes Einschalten einen alten,
    // inzwischen veralteten Stand wiederherstellen.
    try { localStorage.removeItem(LS_FILTERS_KEY); } catch (e) { safeLog('Konnte Filter-Persistenz nicht löschen:', e); }
  }
  if (key === 'showRbfEvents') {
    updateRbfEventsVisibility();
  }
  saveToStorage();
  render();
  if (currentTab === 'programm') renderProg();
  updateStats();
}
function applySettingsUI() {
  document.getElementById('settingShowMapsLinks').checked = appSettings.showMapsLinks;
  document.getElementById('settingShowListening').checked = appSettings.showListening;
  document.getElementById('settingShowSoundRef').checked = appSettings.showSoundRef;
  document.getElementById('settingPersistFilters').checked = appSettings.persistFilters;
  document.getElementById('settingShowMusicEvents').checked = appSettings.showMusicEvents;
  document.getElementById('settingShowOtherEvents').checked = appSettings.showOtherEvents;
  document.getElementById('settingShowRbfEvents').checked = appSettings.showRbfEvents;
  document.getElementById('settingDurationInputMode').value = durationInputMode();
  document.getElementById('settingBackChipMode').value = backChipMode();
  const secSel = document.getElementById('settingBackChipSeconds');
  // Eine nicht in der Liste vorhandene (z. B. importierte) Dauer wird als eigene Option ergänzt
  if (![...secSel.options].some(o => Number(o.value) === backChipSeconds())) {
    const o = document.createElement('option'); o.value = String(backChipSeconds()); o.textContent = `${backChipSeconds()} Sekunden`; secSel.appendChild(o);
  }
  secSel.value = String(backChipSeconds());
  applyBackChipSettingChange();
  updateSoundRefFilterVisibility();
  updateProgFiltersPanelVisibility();
  updateRbfEventsVisibility();
}

// Blendet die beiden Musik-/Sonstige-Events-Checkboxen im "Weitere Filter"-
// Panel der Programm-Übersicht ein bzw. aus, je nach globalem Settings-
// Schalter "RBF-Sonderveranstaltungen". Die eigentliche Ausblendung der
// Events selbst passiert in getFilteredAuftritte() (appSettings.showRbfEvents) -
// hier geht es nur um die Sichtbarkeit der beiden zugehörigen Checkbox-Zeilen,
// die bei ausgeschaltetem Schalter keinen Sinn mehr ergeben.
function updateRbfEventsVisibility() {
  const musicRow = document.getElementById('rowShowMusicEvents');
  const otherRow = document.getElementById('rowShowOtherEvents');
  const show = appSettings.showRbfEvents;
  if (musicRow) musicRow.style.display = show ? 'flex' : 'none';
  if (otherRow) otherRow.style.display = show ? 'flex' : 'none';
}

// Ein-/Ausklappen des selten genutzten unteren Teils der Programm-Filter
// (alles unterhalb der Zeit-/Location-Auswahl) - Zustand wird wie die
// übrigen appSettings persistiert, damit die Wahl über Reloads erhalten bleibt.
function toggleProgFiltersPanel() {
  appSettings.progFiltersExpanded = !appSettings.progFiltersExpanded;
  updateProgFiltersPanelVisibility();
  saveToStorage();
}
function updateProgFiltersPanelVisibility() {
  const panel = document.getElementById('progFiltersExtra');
  const btn = document.getElementById('progFiltersToggleBtn');
  const label = document.getElementById('progFiltersToggleLabel');
  if (!panel || !btn || !label) return;
  const expanded = !!appSettings.progFiltersExpanded;
  panel.style.display = expanded ? 'flex' : 'none';
  label.textContent = expanded ? '▾ Weniger Filter' : '▸ Weitere Filter';
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  updateProgFiltersActiveIndicator();
}

// Prüft, ob mindestens einer der Filter INNERHALB des einklappbaren "Weitere
// Filter"-Bereichs aktiv ist - bewusst OHNE die beiden Event-Sichtbarkeits-
// Haken (Musik-/Sonstige Events), da deren "Default" nicht eindeutig ist
// (reine Geschmackssache, kein klassischer "eingeschränkter" Filterzustand).
// Der Location-Filter zählt hier ebenfalls nicht mit, da sein Button
// (außerhalb dieses Panels, immer sichtbar) bereits selbst per Beschriftung
// anzeigt, wenn eine Auswahl aktiv ist - dort besteht also kein "versteckter"
// Zustand, den es zusätzlich zu kennzeichnen gilt.
function anyHiddenProgFilterActive() {
  return progSelectedGenres.size > 0
    || progRatingFilter > 0
    || progShowRatingFilter > 0
    || document.getElementById('fProgStatus').value !== ''
    || document.getElementById('fProgPlanned').checked
    || document.getElementById('fProgDuration').checked
    || document.getElementById('progShowHidden').checked;
}

// Zeigt den kleinen Punkt am "Weitere Filter"-Button NUR, wenn das Panel
// eingeklappt ist UND mindestens einer der versteckten Filter aktiv ist -
// bei aufgeklapptem Panel sieht man die aktiven Filter ja bereits direkt.
function updateProgFiltersActiveIndicator() {
  const dot = document.getElementById('progFiltersActiveDot');
  if (!dot) return;
  const expanded = !!appSettings.progFiltersExpanded;
  dot.style.display = (!expanded && anyHiddenProgFilterActive()) ? 'inline-block' : 'none';
}

function toggleDay(btn) { btn.classList.toggle('active'); renderProg(); }
function activeDays() { return [...document.querySelectorAll('.day-btn.active')].map(b => b.dataset.day); }

// Chronologische (nicht alphabetische!) Reihenfolge der Festivaltage

function dayIndex(day) {
  const i = DAY_ORDER.indexOf(day);
  return i === -1 ? 99 : i; // unbekannte/fremde Tag-Werte ans Ende
}
// Wandelt "HH:MM" in eine vergleichbare Minutenzahl um, bei der Zeiten nach
// Mitternacht (00:00-04:59) chronologisch ANS ENDE des Festivaltags gehören
// statt (wie bei reinem String-Vergleich) fälschlich ganz an den Anfang.
// "00:10" wird so z.B. zu 24*60+10, liegt also korrekt NACH "23:30".
function timeSortValue(t) {
  if (!t) return 99999; // TBA sortiert immer ans Ende
  const [h, m] = t.split(':').map(Number);
  const hh = h < 5 ? h + 24 : h;
  return hh * 60 + m;
}
// Durchschnitt aus Promo-/Listening-Bewertung (nur gesetzte Werte zählen); 0 = unbewertet
function avgRating(d) {
  if (!d) return 0;
  const vals = appSettings.showListening ? [d.rp, d.rl].filter(v => v > 0) : [d.rp].filter(v => v > 0);
  return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
}

// Kompakte, nicht-editierbare Durchschnitts-Sterne direkt im Künstlernamen der
// (eingeklappten) Künstlerzeile - erscheinen, sobald mindestens eine der beiden
// Bewertungen (Promo ODER Listening) vergeben wurde. Bewusst unabhängig von
// der "Rating Listening"-Einstellung in den Settings (anders als avgRating(),
// die dort für die Programm-Übersicht die Einstellung berücksichtigt) und
// ohne Beschriftung/Zahlenwert im Fließtext, nur ein Tooltip (title) für
// Klarheit bei Bedarf. Als eigenes <span> mit stabiler ID gerendert (auch im
// "leeren" Zustand als leerer, ausgeblendeter Platzhalter), damit setRating()
// es live per outerHTML-Ersatz aktualisieren kann, ohne den ganzen Namen neu
// zu rendern.
function avgMiniStarsHTML(d) {
  const vals = [d.rp, d.rl].filter(v => v > 0);
  if (!vals.length) return `<span class="artist-avg-stars" id="avg-mini-${d.name}" style="display:none"></span>`;
  const avg = vals.reduce((x, y) => x + y, 0) / vals.length;
  return `<span class="artist-avg-stars" id="avg-mini-${d.name}" title="Ø ${avg.toFixed(1)}">${miniStars(avg)}</span>`;
}

// Klickbares Sterne-Widget für den Mindestbewertungs-Filter im Programm.
// Klick auf einen Stern setzt die Mindestbewertung; nochmaliger Klick auf
// den bereits aktiven Stern setzt den Filter zurück (= alle anzeigen).
// Gemeinsamer Generator für die drei Sterne-Filter-Widgets (Programm-
// Künstlerbewertung, Programm-Auftrittsbewertung, Künstler-Auftrittsbewertung).
// Unterscheiden sich nur in Element-Id, CSS-Klasse, aktuellem Wert und
// aufgerufenem Setter.
function ratingFilterStarsHTML(count, cssClass, setterName) {
  return Array.from({ length: MAX }, (_, i) => {
    const n = i + 1;
    return `<span class="star${cssClass}${n <= count ? ' on' : ''}" onclick="${setterName}(${n})">★</span>`;
  }).join('');
}
function renderProgRatingStars() {
  const el = document.getElementById('fProgRatingStars');
  if (el) el.innerHTML = ratingFilterStarsHTML(progRatingFilter, '', 'setProgRatingFilter');
}
function setProgRatingFilter(n) {
  progRatingFilter = (progRatingFilter === n) ? 0 : n;
  renderProgRatingStars();
  renderProg();
}
function renderProgShowRatingStars() {
  const el = document.getElementById('fProgShowRatingStars');
  if (el) el.innerHTML = ratingFilterStarsHTML(progShowRatingFilter, ' star-show', 'setProgShowRatingFilter');
}
function setProgShowRatingFilter(n) {
  progShowRatingFilter = (progShowRatingFilter === n) ? 0 : n;
  renderProgShowRatingStars();
  renderProg();
}
function renderKuenstlerAvgFilterStars() {
  const el = document.getElementById('fKuenstlerAvgFilterStars');
  if (el) el.innerHTML = ratingFilterStarsHTML(kuenstlerAvgFilter, '', 'setKuenstlerAvgFilter');
}
function setKuenstlerAvgFilter(n) {
  kuenstlerAvgFilter = (kuenstlerAvgFilter === n) ? 0 : n;
  renderKuenstlerAvgFilterStars();
  renderKuenstlerPreservingAnchor();
}

// Erkennt, ob "heute" (in der Festival-Zeitzone Europe/Berlin, NICHT der
// Geräte-Zeitzone) einer der 4 Festivaltage ist, und liefert dafür den
// passenden Tag-Filterwert sowie eine sinnvolle Start-Uhrzeit (aktuelle Zeit
// minus 30 Min, abgerundet auf den nächsten 30-Min-Slot). Nutzt bewusst explizit
// Europe/Berlin statt new Date()/getHours() etc., damit das auch dann korrekt
// bleibt, wenn das Gerät auf eine andere Zeitzone eingestellt ist (z.B. nach
// einer Reise vergessen umzustellen).
function getBerlinNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
  }).formatToParts(new Date());
  const get = t => parseInt(parts.find(p => p.type === t).value, 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') === 24 ? 0 : get('hour'), minute: get('minute') };
}
// Zuordnung Kalenderdatum (Monat-Tag, Europe/Berlin) -> Festivaltag-Label.
// Zentral definiert, damit sowohl getFestivalContext() (Zeitsprung) als auch
// getPastFestivalDays() (Reset) dieselbe Quelle nutzen und nie auseinanderlaufen.
const FESTIVAL_DAYS = { '9-15': 'Mi 15.09', '9-16': 'Do 16.09', '9-17': 'Fr 17.09', '9-18': 'Sa 18.09' };

// Liefert das "gefühlte" Kalenderdatum für die Festivaltag-Zuordnung: nach
// Mitternacht (vor 5 Uhr) zählt es noch zum Vorabend/-tag, weil die
// Nacht-Programme der einzelnen Festivaltage bis in die frühen Morgenstunden
// hineinlaufen (siehe RAW_AUFTRITTE: ein 00:10-Uhr-Auftritt trägt trotzdem
// noch das Tages-Label des Vorabends, nicht des Kalendertags).
function getEffectiveFestivalDate(now = getBerlinNow()) {
  let refMonth = now.month, refDay = now.day;
  if (now.hour < 5) {
    const prev = new Date(Date.UTC(now.year, now.month - 1, now.day - 1));
    refMonth = prev.getUTCMonth() + 1;
    refDay = prev.getUTCDate();
  }
  return { month: refMonth, day: refDay };
}

function getFestivalContext() {
  const now = getBerlinNow();
  const eff = getEffectiveFestivalDate(now);
  const key = `${eff.month}-${eff.day}`;
  const day = FESTIVAL_DAYS[key];
  if (!day) return null;

  let totalMin = now.hour * 60 + now.minute - 30; // minus 30 Min Puffer (früher 1h - erwies
  // sich in der Praxis gerade zu Hauptzeiten als zu großzügig, zeigte dann zu viele
  // bereits/kurz vor Beginn laufende Shows gleichzeitig an)
  totalMin = ((totalMin % 1440) + 1440) % 1440; // sauberer Wrap über Mitternacht
  totalMin = Math.floor(totalMin / 30) * 30; // auf 30-Min-Slot abrunden
  let hh = Math.floor(totalMin / 60), mm = totalMin % 60;
  // Dropdown deckt nur 08:00–23:30 und 00:00–04:30 ab (Festival-Betriebszeiten)
  if (hh >= 5 && hh < 8) hh = 8;
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return { day, time };
}

// Liefert die Menge der Festivaltage, die aus Sicht von "heute" (inkl.
// Nachteulen-Puffer, siehe getEffectiveFestivalDate()) bereits komplett
// vorbei sind. Nur relevant WÄHREND des Festivals: vor Festivalbeginn oder
// nach Festivalende liefert diese Funktion bewusst eine leere Menge - in
// beiden Fällen wäre "nur die kommenden Tage zeigen" nicht sinnvoll (vorher
// ist alles zukünftig, nachher alles vergangen).
function getPastFestivalDays() {
  const eff = getEffectiveFestivalDate();
  const todayLabel = FESTIVAL_DAYS[`${eff.month}-${eff.day}`];
  if (!todayLabel) return new Set();
  const todayIdx = DAY_ORDER.indexOf(todayLabel);
  if (todayIdx <= 0) return new Set();
  return new Set(DAY_ORDER.slice(0, todayIdx));
}

// Wird beim allerersten Öffnen des Programm-Tabs aufgerufen (siehe
// smartProgDefaultsApplied) und springt automatisch auf "heute". Tage-Auswahl
// bewusst identisch zu resetProgFilters() (heute + alle kommenden Tage,
// vergangene Tage weg) - nur die Zeit bleibt hier "smart" auf die aktuelle
// Uhrzeit statt auf 08:00, damit der allererste Blick direkt zeigt, was
// gerade läuft/ansteht.
function applySmartProgDefaults() {
  const ctx = getFestivalContext();
  if (!ctx) return; // heute ist kein Festivaltag -> Filter unverändert lassen
  const pastDays = getPastFestivalDays();
  document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', !pastDays.has(b.dataset.day)));
  const fromSel = document.getElementById('timeFrom');
  if ([...fromSel.options].some(o => o.value === ctx.time)) fromSel.value = ctx.time;
}

// Setzt alle Programm-Filter zurück (Tage, Zeit, Location, Bewertungen, Status) -
// bewusst OHNE den "Ausgeblendete anzeigen"-Haken anzutasten, den will man i.d.R.
// nicht bei jedem Reset wieder verlieren.
// Tage: bewusst NICHT einfach "alle" aktivieren, sondern bereits vergangene
// Festivaltage (siehe getPastFestivalDays()) deaktiviert lassen - wer am
// Freitag zurücksetzt, will i.d.R. nicht wieder Mittwoch/Donnerstag sehen.
// Das ist auch der bewusste Unterschied zu "Jetzt": "Zurücksetzen" springt
// IMMER auf "heute" (ganzer Tag, alle künftigen Tage inklusive), "Jetzt"
// springt beim 1. Klick nur auf die genaue Uhrzeit (ohne die übrigen Filter
// anzutasten) und setzt erst beim 2. Klick zusätzlich zurück.
// Setzt die "echten" Programm-Filter zurück (Location, Genre, Status, Dauer,
// Ziel, beide Bewertungsfilter) - der gemeinsame Kern von resetProgFilters()
// und dem 2. Klick von jumpToNow(). Bewusst NICHT enthalten: Tag/Zeit (die
// behandelt jeder Aufrufer unterschiedlich) sowie "Ausgeblendete anzeigen"
// und die beiden Event-Sichtbarkeits-Haken (Dauereinstellungen, keine
// Programm-Filter im engeren Sinn, siehe Kommentar bei jumpToNow()).
function clearProgFilterState() {
  selectedLocs.clear();
  progSelectedGenres.clear();
  updateProgGenreChips();
  document.getElementById('fProgStatus').value = '';
  document.getElementById('fProgDuration').checked = false;
  document.getElementById('fProgPlanned').checked = false;
  progRatingFilter = 0;
  renderProgRatingStars();
  progShowRatingFilter = 0;
  renderProgShowRatingStars();
}
function resetProgFilters() {
  const pastDays = getPastFestivalDays();
  document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', !pastDays.has(b.dataset.day)));
  document.getElementById('timeFrom').value = '08:00';
  document.getElementById('timeTo').value = '';
  clearProgFilterState();
  renderProg();
  toast('Filter zurückgesetzt ✓');
}


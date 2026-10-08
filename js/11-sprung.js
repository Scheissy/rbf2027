// ── js/11-sprung.js ── Sprünge zwischen Künstler/Programm, Terminliste, Tap-Schutz, Zurück-Chip ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('11-sprung');

// ── SPRUNG ZWISCHEN KÜNSTLER- UND PROGRAMM-ÜBERSICHT ─────────────────────────
// Scrollt ein Element innerhalb seiner Scroll-Liste nach oben (abzüglich eines
// Versatzes, z. B. für die sticky Tages-Überschrift) und hebt es kurz hervor.
function scrollListToEl(listId, el, offset) {
  const list = document.getElementById(listId);
  if (!list || !el) return;
  list.scrollTop += (el.getBoundingClientRect().top - list.getBoundingClientRect().top) - (offset || 0);
}
function flashEl(el) {
  if (!el) return;
  el.classList.remove('jump-flash');
  void el.offsetWidth; // Animation neu starten
  el.classList.add('jump-flash');
  setTimeout(() => el.classList.remove('jump-flash'), 2000);
}
// ── WEITERE TERMINE EINES KÜNSTLERS (Programm-Übersicht) ──────────────────────
// Alle Termine eines Künstlers, chronologisch (Tag, Uhrzeit; TBA ans Ende des
// Tages, bei Gleichstand Datenreihenfolge). Bewusst ungefiltert: auch Termine,
// die durch Tag-/Zeit-/Location-Filter gerade nicht in der Liste stehen.
// Die Gruppierung wird gecacht (pro auftritte-Array): beim Aufbau der Liste wird
// die Funktion pro Zeile mehrfach gebraucht - ohne Cache hieß das hunderte
// Filter-/Sortier-Durchläufe über alle Auftritte. Gecacht wird nur, solange
// dasselbe Array (gleiche Identität + Länge) aktiv ist; Laden/Zurücksetzen der
// Daten ersetzt das Array und erneuert den Cache damit automatisch. Das
// zurückgegebene Array darf nicht verändert werden.
let _showsByName = null, _showsByNameSrc = null, _showsByNameLen = -1;
function artistShowsSorted(name) {
  if (_showsByNameSrc !== auftritte || _showsByNameLen !== auftritte.length) {
    const groups = new Map();
    auftritte.forEach((x, i) => {
      if (!groups.has(x.name)) groups.set(x.name, []);
      groups.get(x.name).push({ x, i });
    });
    _showsByName = new Map();
    groups.forEach((g, n) => {
      g.sort((p, q) => dayIndex(p.x.day) - dayIndex(q.x.day) || timeSortValue(p.x.time) - timeSortValue(q.x.time) || p.i - q.i);
      _showsByName.set(n, g.map(o => o.x));
    });
    _showsByNameSrc = auftritte; _showsByNameLen = auftritte.length;
  }
  return _showsByName.get(name) || [];
}
// true, wenn der Künstler NACH diesem Termin noch mindestens einen weiteren hat
// (beim letzten/einzigen Termin und bei Sonderveranstaltungen: false).
function hasLaterShow(a) {
  if (a.isEvent) return false;
  const list = artistShowsSorted(a.name), k = showKey(a);
  const idx = list.findIndex(x => showKey(x) === k);
  return idx >= 0 && idx < list.length - 1;
}
// Termin bereits vorbei (Europe/Berlin, Nachtprogramm zählt noch zum Vortag)?
// Nur WÄHREND des Festivals - davor/danach wird bewusst nichts als vorbei
// gewertet (gleiche Logik wie getPastFestivalDays()).
function isShowPast(a) {
  const eff = getEffectiveFestivalDate();
  const todayLabel = FESTIVAL_DAYS[`${eff.month}-${eff.day}`];
  if (!todayLabel) return false;
  const ti = dayIndex(todayLabel), si = dayIndex(a.day);
  if (si < ti) return true;
  if (si > ti || !a.time) return false;
  const now = getBerlinNow();
  const nowMin = (now.hour < 5 ? now.hour + 24 : now.hour) * 60 + now.minute;
  return timeSortValue(a.endTime || a.time) < nowMin;
}
let progEntryByRid = {};
function termineInnerHTML(a) {
  const list = artistShowsSorted(a.name);
  if (a.isEvent || list.length < 2) return '';
  const curKey = showKey(a);
  const rows = list.map(x => {
    const k = showKey(x);
    const time = x.time ? x.time + (x.endTime ? '–' + x.endTime : '') : 'TBA';
    if (k === curKey) return `<div class="prog-term current"><span class="t-day">${x.day}</span><span class="t-time">${time}</span><span class="t-loc">◂ Dieser Termin</span></div>`;
    const dur = showDurations[k] || 0, rat = showRatings[k] || 0;
    const icons = (planFlags[k] ? '<span title="Ziel">🎯</span>' : '')
      + (dur > 0 ? `<span>⏱ ${formatDuration(dur)}</span>` : '')
      + (rat > 0 ? miniStarsShow(rat) : '');
    return `<div class="prog-term${isShowPast(x) ? ' past' : ''}" role="button" onclick="event.stopPropagation();runJump(()=>jumpToProgShow('${escJs(k)}', true))"><span class="t-day">${x.day}</span><span class="t-time">${time}</span><span class="t-loc">${x.location || 'TBA'}</span><span class="t-icons">${icons}</span></div>`;
  }).join('');
  return rows;
}
// Die Terminliste ist standardmäßig ZUGEKLAPPT (nur Kopfzeile "Termine (3) ▸"):
// sie wird nicht immer gebraucht und nähme sonst in jeder aufgeklappten Zeile
// Platz weg. Das Auf-/Zuklappen betrifft nur diesen Abschnitt - die Zeile selbst
// bleibt offen (stopPropagation).
function termineSectionHTML(a, rid) {
  const inner = termineInnerHTML(a);
  if (!inner) return '';
  const n = artistShowsSorted(a.name).length;
  return `<div class="prog-terms" id="${rid}-terms" onclick="event.stopPropagation()"><div class="prog-terms-head" role="button" aria-expanded="false" onclick="toggleTermine('${rid}')"><span>Termine (${n})</span><span class="prog-terms-arrow">▸</span></div><div class="prog-terms-body" id="${rid}-termsbody">${inner}</div></div>`;
}
function toggleTermine(rid, force) {
  const el = document.getElementById(`${rid}-terms`);
  if (!el) return;
  const open = typeof force === 'boolean' ? force : !el.classList.contains('open');
  el.classList.toggle('open', open);
  const head = el.querySelector('.prog-terms-head');
  if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
  const arrow = el.querySelector('.prog-terms-arrow');
  if (arrow) arrow.textContent = open ? '▾' : '▸';
}
// Zieht die Terminlisten ALLER sichtbaren Zeilen des Künstlers nach, wenn sich
// bei einem seiner Termine Ziel/Dauer/Bewertung geändert hat.
function refreshTermineLists(skey) {
  const entry = auftritte.find(x => showKey(x) === skey);
  if (!entry) return;
  (progRidsByName[entry.name] || []).forEach(r => {
    const el = document.getElementById(`${r}-termsbody`), a = progEntryByRid[r];
    if (el && a) el.innerHTML = termineInnerHTML(a);   // nur den Inhalt: Auf-/Zu-Zustand bleibt erhalten
  });
}

// ── SPRÜNGE AUS DER OBERFLÄCHE: Rückmeldung + Tap-Schutz ─────────────────────
// Ein Sprung kann spürbar dauern (Liste neu aufbauen). Damit man nicht denkt, der
// Tipp sei nicht angekommen, und ein zweiter Tipp nicht auf der NEUEN Ansicht
// landet (z. B. auf dem Location-Link der Ziel-Zeile), gilt für Sprünge, die per
// Tipp ausgelöst werden:
//  - sofort sichtbare Rückmeldung ("Springe …"): die eigentliche Arbeit startet
//    erst nach kurzer Pause, damit der Browser die Rückmeldung noch zeichnet;
//  - ein unsichtbares Schild über der ganzen App fängt alle weiteren Tipps ab,
//    bis der Sprung fertig ist UND noch kurz danach (bereits eingereihte Tipps
//    werden erst nach dem Sprung ausgeliefert und träfen sonst die neue Ansicht);
//  - weitere Sprünge werden währenddessen ignoriert.
const JUMP_START_DELAY_MS = 40;
const JUMP_SHIELD_HOLD_MS = 450;
let jumpBusy = false;
function runJump(fn) {
  if (jumpBusy) return;
  if (window.__rbfSyncJumps) { fn(); return; }   // Tests: synchron ausführen
  jumpBusy = true;
  const shield = document.getElementById('jumpShield');
  shield.style.display = 'block';
  document.body.classList.add('jump-busy');
  setTimeout(() => {
    try { fn(); } catch (e) { safeLog('Sprung fehlgeschlagen:', e); }
    document.body.classList.remove('jump-busy');
    jumpBusy = false;
    setTimeout(() => { if (!jumpBusy) shield.style.display = 'none'; }, JUMP_SHIELD_HOLD_MS);
  }, JUMP_START_DELAY_MS);
}

// ── ZURÜCK-CHIP ────────────────────────────────────────────────────────────
// Nach einem Sprung zwischen Künstler- und Programm-Übersicht schwebt unten ein
// Chip "← Künstler: Nova Frequenz" - ein Tipp bringt an die Ausgangsstelle
// zurück (gleicher Tab, gleiche Scrollstelle, ggf. gleiche aufgeklappte Zeile).
// Filter werden dabei bewusst NICHT wiederhergestellt: Sprünge gehen immer in
// den ANDEREN Tab und verändern nur dessen Filter - die Filter des
// Ausgangs-Tabs sind bei der Rückkehr unverändert. Es wird nur eine Ebene
// gemerkt (ein neuer Sprung ersetzt die alte Stelle). Der Chip verschwindet
// beim Tipp, über das ✕ und bei jedem (manuellen) Tabwechsel; kein Timer.
let jumpOrigin = null;
// Einstellung "Zurück-Chip" (Settings-Tab): 'off' = nie anzeigen, 'scroll' =
// ausblenden, sobald man die Sprungposition verlässt, 'time' = nach N Sekunden
// ausblenden (Standard: 15), 'manual' = nur per Tipp/✕/Tabwechsel. Ungültige
// gespeicherte Werte fallen auf den Standard zurück.
const BACK_CHIP_MODES = ['off', 'scroll', 'time', 'manual'];
const BACK_CHIP_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 60];
function backChipMode() {
  return BACK_CHIP_MODES.includes(appSettings.backChipMode) ? appSettings.backChipMode : 'time';
}
function backChipSeconds() {
  const n = Number(appSettings.backChipSeconds);
  return isFinite(n) && n >= 1 && n <= 600 ? n : 15;
}
let jumpChipTimer = null;
function clearJumpChipTimer() { if (jumpChipTimer) clearTimeout(jumpChipTimer); jumpChipTimer = null; }
function captureScrollAnchor(listId, isRowEl, keyOf) {
  const list = document.getElementById(listId);
  if (!list) return null;
  const lr = list.getBoundingClientRect();
  for (const item of list.children) {
    if (!isRowEl(item)) continue;
    const r = item.getBoundingClientRect();
    if (r.bottom > lr.top) return { key: keyOf(item), offset: r.top - lr.top };
  }
  return null;
}
const JUMP_ORIGIN_LISTS = {
  kuenstler: { listId: 'artistList', isRowEl: el => !!el.id && el.id.startsWith('item-'), keyOf: el => el.id.slice(5), label: 'Künstler' },
  programm: { listId: 'progList', isRowEl: el => !!el.classList && el.classList.contains('prog-item'), keyOf: el => el.dataset.skey, label: 'Programm' },
};
// Muss VOR dem switchTab() des Sprungs aufgerufen werden (liest den noch
// sichtbaren Ausgangs-Tab). null = kein Chip (z. B. Sprung innerhalb desselben
// Tabs oder Start in einem anderen Tab).
function captureJumpOrigin(targetTab, subject, allowSameTab) {
  const from = currentTab;
  const cfg = JUMP_ORIGIN_LISTS[from];
  if (!cfg || (from === targetTab && !allowSameTab)) return null;
  const origin = { tab: from, label: cfg.label, subject: subject || '', anchor: captureScrollAnchor(cfg.listId, cfg.isRowEl, cfg.keyOf), openKey: null };
  if (from === 'programm' && openProgRid) {
    const row = [...document.querySelectorAll('#progList .prog-item')].find(el => (el.getAttribute('onclick') || '').includes(`'${openProgRid}'`));
    if (row) {
      origin.openKey = row.dataset.skey;
      const termsEl = document.getElementById(`${openProgRid}-terms`);
      origin.termsOpen = !!(termsEl && termsEl.classList.contains('open'));
    }
  }
  // Sprung INNERHALB der Programm-Übersicht (z. B. aus der Terminliste): hier
  // können die Programm-Filter durch den Sprung verändert werden (Ausgangs-
  // und Ziel-Liste sind dieselbe). Deshalb Filter vorher merken und beim
  // Zurück wiederherstellen - aber nur, wenn sie seit dem Sprung nicht vom
  // Nutzer weiter verändert wurden (siehe jumpBack()).
  if (from === targetTab) {
    origin.sameTab = true;
    origin.snapBefore = snapshotProgFilters();
    const e = origin.openKey ? allProgEntries().find(x => showKey(x) === origin.openKey) : null;
    origin.label = 'Termin';
    origin.subject = e ? `${e.day}${e.time ? ', ' + e.time : ''}` : (subject || '');
  }
  return origin;
}
function snapshotProgFilters() {
  return {
    days: [...document.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day),
    from: document.getElementById('timeFrom').value, to: document.getElementById('timeTo').value,
    locs: [...selectedLocs], genres: [...progSelectedGenres],
    status: document.getElementById('fProgStatus').value,
    dur: document.getElementById('fProgDuration').checked, planned: document.getElementById('fProgPlanned').checked,
    rating: progRatingFilter, showRating: progShowRatingFilter,
  };
}
function applyProgFilters(f) {
  document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', f.days.includes(b.dataset.day)));
  document.getElementById('timeFrom').value = f.from; document.getElementById('timeTo').value = f.to;
  selectedLocs.clear(); f.locs.forEach(l => selectedLocs.add(l));
  progSelectedGenres.clear(); f.genres.forEach(g => progSelectedGenres.add(g));
  updateProgGenreChips();
  document.getElementById('fProgStatus').value = f.status;
  document.getElementById('fProgDuration').checked = f.dur; document.getElementById('fProgPlanned').checked = f.planned;
  progRatingFilter = f.rating; renderProgRatingStars();
  progShowRatingFilter = f.showRating; renderProgShowRatingStars();
}
function showJumpBackChip(origin) {
  jumpOrigin = origin || null;
  const chip = document.getElementById('jumpBackChip');
  if (!jumpOrigin || backChipMode() === 'off') { hideJumpBackChip(); return; }
  clearJumpChipTimer();
  if (backChipMode() === 'time') jumpChipTimer = setTimeout(hideJumpBackChip, backChipSeconds() * 1000);
  document.getElementById('jumpBackLabel').textContent = `← ${jumpOrigin.label}${jumpOrigin.subject ? ': ' + jumpOrigin.subject : ''}`;
  chip.style.display = 'flex';
  document.body.classList.add('has-jump-back');
}
function hideJumpBackChip() {
  stopJumpScrollWatch();
  clearJumpChipTimer();
  jumpOrigin = null;
  const chip = document.getElementById('jumpBackChip');
  if (chip) chip.style.display = 'none';
  document.body.classList.remove('has-jump-back');
}
function dismissJumpBack() { hideJumpBackChip(); }
// Wird aufgerufen, wenn die Chip-Einstellung geändert wird: ein gerade sichtbarer
// Chip folgt der neuen Einstellung (aus -> weg, Zeit -> Timer neu, sonst Timer weg).
function applyBackChipSettingChange() {
  const seconds = document.getElementById('rowBackChipSeconds');
  if (seconds) seconds.style.display = backChipMode() === 'time' ? 'flex' : 'none';
  if (!jumpOrigin) return;
  const mode = backChipMode();
  if (mode === 'off') { hideJumpBackChip(); return; }
  clearJumpChipTimer();
  if (mode !== 'scroll') stopJumpScrollWatch();
  if (mode === 'time') jumpChipTimer = setTimeout(hideJumpBackChip, backChipSeconds() * 1000);
}
function setBackChipSetting(key, val) {
  appSettings[key] = key === 'backChipSeconds' ? Number(val) : val;
  saveToStorage();
  applyBackChipSettingChange();
}
// Scroll-Überwachung: Verlässt man die Sprungposition (die Ziel-Zeile wandert
// mehr als JUMP_CHIP_LEAVE_PX von ihrem Landeplatz weg), blendet sich der Chip
// aus - man ist dann ohnehin woanders unterwegs. Kein Timer: die Landeposition
// wird direkt nach dem Sprung gemessen, der programmatische Scroll selbst
// verändert sie danach nicht mehr und löst deshalb nichts aus.
const JUMP_CHIP_LEAVE_PX = 80;
let jumpScrollWatch = null;
function startJumpScrollWatch(listId, findRow) {
  stopJumpScrollWatch();
  if (backChipMode() !== 'scroll') return;   // nur im Modus "ausblenden bei Bewegung"

  const list = document.getElementById(listId);
  const row = findRow();
  if (!list || !row || !jumpOrigin) return;
  const topOf = el => el.getBoundingClientRect().top - list.getBoundingClientRect().top;
  const baseline = topOf(row);
  const handler = () => {
    const el = findRow();
    // Zeile nicht mehr da (Liste wurde neu aufgebaut) oder weit weggescrollt
    if (!el || Math.abs(topOf(el) - baseline) > JUMP_CHIP_LEAVE_PX) hideJumpBackChip();
  };
  list.addEventListener('scroll', handler, { passive: true });
  jumpScrollWatch = { list, handler };
}
function stopJumpScrollWatch() {
  if (jumpScrollWatch) jumpScrollWatch.list.removeEventListener('scroll', jumpScrollWatch.handler);
  jumpScrollWatch = null;
}
function jumpBack() {
  const o = jumpOrigin;
  hideJumpBackChip();
  if (!o) return;
  if (o.sameTab && o.snapAfter && JSON.stringify(snapshotProgFilters()) === o.snapAfter) applyProgFilters(o.snapBefore);
  switchTab(o.tab); // Programm rendert dabei neu, Künstler-Liste bleibt bestehen
  const cfg = JUMP_ORIGIN_LISTS[o.tab];
  const findRow = key => [...document.getElementById(cfg.listId).children].find(el => cfg.isRowEl(el) && cfg.keyOf(el) === key);
  // Erst die zuvor aufgeklappte Programm-Zeile wieder öffnen (verändert die
  // Höhe), danach auf die gemerkte Scrollstelle springen.
  if (o.tab === 'programm' && o.openKey) {
    const row = findRow(o.openKey);
    const rid = row && (row.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/) || [])[1];
    const detail = rid && document.getElementById(`${rid}-detail`);
    if (detail && detail.classList.contains('collapsed')) toggleProgRating(rid);
    if (rid && o.termsOpen) toggleTermine(rid, true);
  }
  const restore = () => {
    if (!o.anchor) return;
    const row = findRow(o.anchor.key);
    if (row) scrollListToEl(cfg.listId, row, o.anchor.offset);
  };
  restore();
  if (window.requestAnimationFrame) requestAnimationFrame(restore);
}

// Künstler-Übersicht -> Programm-Übersicht: zeigt genau diesen Auftritt an.
// Filter werden nur so weit angepasst, wie nötig, damit der Auftritt sichtbar
// ist: erst Tag aktivieren, dann Uhrzeit-Filter lösen, zuletzt die übrigen
// Programm-Filter zurücksetzen. Was den Auftritt nicht ausblendet, bleibt wie
// es ist. Dauereinstellungen (ausgeblendete Locations/Künstler) werden NICHT
// angetastet - dann gibt es stattdessen einen Hinweis und man bleibt, wo man ist.
function jumpToProgShow(skey, keepOrigin) {
  const a = allProgEntries().find(x => showKey(x) === skey);
  if (!a) { toast('Auftritt nicht gefunden', false); return; }
  if (appSettings.hiddenLocations.includes(a.location)) {
    toast(`Location „${a.location}“ ist in den Einstellungen ausgeblendet`, false);
    return;
  }
  const d = dataMap[a.name];
  const hiddenArtist = (d && d.ausgeblendet) || (a.isEvent && hiddenEvents[a.nid]);
  if (hiddenArtist && !document.getElementById('progShowHidden').checked) {
    toast('Dieser Auftritt ist ausgeblendet - in der Programm-Übersicht „Ausgeblendete anzeigen“ aktivieren', false);
    return;
  }
  const origin = captureJumpOrigin('programm', a.name, keepOrigin === true);
  // Filter werden VOR dem Tabwechsel angepasst (sie sind reine DOM-Werte und
  // wirken auch bei verstecktem Tab): so baut der Tabwechsel die Liste genau
  // EINMAL mit dem Endergebnis auf, statt erst mit den alten und dann noch
  // einmal mit den neuen Filtern (der Listenaufbau ist der teuerste Schritt).
  const visible = () => getFilteredAuftritte().some(x => showKey(x) === skey);
  let filtersChanged = false;
  if (!visible()) {
    const dayBtn = [...document.querySelectorAll('.day-btn')].find(b => b.dataset.day === a.day);
    if (dayBtn) { dayBtn.classList.add('active'); filtersChanged = true; }
  }
  if (!visible()) {
    // "Kein Zeitfilter": von = erster Eintrag der Liste (08:00), bis = leer
    // (bzw. letzter Eintrag, falls es keine leere Option gibt).
    const fromSel = document.getElementById('timeFrom'), toSel = document.getElementById('timeTo');
    if (fromSel.options.length) fromSel.selectedIndex = 0;
    if ([...toSel.options].some(o => o.value === '')) toSel.value = '';
    else if (toSel.options.length) toSel.selectedIndex = toSel.options.length - 1;
    filtersChanged = true;
  }
  if (!visible()) { clearProgFilterState(); filtersChanged = true; }
  if (currentTab !== 'programm') switchTab('programm');   // baut die Liste auf
  else { hideJumpBackChip(); if (filtersChanged) renderProg(); }   // schon im Programm: nur bei geänderten Filtern neu aufbauen
  showJumpBackChip(origin);
  const row = [...document.querySelectorAll('#progList .prog-item')].find(el => el.dataset.skey === skey);
  if (!row) { toast('Auftritt in der Programm-Übersicht nicht gefunden', false); return; }
  const rid = (row.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/) || [])[1];
  const detail = rid && document.getElementById(`${rid}-detail`);
  if (detail && detail.classList.contains('collapsed')) toggleProgRating(rid);
  if (rid && keepOrigin === true) toggleTermine(rid, true);   // Sprung aus der Terminliste: dort bleibt sie offen
  const header = document.querySelector('#progList .prog-day-header');
  scrollListToEl('progList', row, header ? header.offsetHeight : 0);
  flashEl(row);
  if (origin && origin.sameTab) origin.snapAfter = JSON.stringify(snapshotProgFilters());
  startJumpScrollWatch('progList', () => [...document.querySelectorAll('#progList .prog-item')].find(el => el.dataset.skey === skey));
}
// Programm-Übersicht -> Künstler-Übersicht: klappt den Künstler auf und
// scrollt hin. Künstler-Filter werden nur zurückgesetzt, wenn sie ihn
// ausblenden; ist er selbst ausgeblendet, wird dafür der Filter "Ausgeblendet"
// der Künstler-Übersicht gesetzt (so sind ausgeblendete Künstler dort sichtbar).
function jumpToArtist(name) {
  const d = dataMap[name];
  if (!d) { toast('Künstler nicht in der Liste gefunden', false); return; }
  // Betreff des Chips: die Programm-Zeile, von der aus gesprungen wird (bei
  // Event-Act-Chips also das Event), sonst der Künstlername.
  let subject = name;
  if (currentTab === 'programm' && openProgRid) {
    const openRow = [...document.querySelectorAll('#progList .prog-item')].find(el => (el.getAttribute('onclick') || '').includes(`'${openProgRid}'`));
    const entry = openRow && allProgEntries().find(x => showKey(x) === openRow.dataset.skey);
    if (entry) subject = entry.name;
  }
  const origin = captureJumpOrigin('kuenstler', subject);
  switchTab('kuenstler');
  showJumpBackChip(origin);
  const visibleNow = getFiltered().some(x => x.name === name);
  if (!visibleNow) {
    resetKuenstlerFilters();
    if (d.ausgeblendet) statsAusgeblendetFilter = true;
  }
  expandedRows.add(name);
  // Ist der Künstler ohnehin sichtbar, reicht es, NUR seine Zeile neu zu
  // zeichnen (aufgeklappt); die komplette Künstler-Liste (hunderte Zeilen)
  // muss nur neu aufgebaut werden, wenn dafür Filter zurückgesetzt wurden.
  if (visibleNow && document.getElementById(`item-${name}`)) renderArtistItem(name);
  else render();
  const item = document.getElementById(`item-${name}`);
  if (!item) { toast('Künstler in der Übersicht nicht gefunden', false); return; }
  scrollListToEl('artistList', item, 0);
  flashEl(item.querySelector('.artist-row'));
  startJumpScrollWatch('artistList', () => document.getElementById(`item-${name}`));
}

// Springt auf den heutigen Festivaltag (falls es einer ist) und die aktuelle
// Uhrzeit minus Puffer (30 Min, siehe getFestivalContext), damit gerade
// laufende Shows nicht rausgefiltert werden.
// Tage: bewusst "heute + alle kommenden Tage" aktivieren (wie bei
// resetProgFilters()/applySmartProgDefaults(), siehe getPastFestivalDays()),
// NICHT nur der heutige Tag - zusammen mit der ohnehin fehlenden Endzeit
// (timeTo bleibt leer) kann man so direkt beliebig weit in die Zukunft
// scrollen, ohne die Tages-Auswahl manuell nachjustieren zu müssen.
// Zweistufiges Verhalten: 1. Klick passt NUR Tag+Zeit an (übrige Filter
// bleiben erhalten, damit man z.B. einen gesetzten Bewertungsfilter nicht
// verliert, nur weil man kurz zu "jetzt" springen will). Steht man bereits
// auf Tag+Zeit von "jetzt" (= 2. Klick direkt hintereinander, oder man war
// eh schon da), setzt der Klick zusätzlich die übrigen Programm-Filter
// zurück (Location, Genre, Bewertungen, Status, Dauer, Ziel) - bewusst OHNE
// "Ausgeblendete anzeigen" und OHNE die beiden Event-Sichtbarkeits-Haken
// (Musik-/Sonstige Events anzeigen), das sind Dauereinstellungen, keine
// Programm-Filter im engeren Sinn.
function jumpToNow() {
  const ctx = getFestivalContext();
  if (!ctx) { toast('Heute ist kein Festivaltag', false); return; }

  const pastDays = getPastFestivalDays();
  const dayBtns = [...document.querySelectorAll('.day-btn')];
  const fromSel = document.getElementById('timeFrom');
  const toSel = document.getElementById('timeTo');
  const alreadyAtNow = dayBtns.every(b => b.classList.contains('active') === !pastDays.has(b.dataset.day))
    && fromSel.value === ctx.time
    && toSel.value === '';

  dayBtns.forEach(b => b.classList.toggle('active', !pastDays.has(b.dataset.day)));
  if ([...fromSel.options].some(o => o.value === ctx.time)) fromSel.value = ctx.time;
  toSel.value = '';

  if (alreadyAtNow) {
    clearProgFilterState();
    renderProg();
    toast(`Zu ${ctx.day}, ${ctx.time} Uhr gesprungen + übrige Filter zurückgesetzt ✓`);
  } else {
    renderProg();
    toast(`Zu ${ctx.day}, ${ctx.time} Uhr gesprungen ✓`);
  }
}

// Bottom-Sheet mit statischer Erklärung des zweistufigen "Jetzt"-Verhaltens
// (siehe jumpToNow() oben) - bewusst als eigenes, jederzeit erreichbares
// ⓘ-Icon statt Hover-Tooltip, da Tooltips auf Touch-Geräten nicht
// zuverlässig funktionieren (gleiches Muster wie beim Kommentar-Icon).
function openJumpToNowInfoModal() {
  document.getElementById('jumpToNowInfoModal').classList.add('open');
}
function closeJumpToNowInfoModal() {
  document.getElementById('jumpToNowInfoModal').classList.remove('open');
}
function handleJumpToNowInfoBackdropClick(e) {
  if (e.target.id === 'jumpToNowInfoModal') closeJumpToNowInfoModal();
}

// Bottom-Sheet analog zu openJumpToNowInfoModal(), aber für den Sonderfall
// "dauerhaft ausgeblendete Location über Locations verwalten" - erreichbar
// direkt dort, wo eine fehlende Location tatsächlich auffällt (Location-
// Filter-Button), statt beim inhaltlich verwandten, aber vom Auffindungsort
// her kontextfremden "Jetzt"-ⓘ.
function openLocFilterInfoModal() {
  // Zeigt zusätzlich die aktuell ausgewählten Locations an - praktisch, weil
  // ausgewählte Locations als Chips im einklappbaren "Weitere Filter"-Bereich
  // stecken (dort potenziell unübersichtlich bei vielen Auswahlen) und man
  // sonst nur die reine Anzahl über die Button-Beschriftung sieht.
  const section = document.getElementById('locFilterInfoSelection');
  const list = document.getElementById('locFilterInfoSelectionList');
  if (section && list) {
    if (selectedLocs.size > 0) {
      list.innerHTML = [...selectedLocs].sort().map(l => `<span class="badge" style="font-size:11px">${l}</span>`).join('');
      section.style.display = 'block';
    } else {
      list.innerHTML = '';
      section.style.display = 'none';
    }
  }
  document.getElementById('locFilterInfoModal').classList.add('open');
}
function closeLocFilterInfoModal() {
  document.getElementById('locFilterInfoModal').classList.remove('open');
}
function openAuswertungInfoModal() {
  // Der Fußweg-Hinweis hängt davon ab, ob rbf-walk.js geladen ist - deshalb
  // erst beim Öffnen befüllen statt fest im Markup zu verdrahten.
  const note = document.getElementById('auswertungInfoWalkNote');
  if (note) note.textContent = walkDataAvailable()
    ? 'Fußwege sind vorberechnet (© OpenStreetMap-Mitwirkende, Routing: OSRM).'
    : 'Ohne hinterlegte Fußweg-Daten wird die Luftlinie verwendet und als „Luftlinie“ gekennzeichnet.';
  document.getElementById('auswertungInfoModal').classList.add('open');
}
function closeAuswertungInfoModal() {
  document.getElementById('auswertungInfoModal').classList.remove('open');
}
function handleAuswertungInfoBackdropClick(e) {
  if (e.target.id === 'auswertungInfoModal') closeAuswertungInfoModal();
}
function handleLocFilterInfoBackdropClick(e) {
  if (e.target.id === 'locFilterInfoModal') closeLocFilterInfoModal();
}

// Location-Filter zeigt nur Spielstätten, die im aktuell gewählten Zeitraum
// (Festival-Tag(e) + Uhrzeit von/bis) tatsächlich Auftritte haben - bewusst
// NUR nach Tag/Uhrzeit eingegrenzt, nicht nach den übrigen Programm-Filtern
// (Bewertung, Gesehen-Status, Dauer etc.), damit die Auswahl nicht unnötig
// stark schrumpft. Wird bei jedem renderProg()-Aufruf neu berechnet, reagiert
// also live auf Tag-Buttons und Uhrzeit-Dropdowns.
// Location-Filter zeigt nur Spielstätten, die im aktuell gewählten Zeitraum
// (Festival-Tag(e) + Uhrzeit von/bis) tatsächlich Auftritte haben - bewusst
// NUR nach Tag/Uhrzeit eingegrenzt, nicht nach den übrigen Programm-Filtern
// (Bewertung, Gesehen-Status, Dauer etc.), damit die Auswahl nicht unnötig
// stark schrumpft. Wird bei jedem renderProg()-Aufruf neu berechnet, reagiert
// also live auf Tag-Buttons und Uhrzeit-Dropdowns. Mehrfachauswahl per Modal
// (analog zum Genre-Filter) - bereits ausgewählte Locations bleiben auch dann
// im Modal auswählbar/angehakt, wenn sie im neuen Zeitraum gerade keine
// Auftritte haben, damit Tag/Uhrzeit-Änderungen die Auswahl nicht
// stillschweigend verwerfen.
function updateLocFilter() {
  const days = activeDays();
  const fromVal = document.getElementById('timeFrom').value;
  const toVal = document.getElementById('timeTo').value;
  const relevant = allProgEntries().filter(a => {
    if (!days.includes(a.day)) return false;
    if (appSettings.hiddenLocations.includes(a.location)) return false;
    if (a.time) {
      if (fromVal && timeSortValue(a.time) < timeSortValue(fromVal)) return false;
      if (toVal && timeSortValue(a.time) > timeSortValue(toVal)) return false;
    }
    return true;
  });
  let locs = [...new Set(relevant.map(a => a.location).filter(Boolean))];
  [...selectedLocs].forEach(l => { if (!locs.includes(l)) locs.push(l); });
  locFilterOptions = locs.sort((a, b) => a.localeCompare(b, 'de'));
  renderLocModalList();
  updateLocChips();
}

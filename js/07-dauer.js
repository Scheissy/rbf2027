// ── js/07-dauer.js ── Auftritts-Dauer: Formatierung, Dialog, Scroll-Räder ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('07-dauer');

function formatDuration(min) {
  if (min === 0) return '0 Min';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} Min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
// Dauer-Eingabe: In der aufgeklappten Zeile steht nur ein Button mit der
// aktuellen Dauer; Antippen öffnet ein Modal (wie die anderen Auswahl-Dialoge)
// mit freier Minuteneingabe (Zahlenfeld) plus -/+ im 5-Minuten-Takt.
// 0 bzw. leeres Feld = "keine Dauer eingetragen" (wie bei showRatings: der
// Eintrag wird beim Speichern aus dem Objekt gelöscht statt als 0 gespeichert -
// kein separater "keine Angabe"-Zustand). Nie kleiner als 0, nach oben auf
// DURATION_MAX_MIN begrenzt (Schutz vor Tippfehlern wie 9999).
// Änderungen werden sofort übernommen (wie zuvor beim Dropdown) - das Modal
// ist nur die Eingabeoberfläche, "Fertig"/✕/Hintergrund schließen es.
const DURATION_STEP_MIN = 5;
const DURATION_MAX_MIN = 999;
let durationModalRid = null, durationModalSkey = null, durationModalSuggest = 0;
function parseDurationInput(valStr) {
  const n = Math.round(parseFloat(String(valStr).replace(',', '.')));
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(n, DURATION_MAX_MIN);
}
// Dauer-VORSCHLAG aus Start- und Endzeit des Auftritts (Minuten, 0 = kein
// Vorschlag möglich: Zeit/Endzeit fehlt oder unlesbar). Endzeit nach
// Mitternacht (23:30 -> 00:15) wird mit +24h gerechnet. Der Vorschlag ist
// rein eine ANZEIGE: er steht nie in showDurations und zählt deshalb weder
// als "besucht" noch in Gesamtzeit/Auswertung/Filter - erst die bewusste
// Übernahme im Modal ("Als Auftritt speichern") schreibt einen echten Wert.
function suggestedDurationMin(a) {
  if (!a || !a.time || !a.endTime) return 0;
  const p = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim()); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  const s = p(a.time), e = p(a.endTime);
  if (isNaN(s) || isNaN(e)) return 0;
  let diff = e - s;
  if (diff <= 0) diff += 1440;
  return (diff > 0 && diff <= DURATION_MAX_MIN) ? diff : 0;
}
// In der Zeile wird NUR eine echte, gespeicherte Dauer angezeigt - ohne
// Eintrag steht dort neutral "+ Eintragen" (der Vorschlag taucht erst im
// Modal auf).
function durationBtnLabel(cur) {
  return cur > 0 ? `⏱ ${formatDuration(cur)}` : '+ Eintragen';
}
// Button in der Detailzeile (ersetzt das frühere Dropdown).
function durationButtonHTML(rid, skeyEsc, nameEsc, skey, sug) {
  const cur = showDurations[skey] || 0;
  sug = sug || 0;
  const cls = cur > 0 ? '' : ' duration-btn-empty';
  return `<button type="button" class="duration-btn${cls}" id="${rid}-durbtn" onclick="event.stopPropagation();openDurationModal('${rid}','${skeyEsc}','${nameEsc}',${sug})">${durationBtnLabel(cur)}</button>`;
}
// val = echter gespeicherter Wert. Ist er 0 und gibt es einen Vorschlag, zeigt
// das Modal den Vorschlag (gedimmt) an - OHNE ihn zu speichern.
// Eingabeformat der Dauer im Modal (Settings): 'minutes' = ein Feld mit allen
// Minuten (Standard), 'hm' = getrennte Felder Stunden + Minuten. Gespeichert
// wird in beiden Fällen immer die Gesamtzahl der Minuten.
function durationInputMode() { return appSettings.durationInputMode === 'hm' ? 'hm' : 'minutes'; }
function setDurationInputSetting(val) {
  appSettings.durationInputMode = val === 'hm' ? 'hm' : 'minutes';
  saveToStorage();
}
// Stunden-Schritt: +/- 60 Minuten; die Minuten bleiben erhalten. Unter 1 Stunde
// bleibt der Wert beim Stunden-Minus unverändert (Stundenfeld steht schon auf 0);
// nach oben wird bei DURATION_MAX_MIN gedeckelt.
function nextDurationHourStep(cur, delta) {
  if (delta > 0) return cur + 60 <= DURATION_MAX_MIN ? cur + 60 : cur;
  return cur >= 60 ? cur - 60 : cur;
}
// Zeichnet den Dialog für einen Wert (shown = Gesamtminuten). val = Wert, auf den
// sich "Zurücksetzen" und die Vorschau beziehen. Speichert NICHTS - beim Drehen
// der Räder wird erst am Ende der Geste gespeichert (siehe wheelCommit).
function paintDurationModal(shown, suggestMode, val) {
  const hm = durationInputMode() === 'hm';
  const inputEl = document.getElementById('durationModalInput');
  if (inputEl) {
    // Std:Min -> dieses Feld ist nur der Minuten-ANTEIL (0-59), sonst alle Minuten
    inputEl.value = String(hm ? shown % 60 : shown);
    inputEl.max = hm ? '59' : String(DURATION_MAX_MIN);
    inputEl.classList.toggle('duration-input-suggest', suggestMode);
  }
  const hoursRow = document.getElementById('durationModalHoursRow');
  if (hoursRow) hoursRow.style.display = hm ? 'flex' : 'none';
  const sepEl = document.getElementById('durationModalSep');
  if (sepEl) sepEl.style.display = hm ? 'flex' : 'none';
  const hInput = document.getElementById('durationModalHInput');
  if (hInput) { hInput.value = String(Math.floor(shown / 60)); hInput.classList.toggle('duration-input-suggest', suggestMode); }
  // Nachbar-Zeilen: zeigen, wohin ein Tipp bzw. ein Schritt führt (Minuten: nächster
  // 5er, Stunden: +/- 1 Std). Wo es nicht weitergeht, bleibt die Zeile leer und inaktiv.
  const setNb = (id, target, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = target === shown;
    el.textContent = target === shown ? '' : String(label);
  };
  const minPrev = nextDurationStep(shown, -5), minNext = nextDurationStep(shown, 5);
  setNb('durationModalMinus', minPrev, hm ? minPrev % 60 : minPrev);
  setNb('durationModalPlus', minNext, hm ? minNext % 60 : minNext);
  const hPrev = nextDurationHourStep(shown, -1), hNext = nextDurationHourStep(shown, 1);
  setNb('durationModalHMinus', hPrev, Math.floor(hPrev / 60));
  setNb('durationModalHPlus', hNext, Math.floor(hNext / 60));
  const prevEl = document.getElementById('durationModalPreview');
  if (prevEl) prevEl.textContent = suggestMode
    ? `Vorschlag aus Start-/Endzeit (${formatDuration(shown)}) - noch nicht gespeichert`
    : (val > 0 ? `= ${formatDuration(val)}` : 'Keine Dauer eingetragen');
  const resetEl = document.getElementById('durationModalReset');
  if (resetEl) {
    // Beim bloßen Vorschlag gibt es nichts zurückzusetzen -> der linke Button schließt dann nur
    resetEl.textContent = suggestMode ? 'Schließen' : 'Zurücksetzen';
    resetEl.disabled = !suggestMode && val <= 0;
  }
  const saveEl = document.getElementById('durationModalSave');
  if (saveEl) saveEl.textContent = suggestMode ? 'Als Auftritt speichern' : 'Fertig';
}
// val = echter gespeicherter Wert. Ist er 0 und gibt es einen Vorschlag, zeigt
// das Modal den Vorschlag (gedimmt) an - OHNE ihn zu speichern.
function syncDurationModal(val) {
  const suggestMode = val <= 0 && durationModalSuggest > 0;
  paintDurationModal(suggestMode ? durationModalSuggest : val, suggestMode, val);
}

// ── Räder: Drehen per Wischen (mit Schwung), Mausrad oder Tipp auf die Nachbarzeile ──
// Während der Geste wird nur ein Entwurf gezeichnet; gespeichert wird EINMAL am
// Ende (kein Speichern bei jedem Schritt). Wischen nach unten = kleinere Werte
// (wie beim Wecker: die Zahlen laufen mit dem Finger mit).
const WHEEL_STEP_PX = 34;     // Wischstrecke je Schritt (ca. eine Zeilenhöhe)
const WHEEL_START_PX = 6;     // erst ab dieser Bewegung zählt es als Wischen (sonst Tipp)
let wheelDrag = null, wheelInertia = null, wheelWheelDrag = null, wheelWheelTimer = null, wheelClickBlockUntil = 0;
function wheelStepFn(kind) { return kind === 'h' ? (t, dir) => nextDurationHourStep(t, dir) : (t, dir) => nextDurationStep(t, dir * 5); }
function wheelBaseTotal() { return showDurations[durationModalSkey] || durationModalSuggest || 0; }
function wheelApplySteps(d, n) {
  const fn = wheelStepFn(d.kind);
  let changed = false;
  for (let i = 0; i < Math.abs(n); i++) {
    const nt = fn(d.total, n > 0 ? 1 : -1);
    if (nt === d.total) { d.hitEnd = true; break; }
    d.total = nt; changed = true;
  }
  if (changed) paintDurationModal(d.total, false, d.total);
}
function wheelCommit(d) {
  if (durationModalSkey === null) return;
  const stored = showDurations[durationModalSkey] || 0;
  // Unverändert (bzw. nur der angezeigte Vorschlag): nichts speichern
  if (d.total !== (stored || durationModalSuggest || 0)) setShowDuration(durationModalRid, durationModalSkey, d.total);
  else syncDurationModal(stored);
}
function wheelPointerDown(e, kind) {
  if (durationModalSkey === null) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  finishWheelInertia();
  wheelDrag = { kind, startY: e.clientY, lastY: e.clientY, acc: 0, moved: false, total: wheelBaseTotal(), samples: [{ t: performance.now(), y: e.clientY }], el: e.currentTarget, pid: e.pointerId };
  document.addEventListener('pointermove', wheelPointerMove);
  document.addEventListener('pointerup', wheelPointerUp);
  document.addEventListener('pointercancel', wheelPointerUp);
}
function wheelPointerMove(e) {
  const d = wheelDrag;
  if (!d) return;
  if (!d.moved) {
    if (Math.abs(e.clientY - d.startY) < WHEEL_START_PX) return;
    d.moved = true; d.lastY = e.clientY;
    try { if (d.pid !== undefined && d.el.setPointerCapture) d.el.setPointerCapture(d.pid); } catch (err) { /* ohne Capture weiter */ }
    if (document.activeElement && document.activeElement.blur && /^(durationModal(H)?Input)$/.test(document.activeElement.id)) document.activeElement.blur();
  }
  const dy = e.clientY - d.lastY;
  d.lastY = e.clientY;
  d.acc += dy;
  d.samples.push({ t: performance.now(), y: e.clientY });
  while (d.samples.length > 2 && d.samples[0].t < d.samples[d.samples.length - 1].t - 120) d.samples.shift();
  const steps = Math.trunc(d.acc / WHEEL_STEP_PX);
  if (steps) { d.acc -= steps * WHEEL_STEP_PX; wheelApplySteps(d, -steps); }
}
function wheelPointerUp() {
  document.removeEventListener('pointermove', wheelPointerMove);
  document.removeEventListener('pointerup', wheelPointerUp);
  document.removeEventListener('pointercancel', wheelPointerUp);
  const d = wheelDrag;
  wheelDrag = null;
  if (!d || !d.moved) return;                           // nur getippt: normale Klick-Behandlung
  wheelClickBlockUntil = Date.now() + 400;              // der Klick nach dem Wischen darf nichts auslösen
  const first = d.samples[0], last = d.samples[d.samples.length - 1];
  const dt = last.t - first.t;
  // Wurde der Finger vor dem Loslassen kurz angehalten, gibt es keinen Schwung.
  const v = dt > 0 && performance.now() - last.t <= 100 ? (last.y - first.y) / dt : 0;   // px/ms, positiv = nach unten
  if (Math.abs(v) > 0.5) startWheelInertia(d, v);      // erst ab ca. 500 px/s: ein bewusstes Wischen um 1-2 Schritte läuft nicht nach
  else wheelCommit(d);
}
// Schwung: das Rad läuft nach dem Loslassen noch aus (nötig, um im Minuten-Modus
// bis zu 999 Minuten in 5er-Schritten zu erreichen).
function startWheelInertia(d, v) {
  wheelInertia = { d, v, last: performance.now(), raf: 0 };
  const tick = now => {
    const w = wheelInertia;
    if (!w) return;
    const dt = Math.min(48, now - w.last);
    w.last = now;
    w.d.acc += w.v * dt;
    w.v *= Math.pow(0.95, dt / 16.7);
    const steps = Math.trunc(w.d.acc / WHEEL_STEP_PX);
    if (steps) { w.d.acc -= steps * WHEEL_STEP_PX; wheelApplySteps(w.d, -steps); }
    if (Math.abs(w.v) < 0.04 || w.d.hitEnd) { finishWheelInertia(); return; }
    w.raf = requestAnimationFrame(tick);
  };
  wheelInertia.raf = requestAnimationFrame(tick);
}
function finishWheelInertia() {
  const w = wheelInertia;
  if (!w) return;
  wheelInertia = null;
  if (w.raf) cancelAnimationFrame(w.raf);
  wheelCommit(w.d);
}
// Mausrad (Desktop): ein Rastschritt = ein Schritt, gespeichert wird kurz nach dem letzten.
function wheelOnWheel(e, kind) {
  if (durationModalSkey === null) return;
  e.preventDefault();
  clearTimeout(wheelWheelTimer);
  if (wheelWheelDrag && wheelWheelDrag.kind !== kind) { wheelCommit(wheelWheelDrag); wheelWheelDrag = null; }
  if (!wheelWheelDrag) wheelWheelDrag = { kind, total: wheelBaseTotal() };
  wheelApplySteps(wheelWheelDrag, e.deltaY > 0 ? 1 : -1);
  wheelWheelTimer = setTimeout(flushWheelWheel, 300);
}
function flushWheelWheel() {
  clearTimeout(wheelWheelTimer);
  const d = wheelWheelDrag;
  wheelWheelDrag = null;
  if (d) wheelCommit(d);
}
// Laufender Schwung/Mausrad-Entwurf wird vor dem Schließen gespeichert.
function flushWheels() { finishWheelInertia(); flushWheelWheel(); }
// Der Klick, der direkt auf ein Wischen folgt, wird verschluckt (sonst würde das
// Loslassen über einer Nachbarzeile einen zusätzlichen Schritt auslösen).
document.getElementById('durationModal').addEventListener('click', e => {
  if (Date.now() < wheelClickBlockUntil) { e.stopPropagation(); e.preventDefault(); }
}, true);

function openDurationModal(rid, skey, name, sug) {
  durationModalRid = rid; durationModalSkey = skey; durationModalSuggest = sug > 0 ? sug : 0;
  document.getElementById('durationModalTitle').textContent = name ? `Dauer: ${name}` : 'Dauer';
  syncDurationModal(showDurations[skey] || 0);
  document.getElementById('durationModal').classList.add('open');
}
function closeDurationModal() {
  flushWheels();   // laufender Schwung / Mausrad-Entwurf wird zuerst gespeichert
  // Noch nicht per "change" übernommene Eingabe sichern (Tippen -> sofort Fertig).
  if (durationModalSkey !== null) commitDurationModalInput();
  document.getElementById('durationModal').classList.remove('open');
  durationModalRid = null; durationModalSkey = null; durationModalSuggest = 0;
}
// Der Dauer-Dialog hat bewusst weder ein ✕ noch schließt ein Tipp auf den
// Hintergrund: Änderungen werden hier (wie überall in der App) sofort gespeichert,
// ein ✕ würde aber ein Verwerfen suggerieren. Verlassen geht nur über die beiden
// Buttons - links "Zurücksetzen" (entfernt die Dauer) bzw. beim bloßen Vorschlag
// "Schließen" (verwirft nichts, speichert nichts), rechts "Fertig" bzw.
// "Als Auftritt speichern".
function durationModalLeftAction() {
  if (durationModalSkey === null) return;
  const noStored = !(showDurations[durationModalSkey] > 0);
  if (noStored && durationModalSuggest > 0) closeDurationModal();   // nur Vorschlag: einfach schließen
  else resetDurationModal();
}
// Hauptbutton des Modals: im Vorschlags-Zustand speichert er den Vorschlag
// als echte Dauer (= Auftritt zählt), sonst schließt er nur.
function confirmDurationModal() {
  if (durationModalSkey === null) return;
  // Erst eine getippte, noch nicht per "change" übernommene Zahl sichern -
  // sie hat Vorrang vor dem Vorschlag.
  commitDurationModalInput();
  if (!(showDurations[durationModalSkey] > 0) && durationModalSuggest > 0) {
    setShowDuration(durationModalRid, durationModalSkey, durationModalSuggest);
  }
  closeDurationModal();
}
function commitDurationModalInput() {
  if (durationModalSkey === null) return;
  const cur = showDurations[durationModalSkey] || 0;
  const minVal = parseDurationInput(document.getElementById('durationModalInput').value);
  // Std:Min: Gesamtminuten = Stunden * 60 + Minuten. Minuten über 59 (z. B. 75)
  // werden dabei in die Stunden übertragen (-> 1 h 15 min mehr), nichts geht verloren.
  const val = durationInputMode() === 'hm'
    ? Math.min(DURATION_MAX_MIN, parseDurationInput(document.getElementById('durationModalHInput').value) * 60 + minVal)
    : minVal;
  // Unveränderter Vorschlag im Feld = keine Eingabe -> NICHT speichern.
  const untouchedSuggestion = cur === 0 && durationModalSuggest > 0 && val === durationModalSuggest;
  if (val !== cur && !untouchedSuggestion) setShowDuration(durationModalRid, durationModalSkey, val);
  else syncDurationModal(cur); // ungültige Eingabe (leer/Text) im Feld bereinigen
}
function stepDurationModal(delta) {
  if (durationModalSkey === null) return;
  // Stepper startet beim gespeicherten Wert, sonst beim angezeigten Vorschlag.
  const base = showDurations[durationModalSkey] || durationModalSuggest || 0;
  stepShowDuration(durationModalRid, durationModalSkey, delta, base);
}
function stepDurationModalHours(delta) {
  if (durationModalSkey === null) return;
  const base = showDurations[durationModalSkey] || durationModalSuggest || 0;
  const next = nextDurationHourStep(base, delta);
  if (next !== base) setShowDuration(durationModalRid, durationModalSkey, next);
}
function resetDurationModal() {
  if (durationModalSkey === null) return;
  setShowDuration(durationModalRid, durationModalSkey, 0);
}
// Schrittweite 5: Bei einem glatten Vielfachen von 5 wird 5 addiert/abgezogen,
// bei einem manuell eingetragenen krummen Wert (z. B. 47) springt +/- zum
// NÄCHSTEN 5er in die jeweilige Richtung (47 -> 50 bzw. 45). Nie unter 0,
// nie über DURATION_MAX_MIN.
function nextDurationStep(cur, delta) {
  const st = DURATION_STEP_MIN;
  const v = delta > 0 ? (Math.floor(cur / st) + 1) * st : (Math.ceil(cur / st) - 1) * st;
  return Math.max(0, Math.min(DURATION_MAX_MIN, v));
}
function stepShowDuration(rid, skey, delta, base) {
  const cur = base !== undefined ? base : (showDurations[skey] || 0);
  setShowDuration(rid, skey, nextDurationStep(cur, delta));
}
function setShowDuration(rid, skey, valStr) {
  const val = parseDurationInput(valStr);
  if (val > 0) showDurations[skey] = val;
  else delete showDurations[skey];
  saveToStorage();
  // Modal (falls für diesen Auftritt offen) und Button in der Detailzeile
  // auf den bereinigten Wert synchronisieren (z. B. -3 -> 0, 5000 -> 999).
  if (durationModalSkey === skey) syncDurationModal(val);
  const btnEl = document.getElementById(`${rid}-durbtn`);
  if (btnEl) {
    btnEl.textContent = durationBtnLabel(val);
    btnEl.classList.toggle('duration-btn-empty', val <= 0);
  }
  const summaryEl = document.getElementById(`${rid}-durationsummary`);
  if (summaryEl) {
    summaryEl.style.display = val > 0 ? '' : 'none';
    summaryEl.textContent = val > 0 ? `⏱ ${formatDuration(val)}` : '';
  }
  updateShowMetaRowVisibility(rid);
  updateProgRowVisited(rid, skey);
  // Wird gerade die Dauer entfernt (auf 0 gesetzt) UND der "Nur mit Dauer"-
  // Filter ist aktiv, muss die Zeile aus der Liste verschwinden -> volle
  // Neu-Filterung nötig.
  if (document.getElementById('fProgDuration').checked && val === 0) { renderProg(); return; }
  updateProgTotalTime();
}
// Zentrale Filterlogik der Programm-Übersicht - von renderProg() UND
// updateProgTotalTime() genutzt, damit beide immer exakt dieselben Auftritte
// als "aktuell sichtbar" behandeln.
function getFilteredAuftritte() {
  const days = activeDays();
  const fromVal = document.getElementById('timeFrom').value;
  const toVal = document.getElementById('timeTo').value;
  const showHidden = document.getElementById('progShowHidden').checked;
  const minRating = progRatingFilter;
  const statusVal = document.getElementById('fProgStatus').value;
  const durationOnly = document.getElementById('fProgDuration').checked;
  const plannedOnly = document.getElementById('fProgPlanned').checked;
  return allProgEntries().filter(a => {
    if (!days.includes(a.day)) return false;
    // Globaler Settings-Schalter (Settings-Tab): Sonderveranstaltungen komplett
    // aus der Programm-Übersicht ausblenden, unabhängig von den beiden
    // Musik-/Sonstige-Events-Checkboxen darunter (die regeln nur die
    // Feinauswahl, wenn Events grundsätzlich angezeigt werden).
    if (a.isEvent && !appSettings.showRbfEvents) return false;
    // Persistente Locations-Verwaltung (Settings): komplett ausgeblendete
    // Locations gelten immer, unabhängig vom temporären Location-Filter oben
    // - bewusst NICHT Teil von "Filter zurücksetzen", da es sich eher um eine
    // dauerhafte Anzeige-Einstellung handelt als um einen Sitzungsfilter.
    if (appSettings.hiddenLocations.includes(a.location)) return false;
    if (selectedLocs.size > 0 && !selectedLocs.has(a.location)) return false;
    const d = dataMap[a.name];
    // Gleicher Haken wie bei ausgeblendeten Künstlern, gilt hier zusätzlich
    // für einzeln ausgeblendete Sonderveranstaltungen (hiddenEvents statt
    // d.ausgeblendet, da Events keinen dataMap-Eintrag haben).
    if (!showHidden && ((d && d.ausgeblendet) || (a.isEvent && hiddenEvents[a.nid]))) return false;
    if (a.time) {
      if (fromVal && timeSortValue(a.time) < timeSortValue(fromVal)) return false;
      if (toVal && timeSortValue(a.time) > timeSortValue(toVal)) return false;
    }
    if (minRating > 0 && avgRating(d) < minRating) return false;
    // Events haben kein Genre (nur Künstler-Auftritte) - bei aktivem Filter
    // fallen sie damit konsequent raus, genau wie sie es bei den anderen
    // künstler-spezifischen Filtern (Bewertung, Status) oben bereits tun.
    if (progSelectedGenres.size > 0 && (!d || !splitTags(d.genre).some(g => progSelectedGenres.has(g)))) return false;
    if (progShowRatingFilter > 0 && (showRatings[showKey(a)] || 0) < progShowRatingFilter) return false;
    if (statusVal === 'ja' && d?.gesehen !== 'ja') return false;
    if (statusVal === 'bekannt' && d?.gesehen !== 'bekannt' && d?.gesehen !== 'ja') return false; // "gesehen" ist immer auch "bekannt"
    if (statusVal === 'unbekannt' && (!d || d.gesehen !== '')) return false;
    if (durationOnly && showDurations[showKey(a)] === undefined) return false;
    if (plannedOnly && !planFlags[showKey(a)]) return false;
    return true;
  });
}
// Summiert die eingetragenen Dauern über die aktuell gefilterte Auftritts-
// liste (identische Filter wie renderProg()) und zeigt das Ergebnis über der
// Liste an. Blendet sich komplett aus, wenn in der aktuellen Ansicht keine
// einzige Dauer eingetragen ist.
function updateProgTotalTime() {
  const el = document.getElementById('progTotalTime');
  if (!el) return;
  if (!allProgEntries().length) { el.style.display = 'none'; return; }
  const withDuration = getFilteredAuftritte().filter(a => showDurations[showKey(a)] !== undefined);
  if (!withDuration.length) { el.style.display = 'none'; el.textContent = ''; return; }
  const totalMin = withDuration.reduce((sum, a) => sum + showDurations[showKey(a)], 0);
  el.style.display = '';
  el.textContent = `⏱ Gesamtzeit: ${formatDuration(totalMin)} (${withDuration.length} Auftritt${withDuration.length === 1 ? '' : 'e'} mit Dauer)`;
}

function setProgRating(rid, name, field, val) {
  if (!dataMap[name]) return;
  const d = dataMap[name];
  d[field] = (d[field] === val) ? 0 : val;
  saveToStorage();
  updateStats();
  const vals = [d.rp, d.rl].filter(v => v > 0);
  const avg = vals.length ? vals.reduce((x,y) => x+y, 0) / vals.length : 0;
  // Künstlerbewertung gilt für ALLE seine Auftritte - also jede aktuell
  // sichtbare Zeile dieses Künstlers aktualisieren, nicht nur die angeklickte.
  (progRidsByName[name] || [rid]).forEach(r => {
    const starsEl = document.getElementById(`${r}-${field}`);
    if (starsEl) starsEl.innerHTML = progStarsHTML(r, name, field);
    const summaryEl = document.getElementById(`${r}-summary`);
    if (summaryEl) {
      summaryEl.classList.toggle('has-rating', vals.length > 0);
      summaryEl.innerHTML = miniStars(avg);
      summaryEl.title = vals.length ? `Künstler-Ø-Bewertung: ${avg.toFixed(1)}` : '';
    }
  });
}
let openProgRid = null;
function toggleProgRating(rid) {
  const detail = document.getElementById(`${rid}-detail`);
  const arrow = document.getElementById(`${rid}-arrow`);
  if (!detail) return;

  // Falls eine andere Detail-Ansicht offen ist, diese zuerst schließen
  if (openProgRid && openProgRid !== rid) {
    const prevDetail = document.getElementById(`${openProgRid}-detail`);
    const prevArrow = document.getElementById(`${openProgRid}-arrow`);
    if (prevDetail) prevDetail.classList.add('collapsed');
    if (prevArrow) prevArrow.textContent = '▸';
    updateShowMetaRowVisibility(openProgRid);
  }

  const nowCollapsed = detail.classList.toggle('collapsed');
  if (!nowCollapsed) {
    const entry = progEntryByRid[rid];
    if (entry) detail.innerHTML = progDetailHTML(entry, rid);   // lazy: frisch aus dem aktuellen Zustand
  }
  if (arrow) arrow.textContent = nowCollapsed ? '▸' : '▾';
  openProgRid = nowCollapsed ? null : rid;
  updateShowMetaRowVisibility(rid);
}


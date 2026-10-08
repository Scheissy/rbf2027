// ── js/08-zeilenaktionen.js ── Ausblenden/Reinhören, Kommentar, Soundreferenzen, Gesehen-Buttons ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('08-zeilenaktionen');

// ── SEEN ──────────────────────────────────────────────────────────────────────
function toggleHidden(name) {
  const d = dataMap[name];
  if (!d) return;
  d.ausgeblendet = !d.ausgeblendet;
  saveToStorage();
  renderKuenstlerPreservingScroll();
  if (currentTab === 'programm') renderProg();
  toast(d.ausgeblendet ? `„${name}" ausgeblendet 🙈` : `„${name}" wieder eingeblendet 👁`);
}

// Analog zu toggleHidden(), aber für Sonderveranstaltungen (kein dataMap-
// Eintrag vorhanden) - Zustand hängt am synthetischen nid statt am Namen.
function toggleEventHidden(nid) {
  const wasHidden = !!hiddenEvents[nid];
  if (wasHidden) delete hiddenEvents[nid];
  else hiddenEvents[nid] = true;
  saveToStorage();
  renderProg();
  toast(wasHidden ? 'Veranstaltung wieder eingeblendet 👁' : 'Veranstaltung ausgeblendet 🙈');
}

// Markiert einen Künstler zum "nochmal reinhören" - reine Merk-Funktion für
// die eigene Nachbereitung, wirkt sich (anders als "Ausblenden") auf nichts
// anderes aus. Setzen und Filtern ist bewusst nur in der Künstler-Übersicht
// möglich, kein Pendant in der Programm-Übersicht.
// Aktualisiert bewusst nur die eine Zeile (statt die ganze Liste neu zu
// filtern) - analog zu setRating() bei den Bewertet/Unbewertet-Kacheln: der
// gerade bearbeitete Künstler bleibt sichtbar, auch wenn er durch die
// Änderung nicht mehr zum aktiven "Reinhören"-Filter passt. Kein abruptes
// Verschwinden mitten in der Bearbeitung - der Filter greift erst wieder
// beim nächsten regulären Neu-Rendern (Tab-Wechsel, anderer Filter, Reset).
function toggleReinhoeren(name) {
  const d = dataMap[name];
  if (!d) return;
  d.reinhoeren = !d.reinhoeren;
  saveToStorage();
  renderArtistItem(name);
  updateStats();
  toast(d.reinhoeren ? `„${name}" zum Reinhören vorgemerkt 🎧` : `„${name}" aus dem Reinhören entfernt`);
}

// ── KOMMENTAR ─────────────────────────────────────────────────────────────────
// Escaped Text für die Einbettung in HTML-Attribute/Textarea-Inhalt (kein
// vorhandener Helper dafür im Rest der App, daher hier lokal definiert).
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let commentSaveTimers = {};
function commentHTML(nj, d) {
  const val = d.kommentar || '';
  const len = val.length;
  return `<textarea class="comment-textarea" id="comment-${nj}" maxlength="${MAX_COMMENT_LEN}" placeholder="Kurze Notiz zu diesem Künstler …" oninput="onCommentInput('${nj}')">${escapeHtml(val)}</textarea>
    <div class="comment-count${len >= MAX_COMMENT_LEN ? ' comment-count-max' : ''}" id="comment-count-${nj}">${len}/${MAX_COMMENT_LEN}</div>`;
}
// Aktualisiert dataMap sofort (damit der Text nicht verloren geht, falls z.B.
// zwischendurch der Tab gewechselt wird) und schreibt debounced in localStorage,
// damit nicht bei jedem Tastendruck geschrieben wird.
function onCommentInput(name) {
  if (!dataMap[name]) return;
  const el = document.getElementById(`comment-${name}`);
  if (!el) return;
  const val = el.value.slice(0, MAX_COMMENT_LEN);
  dataMap[name].kommentar = val;
  const countEl = document.getElementById(`comment-count-${name}`);
  if (countEl) {
    countEl.textContent = `${val.length}/${MAX_COMMENT_LEN}`;
    countEl.classList.toggle('comment-count-max', val.length >= MAX_COMMENT_LEN);
  }
  const iconEl = document.getElementById(`comment-icon-${name}`);
  if (iconEl) iconEl.style.display = val ? '' : 'none';
  clearTimeout(commentSaveTimers[name]);
  commentSaveTimers[name] = setTimeout(() => saveToStorage(), 500);
}

// Nur-Lese-Ansicht des Kommentars (Künstler- UND Programm-Übersicht): Icon
// wird nur angezeigt, wenn ein Kommentar existiert; Klick öffnet ihn als
// Bottom-Sheet (statt echtem Hover-Tooltip, da das auf Touch-Geräten nicht
// funktioniert). Stabile ID (aus dem unescapten Namen bzw. optional einem
// idSuffix) plus "leerer" ausgeblendeter Platzhalter-Zustand, damit
// onCommentInput() es beim Tippen sofort ein-/ausblenden kann. idSuffix wird
// in der Programm-Übersicht genutzt (dort z.B. per rid), da ein Künstler
// dort mit mehreren Auftritten gleichzeitig mehrfach stehen kann - ohne
// eindeutige ID pro Zeile gäbe es doppelte HTML-IDs im DOM.
function commentIconHTML(name, nj, d, idSuffix) {
  const has = !!(d && d.kommentar);
  const id = idSuffix || name;
  return `<button type="button" class="comment-icon-btn" id="comment-icon-${id}" onclick="event.stopPropagation();openCommentModal('${nj}')" title="Kommentar anzeigen"${has ? '' : ' style="display:none"'}>💬</button>`;
}
function openCommentModal(name) {
  const d = dataMap[name];
  if (!d || !d.kommentar) return;
  document.getElementById('commentModalTitle').textContent = name;
  document.getElementById('commentModalText').textContent = d.kommentar;
  document.getElementById('commentModal').classList.add('open');
}
function closeCommentModal() {
  document.getElementById('commentModal').classList.remove('open');
}
function handleCommentBackdropClick(e) {
  if (e.target.id === 'commentModal') closeCommentModal();
}

// ── SOUNDREFERENZEN ──────────────────────────────────────────────────────────
// SOUND_REFERENCES kommt aus rbf-data.js: ein Array von Einträgen
// { referenz: [Name(n)], kategorie: string, acts: [Künstlername(n)] }, das
// bekannten Vergleichs-/Referenz-Acts eine Kurzbeschreibung zuordnet. Die
// Liste wächst mit der Zeit (mehr Referenzen, mehr zugeordnete Acts) - daher
// hier bewusst nichts hartverdrahtet, sondern immer dynamisch gegen das
// Array geprüft (inkl. typeof-Schutz, falls es in rbf-data.js mal fehlt).
// Ein Act kann theoretisch in mehreren Referenz-Einträgen auftauchen, daher
// wird hier immer eine Liste aller Treffer zurückgegeben, nicht nur der erste.
function soundReferencesFor(name) {
  if (typeof SOUND_REFERENCES === 'undefined' || !Array.isArray(SOUND_REFERENCES)) return [];
  return SOUND_REFERENCES.filter(r => Array.isArray(r.acts) && r.acts.includes(name));
}
function soundRefIconHTML(name) {
  if (!appSettings.showSoundRef || !soundReferencesFor(name).length) return '';
  return `<button type="button" class="soundref-icon-btn" onclick="event.stopPropagation();openSoundRefModal('${escJs(name)}')" title="Klingt wie …">🔊</button>`;
}
// Blendet den Soundreferenz-Filter komplett aus (nicht nur seinen Inhalt),
// wenn die Anzeige in den Settings deaktiviert ist - dann darf er auch nicht
// mehr in der Filter-Leiste auftauchen.
function updateSoundRefFilterVisibility() {
  const sel = document.getElementById('fSoundRef');
  if (sel) sel.style.display = appSettings.showSoundRef ? '' : 'none';
}
function openSoundRefModal(name) {
  const refs = soundReferencesFor(name);
  if (!refs.length) return;
  document.getElementById('soundRefModalTitle').textContent = name;
  document.getElementById('soundRefModalBody').innerHTML = refs.map(r => `
    <div class="soundref-entry">
      <div class="soundref-name">🔊 Klingt wie: ${(r.referenz || []).join(' / ')}</div>
      <div class="soundref-kategorie">${r.kategorie || ''}</div>
    </div>`).join('');
  document.getElementById('soundRefModal').classList.add('open');
}
function closeSoundRefModal() {
  document.getElementById('soundRefModal').classList.remove('open');
}
function handleSoundRefBackdropClick(e) {
  if (e.target.id === 'soundRefModal') closeSoundRefModal();
}

// Erzeugt die Gesehen-Buttons (wiederverwendet in Künstler-Ansicht)
// WICHTIG: "name" ist hier IMMER der rohe (unescapte) Künstlername - das
// Escaping für den onclick-Aufbau passiert bewusst erst intern (gleiches
// Muster/gleicher Grund wie bei progStarsHTML() oben: vorher wurde teils der
// bereits escapte Name übergeben, was bei Namen mit Apostroph den nächsten
// Klick auf "Gesehen"/"Bekannt" nach einem Neu-Zeichnen brechen konnte).
function seenButtonsHTML(name, d, progRid) {
  const nameEsc = escJs(name);
  const handler = progRid ? `setSeenProg('${progRid}','${nameEsc}',` : `setSeen('${nameEsc}',`;
  return `<div class="seen-btns"${progRid ? ` id="${progRid}-seen"` : ''}>
    <button class="seen-btn${d.gesehen === 'bekannt' ? ' active-bekannt' : ''}" onclick="${handler}'bekannt')">👂 Bekannt</button>
    <button class="seen-btn${d.gesehen === 'ja' ? ' active-ja' : ''}" onclick="${handler}'ja')">✓ Gesehen</button>
  </div>`;
}
// Setzt den Gesehen-Status gezielt aus der Programm-Übersicht heraus, ohne die
// komplette Liste neu zu rendern (sonst würde der aufgeklappte Bereich wieder
// zuklappen). Aktualisiert per direktem DOM-Update ALLE aktuell sichtbaren
// Zeilen dieses Künstlers (Gesehen-Status gilt künstlerweit, nicht pro Show -
// bei mehreren gleichzeitig sichtbaren Auftritten sonst inkonsistent bis zum
// nächsten Reload).
function setSeenProg(rid, name, val) {
  if (!dataMap[name]) return;
  const d = dataMap[name];
  d.gesehen = (d.gesehen === val) ? '' : val;
  saveToStorage();
  updateStats();
  (progRidsByName[name] || [rid]).forEach(r => {
    const el = document.getElementById(`${r}-seen`);
    if (el) el.outerHTML = seenButtonsHTML(name, d, r);
  });
}

// Aktualisiert die Gesehen-Status-Anzeige überall dort, wo der Künstler
// gerade sichtbar ist (Künstler-Detail + ggf. Programm-Übersicht).
function refreshSeenButtons(name) {
  renderArtistItem(name);
  if (currentTab === 'programm') renderProg();
}

function setSeen(name, val) {
  if (!dataMap[name]) return;
  dataMap[name].gesehen = (dataMap[name].gesehen === val) ? '' : val;
  refreshSeenButtons(name);
  updateStats();
  saveToStorage();
}


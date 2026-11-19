// ── js/16-validierung.js ── Datenprüfung: Validierung & Auto-Fix ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('16-validierung');

// Verschoben aus rbf-data.js (dort stehen nur noch die Daten). Nutzt die Globals auftritte, dataMap,
// timeSortValue, toast, safeLog sowie DAY_ORDER und VENUE_LOCATIONS (diese beiden kommen aus rbf-data.js).

// ── VALIDIERUNG & AUTO-FIX ──────────────────────────────────────────────────
let lastValidationIssues = [];
let lastAutoFixes = [];

function autoFixAuftritte() {
  const fixes = [];

  // 1) Location-Whitespace trimmen
  auftritte.forEach(a => {
    if (a.location && a.location !== a.location.trim()) {
      fixes.push(`Location-Leerzeichen entfernt bei ${a.name}: "${a.location}" -> "${a.location.trim()}"`);
      a.location = a.location.trim();
    }
  });

  // 2) Exakte Duplikate entfernen (gleicher Künstler+Tag+Zeit+Location, bzw. gleiche nid)
  const seen = new Set();
  const deduped = [];
  auftritte.forEach(a => {
    const key = a.nid !== undefined && a.nid !== null ? `nid:${a.nid}` : `${a.name}|${a.day}|${a.time}|${a.location}`;
    if (seen.has(key)) {
      fixes.push(`Exaktes Duplikat entfernt: ${a.name} (${a.day} ${a.time || 'TBA'})`);
      return;
    }
    seen.add(key);
    deduped.push(a);
  });
  auftritte = deduped;

  if (fixes.length) safeLog(`🔧 Auto-Fix: ${fixes.length} triviale(s) Problem(e) automatisch behoben`, fixes);
  lastAutoFixes = fixes;
  updateValidationPanel();
  return fixes;
}

function validateAuftritte(silent) {
  const issues = [];
  const exactSeen = new Map();
  const byArtistDayTime = new Map();
  const byTimeLoc = new Map();
  const byArtistDay = new Map();
  const nameCounts = new Map();

  auftritte.forEach(a => {
    nameCounts.set(a.name, (nameCounts.get(a.name) || 0) + 1);

    if (!DAY_ORDER.includes(a.day)) issues.push(`Unbekannter Tag „${a.day}" bei ${a.name}`);
    if (!dataMap[a.name]) issues.push(`„${a.name}" (Auftritt) nicht in der Künstlerliste gefunden`);
    if (a.time && !/^\d{2}:\d{2}$/.test(a.time)) issues.push(`Ungültiges Zeitformat „${a.time}" bei ${a.name}`);
    if (a.endTime && !/^\d{2}:\d{2}$/.test(a.endTime)) issues.push(`Ungültiges Endzeit-Format „${a.endTime}" bei ${a.name}`);
    if (a.location && a.location !== a.location.trim()) issues.push(`Location mit Leerzeichen-Problem bei ${a.name}: "${a.location}"`);
    if (a.location && !VENUE_LOCATIONS[a.location]) issues.push(`Location „${a.location}" (${a.name}) hat keinen Maps-Eintrag - Link fällt auf Namenssuche zurück`);

    if (a.time && a.endTime) {
      const s = timeSortValue(a.time), e = timeSortValue(a.endTime);
      if (e <= s) issues.push(`Endzeit nicht nach Startzeit bei ${a.name} (${a.time}–${a.endTime})`);
      else if (e - s > 180) issues.push(`Ungewöhnlich lange Show bei ${a.name}: ${a.time}–${a.endTime} (${Math.round((e - s) / 6) / 10}h)`);
    }

    const exactKey = `${a.name}|${a.day}|${a.time}|${a.location}`;
    exactSeen.set(exactKey, (exactSeen.get(exactKey) || 0) + 1);

    if (a.time) {
      const adtKey = `${a.name}|${a.day}|${a.time}`;
      if (!byArtistDayTime.has(adtKey)) byArtistDayTime.set(adtKey, new Set());
      byArtistDayTime.get(adtKey).add(a.location);

      if (a.location) {
        const tlKey = `${a.day}|${a.time}|${a.location}`;
        if (!byTimeLoc.has(tlKey)) byTimeLoc.set(tlKey, new Set());
        byTimeLoc.get(tlKey).add(a.name);
      }
    }

    const adKey = `${a.name}|${a.day}`;
    if (!byArtistDay.has(adKey)) byArtistDay.set(adKey, []);
    byArtistDay.get(adKey).push(a);
  });

  exactSeen.forEach((count, key) => { if (count > 1) issues.push(`Exaktes Duplikat (${count}×): ${key.replace(/\|/g, ' / ')}`); });
  byArtistDayTime.forEach((locs, key) => { if (locs.size > 1) issues.push(`${key.replace(/\|/g, ' / ')}: unterschiedliche Locations gleichzeitig (${[...locs].join(', ')})`); });
  byTimeLoc.forEach((names, key) => { if (names.size > 1) issues.push(`${key.replace(/\|/g, ' / ')}: mehrere Künstler gleichzeitig am selben Ort (${[...names].join(', ')})`); });
  byArtistDay.forEach((shows, key) => {
    if (shows.length < 2) return;
    const timed = shows.filter(s => s.time).sort((a, b) => timeSortValue(a.time) - timeSortValue(b.time));
    for (let i = 0; i < timed.length - 1; i++) {
      if (timeSortValue(timed[i].endTime || timed[i].time) > timeSortValue(timed[i + 1].time)) {
        issues.push(`Überlappende Auftritte bei ${key.split('|')[0]} am ${key.split('|')[1]}`);
      }
    }
  });
  nameCounts.forEach((count, name) => { if (count > 3) issues.push(`${name} hat ungewöhnlich viele Auftritte (${count}) - evtl. Mehrfach-Import?`); });

  if (issues.length) {
    if (!silent) {
      safeLog(`⚠️ Datenqualitäts-Check: ${issues.length} Auffälligkeit(en)`, issues);
      toast(`⚠️ Datencheck: ${issues.length} Auffälligkeit(en) - siehe Settings`, false);
    }
  } else {
    if (!silent) {
      safeLog('✓ Datenqualitäts-Check: keine Auffälligkeiten');
      toast('✓ Datencheck: keine Auffälligkeiten gefunden');
    }
  }
  lastValidationIssues = issues;
  updateValidationPanel();
  return issues;
}

// Stabiler Schlüssel für die Auftritts-Bewertung: nutzt die eindeutige, von der
// RBF-API vergebene Auftritts-ID (nid) - die bleibt unverändert, auch wenn
// Zeit/Location später von TBA auf echte Werte aktualisiert werden oder sich
// der Tag verschiebt. Fallback auf Künstler+Tag+Zeit+Location nur für Auftritte
// ohne nid (z.B. per CSV importiert), damit auch die noch funktionieren.
function updateValidationPanel() {
  const el = document.getElementById('validationPanel');
  if (!el) return;
  let html = '';
  if (lastAutoFixes.length) {
    html += `<div style="color:var(--accent);font-size:12px;margin-bottom:6px">🔧 ${lastAutoFixes.length} automatisch behoben:</div>` +
      lastAutoFixes.map(f => `<div style="font-size:12px;color:var(--text2);padding:3px 0;border-top:1px solid var(--border)">${f}</div>`).join('') +
      `<div style="height:10px"></div>`;
  }
  if (!lastValidationIssues.length) {
    html += `<div style="color:var(--green);font-size:13px">✓ Keine weiteren Auffälligkeiten</div>`;
  } else {
    html += `<div style="color:#e0a030;font-size:12px;margin-bottom:6px">⚠️ ${lastValidationIssues.length} Auffälligkeit(en), die eine Entscheidung brauchen:</div>` +
      lastValidationIssues.map(i => `<div style="font-size:12px;color:var(--text2);padding:3px 0;border-top:1px solid var(--border)">${i}</div>`).join('');
  }
  el.innerHTML = html;
}

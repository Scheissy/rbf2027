// ── js/99-main.js ── Start: Vollständigkeitsprüfung, Initialisierung ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('99-main');

// Prüft zuerst, ob alle Teile geladen wurden (z. B. nach einem unvollständigen Update oder bei
// fehlender Datei im Offline-Cache) und warnt sichtbar, statt mit kryptischen Fehlern zu starten.
const RBF_EXPECTED_PARTS = ["01-data", "02-storage", "03-auswertung", "04-wegstrecke", "05-filter", "06-bewertung", "07-dauer", "08-zeilenaktionen", "09-kuenstler", "10-programm", "11-sprung", "12-filtermodals", "13-install", "14-programmliste", "15-export", "99-main"];
function checkAppParts(expected) {
  const loaded = window.RBF_PARTS || [];
  const missing = expected.filter(p => !loaded.includes(p));
  if (missing.length) {
    const b = document.createElement('div');
    b.id = 'partsWarning';
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:3000;padding:10px 14px;background:#b00020;color:#fff;font-size:13px;text-align:center';
    b.textContent = 'App unvollständig geladen (' + missing.join(', ') + ') – bitte Seite neu laden.';
    document.body.appendChild(b);
  }
  return missing;
}
checkAppParts(RBF_EXPECTED_PARTS);

loadFromStorage();
autoFixAuftritte();
buildRbfEvents();
applySettingsUI();
updateLocFilter();
updateTagFilters();
buildTimeDropdowns();
loadFilterState();
updateGenreChips();
updateLocFilter();
renderProgRatingStars();
renderProgShowRatingStars();
renderKuenstlerAvgFilterStars();
render();
updateStats();
validateAuftritte(true);
document.getElementById('stats').addEventListener('scroll', updateStatsbarFades);
window.addEventListener('resize', updateStatsbarFades);

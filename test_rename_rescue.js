const { loadApp, reloadWithState, createChecker } = require('./test-helpers');

// Eigene Testdatendatei: Version A hat "Meller", Version B hat "MELLER"
// (identischer Künstler, nur Groß-/Kleinschreibung geändert - genau der
// gemeldete Fall) - simuliert ein rbf-data.js-Update zwischen zwei Sessions.
function buildDataScript(name) {
  return `
    const DATA_VERSION = 'test-rename';
    const DAY_ORDER = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];
    const RAW = [
      ['${name}', 'Techno', 'Berlin, DE', 'männlich', 'https://example.org/a'],
      ['Anderer Act', 'Pop', 'Hamburg, DE', 'divers', 'https://example.org/b'],
    ];
    const RAW_AUFTRITTE = [];
    const VENUE_LOCATIONS = {};
    const ANCHOR_AWARD_NOMINEES = [];
    const SOUND_REFERENCES = [];
    const RBF_EVENTS = [];
    let lastAutoFixes = []; let lastValidationIssues = [];
    function autoFixAuftritte() {} function validateAuftritte() {} function updateValidationPanel() {}
  `;
}

(async () => {
  const t = createChecker();

  // ── Fall 1: reine Schreibweisen-Änderung (Meller -> MELLER) - Bewertung
  // und Gesehen-Status sollen automatisch auf den neuen Namen übertragen
  // werden. ──────────────────────────────────────────────────────────────
  {
    const { window: w } = await loadApp({ dataScript: buildDataScript('Meller') });
    w.setRating('Meller', 'rp', 4);
    w.setSeen('Meller', 'ja');
    w.saveToStorage();

    const reloaded = await reloadWithState(w, ['rbf2027_v1'], { dataScript: buildDataScript('MELLER') });
    reloaded.window.render();
    const d = reloaded.document;
    const badge = d.getElementById('avg-mini-MELLER');
    t.check('Bewertung wird nach Umbenennung "Meller" -> "MELLER" automatisch übernommen.',
      badge && badge.getAttribute('title') === 'Ø 4.0', badge && badge.getAttribute('title'));

    reloaded.window.toggleExpand('MELLER'); // Detail aufklappen, um den Gesehen-Status zu sehen
    const jaBtn = [...d.querySelectorAll('.seen-btn')].find(b => b.textContent.includes('Gesehen'));
    t.check('Gesehen-Status wird ebenfalls übernommen.', !!jaBtn && jaBtn.classList.contains('active-ja'));
  }

  // ── Fall 2: mehrdeutiger Fall - zwei Künstler, die nach Lowercase
  // identisch wären, dürfen NICHT automatisch verknüpft werden (Sicherheits-
  // Bremse: nur bei eindeutigem Treffer wird übertragen). ──────────────────
  {
    const dataScriptAmbiguous = `
      const DATA_VERSION = 'test-ambiguous';
      const DAY_ORDER = ['Mi 15.09'];
      const RAW = [
        ['dj echo', 'Techno', 'Berlin, DE', 'männlich', 'https://example.org/a'],
        ['DJ Echo', 'House', 'Wien, AT', 'weiblich', 'https://example.org/b']
      ];
      const RAW_AUFTRITTE = []; const VENUE_LOCATIONS = {};
      const ANCHOR_AWARD_NOMINEES = []; const SOUND_REFERENCES = []; const RBF_EVENTS = [];
      let lastAutoFixes = []; let lastValidationIssues = [];
      function autoFixAuftritte() {} function validateAuftritte() {} function updateValidationPanel() {}
    `;
    const { window: w } = await loadApp({ dataScript: dataScriptAmbiguous });
    // Ein alter, verwaister Eintrag mit abweichender Schreibweise, die zu
    // BEIDEN aktuellen Künstlern passen würde.
    w.localStorage.setItem('rbf2027_v1', JSON.stringify({
      ratings: [{ n: 'DJ ECHO', rp: 5, rl: 0, s: '', manual: false }],
      auftritte: [], showRatings: {}, showDurations: {}, planFlags: {}, hiddenEvents: {}, settings: {}
    }));
    w.loadFromStorage();
    w.render();
    const d = w.document;
    const badge1 = d.getElementById('avg-mini-dj echo');
    const badge2 = d.getElementById('avg-mini-DJ Echo');
    const noneRated = (!badge1 || badge1.getAttribute('title') !== 'Ø 5.0') && (!badge2 || badge2.getAttribute('title') !== 'Ø 5.0');
    t.check('Bei mehrdeutigem Treffer (zwei Künstler unterscheiden sich nur durch Groß-/Kleinschreibung) wird NICHTS automatisch zugeordnet.',
      noneRated, { badge1: badge1 && badge1.getAttribute('title'), badge2: badge2 && badge2.getAttribute('title') });
  }

  // ── Fall 3: eine echte, komplett andere Umbenennung wird weiterhin NICHT
  // automatisch erkannt (das kann und soll die App nicht raten). ───────────
  {
    const { window: w } = await loadApp({ dataScript: buildDataScript('Meller') });
    w.setRating('Meller', 'rp', 3);
    w.saveToStorage();

    const reloaded = await reloadWithState(w, ['rbf2027_v1'], { dataScript: buildDataScript('Komplett Anderer Name') });
    reloaded.window.render();
    const d = reloaded.document;
    const badge = d.getElementById('avg-mini-Komplett Anderer Name');
    t.check('Eine völlig andere Umbenennung wird NICHT automatisch verknüpft (kann die App nicht wissen).',
      !badge || badge.getAttribute('title') !== 'Ø 3.0', badge && badge.getAttribute('title'));
  }

  t.finish();
})();

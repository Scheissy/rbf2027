const { loadApp, createChecker } = require('./test-helpers');

(async () => {
  const { window: w, document: d } = await loadApp();
  const t = createChecker();

  // "Heute" ist Do 16.09, 15 Uhr.
  w.getBerlinNow = () => ({ year: 2027, month: 9, day: 16, hour: 15, minute: 0 });
  w.currentTab = 'programm';
  d.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
  w.jumpToNow();

  // 1) Keine Endzeit gesetzt - offenes Zeitfenster nach oben.
  t.check('timeTo bleibt nach "Jetzt" leer (keine künstliche Obergrenze).', d.getElementById('timeTo').value === '');

  // 2) Kommende Tage bleiben aktiv, nicht nur "heute" - genau das erlaubt das
  // "beliebig weit in die Zukunft scrollen" ohne manuelles Nachjustieren.
  const active = [...d.querySelectorAll('.day-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.day);
  t.check('"Jetzt" aktiviert heute + alle kommenden Tage (nicht nur den heutigen Tag).',
    JSON.stringify(active) === JSON.stringify(['Do 16.09', 'Fr 17.09', 'Sa 18.09']), active);

  // 3) Praktischer Beweis: ein Auftritt am übernächsten Tag (Sa 18.09) ist
  // ohne jede weitere manuelle Filteränderung sichtbar.
  w.renderProg();
  const names = [...d.querySelectorAll('.prog-name')].map(el => el.textContent);
  t.check('Ein Auftritt am Samstag (zwei Tage später) ist direkt sichtbar, ohne den Filter manuell anzupassen.',
    names.some(n => n.includes('Funkeninsel') || n.includes('Lila Oktober') || n.includes('Nordlicht Prozession') || n.includes('DJ Mitternacht')), names);

  t.finish();
})();

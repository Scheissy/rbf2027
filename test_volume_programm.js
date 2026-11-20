const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadApp, createChecker } = require('./test-helpers');

// Programm-Übersicht mit dem großen synthetischen Datensatz (560 Auftritte + 12 Events = 572 Zeilen):
// vollständige, chronologische Ausgabe (inkl. Auftritte nach Mitternacht), Tages-, Location- und Zeitfilter
// gegen eine unabhängige Berechnung, exakte Location-Namen (Präfix-Paare, Sonderzeichen), lazy Detailansicht,
// Terminliste eines Dreifach-Künstlers, einfache Zeitgrenzen.
const FILE = path.join(__dirname, 'rbf-data.volume.test.js');
const LIMIT_RENDER_MS = 8000, LIMIT_TOTAL_MS = 60000;
const DAYS = ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'];

(async () => {
  const t = createChecker();
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FILE, 'utf-8') + ';this.D = { RAW, RAW_AUFTRITTE, RBF_EVENTS };', ctx);
  const GENRES_OF = new Map(Array.from(ctx.D.RAW).map(r => [r[0], r[1].split(' / ')]));
  const SHOWS = Array.from(ctx.D.RAW_AUFTRITTE).map(r => ({ name: r[0], day: r[1], time: r[2], end: r[3], loc: r[4], nid: r[5] }));
  const EVENTS = Array.from(ctx.D.RBF_EVENTS).map(e => ({ name: e.name, day: e.day, time: e.time, end: e.endTime, loc: e.location }));
  const ALL = [...SHOWS, ...EVENTS];
  const tsv = s => { const [h, m] = s.split(':').map(Number); return (h < 5 ? h + 24 : h) * 60 + m; };   // 00:00-04:59 zählt als nach Mitternacht

  const { window: w, document: d, errors } = await loadApp({ dataPath: FILE, trackErrors: true });
  const ev = c => w.eval(c);
  const arr = x => Array.from(x);
  let totalMs = 0, maxMs = 0;
  const setup = ({ days = DAYS, from = '08:00', to = '' } = {}) => {
    w.switchTab('programm'); w.resetProgFilters();
    d.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', days.includes(b.dataset.day)));
    d.getElementById('timeFrom').value = from; d.getElementById('timeTo').value = to;
  };
  const renderP = () => { const t0 = Date.now(); w.renderProg(); const ms = Date.now() - t0; totalMs += ms; maxMs = Math.max(maxMs, ms); };
  // Zeilen mit Tag (vom Tages-Header), Start, Ende, Location, skey
  const rows = () => {
    const out = []; let day = null;
    arr(d.querySelectorAll('#progList > *')).forEach(el => {
      if (el.classList.contains('prog-day-header')) day = el.textContent.trim().slice(0, 8);
      else if (el.classList.contains('prog-item')) {
        const tv = el.querySelector('.prog-time-val').textContent.replace(/\s+/g, '');
        const [s, e] = tv.split('–');
        const locEl = el.querySelector('.prog-loc a') || el.querySelector('.prog-loc');
        out.push({ day, start: s, end: e, loc: locEl ? locEl.textContent.replace('📍', '').trim() : '', skey: el.dataset.skey, name: el.querySelector('.prog-name').textContent.replace(/\s+/g, ' ').trim() });
      }
    });
    return out;
  };
  const count = (list, f) => list.filter(f).length;

  // ───────── 1) Vollständige, chronologische Ausgabe ─────────
  setup(); renderP();
  const R = rows();
  t.check('Alle 560 Auftritte und 12 Events stehen als Zeilen in der Liste (572), unter vier Tages-Überschriften.', R.length === 572 && d.querySelectorAll('#progList .prog-day-header').length === 4, [R.length, d.querySelectorAll('#progList .prog-day-header').length]);
  t.check('Zeilen je Tag stimmen mit den Rohdaten überein (Mi 110+, Do 170+, Fr 170+, Sa 110+ Events).', DAYS.every(day => count(R, r => r.day === day) === count(ALL, x => x.day === day)), DAYS.map(day => [day, count(R, r => r.day === day), count(ALL, x => x.day === day)]));
  const dayIdx = day => DAYS.indexOf(day);
  let orderBad = -1;
  R.forEach((r, i) => { if (i && orderBad < 0 && (dayIdx(r.day) < dayIdx(R[i - 1].day) || (r.day === R[i - 1].day && tsv(r.start) < tsv(R[i - 1].start)))) orderBad = i; });
  t.check('Reihenfolge: Tag, dann Startzeit (Auftritte nach Mitternacht stehen am Ende ihres Tages).', orderBad < 0, orderBad);
  const lateRows = R.filter(r => /^0[0-4]:/.test(r.start));
  t.check(`Auftritte zwischen 00:00 und 04:59 (${lateRows.length}) stehen jeweils hinter allen Auftritten des Abends am selben Tag.`, lateRows.length >= 8 && lateRows.every(r => { const same = R.filter(x => x.day === r.day); return same.indexOf(r) > same.findIndex(x => /^2[0-3]:/.test(x.start)); }), lateRows.length);
  const byKey = new Map(SHOWS.map(s => [`nid:${s.nid}`, s]));
  let timeBad = [];
  R.forEach(r => { const s = byKey.get(r.skey); if (s && (r.start !== s.time || r.end !== s.end || r.loc !== s.loc || r.day !== s.day)) timeBad.push([r.skey, r.start, r.end, r.loc, s.time, s.end, s.loc]); });
  t.check('Jede Auftritts-Zeile zeigt Tag, Start, Ende und Location exakt wie in den Rohdaten (auch über Mitternacht, Venue-Namen mit Sonderzeichen).', timeBad.length === 0 && count(R, r => byKey.has(r.skey)) === 560, timeBad.slice(0, 3));

  // ───────── 2) Tagesfilter ─────────
  const dayCounts = DAYS.map(day => { setup({ days: [day] }); renderP(); const rr = rows(); return [day, rr.length, count(ALL, x => x.day === day), rr.every(r => r.day === day)]; });
  t.check('Einzelne Tage: jeder Tag zeigt genau seine Zeilen.', dayCounts.every(x => x[1] === x[2] && x[3]), dayCounts);
  setup({ days: ['Do 16.09', 'Fr 17.09'] }); renderP();
  t.check('Zwei Tage (Do + Fr): 340 Auftritte plus deren Events.', rows().length === count(ALL, x => x.day === 'Do 16.09' || x.day === 'Fr 17.09'), rows().length);

  // ───────── 3) Location-Filter ─────────
  const perVenue = new Map(); ALL.forEach(x => perVenue.set(x.loc, (perVenue.get(x.loc) || 0) + 1));
  const showCount = new Map(); SHOWS.forEach(x => showCount.set(x.loc, (showCount.get(x.loc) || 0) + 1));
  const venues = [...showCount.keys()].sort((a, b) => showCount.get(b) - showCount.get(a));   // nach Auftritten, ohne Events
  const biggest = venues[0], smallest = venues[venues.length - 1];
  const locCheck = loc => { setup(); w.toggleLocSelection(loc); renderP(); const rr = rows(); w.resetProgFilters(); return [loc, rr.length, perVenue.get(loc), rr.every(r => r.loc === loc)]; };
  const locResults = [biggest, smallest, 'Elbwerft', 'Elbwerft Bar', 'Kiezkeller', 'Kiezkeller/Hof', 'Mole', 'Mole Terrasse', "Rock'n'Roll Garage", 'Bühne am Kai®', 'Jazz@Sternwarte (Saal 2)'].map(locCheck);
  t.check('Location-Filter: größte, kleinste Venue und Venues mit Sonderzeichen liefern genau ihre Zeilen (Anzahl und Name).', locResults.every(r => r[1] === r[2] && r[3] && r[2] > 0), locResults.filter(r => !(r[1] === r[2] && r[3])));
  t.check('Präfix-Paare bleiben getrennt ("Elbwerft" vs. "Elbwerft Bar", "Kiezkeller" vs. "Kiezkeller/Hof", "Mole" vs. "Mole Terrasse"): keine Vermischung der Zahlen.', locResults[2][1] !== locResults[3][1] && locResults[4][1] !== locResults[5][1] && locResults[6][1] !== locResults[7][1] && locResults[2][1] + locResults[3][1] === count(ALL, x => x.loc === 'Elbwerft' || x.loc === 'Elbwerft Bar'), locResults.slice(2, 8).map(r => r[0] + ':' + r[1]));
  t.check(`Schiefe Verteilung: die größte Venue (${biggest}) hat 35 bis 40 Auftritte, die kleinste (${smallest}) genau 2.`, showCount.get(biggest) >= 35 && showCount.get(biggest) <= 40 && showCount.get(smallest) === 2, [showCount.get(biggest), showCount.get(smallest)]);

  // ───────── 4) Zeitfilter und Kombination ─────────
  const timeCase = (from, to, days) => { setup({ from, to, days }); renderP(); const rr = rows(); const exp = ALL.filter(x => days.includes(x.day) && tsv(x.time) >= tsv(from) && (!to || tsv(x.time) <= tsv(to))); return [from + '-' + to, rr.length, exp.length]; };
  const tc = [timeCase('22:00', '', DAYS), timeCase('08:00', '18:00', DAYS), timeCase('20:00', '23:30', ['Fr 17.09']), timeCase('00:00', '', DAYS), timeCase('23:00', '', ['Sa 18.09'])];
  t.check('Zeitfilter (ab 22:00, 08-18 Uhr, Fr 20:00-23:30, ab 00:00 = nur nach Mitternacht, Sa ab 23:00) zeigt genau die Zeilen, deren Start im Bereich liegt.', tc.every(x => x[1] === x[2]) && tc[3][1] > 0 && tc[3][1] < 40, tc);
  setup({ days: ['Fr 17.09'], from: '20:00' }); w.toggleLocSelection(biggest); renderP();
  t.check('Tag + Zeit + Location zusammen verknüpfen mit UND.', rows().length === count(ALL, x => x.day === 'Fr 17.09' && tsv(x.time) >= tsv('20:00') && x.loc === biggest), rows().length);
  w.resetProgFilters();

  // ───────── 4b) Genre-Filter im Programm ─────────
  const genreCase = (...gs) => { setup(); gs.forEach(g => w.toggleProgGenreSelection(g)); renderP(); const rr = rows(); const exp = SHOWS.filter(s => GENRES_OF.get(s.name).some(g => gs.includes(g))); w.resetProgFilters(); return [gs.join('+'), rr.length, exp.length]; };
  const gc = [genreCase('Hip-Hop/Rap'), genreCase('Indie'), genreCase('Indie', 'Pop'), genreCase('Electronic/Live', 'Electronic/DJ', 'Jazz')];
  t.check('Genre-Filter im Programm (ein Genre und mehrere gemeinsam): zeigt die Auftritte aller Künstler mit mindestens einem der Genres, Events fallen weg.', gc.every(x => x[1] === x[2] && x[2] > 0), gc);

  // ───────── 5) Detailansicht, Terminliste ─────────
  setup(); renderP();
  const detailContainers = arr(d.querySelectorAll('[id$="-detail"]'));
  t.check('Detailansichten werden erst beim Aufklappen gebaut: bei 572 Zeilen ist keine einzige gefüllt.', detailContainers.length === 572 && detailContainers.every(x => x.innerHTML.trim() === ''), detailContainers.filter(x => x.innerHTML.trim() !== '').length);
  const perArtist = new Map(); SHOWS.forEach(s => { if (!perArtist.has(s.name)) perArtist.set(s.name, []); perArtist.get(s.name).push(s); });
  const triple = [...perArtist.values()].find(l => l.length === 3);
  const tripleRow = arr(d.querySelectorAll('#progList .prog-item')).find(el => el.dataset.skey === `nid:${triple[0].nid}`);
  const rid = tripleRow.getAttribute('onclick').match(/toggleProgRating\('([^']+)'\)/)[1];
  w.toggleProgRating(rid);
  const filled = arr(d.querySelectorAll('[id$="-detail"]')).filter(x => x.innerHTML.trim() !== '');
  t.check('Aufklappen baut genau die eine Detailansicht.', filled.length === 1 && filled[0].id === `${rid}-detail`, filled.map(x => x.id));
  const terms = d.getElementById(`${rid}-terms`);
  t.check('Künstler mit drei Auftritten: Terminliste "Kommende Termine (2)" (die beiden anderen Termine, nicht der eigene).', !!terms && terms.querySelector('.prog-terms-head span').textContent === 'Kommende Termine (2)' && terms.querySelectorAll('.prog-term').length === 2, terms && terms.querySelector('.prog-terms-head').textContent);
  w.toggleProgRating(rid);
  const sameDay = [...perArtist.values()].find(l => l.length === 2 && l[0].day === l[1].day);
  const dayRows = arr(d.querySelectorAll('#progList .prog-item')).filter(el => el.dataset.skey === `nid:${sameDay[0].nid}` || el.dataset.skey === `nid:${sameDay[1].nid}`);
  t.check('Doppelauftritt am selben Tag: beide Zeilen stehen unter demselben Tag, in chronologischer Reihenfolge.', dayRows.length === 2 && dayRows[0].compareDocumentPosition(dayRows[1]) & 4, sameDay.map(s => s.day + ' ' + s.time));

  // ───────── 6) Zeit und Fehler ─────────
  t.check(`Zeitgrenze: kein einzelner Render über ${LIMIT_RENDER_MS / 1000} s (größter: ${maxMs} ms), alle zusammen unter ${LIMIT_TOTAL_MS / 1000} s (${totalMs} ms).`, maxMs < LIMIT_RENDER_MS && totalMs < LIMIT_TOTAL_MS, { maxMs, totalMs });
  t.check('Keine JS-Fehler während des gesamten Ablaufs.', errors.length === 0, errors);
  t.finish();
})();

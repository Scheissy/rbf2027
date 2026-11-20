const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadApp, createChecker } = require('./test-helpers');

// Der große synthetische Datensatz (rbf-data.volume.test.js, erzeugt von build-volume-data.js):
// 1) deterministisch und eingecheckt = Ergebnis des Generators, 2) das Profil entspricht den echten
// Verteilungen (Umfang, Genres, Herkunft, Auftritte je Künstler, Zeiten, Venues, Namen), 3) die App lädt ihn ohne
// Fehler und die Validierung findet nur den einen beabsichtigten Hinweis, 4) keine echten Daten.
const FILE = path.join(__dirname, 'rbf-data.volume.test.js');

(async () => {
  const t = createChecker();
  const src = fs.readFileSync(FILE, 'utf-8');

  // ───────── 1) Determinismus ─────────
  const gen = require('./build-volume-data.js');
  t.check('Die eingecheckte Datei ist exakt das Ergebnis des Generators (fester Seed).', gen.build() === src);
  t.check('Zweiter Lauf des Generators liefert dasselbe (deterministisch).', gen.build() === gen.build());

  // Daten ohne App auswerten
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src + ';this.D = { DATA_VERSION, DAY_ORDER, RAW, RAW_AUFTRITTE, VENUE_LOCATIONS, ANCHOR_AWARD_NOMINEES, SOUND_REFERENCES, RBF_EVENTS };', ctx);
  const D = ctx.D;
  const RAW = Array.from(D.RAW).map(r => Array.from(r)), A = Array.from(D.RAW_AUFTRITTE).map(r => Array.from(r));
  const VENUES = D.VENUE_LOCATIONS, EVENTS = Array.from(D.RBF_EVENTS), REFS = Array.from(D.SOUND_REFERENCES);
  const taxonomy = ['Indie', 'Pop', 'Alternative', 'Rock', 'Hip-Hop/Rap', 'Electronic/Live', 'Punk', 'Singer-Songwriter', 'Folk', "R'n'B/Soul", 'Heavy Metal', 'Electronic/DJ', 'Funk', 'Jazz', 'Global', 'Country'];
  const count = (arr, f) => { const m = new Map(); arr.forEach(x => { const k = f(x); m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const mm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tagSplit = v => v.split(' / ');

  // ───────── 2) Umfang ─────────
  t.check('Umfang: 400 Künstler, 560 Auftritte, 45 Venues, 12 Events, 6 Anchor-Nominierte, 35 Sound-Referenzen.', RAW.length === 400 && A.length === 560 && Object.keys(VENUES).length === 45 && EVENTS.length === 12 && D.ANCHOR_AWARD_NOMINEES.length === 6 && REFS.length === 35, [RAW.length, A.length, Object.keys(VENUES).length, EVENTS.length, REFS.length]);
  const perDay = count(A, a => a[1]);
  t.check('Auftritte je Tag: Mi 110, Do 170, Fr 170, Sa 110.', ['Mi 15.09', 'Do 16.09', 'Fr 17.09', 'Sa 18.09'].map(d => perDay.get(d)).join() === '110,170,170,110', [...perDay]);
  t.check('Künstlernamen sind eindeutig (exakt); nid fünfstellig, aufsteigend, nicht lückenlos.', new Set(RAW.map(r => r[0])).size === 400 && A.every(a => a[5] >= 10000 && a[5] <= 99999) && A.every((a, i) => i === 0 || a[5] > A[i - 1][5]) && A[A.length - 1][5] - A[0][5] > A.length);

  // ───────── 3) Genres ─────────
  const tagCount = new Map(); RAW.forEach(r => tagSplit(r[1]).forEach(g => tagCount.set(g, (tagCount.get(g) || 0) + 1)));
  t.check('Alle 16 Genres der echten Taxonomie kommen vor, keine anderen.', taxonomy.every(g => tagCount.has(g)) && [...tagCount.keys()].every(g => taxonomy.includes(g)), [...tagCount.keys()]);
  const ranked = [...tagCount].sort((a, b) => b[1] - a[1]);
  const totalTags = [...tagCount.values()].reduce((a, b) => a + b, 0);
  t.check('Schiefe Verteilung: Indie und Pop sind die häufigsten und machen zusammen über 35 % der Genre-Zuordnungen aus; seltenste Genres unter 5 Künstlern.', ['Indie', 'Pop'].includes(ranked[0][0]) && ['Indie', 'Pop'].includes(ranked[1][0]) && (ranked[0][1] + ranked[1][1]) / totalTags > 0.35 && ranked[ranked.length - 1][1] < 5, ranked);
  const perArtistGenres = count(RAW, r => tagSplit(r[1]).length);
  t.check('Genres je Künstler: ca. 45 % einzeln, ca. 54 % doppelt, genau ein Künstler mit drei.', perArtistGenres.get(1) / 400 > 0.40 && perArtistGenres.get(1) / 400 < 0.52 && perArtistGenres.get(2) / 400 > 0.48 && perArtistGenres.get(2) / 400 < 0.60 && perArtistGenres.get(3) === 1 && !perArtistGenres.has(4), [...perArtistGenres]);
  t.check('Schrägstrich-Genres (Hip-Hop/Rap, Electronic/Live, Electronic/DJ, R\'n\'B/Soul) kommen vor, auch mit Mehrfach-Genre dahinter.', ['Hip-Hop/Rap', 'Electronic/Live', 'Electronic/DJ', "R'n'B/Soul"].every(g => tagCount.has(g)) && RAW.some(r => /\/[^ ]+ \/ /.test(r[1]) || /^[^ ]+ \/ [^ ]+\/[^ ]+$/.test(r[1])));

  // ───────── 4) Herkunft, Geschlecht ─────────
  const countries = new Set(); RAW.forEach(r => tagSplit(r[2]).forEach(c => countries.add(c)));
  const multi = RAW.filter(r => r[2].includes(' / ')).length;
  t.check('Herkunft: 51 verschiedene Länder, nur Ländernamen (kein "Stadt, Land"), Deutschland dominiert.', countries.size === 51 && RAW.every(r => !r[2].includes(',')) && count(RAW.flatMap(r => tagSplit(r[2])), x => x).get('Deutschland') > 80, countries.size);
  t.check('Mehrere Länder ("A / B") bei 7 bis 11 % der Künstler, höchstens 4 Länder.', multi / 400 >= 0.07 && multi / 400 <= 0.11 && RAW.every(r => tagSplit(r[2]).length <= 4), multi);
  const gender = count(RAW, r => r[3]);
  t.check('Geschlecht: männlich/weiblich/mixed je über 25 %, divers höchstens 3.', ['männlich', 'weiblich', 'mixed'].every(g => gender.get(g) / 400 > 0.25) && (gender.get('divers') || 0) <= 3 && (gender.get('divers') || 0) >= 1, [...gender]);

  // ───────── 5) Auftritte je Künstler ─────────
  const perArtist = count(A, a => a[0]);
  const showsDist = count([...perArtist.values()], x => x);
  t.check('Jeder Künstler hat mindestens einen Auftritt, höchstens 3 (260× einmal, 120× zweimal, 20× dreimal).', perArtist.size === 400 && RAW.every(r => perArtist.has(r[0])) && showsDist.get(1) === 260 && showsDist.get(2) === 120 && showsDist.get(3) === 20, [...showsDist]);
  const sameDay = [...count(A, a => a[0] + '|' + a[1])].filter(([, v]) => v > 1).length;
  const daysPerArtist = new Map(); A.forEach(a => { if (!daysPerArtist.has(a[0])) daysPerArtist.set(a[0], new Set()); daysPerArtist.get(a[0]).add(a[1]); });
  const multiDay = [...daysPerArtist.values()].filter(s => s.size > 1).length;
  t.check('Doppelauftritte am selben Tag (70) und Künstler an mehreren Tagen (70, ca. 18 %).', sameDay === 70 && multiDay === 70, { sameDay, multiDay });
  // gleicher Künstler, selber Tag: kein Überlappen und mindestens 70 Min. Abstand der Startzeiten
  const srt = m => (m < 360 ? m + 1440 : m);
  let overlapProblems = 0;
  const byAD = new Map(); A.forEach(a => { const k = a[0] + '|' + a[1]; if (!byAD.has(k)) byAD.set(k, []); byAD.get(k).push(a); });
  byAD.forEach(list => { if (list.length > 1) { list.sort((x, y) => srt(mm(x[2])) - srt(mm(y[2]))); for (let i = 0; i < list.length - 1; i++) if (srt(mm(list[i + 1][2])) - srt(mm(list[i][2])) < 70) overlapProblems++; } });
  t.check('Doppelauftritte am selben Tag liegen mindestens 70 Minuten auseinander (Start zu Start).', overlapProblems === 0, overlapProblems);

  // ───────── 6) Venues ─────────
  const perVenue = count(A, a => a[4]);
  const vc = [...perVenue.values()].sort((a, b) => b - a);
  t.check('Venues: alle 45 bespielt, größte 35 bis 40 Auftritte, kleinste 2, Summe 560.', perVenue.size === 45 && Object.keys(VENUES).every(v => perVenue.has(v)) && vc[0] >= 35 && vc[0] <= 40 && vc[vc.length - 1] === 2 && vc.reduce((a, b) => a + b, 0) === 560, vc);
  t.check('Schiefe Verteilung: mindestens 10 Venues mit 20+ Auftritten, Median unter 15, mindestens 5 Venues mit höchstens 3.', vc.filter(x => x >= 20).length >= 10 && vc[22] < 15 && vc.filter(x => x <= 3).length >= 5, vc);
  t.check('Alle Venues haben Koordinaten und Adresse.', Object.values(VENUES).every(v => typeof v.lat === 'number' && typeof v.lng === 'number' && v.address && v.address.endsWith('Hamburg')));
  const vnames = Object.keys(VENUES);
  const prefixPairs = vnames.filter(a => vnames.some(b => b !== a && b.startsWith(a)));
  t.check('Venue-Namen: mindestens 3 sind Präfix eines anderen (z. B. "Elbwerft" / "Elbwerft Bar"), eine mobile Venue ("Festivalbus ...").', prefixPairs.length >= 3 && vnames.some(v => v.startsWith('Festivalbus')), prefixPairs);
  t.check('Venue-Namen mit Sonderzeichen ® @ ( ) / . é ü ä & \' vorhanden, längster Name 40 bis 42 Zeichen.', ['®', '@', '(', ')', '/', '.', 'é', 'ü', 'ä', '&', "'"].every(c => vnames.some(v => v.includes(c))) && Math.max(...vnames.map(v => v.length)) >= 40 && Math.max(...vnames.map(v => v.length)) <= 42, Math.max(...vnames.map(v => v.length)));
  // kein Venue ist doppelt belegt
  let venueClash = 0;
  const byVD = new Map(); A.forEach(a => { const k = a[4] + '|' + a[1]; if (!byVD.has(k)) byVD.set(k, []); byVD.get(k).push(a); });
  byVD.forEach(list => { const iv = list.map(a => [srt(mm(a[2])), srt(mm(a[2])) + ((mm(a[3]) - mm(a[2]) + 1440) % 1440)]).sort((x, y) => x[0] - y[0]); for (let i = 0; i < iv.length - 1; i++) if (iv[i + 1][0] < iv[i][1]) venueClash++; });
  t.check('Keine Venue ist am selben Tag doppelt belegt (keine überlappenden Auftritte).', venueClash === 0, venueClash);

  // ───────── 7) Zeiten ─────────
  const dur = A.map(a => (mm(a[3]) - mm(a[2]) + 1440) % 1440).sort((x, y) => x - y);
  t.check('Dauer: ab 15 Minuten, Median 30, genau ein Auftritt über 120 Minuten (4 Stunden).', dur[0] === 15 && dur[280] === 30 && dur.filter(x => x > 120).length === 1 && dur[dur.length - 1] === 240, [dur[0], dur[280], dur[dur.length - 1]]);
  const afterMidnightStart = A.filter(a => mm(a[2]) < 360).length;
  const endAfterMidnight = A.filter(a => mm(a[3]) < mm(a[2]) || mm(a[2]) < 360).length;
  t.check('Nach Mitternacht: 8 bis 20 Starts zwischen 00:00 und 05:59, 8 bis 12 % der Auftritte enden nach Mitternacht.', afterMidnightStart >= 8 && afterMidnightStart <= 20 && endAfterMidnight / 560 >= 0.08 && endAfterMidnight / 560 <= 0.12, { afterMidnightStart, endAfterMidnight });
  t.check('Startzeiten nicht nur volle/halbe Stunden: mindestens 8 verschiedene Minutenwerte.', new Set(A.map(a => a[2].slice(3))).size >= 8, [...new Set(A.map(a => a[2].slice(3)))]);
  const sameStart = Math.max(...count(A, a => a[1] + a[2]).values());
  t.check('Gleichzeitigkeit: bis zu 6 bis 12 Auftritte mit identischer Startzeit am selben Tag.', sameStart >= 6 && sameStart <= 12, sameStart);
  t.check('Alle Auftritte haben Zeit, Ende und Location (kein TBA) und eine bekannte Venue.', A.every(a => /^\d\d:\d\d$/.test(a[2]) && /^\d\d:\d\d$/.test(a[3]) && VENUES[a[4]]));

  // ───────── 8) Namen ─────────
  const names = RAW.map(r => r[0]);
  const upper = names.filter(n => n === n.toUpperCase() && n !== n.toLowerCase()).length;
  const lower = names.filter(n => n === n.toLowerCase() && n !== n.toUpperCase()).length;
  t.check('Namen: länger als 1 und höchstens 44 Zeichen; viele komplett GROSS (30+) und komplett klein (20+).', Math.min(...names.map(n => n.length)) === 2 && Math.max(...names.map(n => n.length)) === 44 && upper >= 30 && lower >= 20, { upper, lower });
  const has = f => names.some(f);
  t.check('Sonderzeichen-Namen vorhanden: Ziffer am Anfang, Ziffern, Punkte, &, Klammern, Apostroph, !, ?, ·, Σ, :, /.', has(n => /^\d/.test(n)) && has(n => /\d/.test(n.slice(1))) && has(n => /\./.test(n)) && has(n => n.includes(' & ')) && has(n => n.includes('(')) && has(n => n.includes("'")) && has(n => n.includes('!')) && has(n => n.includes('?')) && has(n => n.includes('·')) && has(n => n.includes('Σ')) && has(n => n.includes(':')) && has(n => n.includes('/')));
  t.check('Präfixe The / DJ / MC, mindestens 15 Namen mit 4+ Wörtern, Akzente/Umlaute (mindestens 20 Namen).', has(n => n.startsWith('The ')) && has(n => n.startsWith('DJ ')) && has(n => n.startsWith('MC ')) && names.filter(n => n.split(/\s+/).length >= 4).length >= 15 && names.filter(n => /[^\x00-\x7f]/.test(n)).length >= 20, names.filter(n => n.split(/\s+/).length >= 4).length);
  const groups = new Map(); names.forEach(n => { const k = norm(n); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); });
  const variants = [...groups.values()].filter(g => g.length > 1);
  t.check('Namensvarianten, die sich nur in Groß-/Kleinschreibung oder Akzent unterscheiden: mindestens 3 Paare.', variants.length >= 3 && variants.every(g => g.length === 2), variants);

  // ───────── 9) Events, Referenzen ─────────
  const known = new Set(names);
  t.check('Events: 11× "Sonstiges" ohne Künstler, 1× "Musik" mit 6 Künstlern (alle in der Künstlerliste), alle mit URL.', EVENTS.filter(e => e.kategorie === 'Sonstiges' && e.acts.length === 0).length === 11 && EVENTS.filter(e => e.kategorie === 'Musik').length === 1 && EVENTS.find(e => e.kategorie === 'Musik').acts.length === 6 && EVENTS.find(e => e.kategorie === 'Musik').acts.every(n => known.has(n)) && EVENTS.every(e => e.url && e.url.startsWith('https://example.org/')), EVENTS.map(e => e.kategorie));
  t.check('Anchor-Nominierte stehen alle in der Künstlerliste.', D.ANCHOR_AWARD_NOMINEES.every(n => known.has(n)));
  const refActs = REFS.flatMap(r => Array.from(r.acts));
  const refCounts = count(refActs, x => x);
  t.check('Sound-Referenzen: 35 Einträge, 71 verschiedene Acts (alle in der Künstlerliste), 17 mit nur einem Act, höchstens 7 je Eintrag, genau ein Act in zwei Einträgen, eine Referenz je Eintrag.', REFS.length === 35 && new Set(refActs).size === 71 && refActs.every(n => known.has(n)) && REFS.filter(r => r.acts.length === 1).length === 17 && Math.max(...REFS.map(r => r.acts.length)) <= 7 && [...refCounts.values()].filter(v => v > 1).length === 1 && REFS.every(r => r.referenz.length === 1), { distinct: new Set(refActs).size, single: REFS.filter(r => r.acts.length === 1).length });

  // ───────── 10) Keine echten Daten ─────────
  const urls = [...RAW.flatMap(r => r.slice(4)), ...EVENTS.map(e => e.url)];
  t.check('Keine echten URLs: alles auf example.org (Discogs-Links nur als Platzhalter-Muster mit erfundener ID).', urls.every(u => u.startsWith('https://example.org/') || /^https:\/\/www\.discogs\.com\/artist\/1\d{5}-[a-z0-9-]+$/.test(u)), urls.filter(u => !u.startsWith('https://example.org/')));
  t.check('Datei kennzeichnet sich als synthetisch und generiert.', /SYNTHETISCHER GROSS-DATENSATZ/.test(src) && /GENERIERT von build-volume-data\.js/.test(src) && D.DATA_VERSION === 'volume-1');

  // ───────── 11) Verhalten in der App ─────────
  const t0 = Date.now();
  const { window: w, errors } = await loadApp({ dataPath: FILE, trackErrors: true });
  const loadMs = Date.now() - t0;
  t.check('Die App lädt den Datensatz ohne JS-Fehler (400 Künstler, 560 Auftritte) in unter 20 s.', errors.length === 0 && w.eval('Object.keys(dataMap).length') === 400 && w.eval('auftritte.length') === 560 && loadMs < 20000, { errors, loadMs });
  const issues = Array.from(w.eval('lastValidationIssues'));
  t.check('Validierung: nur der beabsichtigte 4-Stunden-Auftritt fällt auf, kein Auto-Fix nötig (Daten sind sauber).', issues.length === 1 && issues[0].includes('(4h)') && w.eval('lastAutoFixes.length') === 0, issues);
  t.check('Die App zerlegt die Genres richtig: genau die 16 Taxonomie-Werte als Filter-Tags (keine Bruchstücke), 51 Länder als Herkunfts-Tags.', JSON.stringify(Array.from(w.eval('allGenreTags')).sort()) === JSON.stringify([...taxonomy].sort()) && w.eval("new Set(Object.values(dataMap).flatMap(x => splitTags(x.herkunft))).size") === 51);

  t.finish();
})();

// ── js/15-export.js ── CSV-Export ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('15-export');

// ── EXPORTS ───────────────────────────────────────────────────────────────────
function csvQ(v) { return `"${String(v).replace(/"/g, '""')}"`; }
function download(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
function exportKuenstlerCSV() {
  const header = ['Künstler','Genre','Herkunft','Geschlecht','Rating Promo (1-5)','Rating Listening (1-5)','Gesehen','RBF-Link','Link individuell'];
  const rows = Object.values(dataMap).map(d => [d.name,d.genre,d.herkunft,d.geschlecht,d.rp||'',d.rl||'',d.gesehen,d.rbfUrl,d.customUrl?'ja':''].map(csvQ).join(','));
  download([header.join(','), ...rows].join('\n'), 'RBF2027_Kuenstler.csv');
  toast('Künstler-CSV exportiert ✓');
}
function exportAuftritteCSV() {
  if (!auftritte.length) { toast('Keine Auftrittsdaten vorhanden.', false); return; }
  const header = ['Künstler','Tag','Zeit','Ende','Location'];
  const rows = auftritte.map(a => [a.name,a.day,a.time,a.endTime||'',a.location].map(csvQ).join(','));
  download([header.join(','), ...rows].join('\n'), 'RBF2027_Auftritte.csv');
  toast('Auftritte-CSV exportiert ✓');
}
function exportKombiniertCSV() {
  const h1 = ['Künstler','Genre','Herkunft','Geschlecht','Rating Promo (1-5)','Rating Listening (1-5)','Gesehen','RBF-Link','Link individuell'];
  const r1 = Object.values(dataMap).map(d => [d.name,d.genre,d.herkunft,d.geschlecht,d.rp||'',d.rl||'',d.gesehen,d.rbfUrl,d.customUrl?'ja':''].map(csvQ).join(','));
  const h2 = ['Künstler','Tag','Zeit','Ende','Location'];
  const r2 = auftritte.map(a => [a.name,a.day,a.time,a.endTime||'',a.location].map(csvQ).join(','));
  const csv = ['### RBF2027 – Künstler ###', h1.join(','), ...r1, '', '### RBF2027 – Auftritte ###', h2.join(','), ...(r2.length ? r2 : ['(keine Auftrittsdaten)'])].join('\n');
  download(csv, 'RBF2027_Komplett.csv');
  toast('Kombinierte CSV exportiert ✓');
}


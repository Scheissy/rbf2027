// ── js/13-install.js ── App installieren (Anleitung) ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.RBF_PARTS = window.RBF_PARTS || []).push('13-install');

// ── APP INSTALLIEREN (Settings) ──────────────────────────────────────────────
// Kurzanleitung, wie man die PWA auf dem Startbildschirm installiert - je
// nach Browser völlig unterschiedliche Schritte, daher als Tabs statt als
// eine lange Textwand: es wird immer nur die Anleitung für den gerade
// gewählten Browser angezeigt, nicht alle gleichzeitig.
const INSTALL_GUIDES = {
  android: {
    label: 'Chrome (Android)',
    steps: [
      'Menü (⋮) oben rechts antippen',
      '„App installieren" bzw. „Zum Startbildschirm hinzufügen" wählen',
      'Installation bestätigen'
    ]
  },
  samsung: {
    label: 'Samsung Internet',
    steps: [
      'Menü antippen (☰, meist unten in der Leiste)',
      '„Seite hinzufügen zu" wählen',
      '„Startbildschirm" auswählen und bestätigen'
    ]
  },
  ios: {
    label: 'Safari (iPhone/iPad)',
    steps: [
      'Teilen-Symbol (Quadrat mit Pfeil nach oben) unten in der Leiste antippen',
      'Nach unten scrollen und „Zum Home-Bildschirm" wählen',
      '„Hinzufügen" oben rechts bestätigen'
    ]
  },
  desktop: {
    label: 'Desktop (Chrome/Edge)',
    steps: [
      'Install-Symbol in der Adressleiste anklicken (⊕ bzw. kleines Bildschirm-Icon) - falls nicht sichtbar: Menü (⋮) → „App installieren"',
      'Installation im Dialog bestätigen'
    ]
  }
};
let currentInstallTab = 'android';
function renderInstallGuide() {
  const tabsEl = document.getElementById('installTabs');
  const bodyEl = document.getElementById('installModalBody');
  if (!tabsEl || !bodyEl) return;
  tabsEl.innerHTML = Object.keys(INSTALL_GUIDES).map(key =>
    `<button type="button" class="install-tab${key === currentInstallTab ? ' active' : ''}" onclick="switchInstallTab('${key}')">${INSTALL_GUIDES[key].label}</button>`
  ).join('');
  const guide = INSTALL_GUIDES[currentInstallTab];
  bodyEl.innerHTML = `<div class="install-steps">${guide.steps.map((s, i) =>
    `<div class="install-step"><div class="install-step-num">${i + 1}</div><div class="install-step-text">${s}</div></div>`
  ).join('')}</div>`;
}
function switchInstallTab(key) {
  currentInstallTab = key;
  renderInstallGuide();
}
// Grobe Einschätzung, welcher Browser gerade läuft, um beim Öffnen direkt den
// passenden Tab vorauszuwählen - reine Komfortfunktion, alle Tabs bleiben
// jederzeit manuell erreichbar, falls die Erkennung mal danebenliegt.
function guessInstallPlatform() {
  const ua = navigator.userAgent || '';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
function openInstallModal() {
  currentInstallTab = guessInstallPlatform();
  renderInstallGuide();
  document.getElementById('installModal').classList.add('open');
}
function closeInstallModal() {
  document.getElementById('installModal').classList.remove('open');
}
function handleInstallBackdropClick(e) {
  if (e.target.id === 'installModal') closeInstallModal();
}


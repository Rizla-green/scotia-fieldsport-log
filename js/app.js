// Scotia Fieldsport Log — main app controller v1.0.0

const AppUI = (() => {
  let allPins        = [];
  let allBoundaries  = [];
  let allGates       = [];
  let activeTab      = 'overview';
  let _activeSpecies = 'fox';
  let filterUser     = '';
  let mapInitDone    = false;
  let overviewDone   = false;

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    // Handle Dropbox OAuth return
    if (location.search.includes('code=')) {
      const ok = await DropboxBackup.handleOAuthCallback();
      if (ok) alert('Dropbox connected ✓');
    }

    const user = Auth.currentUser();
    if (!user) {
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('appScreen').classList.add('hidden');
      return;
    }
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    startApp(user);
  }

  async function startApp(user) {
    document.getElementById('userInitialBadge').textContent = user.initial;
    const settingsUser = document.getElementById('settingsUser');
    if (settingsUser) settingsUser.textContent = `${user.displayName} (${user.username})`;

    DB.init();
    Weather.renderStrip();
    buildUserFilter();

    // Live subscriptions
    DB.listenPins(pins => {
      allPins = pins;
      Lists.update(pins);
      if (mapInitDone) MapModule.renderPins(pins, getSpeciesFilter(), filterUser);
      if (overviewDone) MapModule.renderOverview(pins, allBoundaries, allGates);
      refreshLists();
    });
    DB.listenBoundaries(b => {
      allBoundaries = b;
      if (mapInitDone) MapModule.loadBoundaries(b);
      if (overviewDone) MapModule.renderOverview(allPins, b, allGates);
    });
    DB.listenGates(g => {
      allGates = g;
      if (mapInitDone) MapModule.loadGates(g);
      if (overviewDone) MapModule.renderOverview(allPins, allBoundaries, g);
    });

    activateTab('overview');
    DropboxBackup.init();
    DB.updateOfflineBadge();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ── Tab switching ─────────────────────────────────────────────────────
  function activateTab(tab) {
    activeTab = tab;

    // Pill highlight
    document.querySelectorAll('.pill-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tab)
    );

    // Hide all content panels
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('speciesMapPanel').style.display = 'none';

    const panel = document.getElementById('tab-' + tab);
    if (panel) panel.classList.remove('hidden');

    if (tab === 'overview') {
      if (!overviewDone) {
        MapModule.initOverviewMaps();
        overviewDone = true;
      }
      MapModule.renderOverview(allPins, allBoundaries, allGates);
      setTimeout(() => MapModule.invalidateAll(), 200);
    }

    if (['fox','deer','goat'].includes(tab)) {
      // Move shared panel into this tab's div
      const tabDiv = document.getElementById('tab-' + tab);
      tabDiv.classList.remove('hidden');
      const panel = document.getElementById('speciesMapPanel');
      panel.style.display = 'flex';
      tabDiv.appendChild(panel);

      if (!mapInitDone) {
        MapModule.initMainMap();
        mapInitDone = true;
        MapModule.loadBoundaries(allBoundaries);
        MapModule.loadGates(allGates);
      }

      // Set species
      if (tab === 'fox')  _activeSpecies = 'fox';
      if (tab === 'goat') _activeSpecies = 'goat';
      // deer keeps whichever sub-species was last selected

      updateSpeciesControls(tab);
      MapModule.renderPins(allPins, getSpeciesFilter(), filterUser);
      setTimeout(() => MapModule.invalidateAll(), 200);
      refreshLists();
    }

    if (tab === 'fieldsync') renderFieldSync();
    if (tab === 'settings')  DropboxBackup.updateUI();
  }

  function updateSpeciesControls(tab) {
    const ctrl = document.getElementById('speciesMapControls');
    const header = document.getElementById('speciesListHeader');
    if (!ctrl) return;

    const sp = getSpeciesLabel();
    if (header) header.textContent = `${sp} — Shot entries`;

    ctrl.innerHTML = `
      <button class="btn-sm" onclick="PinForm.dropAtCurrentLocation('${_activeSpecies}')">📍 Drop pin (my GPS)</button>
      <button class="btn-sm" onclick="PinForm.dropOnMap('${_activeSpecies}')">🗺 Drop on map</button>
      ${tab !== 'deer' ? '' : ''}
      <button class="btn-sm" onclick="MapModule.enableGateDrop()">🔓 Add gate</button>
      <button class="btn-sm" onclick="Export.showExportDialog()">⬇ Export</button>
    `;
  }

  function getSpeciesFilter() {
    if (activeTab === 'fox')  return 'fox';
    if (activeTab === 'goat') return 'goat';
    if (activeTab === 'deer') return _activeSpecies;
    return null;
  }

  function getSpeciesLabel() {
    return SPECIES.find(s => s.id === _activeSpecies)?.label || _activeSpecies;
  }

  // Called from deer sub-menu buttons
  function setDeerSpecies(sp) {
    _activeSpecies = sp;
    document.querySelector('.deer-dropdown-label').textContent =
      SPECIES.find(s => s.id === sp)?.label || 'Deer';
    document.getElementById('deerSubMenu')?.classList.add('hidden');
    updateSpeciesControls('deer');
    MapModule.renderPins(allPins, sp, filterUser);
    refreshLists();
  }

  // ── User filter ────────────────────────────────────────────────────────
  function buildUserFilter() {
    const sel = document.getElementById('userFilterSel');
    if (!sel) return;
    sel.innerHTML = '<option value="">All users</option>' +
      USERS.map(u => `<option value="${u.username}">${u.displayName}</option>`).join('');
    sel.onchange = () => {
      filterUser = sel.value;
      if (mapInitDone) MapModule.renderPins(allPins, getSpeciesFilter(), filterUser);
      refreshLists();
    };
  }

  // ── List refresh ───────────────────────────────────────────────────────
  function refreshLists() {
    if (['fox','deer','goat'].includes(activeTab)) {
      Lists.renderSpeciesList('speciesListContainer', _activeSpecies, filterUser);
    }
  }

  // ── Field Sync ─────────────────────────────────────────────────────────
  function renderFieldSync() {
    const el = document.getElementById('fieldSyncStatus');
    if (!el) return;
    const q = DB.queueLength();
    const online = navigator.onLine;
    el.innerHTML = `
      <div class="fs-status ${online ? 'fs-online' : 'fs-offline'}">
        <span class="fs-dot"></span>
        ${online ? 'Online — data is syncing' : 'Offline — entries saved to phone'}
      </div>
      ${q > 0 ? `<p style="margin-top:8px">${q} entry(s) waiting to sync when signal returns.</p>` : '<p style="margin-top:8px">All entries synced ✓</p>'}
      <p class="fs-hint">This app works without mobile signal. Any pins, boundaries or gates you add offline are stored on your phone and automatically sent to the cloud database when you get signal back — no action needed.</p>
    `;
  }

  // ── Log out ────────────────────────────────────────────────────────────
  function logOut() {
    Auth.logout();
    location.reload();
  }

  return { boot, activateTab, setDeerSpecies, refreshLists, logOut, _activeSpecies };
})();

// ── DOM ready ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Login form handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const session  = Auth.login(username, password);
      if (!session) {
        document.getElementById('loginError').textContent = 'Incorrect username or password.';
        return;
      }
      document.getElementById('loginError').textContent = '';
      AppUI.boot();
    });
  }

  // Boot (checks existing session)
  AppUI.boot();
});

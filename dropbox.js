// Scotia Fieldsport Log — Dropbox auto-backup
// Mirrors the Hunting Info pattern: PKCE OAuth, 7-day auto, keep 12 backups

const DropboxBackup = (() => {
  const TOKEN_KEY   = 'sfl_dbx_token';
  const REFRESH_KEY = 'sfl_dbx_refresh';
  const LAST_KEY    = 'sfl_dbx_last_backup';
  const FOLDER      = DROPBOX_CONFIG.folder;
  const MAX_BACKUPS = DROPBOX_CONFIG.maxBackups;
  const INTERVAL_MS = DROPBOX_CONFIG.backupIntervalDays * 24 * 60 * 60 * 1000;

  // ── PKCE helpers ─────────────────────────────────────────────────────────
  function randomB64url(len) {
    const arr = crypto.getRandomValues(new Uint8Array(len));
    return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }
  async function sha256b64url(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }

  // ── Token helpers ─────────────────────────────────────────────────────────
  function getToken()   { return localStorage.getItem(TOKEN_KEY); }
  function getRefresh() { return localStorage.getItem(REFRESH_KEY); }

  async function refreshAccessToken() {
    const refresh = getRefresh();
    if (!refresh) return false;
    try {
      const r = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refresh,
          client_id: DROPBOX_CONFIG.appKey
        })
      });
      if (!r.ok) return false;
      const d = await r.json();
      localStorage.setItem(TOKEN_KEY, d.access_token);
      if (d.refresh_token) localStorage.setItem(REFRESH_KEY, d.refresh_token);
      return true;
    } catch { return false; }
  }

  async function apiCall(endpoint, body) {
    let token = getToken();
    if (!token) return null;
    let r = await fetch('https://api.dropboxapi.com/2' + endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.status === 401) {
      const ok = await refreshAccessToken();
      if (!ok) return null;
      token = getToken();
      r = await fetch('https://api.dropboxapi.com/2' + endpoint, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
    if (!r.ok) return null;
    return r.json();
  }

  async function uploadContent(content, filename) {
    let token = getToken();
    if (!token) return false;
    const path = `${FOLDER}/${filename}`;
    let r = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: true }),
        'Content-Type': 'application/octet-stream'
      },
      body: content
    });
    if (r.status === 401) {
      const ok = await refreshAccessToken();
      if (!ok) return false;
      token = getToken();
      r = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: true }),
          'Content-Type': 'application/octet-stream'
        },
        body: content
      });
    }
    return r.ok;
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  async function connect() {
    const verifier = randomB64url(64);
    const challenge = await sha256b64url(verifier);
    sessionStorage.setItem('sfl_pkce_verifier', verifier);

    const params = new URLSearchParams({
      client_id: DROPBOX_CONFIG.appKey,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline',
      redirect_uri: location.origin + location.pathname
    });
    location.href = 'https://www.dropbox.com/oauth2/authorize?' + params;
  }

  async function handleOAuthCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code) return false;
    const verifier = sessionStorage.getItem('sfl_pkce_verifier');
    if (!verifier) return false;

    history.replaceState({}, '', location.pathname);
    sessionStorage.removeItem('sfl_pkce_verifier');

    const r = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: DROPBOX_CONFIG.appKey,
        code_verifier: verifier,
        redirect_uri: location.origin + location.pathname
      })
    });
    if (!r.ok) return false;
    const d = await r.json();
    localStorage.setItem(TOKEN_KEY, d.access_token);
    if (d.refresh_token) localStorage.setItem(REFRESH_KEY, d.refresh_token);
    return true;
  }

  function disconnect() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LAST_KEY);
    updateUI();
  }

  function isConnected() { return !!getRefresh(); }

  // ── Backup ────────────────────────────────────────────────────────────────
  async function backup(statusEl) {
    const set = t => { if (statusEl) statusEl.textContent = t; };
    if (!isConnected()) { set('Not connected to Dropbox.'); return false; }
    set('Exporting data…');
    try {
      const data = await DB.exportAll();
      const json = JSON.stringify(data, null, 2);
      const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,16);
      const filename = `ScotiaFieldsportLog-backup-${stamp}.json`;
      set('Uploading to Dropbox…');
      const ok = await uploadContent(json, filename);
      if (!ok) { set('Backup failed — check connection.'); return false; }
      localStorage.setItem(LAST_KEY, Date.now().toString());
      set('Backup saved ✓ — tidying old backups…');
      await tidyOldBackups();
      set(`Backup complete ✓  (${new Date().toLocaleString('en-GB')})`);
      return true;
    } catch (e) {
      set('Backup error: ' + e.message);
      return false;
    }
  }

  async function tidyOldBackups() {
    const res = await apiCall('/files/list_folder', { path: FOLDER });
    if (!res || !res.entries) return;
    const files = res.entries
      .filter(e => e['.tag'] === 'file' && e.name.startsWith('ScotiaFieldsportLog-backup-'))
      .sort((a, b) => b.server_modified.localeCompare(a.server_modified));
    for (const f of files.slice(MAX_BACKUPS)) {
      await apiCall('/files/delete_v2', { path: f.path_lower });
    }
  }

  async function checkAutoBackup() {
    if (!isConnected()) return;
    const last = parseInt(localStorage.getItem(LAST_KEY) || '0', 10);
    if (Date.now() - last >= INTERVAL_MS) {
      const statusEl = document.getElementById('dropboxStatus');
      await backup(statusEl);
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  function updateUI() {
    const connected = isConnected();
    const connectBtn    = document.getElementById('connectDropboxBtn');
    const backupNowBtn  = document.getElementById('backupNowBtn');
    const disconnectBtn = document.getElementById('disconnectDropboxBtn');
    const statusEl      = document.getElementById('dropboxStatus');
    if (connectBtn)    connectBtn.classList.toggle('hidden', connected);
    if (backupNowBtn)  backupNowBtn.classList.toggle('hidden', !connected);
    if (disconnectBtn) disconnectBtn.classList.toggle('hidden', !connected);
    if (statusEl && connected) {
      const last = parseInt(localStorage.getItem(LAST_KEY) || '0', 10);
      statusEl.textContent = last
        ? `Last backup: ${new Date(last).toLocaleString('en-GB')}`
        : 'Connected — no backup yet.';
    }
  }

  function init() {
    document.getElementById('connectDropboxBtn')?.addEventListener('click', connect);
    document.getElementById('disconnectDropboxBtn')?.addEventListener('click', disconnect);
    document.getElementById('backupNowBtn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('dropboxStatus');
      await backup(statusEl);
    });
    updateUI();
    checkAutoBackup();
  }

  return { init, connect, disconnect, backup, isConnected, handleOAuthCallback, updateUI, checkAutoBackup };
})();

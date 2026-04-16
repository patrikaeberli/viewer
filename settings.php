<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Settings</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="static/style.css">
<link rel="icon" href="https://avatars.githubusercontent.com/u/175005826?v=4&size=64">
<style>
  .update-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .06em;
    padding: 3px 10px;
    border-radius: 20px;
    vertical-align: middle;
    margin-left: 10px;
    font-family: 'IBM Plex Mono', monospace;
    transition: background .3s, color .3s;
  }
  .update-badge.checking  { background: rgba(255,255,255,.08); color: #888; }
  .update-badge.current   { background: rgba(80,220,100,.12);  color: #50dc64; }
  .update-badge.outdated  { background: rgba(255,170,0,.14);   color: #ffaa00; }
  .update-badge.error     { background: rgba(255,80,80,.12);   color: #ff5050; }
  .update-commits {
    margin-top: 10px;
    font-size: 12px;
    font-family: 'IBM Plex Mono', monospace;
    color: #888;
    line-height: 1.7;
  }
  .update-commits a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  .update-meta {
    margin-top: 4px;
    font-size: 11px;
    color: #555;
    font-family: 'IBM Plex Mono', monospace;
  }
</style>
</head>
<body class="admin-body settings-body">
<div id="topbar">
  <div class="topbar-left">
    <div class="logo"><span class="logo-icon">▣</span><span class="logo-text">SIGNAGE</span><span class="logo-sub">SETTINGS</span></div>
  </div>
  <div class="topbar-center"></div>
  <div class="topbar-right">
    <a href="admin.php" class="topbar-btn highlight">← EDITOR</a>
  </div>
</div>

<div id="settingsLayout">

  <!-- ── GERÄT / REFRESH ─────────────────────────── -->
  <div class="settings-col">
    <div class="settings-card">
      <div class="settings-card-title">GERÄT / REFRESH</div>
      <div class="pref-row pref-row--col">
        <div class="pref-info">
          <div class="pref-label">Refresh-Befehl</div>
          <div class="pref-desc">Shell-Befehl, der auf dem Server ausgeführt wird – z.&thinsp;B. <code>sudo systemctl restart signage-kiosk</code>. Der Befehl läuft als <code>www-data</code>; stelle sicher, dass ein passender <code>sudoers</code>-Eintrag vorhanden ist (wird vom Installer automatisch gesetzt).</div>
        </div>
        <div class="refresh-cmd-row">
          <input type="text" id="refreshCmdInput" class="refresh-cmd-input"
            placeholder="sudo systemctl restart signage-kiosk"
            spellcheck="false" autocomplete="off">
          <button class="refresh-cmd-btn save-btn" id="saveCmdBtn" onclick="saveRefreshCmd()">SPEICHERN</button>
        </div>
        <div class="refresh-run-row">
          <button class="refresh-cmd-btn run-btn" id="runCmdBtn" onclick="runRefreshCmd()">&#9654; JETZT AUSFÜHREN</button>
          <span id="refreshStatus" class="refresh-status"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- ── EDITOR PREFERENCES ─────────────────────── -->
  <div class="settings-col">
    <div class="settings-card">
      <div class="settings-card-title">EDITOR PREFERENCES</div>
      <div class="pref-row">
        <div class="pref-info">
          <div class="pref-label">Auto-save</div>
          <div class="pref-desc">Automatically save changes 700ms after edits. When off, a Save button appears in the editor toolbar.</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="autoSaveToggle" onchange="setAutoSave(this.checked)">
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
    </div>
  </div>

  <!-- ── UPDATE ─────────────────────────────────── -->
  <div class="settings-col">
    <div class="settings-card">
      <div class="settings-card-title">
        UPDATE
        <span id="updateBadge" class="update-badge checking">⬤ Wird geprüft…</span>
      </div>
      <div class="pref-row pref-row--col">
        <div class="pref-info">
          <div class="pref-label">Anwendung aktualisieren</div>
          <div class="pref-desc">
            Aktualisiert den Code aus GitHub via <code>update.sh</code>.
            Assets (<code>assets/</code>), <code>state.json</code> und der Refresh-Befehl bleiben erhalten.
          </div>
          <div class="update-meta" id="updateMeta"></div>
          <div class="update-commits" id="updateCommits"></div>
        </div>
        <div class="refresh-run-row">
          <button class="refresh-cmd-btn run-btn" id="updateBtn" onclick="doUpdate()" disabled>↑ AKTUALISIEREN</button>
          <span id="updateStatus" class="refresh-status"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- ── ASSET LIBRARY ──────────────────────────── -->
  <div class="settings-col wide">
    <div class="settings-card">
      <div class="settings-card-title">
        ASSET LIBRARY
        <span id="assetCount" class="item-count"></span>
      </div>
      <div id="assetGrid" class="asset-grid">
        <div class="asset-loading">Loading assets…</div>
      </div>
    </div>
  </div>

</div>

<script>
// ── Update check & run ────────────────────────────────────────────────────────

async function checkUpdate() {
  const badge  = document.getElementById('updateBadge');
  const meta   = document.getElementById('updateMeta');
  const commits = document.getElementById('updateCommits');
  const btn    = document.getElementById('updateBtn');
  const status = document.getElementById('updateStatus');

  badge.className = 'update-badge checking';
  badge.textContent = '⬤ Wird geprüft…';
  meta.textContent  = '';
  commits.innerHTML = '';

  try {
    const r = await fetch('api.php?action=check_update');
    const d = await r.json();

    if (d.error) throw new Error(d.error);

    meta.textContent = `Aktueller Stand: ${d.current_hash}  (${d.branch})` +
      (d.current_date ? `  ·  ${d.current_date.slice(0,10)}` : '');

    if (d.up_to_date) {
      badge.className   = 'update-badge current';
      badge.textContent = '✔ Aktuell';
      btn.disabled = true;
      status.textContent = '';
    } else {
      badge.className   = 'update-badge outdated';
      badge.textContent = `⬤ Nicht aktuell  (+${d.behind})`;
      btn.disabled = false;

      if (d.commits && d.commits.length) {
        commits.innerHTML = d.commits
          .map(c => `<span>▸ ${escHtml(c)}</span>`)
          .join('<br>');
        if (d.changelog_url) {
          commits.innerHTML += `<br><a href="${d.changelog_url}" target="_blank" rel="noopener">→ Alle Änderungen auf GitHub</a>`;
        }
      }
    }
  } catch (e) {
    badge.className   = 'update-badge error';
    badge.textContent = '✘ Fehler';
    meta.textContent  = e.message || 'Unbekannter Fehler';
    btn.disabled = false; // allow manual retry via update
  }
}

async function doUpdate() {
  const btn    = document.getElementById('updateBtn');
  const status = document.getElementById('updateStatus');
  const badge  = document.getElementById('updateBadge');

  btn.disabled = true;
  badge.className = 'update-badge checking';
  badge.textContent = '⬤ Wird aktualisiert…';
  status.textContent = '⏳ Update läuft…';

  try {
    const r = await fetch('api.php?action=do_update');
    const d = await r.json();

    if (d.ok) {
      status.textContent = `✔ Fertig  (${d.new_hash || 'OK'})`;
      await checkUpdate(); // refresh badge
    } else {
      status.textContent = `✘ Fehler (Code ${d.code})`;
      if (d.output) status.title = d.output;
      badge.className = 'update-badge error';
      badge.textContent = '✘ Fehler';
      btn.disabled = false;
    }
  } catch (e) {
    status.textContent = '✘ Netzwerkfehler';
    badge.className = 'update-badge error';
    badge.textContent = '✘ Fehler';
    btn.disabled = false;
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Run check on page load
checkUpdate();
</script>

<script src="static/settings.js"></script>
</body>
</html>

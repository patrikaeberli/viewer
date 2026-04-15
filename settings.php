<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Settings</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="static/style.css">
  <link rel="icon" href="https://avatars.githubusercontent.com/u/175005826?v=4&size=64">
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

<script src="static/settings.js"></script>
</body>
</html>

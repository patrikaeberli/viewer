<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Editor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="static/style.css">
  <link rel="icon" href="https://avatars.githubusercontent.com/u/175005826?v=4&size=64">
</head>
<body class="admin-body">

<div id="topbar">
  <div class="topbar-left">
    <div class="logo"><span class="logo-icon">▣</span><span class="logo-text">SIGNAGE</span><span class="logo-sub">EDITOR</span></div>
    <div class="topbar-sep"></div>
    <button id="btnUndo" class="topbar-btn" onclick="undo()" title="Ctrl+Z" disabled>↩ UNDO</button>
    <button id="btnRedo" class="topbar-btn" onclick="redo()" title="Ctrl+Y" disabled>↪ REDO</button>
  </div>
  <div class="topbar-center">
    <select id="resSelect" class="res-select" onchange="changeResolution(this.value)">
      <option value="1920x1080">1920 × 1080  (FHD 16:9)</option>
      <option value="1280x720">1280 × 720   (HD 16:9)</option>
      <option value="3840x2160">3840 × 2160  (4K)</option>
      <option value="1080x1920">1080 × 1920  (Portrait)</option>
      <option value="custom">Custom…</option>
    </select>
  </div>
  <div class="topbar-right">
    <span id="saveStatus" class="save-status" data-state="saved">● SAVED</span>
    <button id="btnManualSave" class="topbar-btn accent" style="display:none" onclick="forceSave()">💾 SAVE</button>
    <a href="settings.php" class="topbar-btn">⚙ SETTINGS</a>
    <a href="index.php" target="_blank" class="topbar-btn highlight">PREVIEW ↗</a>
  </div>
</div>

<div id="adminLayout">
  <div id="sidebar">
    <div class="sidebar-head">
      <span class="sidebar-title">LAYERS</span>
      <div class="add-layer-wrap">
        <button class="add-btn" onclick="toggleAddMenu(event)">＋ ADD</button>
        <div id="addLayerMenu" class="add-menu hidden">
          <div class="add-menu-item" onclick="addLayer('background')">
            <span class="dot dot-bg"></span>
            <div><div class="add-menu-label">BACKGROUND</div><div class="add-menu-desc">Fullscreen · lowest z-index · cycles items</div></div>
          </div>
          <div class="add-menu-item" onclick="addLayer('carousel')">
            <span class="dot dot-car"></span>
            <div><div class="add-menu-label">CAROUSEL</div><div class="add-menu-desc">Positioned area · timed slideshow</div></div>
          </div>
          <div class="add-menu-item" onclick="addLayer('free')">
            <span class="dot dot-free"></span>
            <div><div class="add-menu-label">FREE</div><div class="add-menu-desc">All items visible · drag &amp; resize</div></div>
          </div>
        </div>
      </div>
    </div>
    <div id="layerList"></div>
    <div class="sidebar-legend">
      <div><span class="badge badge-bg">BG</span> Fullscreen cycle</div>
      <div><span class="badge badge-car">CAR</span> Timed slideshow</div>
      <div><span class="badge badge-free">FREE</span> Simultaneous</div>
    </div>
  </div>

  <div id="canvasWrap">
    <div id="canvasOuter">
      <div id="canvas"></div>
    </div>
  </div>

  <div id="propsPanel">
    <div id="propsPanelInner"></div>
  </div>
</div>

<script src="static/editor.js"></script>
<script src="static/theme.js"></script>
</body>
</html>

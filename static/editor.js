/* editor.js — Signage Admin Editor */

// ─── State & Config ────────────────────────────────────────────────────────────

let state = { canvas: { w: 1920, h: 1080 }, layers: [] };
let activeLayerIdx = 0;
let selectedItemIdx = null;
let saveTimer = null;

// Auto-save preference (persisted in localStorage)
let autoSave = localStorage.getItem('signage_autosave') !== 'false';

// Undo/Redo history
const history = [];
let historyIdx = -1;
const MAX_HISTORY = 50;

const TYPE = {
  background: { badge: 'BG',   cls: 'badge-bg',   label: 'Background' },
  carousel:   { badge: 'CAR',  cls: 'badge-car',  label: 'Carousel'   },
  free:       { badge: 'FREE', cls: 'badge-free', label: 'Free'       },
};

const RES_PRESETS = {
  '1920x1080': { w: 1920, h: 1080 },
  '1280x720':  { w: 1280, h: 720  },
  '3840x2160': { w: 3840, h: 2160 },
  '1080x1920': { w: 1080, h: 1920 },
};

// ─── Canvas dimensions helpers ─────────────────────────────────────────────────

const CW = () => state.canvas?.w || 1920;
const CH = () => state.canvas?.h || 1080;

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiLoad() {
  const r = await fetch('api.php?action=load');
  return r.json();
}

async function apiSave() {
  setSaveStatus('saving');
  await fetch('api.php?action=save', {
    method: 'POST',
    body: JSON.stringify(state)
  });
  setSaveStatus('saved');
}

async function apiUpload(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('api.php?action=upload', { method: 'POST', body: fd });
  return r.json();
}

function setSaveStatus(s) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  const map = { saved: '● SAVED', saving: '○ SAVING…', pending: '◌ UNSAVED' };
  el.textContent = map[s] || '';
  el.dataset.state = s;
}

function scheduleSave() {
  setSaveStatus('pending');
  if (!autoSave) return; // manual save only
  clearTimeout(saveTimer);
  saveTimer = setTimeout(apiSave, 700);
}

async function forceSave() {
  clearTimeout(saveTimer);
  await apiSave();
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

function pushHistory() {
  history.length = historyIdx + 1; // truncate redo branch
  history.push(JSON.stringify(state));
  if (history.length > MAX_HISTORY) history.shift();
  historyIdx = history.length - 1;
  updateUndoRedoBtns();
}

function undo() {
  if (historyIdx <= 0) return;
  historyIdx--;
  state = JSON.parse(history[historyIdx]);
  selectedItemIdx = null;
  renderAll();
  scheduleSave();
}

function redo() {
  if (historyIdx >= history.length - 1) return;
  historyIdx++;
  state = JSON.parse(history[historyIdx]);
  selectedItemIdx = null;
  renderAll();
  scheduleSave();
}

function updateUndoRedoBtns() {
  const u = document.getElementById('btnUndo');
  const r = document.getElementById('btnRedo');
  if (u) u.disabled = historyIdx <= 0;
  if (r) r.disabled = historyIdx >= history.length - 1;
}

// Keyboard shortcuts
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); forceSave(); }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  updateAutoSaveUI();

  state = await apiLoad();
  if (!state.canvas) state.canvas = { w: 1920, h: 1080 };

  // Migrate legacy state
  state.layers.forEach((l, li) => {
    if (!l.id)   l.id = 'l' + li + '_' + Date.now();
    if (!l.type) l.type = 'free';
    if (l.visible === undefined) l.visible = true;

    // Carousel gets layer-level position if missing
    if (l.type === 'carousel') {
      if (!l.x) l.x = l.items[0]?.x ?? 80;
      if (!l.y) l.y = l.items[0]?.y ?? 80;
      if (!l.w) l.w = l.items[0]?.w ?? 400;
      if (!l.h) l.h = l.items[0]?.h ?? 300;
    }

    l.items.forEach((item, ii) => {
      if (!item.id)              item.id = 'i' + li + ii + Date.now();
      if (item.x === undefined)  item.x = 80;
      if (item.y === undefined)  item.y = 80;
      if (item.w === undefined)  item.w = 400;
      if (item.h === undefined)  item.h = 300;
      if (!item.duration)        item.duration = 5;
    });
  });

  // Sync resolution selector
  syncResSelect();

  // Initial history snapshot
  pushHistory();

  renderAll();
  window.addEventListener('resize', debounce(() => {
    updateCanvasTransform();
    renderCanvas();
  }, 100));
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function updateAutoSaveUI() {
  autoSave = localStorage.getItem('signage_autosave') !== 'false';
  const btn = document.getElementById('btnManualSave');
  if (btn) btn.style.display = autoSave ? 'none' : 'inline-flex';
}

// ─── Resolution ───────────────────────────────────────────────────────────────

function syncResSelect() {
  const sel = document.getElementById('resSelect');
  if (!sel) return;
  const key = CW() + 'x' + CH();
  if (RES_PRESETS[key]) sel.value = key;
  else sel.value = 'custom';
}

function changeResolution(val) {
  if (val === 'custom') {
    const w = parseInt(prompt('Canvas width (px):', CW()), 10);
    const h = parseInt(prompt('Canvas height (px):', CH()), 10);
    if (!w || !h || w < 100 || h < 100) { syncResSelect(); return; }
    state.canvas = { w, h };
  } else if (RES_PRESETS[val]) {
    state.canvas = { ...RES_PRESETS[val] };
  }
  pushHistory();
  scheduleSave();
  renderAll();
}

// ─── Render All ───────────────────────────────────────────────────────────────

function renderAll() {
  renderLayerList();
  renderCanvas();
  renderProps();
}

// ─── Layer List ───────────────────────────────────────────────────────────────

function renderLayerList() {
  const el = document.getElementById('layerList');
  el.innerHTML = '';

  // Show top layers first (reversed visual order = higher z on top)
  [...state.layers].reverse().forEach((layer, revIdx) => {
    const i = state.layers.length - 1 - revIdx;
    const isActive = i === activeLayerIdx;
    const meta = TYPE[layer.type] || TYPE.free;

    const div = document.createElement('div');
    div.className = 'layer-row' + (isActive ? ' layer-active' : '');
    div.onclick = () => { activeLayerIdx = i; selectedItemIdx = null; renderAll(); };

    div.innerHTML = `
      <span class="badge ${meta.cls}">${meta.badge}</span>
      <span class="layer-name">${layer.name}</span>
      <div class="layer-row-btns">
        <button class="icon-btn" onclick="toggleVis(${i},event)" title="Toggle visibility">${layer.visible !== false ? '●' : '○'}</button>
        <button class="icon-btn" onclick="layerUp(${i},event)" title="Move up">↑</button>
        <button class="icon-btn" onclick="layerDown(${i},event)" title="Move down">↓</button>
        <button class="icon-btn danger" onclick="deleteLayer(${i},event)" title="Delete layer">✕</button>
      </div>`;

    el.appendChild(div);
  });

  if (!state.layers.length) {
    el.innerHTML = '<div class="no-layers">No layers yet.<br>Click + ADD to start.</div>';
  }
}

// ─── Canvas Scaling ────────────────────────────────────────────────────────────

function getScale() {
  const wrap = document.getElementById('canvasWrap');
  if (!wrap) return 1;
  const aw = wrap.clientWidth  - 48;
  const ah = wrap.clientHeight - 48;
  return Math.min(aw / CW(), ah / CH(), 1);
}

function updateCanvasTransform() {
  const sc     = getScale();
  const outer  = document.getElementById('canvasOuter');
  const canvas = document.getElementById('canvas');
  if (!outer || !canvas) return;

  const sw = Math.round(CW() * sc);
  const sh = Math.round(CH() * sc);

  // Outer div = exact scaled size → flexbox can center it perfectly
  outer.style.width  = sw + 'px';
  outer.style.height = sh + 'px';

  // Canvas = full resolution, scaled down
  canvas.style.position       = 'absolute';
  canvas.style.top            = '0';
  canvas.style.left           = '0';
  canvas.style.width          = CW() + 'px';
  canvas.style.height         = CH() + 'px';
  canvas.style.transform      = `scale(${sc})`;
  canvas.style.transformOrigin = 'top left';
}

// ─── Canvas Render ────────────────────────────────────────────────────────────

function renderCanvas() {
  updateCanvasTransform();

  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';

  const layer = state.layers[activeLayerIdx];
  if (!layer) {
    canvas.innerHTML = '<div class="canvas-empty">Select or create a layer</div>';
    return;
  }

  if (layer.type === 'free')       renderFreeCanvas(canvas, layer);
  else if (layer.type === 'background') renderBgCanvas(canvas, layer);
  else                              renderCarouselCanvas(canvas, layer);
}

// ── Background canvas ──

function renderBgCanvas(canvas, layer) {
  canvas.onclick = () => { selectedItemIdx = null; renderCanvas(); renderProps(); };

  if (!layer.items.length) {
    canvas.innerHTML = '<div class="canvas-empty">No items yet — add one in the panel →</div>';
    return;
  }

  const idx  = (selectedItemIdx !== null && layer.items[selectedItemIdx]) ? selectedItemIdx : 0;
  const item = layer.items[idx];

  const media = makePreviewMedia(item);
  if (item.type === 'color') {
    media.style.cssText = `position:absolute;inset:0;width:100%;height:100%;`;
  } else {
    media.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${item.fit||'contain'};`;
  }
  canvas.appendChild(media);

  if (layer.items.length > 1) canvas.appendChild(makeSlideDots(layer, idx));
}

// ── Carousel canvas ──

function renderCarouselCanvas(canvas, layer) {
  canvas.onclick = () => { selectedItemIdx = null; renderCanvas(); renderProps(); };

  // Draw the carousel container box — draggable + resizable
  const box = document.createElement('div');
  box.className = 'ci carousel-box' + (selectedItemIdx === 0 ? ' ci-sel' : '');
  box.style.cssText = `left:${layer.x}px;top:${layer.y}px;width:${layer.w}px;height:${layer.h}px;`;

  if (layer.items.length) {
    const idx   = typeof selectedItemIdx === 'number' && selectedItemIdx > 0 ? selectedItemIdx - 1 : 0;
    const item  = layer.items[idx] || layer.items[0];
    const media = makePreviewMedia(item);
    media.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    box.appendChild(media);
  }

  if (layer.items.length > 1) {
    const dots = makeSlideDots(layer, typeof selectedItemIdx === 'number' && selectedItemIdx > 0 ? selectedItemIdx - 1 : 0, true);
    box.appendChild(dots);
  }

  // Select on click
  box.onclick = (e) => { e.stopPropagation(); selectedItemIdx = 0; renderCanvas(); renderProps(); };

  // Drag
  box.onmousedown = e => {
    if (e.target.classList.contains('ci-resize')) return;
    e.stopPropagation(); e.preventDefault();
    const sc = getScale();
    const rect = document.getElementById('canvas').getBoundingClientRect();
    const ox = (e.clientX - rect.left) / sc - layer.x;
    const oy = (e.clientY - rect.top)  / sc - layer.y;

    const onMove = e => {
      layer.x = Math.max(0, Math.round((e.clientX - rect.left) / sc - ox));
      layer.y = Math.max(0, Math.round((e.clientY - rect.top)  / sc - oy));
      box.style.left = layer.x + 'px';
      box.style.top  = layer.y + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      pushHistory(); scheduleSave(); renderProps();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Resize handle
  const handle = document.createElement('div');
  handle.className = 'ci-resize';
  handle.onmousedown = e => {
    e.stopPropagation(); e.preventDefault();
    const sc = getScale();
    const sx = e.clientX, sy = e.clientY, sw = layer.w, sh = layer.h;

    const onMove = e => {
      layer.w = Math.max(80, Math.round(sw + (e.clientX - sx) / sc));
      layer.h = Math.max(60, Math.round(sh + (e.clientY - sy) / sc));
      box.style.width  = layer.w + 'px';
      box.style.height = layer.h + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      pushHistory(); scheduleSave(); renderProps();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  box.appendChild(handle);
  canvas.appendChild(box);
}

// ── Free canvas ──

function renderFreeCanvas(canvas, layer) {
  canvas.onclick = () => { selectedItemIdx = null; renderCanvas(); renderProps(); };

  layer.items.forEach((item, i) => {
    const isSel = i === selectedItemIdx;
    const el = document.createElement('div');
    el.className = 'ci' + (isSel ? ' ci-sel' : '');
    el.style.cssText = `left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;`;

    const media = makePreviewMedia(item);
    media.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
    el.appendChild(media);

    // Filename label on hover
    const lbl = document.createElement('div');
    lbl.className = 'ci-label';
    lbl.textContent = item.src.split('/').pop().substring(0, 24);
    el.appendChild(lbl);

    el.onclick = e => { e.stopPropagation(); }; // stopPropagation only — selection happens in mousedown

    el.onmousedown = e => {
      if (e.target.classList.contains('ci-resize')) return;
      e.stopPropagation(); e.preventDefault();

      // Select immediately on mousedown so props show up without waiting for click
      if (selectedItemIdx !== i) {
        selectedItemIdx = i;
        renderCanvas(); renderProps();
      }

      const sc = getScale();
      const rect = canvas.getBoundingClientRect();
      const ox = (e.clientX - rect.left) / sc - item.x;
      const oy = (e.clientY - rect.top)  / sc - item.y;
      let moved = false;

      const onMove = e => {
        moved = true;
        item.x = Math.max(0, Math.round((e.clientX - rect.left) / sc - ox));
        item.y = Math.max(0, Math.round((e.clientY - rect.top)  / sc - oy));
        el.style.left = item.x + 'px';
        el.style.top  = item.y + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (moved) { pushHistory(); scheduleSave(); renderProps(); }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    const handle = document.createElement('div');
    handle.className = 'ci-resize';
    handle.onmousedown = e => {
      e.stopPropagation(); e.preventDefault();
      const sc = getScale();
      const sx = e.clientX, sy = e.clientY, sw = item.w, sh = item.h;

      const onMove = e => {
        item.w = Math.max(40, Math.round(sw + (e.clientX - sx) / sc));
        item.h = Math.max(40, Math.round(sh + (e.clientY - sy) / sc));
        el.style.width  = item.w + 'px';
        el.style.height = item.h + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        pushHistory(); scheduleSave(); renderProps();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    el.appendChild(handle);
    canvas.appendChild(el);
  });
}

// ── Helpers ──

function makePreviewMedia(item) {
  if (item.type === 'color') {
    const d = document.createElement('div');
    d.style.background = item.color || '#000';
    return d;
  }
  let el;
  if (item.type === 'video') {
    el = document.createElement('video');
    el.autoplay = true; el.loop = true; el.muted = true;
  } else if (item.type === 'url') {
    el = document.createElement('iframe');
    el.style.border = 'none';
    el.style.pointerEvents = 'none';
  } else {
    el = document.createElement('img');
  }
  el.src = item.src;
  return el;
}

function makeSlideDots(layer, currentIdx, inside) {
  const dots = document.createElement('div');
  dots.className = 'slide-dots' + (inside ? ' slide-dots-inside' : '');
  dots.onclick = e => e.stopPropagation();

  layer.items.forEach((_, di) => {
    const dot = document.createElement('div');
    dot.className = 'slide-dot' + (di === currentIdx ? ' active' : '');
    dot.onclick = e => {
      e.stopPropagation();
      selectedItemIdx = inside ? di + 1 : di;  // +1 because 0 = box itself for carousel
      renderCanvas(); renderProps();
    };
    dots.appendChild(dot);
  });
  return dots;
}

// ─── Props Panel ──────────────────────────────────────────────────────────────

function renderProps() {
  const panel = document.getElementById('propsPanelInner');
  if (!panel) return;

  const layer = state.layers[activeLayerIdx];
  if (!layer) {
    panel.innerHTML = '<div class="props-empty">No layer selected</div>';
    return;
  }

  const meta = TYPE[layer.type] || TYPE.free;
  let html = '';

  // ── Layer Section ──
  html += `<div class="props-section">
    <div class="props-label">LAYER</div>
    <div class="field-row"><label>Name</label>
      <input class="field-input" value="${escAttr(layer.name)}" oninput="renameLayer(this.value)">
    </div>
    <div class="field-row"><label>Type</label>
      <select class="field-input" onchange="changeLayerType(this.value)">
        ${Object.entries(TYPE).map(([k,v]) => `<option value="${k}"${layer.type===k?' selected':''}>${v.label}</option>`).join('')}
      </select>
    </div>`;

  // Carousel position/size in layer section
  if (layer.type === 'carousel') {
    html += `
    <div class="field-row"><label>X</label><input class="field-input" type="number" value="${Math.round(layer.x||0)}" oninput="updateLayerProp('x',+this.value)"></div>
    <div class="field-row"><label>Y</label><input class="field-input" type="number" value="${Math.round(layer.y||0)}" oninput="updateLayerProp('y',+this.value)"></div>
    <div class="field-row"><label>W</label><input class="field-input" type="number" value="${Math.round(layer.w||400)}" oninput="updateLayerProp('w',+this.value)"></div>
    <div class="field-row"><label>H</label><input class="field-input" type="number" value="${Math.round(layer.h||300)}" oninput="updateLayerProp('h',+this.value)"></div>`;
  }

  html += `</div>`;

  // ── Items List ──
  html += `<div class="props-section">
    <div class="props-label">ITEMS <span class="item-count">${layer.items.length}</span></div>
    <div class="items-list" id="itemsList">`;

  layer.items.forEach((it, i) => {
    // Carousel uses selectedItemIdx offset: 0=box, 1+=items. Free/BG use direct index.
    const clickIdx = layer.type === 'carousel' ? i + 1 : i;
    const isSel    = layer.type === 'carousel' ? selectedItemIdx === i + 1 : i === selectedItemIdx;
    let thumb;
    if (it.type === 'color') thumb = `<div class="item-thumb" style="background:${it.color||'#000'}"></div>`;
    else if (it.type === 'image') thumb = `<img class="item-thumb" src="${escAttr(it.src)}">`;
    else thumb = `<div class="item-thumb item-thumb-icon">${it.type === 'video' ? '▶' : '🌐'}</div>`;

    html += `<div class="item-row${isSel?' item-row-sel':''}" onclick="selectItem(${clickIdx})">
      ${thumb}
      <div class="item-row-info">
        <div class="item-row-name">${it.type === 'color' ? 'Color: ' + (it.color||'#000') : escHtml(it.src.split('/').pop().substring(0,20))}</div>
        <div class="item-row-meta">${it.duration}s${it.type!=='color'?' · '+it.w+'×'+it.h:''}</div>
      </div>
      <div class="item-order-btns">
        <button class="icon-btn sm" onclick="itemMoveUp(${i},event)" title="Move earlier">↑</button>
        <button class="icon-btn sm" onclick="itemMoveDown(${i},event)" title="Move later">↓</button>
      </div>
      <button class="icon-btn danger sm" onclick="deleteItem(${i},event)">✕</button>
    </div>`;
  });

  html += `</div></div>`;

  // ── Selected Item Props ──
  // For carousel: selectedItemIdx=0 means box, 1+ means items[selectedItemIdx-1]
  // For free/bg:  selectedItemIdx is the direct item index
  let activeItem = null;
  if (selectedItemIdx !== null) {
    if (layer.type === 'carousel' && selectedItemIdx > 0) {
      activeItem = layer.items[selectedItemIdx - 1] || null;
    } else if (layer.type !== 'carousel') {
      activeItem = layer.items[selectedItemIdx] || null;
    }
  }

  if (activeItem) {
    html += `<div class="props-section"><div class="props-label">ITEM PROPERTIES</div>`;
    html += `<div class="field-row"><label>Duration</label>
      <div class="field-with-unit">
        <input class="field-input" type="number" min="1" value="${activeItem.duration}" oninput="updateActiveItem('duration',+this.value)">
        <span class="unit">sec</span>
      </div></div>`;

    if (activeItem.type === 'color') {
      html += `<div class="field-row"><label>Color</label>
        <input type="color" class="color-picker" value="${activeItem.color||'#000000'}" oninput="updateActiveItem('color',this.value)">
        <input class="field-input mono small" value="${activeItem.color||'#000000'}" oninput="updateActiveItem('color',this.value);this.previousElementSibling.value=this.value">
      </div>`;
    }

    if (layer.type === 'background') {
      html += `<div class="field-row"><label>Fit</label>
        <select class="field-input" onchange="updateActiveItem('fit',this.value)">
          <option value="contain"${(activeItem.fit||'contain')==='contain'?' selected':''}>Contain (no crop)</option>
          <option value="cover"${activeItem.fit==='cover'?' selected':''}>Cover (fill &amp; crop)</option>
          <option value="fill"${activeItem.fit==='fill'?' selected':''}>Stretch (fill)</option>
        </select>
      </div>`;
    }

    if (layer.type === 'free') {
      html += `
      <div class="field-row"><label>X</label><input class="field-input" type="number" value="${Math.round(activeItem.x)}" oninput="updateActiveItem('x',+this.value)"></div>
      <div class="field-row"><label>Y</label><input class="field-input" type="number" value="${Math.round(activeItem.y)}" oninput="updateActiveItem('y',+this.value)"></div>
      <div class="field-row"><label>W</label><input class="field-input" type="number" value="${Math.round(activeItem.w)}" oninput="updateActiveItem('w',+this.value)"></div>
      <div class="field-row"><label>H</label><input class="field-input" type="number" value="${Math.round(activeItem.h)}" oninput="updateActiveItem('h',+this.value)"></div>`;
    }

    html += `</div>`;
  }

  // ── Add Item ──
  html += `<div class="props-section">
    <div class="props-label">ADD ITEM</div>`;

  if (layer.type === 'background') {
    html += `<button class="add-color-btn" onclick="addColorItem()">＋ Add Solid Color</button>`;
  }

  html += `<div class="upload-area" id="uploadArea" ondragover="dragOver(event)" ondragleave="dragLeave()" ondrop="dropFile(event)">
    <div class="upload-icon">↑</div>
    <div class="upload-hint">Drop file or click to browse</div>
    <input type="file" id="fileInput" accept="image/*,video/*" style="display:none" onchange="handleFileSelect(this)">
    <button class="upload-browse-btn" onclick="document.getElementById('fileInput').click()">Browse</button>
  </div>
  <div class="field-row" style="margin-top:8px">
    <label>URL</label>
    <input id="urlInput" class="field-input mono small" placeholder="https://…">
  </div>
  <div class="field-row">
    <label>Duration</label>
    <div class="field-with-unit">
      <input id="addDuration" class="field-input" type="number" min="1" value="5">
      <span class="unit">sec</span>
    </div>
  </div>
  <button class="add-item-btn" onclick="addItemFromUrl()">＋ Add URL / Iframe</button>
  </div>`;

  panel.innerHTML = html;
}

// ─── Layer Operations ─────────────────────────────────────────────────────────

function addLayer(type) {
  const names = { background: 'Background', carousel: 'Carousel', free: 'Free Layer' };
  const base  = { id: 'l' + Date.now(), name: names[type], type, visible: true, items: [] };
  if (type === 'carousel') Object.assign(base, { x: 80, y: 80, w: 400, h: 300 });
  state.layers.push(base);
  activeLayerIdx = state.layers.length - 1;
  selectedItemIdx = null;
  document.getElementById('addLayerMenu').classList.add('hidden');
  pushHistory(); scheduleSave(); renderAll();
}

function deleteLayer(i, e) {
  e && e.stopPropagation();
  if (!confirm(`Delete layer "${state.layers[i].name}"?`)) return;
  state.layers.splice(i, 1);
  activeLayerIdx = Math.min(activeLayerIdx, Math.max(0, state.layers.length - 1));
  selectedItemIdx = null;
  pushHistory(); scheduleSave(); renderAll();
}

function layerUp(i, e) {
  e && e.stopPropagation();
  if (i >= state.layers.length - 1) return;
  [state.layers[i], state.layers[i+1]] = [state.layers[i+1], state.layers[i]];
  if (activeLayerIdx === i) activeLayerIdx = i + 1;
  else if (activeLayerIdx === i+1) activeLayerIdx = i;
  pushHistory(); scheduleSave(); renderAll();
}

function layerDown(i, e) {
  e && e.stopPropagation();
  if (i === 0) return;
  [state.layers[i], state.layers[i-1]] = [state.layers[i-1], state.layers[i]];
  if (activeLayerIdx === i) activeLayerIdx = i - 1;
  else if (activeLayerIdx === i-1) activeLayerIdx = i;
  pushHistory(); scheduleSave(); renderAll();
}

function toggleVis(i, e) {
  e && e.stopPropagation();
  state.layers[i].visible = state.layers[i].visible === false ? true : false;
  pushHistory(); scheduleSave(); renderLayerList();
}

function renameLayer(name) {
  if (!state.layers[activeLayerIdx]) return;
  state.layers[activeLayerIdx].name = name;
  scheduleSave(); renderLayerList();
}

function changeLayerType(type) {
  const layer = state.layers[activeLayerIdx];
  if (!layer) return;
  layer.type = type;
  if (type === 'carousel' && !layer.x) {
    Object.assign(layer, { x: 80, y: 80, w: 400, h: 300 });
  }
  pushHistory(); scheduleSave(); renderAll();
}

function updateLayerProp(key, val) {
  const layer = state.layers[activeLayerIdx];
  if (!layer) return;
  layer[key] = val;
  scheduleSave(); renderCanvas();
}

// ─── Item Operations ──────────────────────────────────────────────────────────

function selectItem(i) {
  selectedItemIdx = i;
  renderCanvas(); renderProps();
}

function updateActiveItem(key, val) {
  const layer = state.layers[activeLayerIdx];
  if (!layer) return;

  let idx = selectedItemIdx;
  if (layer.type === 'carousel' && selectedItemIdx !== null && selectedItemIdx > 0) idx = selectedItemIdx - 1;
  if (idx === null || !layer.items[idx]) return;

  layer.items[idx][key] = val;
  scheduleSave(); renderCanvas(); renderProps();
}

function deleteItem(i, e) {
  e && e.stopPropagation();
  const layer = state.layers[activeLayerIdx];
  if (!layer) return;
  layer.items.splice(i, 1);
  selectedItemIdx = null;
  pushHistory(); scheduleSave(); renderAll();
}

function itemMoveUp(i, e) {
  e && e.stopPropagation();
  const items = state.layers[activeLayerIdx]?.items;
  if (!items || i === 0) return;
  [items[i], items[i-1]] = [items[i-1], items[i]];
  selectedItemIdx = i - 1;
  pushHistory(); scheduleSave(); renderAll();
}

function itemMoveDown(i, e) {
  e && e.stopPropagation();
  const items = state.layers[activeLayerIdx]?.items;
  if (!items || i >= items.length - 1) return;
  [items[i], items[i+1]] = [items[i+1], items[i]];
  selectedItemIdx = i + 1;
  pushHistory(); scheduleSave(); renderAll();
}

function pushItem(src, type, duration) {
  const layer = state.layers[activeLayerIdx];
  if (!layer) return;
  const item = {
    id: 'i' + Date.now(), type, src,
    x: 80, y: 80,
    w: layer.type === 'background' ? CW() : (layer.w || 400),
    h: layer.type === 'background' ? CH() : (layer.h || 300),
    duration: duration || 5,
    fit: 'contain',
  };
  layer.items.push(item);
  selectedItemIdx = layer.items.length - 1;
  pushHistory(); scheduleSave(); renderAll();
}

function addColorItem() {
  const layer = state.layers[activeLayerIdx];
  if (!layer) return;
  layer.items.push({ id: 'i' + Date.now(), type: 'color', color: '#1a1a2e', src: '', x: 0, y: 0, w: CW(), h: CH(), duration: 5 });
  selectedItemIdx = layer.items.length - 1;
  pushHistory(); scheduleSave(); renderAll();
}

async function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const duration = +(document.getElementById('addDuration')?.value) || 5;

  const area = document.getElementById('uploadArea');
  if (area) { area.classList.add('uploading'); area.querySelector('.upload-hint').textContent = 'Uploading…'; }

  const data = await apiUpload(file);
  const type = file.type.startsWith('video') ? 'video' : 'image';
  pushItem(data.path, type, duration);

  if (area) { area.classList.remove('uploading'); area.querySelector('.upload-hint').textContent = 'Drop file or click to browse'; }
  input.value = '';
}

function dragOver(e)  { e.preventDefault(); document.getElementById('uploadArea')?.classList.add('drag-over'); }
function dragLeave()  { document.getElementById('uploadArea')?.classList.remove('drag-over'); }

function dropFile(e) {
  e.preventDefault();
  document.getElementById('uploadArea')?.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect({ files: [file] });
}

function addItemFromUrl() {
  const url = document.getElementById('urlInput')?.value.trim();
  const dur = +(document.getElementById('addDuration')?.value) || 5;
  if (!url) return;
  const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
  const isImg   = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  pushItem(url, isVideo ? 'video' : isImg ? 'image' : 'url', dur);
  document.getElementById('urlInput').value = '';
}

// ─── Add Layer Menu ───────────────────────────────────────────────────────────

function toggleAddMenu(e) {
  e && e.stopPropagation();
  document.getElementById('addLayerMenu').classList.toggle('hidden');
}

document.addEventListener('click', e => {
  const menu = document.getElementById('addLayerMenu');
  if (menu && !menu.contains(e.target) && !e.target.classList.contains('add-btn'))
    menu.classList.add('hidden');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escHtml(s) { return String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ─── Boot ─────────────────────────────────────────────────────────────────────

init();

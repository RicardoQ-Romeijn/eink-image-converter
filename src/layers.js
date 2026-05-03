function toLayerLocal(layer, cx, cy) {
  const w = layer.image.width * layer.scale / 100;
  const h = layer.image.height * layer.scale / 100;
  const centerX = layer.x + w / 2;
  const centerY = layer.y + h / 2;
  const rad = -(layer.rotation || 0) * Math.PI / 180;
  const dx = cx - centerX;
  const dy = cy - centerY;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + w / 2;
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + h / 2;
  return { lx, ly, w, h };
}

// ----- File loading
async function loadFiles(fileList) {
  // Snapshot the FileList before we await anything. Both
  // `<input type=file>.files` and `DataTransfer.files` are *live*, and
  // some browsers release File handles after the input is cleared.
  const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;

  // Kick off every load in parallel. This calls URL.createObjectURL on each
  // File immediately (synchronously), so the blob URLs are established
  // before any subsequent reset of the input can release them.
  const loaders = files.map(f =>
    loadImage(f).then(img => ({ img, name: f.name }), err => ({ err, name: f.name }))
  );

  // Wait for them all and add in the original order so layer z-order
  // matches selection order in the file dialog.
  const results = await Promise.all(loaders);
  for (const r of results) {
    if (r.img) addLayer(r.img, r.name);
    else console.error('image load failed:', r.name, r.err);
  }
  scheduleRender();
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
function addLayer(image, name) {
  const fitScale = Math.min(W / image.width, H / image.height) * 100;
  const scale = Math.min(100, fitScale * 0.8);
  const w = image.width * scale / 100;
  const h = image.height * scale / 100;
  const offset = layers.length * 30;
  pushHistory();
  const layer = {
    id: nextId++,
    image, name,
    x: Math.max(0, Math.min(W - w, (W - w) / 2 + offset)),
    y: Math.max(0, Math.min(H - h, (H - h) / 2 + offset)),
    scale,
    rotation: 0,
    bg: { enabled: false, color: null, tolerance: 30, feather: 20 },
    _processedCanvas: null,
    _processedKey: '',
  };
  layers.push(layer);
  selectLayer(layer.id);
  rebuildLayerList();
}

// ----- Layer operations
function selectedLayer() {
  return layers.find(l => l.id === selectedId) || null;
}
function selectLayer(id) {
  selectedId = id;
  rebuildLayerList();
  updateSelectedUI();
  scheduleRender();
}

function updateSelectedUI() {
  const layer = selectedLayer();
  $('layerEmpty').classList.toggle('hidden', !!layer);
  $('selHead').classList.toggle('hidden', !layer);
  $('selControls').classList.toggle('hidden', !layer);
  $('selControlsRot').classList.toggle('hidden', !layer);
  $('selControls2').classList.toggle('hidden', !layer);
  $('bgHead').classList.toggle('hidden', !layer);
  $('bgControls').classList.toggle('hidden', !layer);
  const showBg = layer && layer.bg.enabled;
  $('bgControls2').classList.toggle('hidden', !showBg);
  $('bgControls3').classList.toggle('hidden', !showBg);
  if (layer) {
    const s = Math.round(layer.scale);
    $('scale').value = s;
    $('scaleVal').value = s;
    $('rotation').value = layer.rotation;
    $('rotationVal').value = Math.round(layer.rotation);
    $('bgEnable').checked = layer.bg.enabled;
    $('bgTolerance').value = layer.bg.tolerance;
    $('bgToleranceVal').value = layer.bg.tolerance;
    $('bgFeather').value = layer.bg.feather;
    $('bgFeatherVal').value = layer.bg.feather;
    updateSwatch(layer.bg.color);
  }
  if (!layer) setPickMode(false);
}

function updateSwatch(color) {
  const sw = $('bgSwatch');
  if (!color) {
    sw.style.background = 'repeating-conic-gradient(#9999 0 25%, #ddd5 0 50%) 0 0 / 8px 8px';
    sw.title = 'auto (samples image corners)';
  } else {
    sw.style.background = `rgb(${color.r}, ${color.g}, ${color.b})`;
    sw.title = `rgb(${color.r}, ${color.g}, ${color.b})`;
  }
}

function setPickMode(on) {
  pickMode = on && selectedLayer() !== null;
  $('bgPick').textContent = pickMode ? 'Cancel' : 'Pick';
  canvas.style.cursor = pickMode ? 'crosshair' : '';
}

function deleteLayer(id) {
  const i = layers.findIndex(l => l.id === id);
  if (i < 0) return;
  pushHistory();
  layers.splice(i, 1);
  if (selectedId === id) selectedId = null;
  rebuildLayerList();
  updateSelectedUI();
  scheduleRender();
}

function moveLayer(id, dir) {
  const i = layers.findIndex(l => l.id === id);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= layers.length) return;
  pushHistory();
  [layers[i], layers[j]] = [layers[j], layers[i]];
  rebuildLayerList();
  scheduleRender();
}

// Drop layer A onto layer B's position.
function reorderLayer(draggedId, targetId) {
  const fromIdx = layers.findIndex(l => l.id === draggedId);
  const toIdx   = layers.findIndex(l => l.id === targetId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  pushHistory();
  const [moved] = layers.splice(fromIdx, 1);
  // toIdx might shift after the splice — recompute.
  const insertAt = layers.findIndex(l => l.id === targetId);
  layers.splice(insertAt, 0, moved);
  rebuildLayerList();
  scheduleRender();
}

function rebuildLayerList() {
  const list = $('layers');
  list.innerHTML = '';
  if (!layers.length) {
    list.innerHTML = '<div class="empty">No layers yet</div>';
    canvas.classList.remove('pan');
    return;
  }
  canvas.classList.add('pan');
  // Render top-most first; visual order = reverse of array order.
  [...layers].reverse().forEach(layer => {
    const el = document.createElement('div');
    el.className = 'layer' + (layer.id === selectedId ? ' selected' : '');
    el.dataset.id = layer.id;
    el.draggable = true;

    const grip = document.createElement('span');
    grip.className = 'grip';
    grip.textContent = '⋮⋮';
    grip.title = 'Drag to reorder';
    el.appendChild(grip);

    const thumb = document.createElement('canvas');
    thumb.width = 48; thumb.height = 32;
    const tctx = thumb.getContext('2d');
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, 48, 32);
    const ts = Math.min(48 / layer.image.width, 32 / layer.image.height);
    const tw = layer.image.width * ts;
    const th = layer.image.height * ts;
    tctx.drawImage(layer.image, (48 - tw) / 2, (32 - th) / 2, tw, th);
    el.appendChild(thumb);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = layer.name;
    el.appendChild(name);

    const actions = document.createElement('span');
    actions.className = 'actions';
    const up = document.createElement('button');
    up.textContent = '↑'; up.title = 'Bring forward';
    up.addEventListener('click', e => { e.stopPropagation(); moveLayer(layer.id, +1); });
    const down = document.createElement('button');
    down.textContent = '↓'; down.title = 'Send backward';
    down.addEventListener('click', e => { e.stopPropagation(); moveLayer(layer.id, -1); });
    const del = document.createElement('button');
    del.textContent = '×'; del.title = 'Delete (Del)';
    del.addEventListener('click', e => { e.stopPropagation(); deleteLayer(layer.id); });
    actions.append(up, down, del);
    el.appendChild(actions);

    el.addEventListener('click', () => selectLayer(layer.id));

    // ---- HTML5 drag-to-reorder ----
    el.addEventListener('dragstart', e => {
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(layer.id));
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.layer.drop-target').forEach(n => n.classList.remove('drop-target'));
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drop-target');
      const draggedId = +e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== layer.id) reorderLayer(draggedId, layer.id);
    });

    list.appendChild(el);
  });
}

// ----- Background removal (chroma-key with feather)
function samplePixel(image, x, y) {
  const cvs = document.createElement('canvas');
  cvs.width = image.naturalWidth; cvs.height = image.naturalHeight;
  const c = cvs.getContext('2d', { willReadFrequently: true });
  c.drawImage(image, 0, 0);
  const d = c.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2] };
}

function autoDetectBackground(image) {
  const cvs = document.createElement('canvas');
  cvs.width = image.naturalWidth; cvs.height = image.naturalHeight;
  const c = cvs.getContext('2d', { willReadFrequently: true });
  c.drawImage(image, 0, 0);
  const corners = [
    [0, 0], [cvs.width - 1, 0], [0, cvs.height - 1], [cvs.width - 1, cvs.height - 1],
  ];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of corners) {
    const d = c.getImageData(x, y, 1, 1).data;
    r += d[0]; g += d[1]; b += d[2];
  }
  return { r: Math.round(r / 4), g: Math.round(g / 4), b: Math.round(b / 4) };
}

function drawSourceFor(layer) {
  if (!layer.bg.enabled || !layer.bg.color) return layer.image;
  const { color, tolerance, feather } = layer.bg;
  const key = `${color.r},${color.g},${color.b},${tolerance},${feather}`;
  if (layer._processedKey === key && layer._processedCanvas) return layer._processedCanvas;
  const cvs = document.createElement('canvas');
  cvs.width = layer.image.naturalWidth;
  cvs.height = layer.image.naturalHeight;
  const c = cvs.getContext('2d', { willReadFrequently: true });
  c.drawImage(layer.image, 0, 0);
  const data = c.getImageData(0, 0, cvs.width, cvs.height);
  const px = data.data;
  const core = tolerance;
  const outer = tolerance + feather;
  const core2 = core * core;
  const outer2 = outer * outer;
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - color.r;
    const dg = px[i + 1] - color.g;
    const db = px[i + 2] - color.b;
    const d2 = dr * dr + dg * dg + db * db;
    if (d2 <= core2) {
      px[i + 3] = 0;
    } else if (d2 < outer2) {
      const d = Math.sqrt(d2);
      const a = (d - core) / feather;
      px[i + 3] = Math.round(px[i + 3] * a);
    }
  }
  c.putImageData(data, 0, 0);
  layer._processedCanvas = cvs;
  layer._processedKey = key;
  return cvs;
}

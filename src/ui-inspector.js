const commitScale = v => {
  const layer = selectedLayer();
  if (!layer) return;
  v = Math.max(1, Math.min(500, Number.isFinite(v) ? v : 100));
  const oldW = layer.image.width * layer.scale / 100;
  const oldH = layer.image.height * layer.scale / 100;
  const newW = layer.image.width * v / 100;
  const newH = layer.image.height * v / 100;
  layer.x += (oldW - newW) / 2;
  layer.y += (oldH - newH) / 2;
  layer.scale = v;
  $('scale').value = v;
  $('scaleVal').value = v;
  scheduleRender();
};
$('scale').addEventListener('input', e => commitScale(+e.target.value));
$('scaleVal').addEventListener('change', e => commitScale(+e.target.value));

const commitRotation = v => {
  const layer = selectedLayer();
  if (!layer) return;
  if (!Number.isFinite(v)) v = 0;
  v = ((v + 180) % 360 + 360) % 360 - 180;
  layer.rotation = v;
  $('rotation').value = v;
  $('rotationVal').value = Math.round(v);
  scheduleRender();
};
$('rotation').addEventListener('input', e => commitRotation(+e.target.value));
$('rotationVal').addEventListener('change', e => commitRotation(+e.target.value));
$('rotate90').addEventListener('click', () => {
  const layer = selectedLayer();
  if (!layer) return;
  pushHistory();
  commitRotation(layer.rotation + 90);
});
$('rotateReset').addEventListener('click', () => { pushHistory(); commitRotation(0); });

$('center').addEventListener('click', () => {
  const layer = selectedLayer();
  if (!layer) return;
  pushHistory();
  const w = layer.image.width * layer.scale / 100;
  const h = layer.image.height * layer.scale / 100;
  layer.x = (W - w) / 2;
  layer.y = (H - h) / 2;
  scheduleRender();
});

$('fit').addEventListener('click', () => {
  const layer = selectedLayer();
  if (!layer) return;
  pushHistory();
  const s = Math.min(W / layer.image.width, H / layer.image.height) * 100;
  const newW = layer.image.width * s / 100;
  const newH = layer.image.height * s / 100;
  layer.scale = s;
  layer.x = (W - newW) / 2;
  layer.y = (H - newH) / 2;
  $('scale').value = Math.round(s);
  $('scaleVal').value = Math.round(s);
  scheduleRender();
});

$('bgEnable').addEventListener('change', e => {
  const layer = selectedLayer();
  if (!layer) return;
  pushHistory();
  layer.bg.enabled = e.target.checked;
  if (layer.bg.enabled && !layer.bg.color) {
    layer.bg.color = autoDetectBackground(layer.image);
  }
  updateSelectedUI();
  scheduleRender();
});
const commitBgField = (field, min, max, sliderId, inputId) => v => {
  const layer = selectedLayer();
  if (!layer) return;
  v = Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));
  layer.bg[field] = v;
  $(sliderId).value = v;
  $(inputId).value = v;
  scheduleRender();
};
const commitTolerance = commitBgField('tolerance', 0, 255, 'bgTolerance', 'bgToleranceVal');
const commitFeather   = commitBgField('feather',   0, 200, 'bgFeather',   'bgFeatherVal');
$('bgTolerance').addEventListener('input', e => commitTolerance(+e.target.value));
$('bgToleranceVal').addEventListener('change', e => commitTolerance(+e.target.value));
$('bgFeather').addEventListener('input', e => commitFeather(+e.target.value));
$('bgFeatherVal').addEventListener('change', e => commitFeather(+e.target.value));

// Snapshot before any per-layer slider drag — undo restores pre-drag state.
// pointerdown covers mouse + touch + stylus in one shot.
['scale', 'rotation', 'bgTolerance', 'bgFeather'].forEach(id => {
  $(id).addEventListener('pointerdown', () => {
    if (selectedLayer()) pushHistory();
  });
});

$('bgAuto').addEventListener('click', () => {
  const layer = selectedLayer();
  if (!layer) return;
  pushHistory();
  layer.bg.color = autoDetectBackground(layer.image);
  updateSwatch(layer.bg.color);
  scheduleRender();
});
$('bgPick').addEventListener('click', () => {
  if (!selectedLayer()) return;
  setPickMode(!pickMode);
});

$('resetGlobals').addEventListener('click', () => {
  const prevDisplayIndex = globals.displayIndex;
  const prevPortrait = globals.portrait;
  Object.assign(globals, GLOBAL_DEFAULTS);
  globals.displayIndex = prevDisplayIndex;
  globals.portrait = prevPortrait;
  syncControlsFromGlobals();
  scheduleRender();
  saveSettings();
});

$('clearAll').addEventListener('click', () => {
  if (!layers.length) return;
  if (!confirm(`Remove all ${layers.length} layer(s)?`)) return;
  pushHistory();
  layers = [];
  selectedId = null;
  rebuildLayerList();
  updateSelectedUI();
  scheduleRender();
});

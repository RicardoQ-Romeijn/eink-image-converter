// ----- Quick-start device profiles
function _findDisplayIndex(w, h) {
  return DISPLAYS.findIndex(d => d.w === w && d.h === h);
}
const PROFILES = [
  {
    name: 'TRMNL B&W',
    sub: '800×480 · 1-bit',
    apply: () => Object.assign(globals, {
      outputMode: '1bit', dither: 'fs', fsStrength: 100,
      gamma: false, background: 'white', invert: false, saturation: 100,
      displayIndex: Math.max(0, _findDisplayIndex(800, 480)), portrait: false,
    }),
  },
  {
    name: 'Waveshare 7.5" B+W+Red',
    sub: '800×480 · 4-bit indexed',
    apply: () => Object.assign(globals, {
      outputMode: '2bit-bw-red', perceptual: true, gamma: true,
      dither: 'fs', fsStrength: 100, saturation: 160,
      background: 'white', invert: false,
      displayIndex: Math.max(0, _findDisplayIndex(800, 480)), portrait: false,
    }),
  },
  {
    name: 'PhotoPainter 7-color',
    sub: '800×480 · 24-bit',
    apply: () => Object.assign(globals, {
      outputMode: '7color', perceptual: true, gamma: true,
      dither: 'fs', fsStrength: 100, saturation: 180,
      background: 'white', invert: false,
      displayIndex: Math.max(0, _findDisplayIndex(800, 480)), portrait: false,
    }),
  },
  {
    name: 'Waveshare 5.65" 7-color',
    sub: '600×448 · 24-bit',
    apply: () => Object.assign(globals, {
      outputMode: '7color', perceptual: true, gamma: true,
      dither: 'fs', fsStrength: 100, saturation: 180,
      background: 'white', invert: false,
      displayIndex: Math.max(0, _findDisplayIndex(600, 448)), portrait: false,
    }),
  },
];

// Populate display preset dropdown
const displaySelect = $('displayPreset');
DISPLAYS.forEach((d, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = d.name;
  displaySelect.appendChild(opt);
});

bindSelect('background', 'background');
bindSelect('dither', 'dither', updateDitherUI);
bindRange('brightness', 'brightness', 'brightnessVal');
bindRange('contrast', 'contrast', 'contrastVal');
bindRange('saturation', 'saturation', 'saturationVal');
bindRange('fsStrength', 'fsStrength', 'fsStrengthVal');
bindRange('threshold', 'threshold', 'thresholdVal');
bindCheckbox('invert', 'invert');
bindSelect('outputMode', 'outputMode', () => { updateDitherUI(); updateColorModeUI(); refreshPaletteSwatches(); });
bindCheckbox('perceptual', 'perceptual');
bindCheckbox('gamma', 'gamma');

$('displayPreset').addEventListener('change', e => {
  globals.displayIndex = +e.target.value;
  applyDisplay();
  saveSettings();
});
$('portrait').addEventListener('change', e => {
  globals.portrait = e.target.checked;
  applyDisplay();
  saveSettings();
});

// Read the selected preset (+ portrait toggle) and resize canvases.
function applyDisplay() {
  const d = DISPLAYS[globals.displayIndex] || DISPLAYS[0];
  W = globals.portrait ? d.h : d.w;
  H = globals.portrait ? d.w : d.h;
  offCanvas.width = W;
  offCanvas.height = H;
  srcCanvas.width = W;
  srcCanvas.height = H;
  syncDisplayCanvasSize();
  scheduleRender();
}


// ----- Quick-start profile buttons
function applyProfile(profile) {
  profile.apply();
  syncControlsFromGlobals();
  applyDisplay();
  saveSettings();
}
function syncControlsFromGlobals() {
  $('background').value = globals.background;
  $('dither').value = globals.dither;
  $('invert').checked = globals.invert;
  $('outputMode').value = globals.outputMode;
  $('perceptual').checked = globals.perceptual;
  $('gamma').checked = globals.gamma;
  $('brightness').value = globals.brightness;     $('brightnessVal').value = globals.brightness;
  $('contrast').value = globals.contrast;         $('contrastVal').value = globals.contrast;
  $('saturation').value = globals.saturation;     $('saturationVal').value = globals.saturation;
  $('fsStrength').value = globals.fsStrength;     $('fsStrengthVal').value = globals.fsStrength;
  $('threshold').value = globals.threshold;       $('thresholdVal').value = globals.threshold;
  $('displayPreset').value = globals.displayIndex;
  $('portrait').checked = globals.portrait;
  updateDitherUI();
  updateColorModeUI();
  refreshPaletteSwatches();
}
// ----- Preset popover (replaces the old pill row)
const presetBtn  = $('presetBtn');
const presetMenu = $('presetMenu');
PROFILES.forEach(p => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'preset-item';
  b.role = 'menuitem';
  b.innerHTML = `<strong>${p.name}</strong><span>${p.sub}</span>`;
  b.title = `Apply "${p.name}" preset — replaces display, dither, tone & colour settings.`;
  b.addEventListener('click', () => {
    applyProfile(p);
    closePresetMenu();
  });
  presetMenu.appendChild(b);
});
function openPresetMenu() {
  presetMenu.classList.remove('hidden');
  presetBtn.setAttribute('aria-expanded', 'true');
}
function closePresetMenu() {
  presetMenu.classList.add('hidden');
  presetBtn.setAttribute('aria-expanded', 'false');
}
presetBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (presetMenu.classList.contains('hidden')) openPresetMenu();
  else closePresetMenu();
});
// Close on outside click or Escape.
document.addEventListener('click', e => {
  if (!presetMenu.classList.contains('hidden') &&
      !presetMenu.contains(e.target) &&
      e.target !== presetBtn) {
    closePresetMenu();
  }
});

// ----- Undo/redo header buttons
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);

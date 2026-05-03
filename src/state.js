// ----- Per-layer data
let layers = [];
let nextId = 1;
let selectedId = null;
let pickMode = false;

const GLOBAL_DEFAULTS = {
  background: 'white',
  brightness: 0,
  contrast: 0,
  saturation: 100,
  invert: false,
  dither: 'fs',
  fsStrength: 100,
  threshold: 128,
  outputMode: '1bit',         // '1bit' | '4gray' | '2bit-bw-red' | '2bit-bw-yellow' | '7color'
  perceptual: true,
  gamma: false,
  displayIndex: 0,
  portrait: false,
};
const globals = { ...GLOBAL_DEFAULTS };

// ----- Persistence
const LS_KEY = 'bmp_merge_settings_v1';
let _saveTimer = null;
function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const k of Object.keys(GLOBAL_DEFAULTS)) {
      if (k in data) globals[k] = data[k];
    }
    // Migration: legacy schema used a boolean `sevenColor`. Map it forward
    // so existing users keep their previous mode after this update.
    if (!('outputMode' in data) && 'sevenColor' in data) {
      globals.outputMode = data.sevenColor ? '7color' : '1bit';
    }
    // Defensive: if outputMode is unknown (e.g. future version was loaded
    // and rolled back), fall back to 1-bit instead of crashing render().
    if (!OUTPUT_MODES[globals.outputMode]) globals.outputMode = '1bit';
  } catch (_) { /* corrupt JSON → ignore, defaults stand */ }
}
function saveSettings() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      const out = {};
      for (const k of Object.keys(GLOBAL_DEFAULTS)) out[k] = globals[k];
      localStorage.setItem(LS_KEY, JSON.stringify(out));
    } catch (_) { /* quota / disabled — silent */ }
  }, 200);
}

// ----- Before/after peek
let peekMode = false;

let bmpBlob = null;
let renderPending = false;

const $ = id => document.getElementById(id);



// Render palette swatches next to the Output dropdown — re-rendered every
// time the mode changes so the user sees exactly which colours will land
// in the BMP.
const swatchHost = $('paletteSwatches');
function refreshPaletteSwatches() {
  const mode = OUTPUT_MODES[globals.outputMode] || OUTPUT_MODES['1bit'];
  swatchHost.innerHTML = '';
  for (const p of mode.palette) {
    const s = document.createElement('span');
    s.style.background = `rgb(${p.r}, ${p.g}, ${p.b})`;
    s.title = `rgb(${p.r}, ${p.g}, ${p.b})`;
    swatchHost.appendChild(s);
  }
}

// ----- UI wiring
const bindRange = (id, key, out, target = globals) => {
  const slider = $(id);
  const input = $(out);
  const commit = v => {
    v = Math.max(+slider.min, Math.min(+slider.max, Number.isFinite(v) ? v : 0));
    target[key] = v;
    slider.value = v;
    input.value = v;
    scheduleRender();
    if (target === globals) saveSettings();
  };
  slider.addEventListener('input', e => commit(+e.target.value));
  input.addEventListener('change', e => commit(+e.target.value));
};
const bindSelect = (id, key, extra) => {
  $(id).addEventListener('change', e => {
    globals[key] = e.target.value;
    if (extra) extra();
    scheduleRender();
    saveSettings();
  });
};
const bindCheckbox = (id, key, extra) => {
  $(id).addEventListener('change', e => {
    globals[key] = e.target.checked;
    if (extra) extra();
    scheduleRender();
    saveSettings();
  });
};

// ----- Colour-mode-only controls — saturation only matters when the
// output palette has chromatic entries (7-color, B+W+Red, B+W+Yellow).
function updateColorModeUI() {
  const mode = OUTPUT_MODES[globals.outputMode] || OUTPUT_MODES['1bit'];
  $('saturationLabel').classList.toggle('hidden', !mode.chromatic);
}

function updateDitherUI() {
  const isErrorDiffusion = ERROR_DIFFUSION_KEYS.has(globals.dither);
  const isThreshold = globals.dither === 'none';
  $('diffStrengthLabel').classList.toggle('hidden', !isErrorDiffusion);
  // Threshold is a 1-bit-only concept (single cut between black & white).
  $('thresholdLabel').classList.toggle('hidden', !isThreshold || globals.outputMode !== '1bit');
}


function setStatus(msg, kind) {
  $('status').textContent = msg;
  $('status').className = 'status' + (kind ? ' ' + kind : '');
}

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const offCanvas = document.createElement('canvas');
offCanvas.width = W; offCanvas.height = H;
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
// The source canvas holds the final dither output at the panel's native
// resolution (W×H). The visible #preview canvas is sized to its on-screen
// pixel box and gets `srcCanvas` blitted into it with imageSmoothing off,
// so the user always sees true nearest-neighbor scaling. CSS
// `image-rendering: pixelated` only specifies nearest-neighbor for upscale
// — Chromium falls back to bilinear when downscaling, which turns dither
// patterns into moire. Doing the scale ourselves avoids that.
const srcCanvas = document.createElement('canvas');
srcCanvas.width = W; srcCanvas.height = H;
const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });

// Size the visible #preview canvas's bitmap to match its CSS box in
// device pixels — this is what lets us avoid the browser doing a
// fractional bilinear downscale of the source. Width drives; height is
// locked to the source W:H aspect so the bitmap can't drift away from
// the panel ratio across resize cycles. Returns true if it changed.
function syncDisplayCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  if (cssW <= 0) return false;
  const bmpW = Math.max(1, Math.round(cssW * dpr));
  const bmpH = Math.max(1, Math.round(bmpW * H / W));
  if (canvas.width !== bmpW || canvas.height !== bmpH) {
    canvas.width = bmpW;
    canvas.height = bmpH;
    return true;
  }
  return false;
}

// Paint srcCanvas onto the visible canvas with explicit nearest-neighbor.
function blitToDisplay() {
  syncDisplayCanvasSize();
  if (canvas.width === 0 || canvas.height === 0) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(srcCanvas, 0, 0, canvas.width, canvas.height);
}

// Re-blit when the canvas's CSS box changes (window resize, rail collapse).
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    if (syncDisplayCanvasSize()) blitToDisplay();
  }).observe(canvas);
}
window.addEventListener('resize', () => { if (syncDisplayCanvasSize()) blitToDisplay(); });

// ----- Render pipeline
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; render(); });
}

function render() {
  offCtx.fillStyle = globals.background === 'black' ? '#000' : '#fff';
  offCtx.fillRect(0, 0, W, H);

  for (const layer of layers) {
    const w = layer.image.width * layer.scale / 100;
    const h = layer.image.height * layer.scale / 100;
    const source = drawSourceFor(layer);
    const rot = layer.rotation || 0;
    if (rot === 0) {
      offCtx.drawImage(source, layer.x, layer.y, w, h);
    } else {
      offCtx.save();
      offCtx.translate(layer.x + w / 2, layer.y + h / 2);
      offCtx.rotate(rot * Math.PI / 180);
      offCtx.drawImage(source, -w / 2, -h / 2, w, h);
      offCtx.restore();
    }
  }

  if (!layers.length) {
    srcCtx.fillStyle = globals.background === 'black' ? '#000' : '#fff';
    srcCtx.fillRect(0, 0, W, H);
    blitToDisplay();
    bmpBlob = null;
    $('download').disabled = true;
    setStatus('Drop, paste, or click to add an image', null);
    return;
  }

  // While spacebar is held, blit the un-dithered composite directly.
  if (peekMode) {
    srcCtx.drawImage(offCanvas, 0, 0);
    blitToDisplay();
    drawSelectionOverlay();
    setStatus(`PEEK · un-dithered composite (release space to dither)`, 'warn');
    return;
  }

  const imageData = offCtx.getImageData(0, 0, W, H);
  const mode = OUTPUT_MODES[globals.outputMode] || OUTPUT_MODES['1bit'];

  if (mode.encoder === 'bmp1') {
    const gray = toGrayscale(imageData, globals);
    const bits = dither1bit(gray, globals);
    paintPreviewBits(bits);
    drawSelectionOverlay();
    bmpBlob = buildBmp1(bits);
    $('download').disabled = false;
    const isTrmnl = (W === TRMNL_W && H === TRMNL_H && bmpBlob.size === TRMNL_BMP_SIZE);
    setStatus(
      `${layers.length} layer(s) · ${W}×${H} · ${bmpBlob.size.toLocaleString()} B · 1-bit BMP${isTrmnl ? ' ✓ matches Terminus / TRMNL' : ''}`,
      isTrmnl ? 'ok' : 'warn',
    );
  } else if (mode.encoder === 'bmp24') {
    const rgb = quantize7(imageData, globals);
    paintPreviewRGB(rgb);
    drawSelectionOverlay();
    bmpBlob = buildBmp24(rgb);
    $('download').disabled = false;
    const isPhotoPainter = (W === 800 && H === 480) || (W === 480 && H === 800);
    setStatus(
      `${layers.length} layer(s) · ${W}×${H} · ${bmpBlob.size.toLocaleString()} B · 24-bit BMP (${mode.name})${isPhotoPainter ? ' ✓ matches Waveshare PhotoPainter' : ''}`,
      isPhotoPainter ? 'ok' : 'warn',
    );
  } else {
    // bmp4 — indexed 4-bit BMP for 4-gray and the 2-bit accent modes.
    const indices = quantizeIndexed(imageData, mode.palette, globals);
    paintPreviewIndexed(indices, mode.palette);
    drawSelectionOverlay();
    bmpBlob = buildBmp4(indices, mode.palette);
    $('download').disabled = false;
    setStatus(
      `${layers.length} layer(s) · ${W}×${H} · ${bmpBlob.size.toLocaleString()} B · 4-bit BMP (${mode.name})`,
      'warn',
    );
  }
}

function paintPreviewBits(bits) {
  const preview = srcCtx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = bits[i] ? 255 : 0;
    preview.data[i * 4]     = v;
    preview.data[i * 4 + 1] = v;
    preview.data[i * 4 + 2] = v;
    preview.data[i * 4 + 3] = 255;
  }
  srcCtx.putImageData(preview, 0, 0);
  blitToDisplay();
}

function paintPreviewRGB(rgb) {
  const preview = srcCtx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    preview.data[i * 4]     = rgb[i * 3];
    preview.data[i * 4 + 1] = rgb[i * 3 + 1];
    preview.data[i * 4 + 2] = rgb[i * 3 + 2];
    preview.data[i * 4 + 3] = 255;
  }
  srcCtx.putImageData(preview, 0, 0);
  blitToDisplay();
}

function drawSelectionOverlay() {
  const sel = selectedLayer();
  if (!sel) return;
  const w = sel.image.width * sel.scale / 100;
  const h = sel.image.height * sel.scale / 100;
  const rot = sel.rotation || 0;
  // Coordinates from selection state are in source (W×H) space; the
  // visible canvas is sized in device pixels, so apply the matching
  // scale before stroking.
  const sx = canvas.width / W;
  const sy = canvas.height / H;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = '#2a7';
  ctx.lineWidth = 2 / Math.min(sx, sy);
  ctx.setLineDash([6 / Math.min(sx, sy), 4 / Math.min(sx, sy)]);
  if (rot === 0) {
    ctx.strokeRect(sel.x, sel.y, w, h);
  } else {
    ctx.translate(sel.x + w / 2, sel.y + h / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}



function paintPreviewIndexed(indices, palette) {
  const preview = srcCtx.createImageData(W, H);
  for (let i = 0; i < indices.length; i++) {
    const p = palette[indices[i]] || palette[0];
    preview.data[i * 4]     = p.r;
    preview.data[i * 4 + 1] = p.g;
    preview.data[i * 4 + 2] = p.b;
    preview.data[i * 4 + 3] = 255;
  }
  srcCtx.putImageData(preview, 0, 0);
  blitToDisplay();
}

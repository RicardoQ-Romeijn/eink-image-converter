// ----- Peek button (touch alternative for the spacebar peek shortcut).
// Hold to swap the preview to the un-dithered composite; release / cancel
// / pointer-leave restores the dither. Pointer capture keeps the up event
// arriving on the button even if the finger drifts off it.
const peekBtn = $('peekBtn');
function peekDown(e) {
  if (e) e.preventDefault();          // suppress synthetic mouse follow-on
  if (!peekMode) {
    peekMode = true;
    scheduleRender();
  }
  if (e && e.pointerId !== undefined) {
    try { peekBtn.setPointerCapture(e.pointerId); } catch (_) {}
  }
}
function peekUp() {
  if (peekMode) {
    peekMode = false;
    scheduleRender();
  }
}
peekBtn.addEventListener('pointerdown',  peekDown);
peekBtn.addEventListener('pointerup',    peekUp);
peekBtn.addEventListener('pointercancel', peekUp);
peekBtn.addEventListener('pointerleave', peekUp);


$('download').addEventListener('click', downloadBmp);

// ----- Canvas interaction (drag selected layer)


// Canvas drag uses pointer events so the same code path covers mouse,
// touch and stylus. setPointerCapture lets the move/up keep firing on the
// canvas even after the finger leaves the element, removing the need for
// window-level listeners. touch-action: none on the canvas (CSS) stops
// the browser's default scroll/zoom from stealing the gesture.
let dragState = null;
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary) return;          // ignore secondary fingers cleanly
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const cx = (e.clientX - rect.left) * scaleX;
  const cy = (e.clientY - rect.top)  * scaleY;

  if (pickMode) {
    const layer = selectedLayer();
    if (layer) {
      const { lx, ly, w, h } = toLayerLocal(layer, cx, cy);
      if (lx >= 0 && ly >= 0 && lx <= w && ly <= h) {
        const ix = Math.round(lx / w * layer.image.naturalWidth);
        const iy = Math.round(ly / h * layer.image.naturalHeight);
        if (ix >= 0 && iy >= 0 && ix < layer.image.naturalWidth && iy < layer.image.naturalHeight) {
          pushHistory();
          layer.bg.color = samplePixel(layer.image, ix, iy);
          if (!layer.bg.enabled) { layer.bg.enabled = true; updateSelectedUI(); }
          updateSwatch(layer.bg.color);
          scheduleRender();
        }
      }
    }
    setPickMode(false);
    return;
  }

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const { lx, ly, w, h } = toLayerLocal(layer, cx, cy);
    if (lx >= 0 && lx <= w && ly >= 0 && ly <= h) {
      selectLayer(layer.id);
      pushHistory();
      dragState = {
        offsetX: cx - layer.x, offsetY: cy - layer.y,
        scaleX, scaleY,
        layerId: layer.id,
        pointerId: e.pointerId,
        startX: layer.x, startY: layer.y,
      };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('panning');
      return;
    }
  }
  selectLayer(null);
});
canvas.addEventListener('pointermove', e => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * dragState.scaleX;
  const cy = (e.clientY - rect.top)  * dragState.scaleY;
  const layer = layers.find(l => l.id === dragState.layerId);
  if (!layer) return;
  layer.x = cx - dragState.offsetX;
  layer.y = cy - dragState.offsetY;
  scheduleRender();
});
function endCanvasDrag(e) {
  if (!dragState) return;
  if (e && e.pointerId !== dragState.pointerId) return;
  dragState = null;
  canvas.classList.remove('panning');
}
canvas.addEventListener('pointerup',     endCanvasDrag);
canvas.addEventListener('pointercancel', endCanvasDrag);  // iOS system-gesture interrupt


function downloadBmp() {
  if (!bmpBlob) return;
  const url = URL.createObjectURL(bmpBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `merged-${W}x${H}-${globals.outputMode}.bmp`;
  a.click();
  URL.revokeObjectURL(url);
}

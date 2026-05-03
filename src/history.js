// ----- Layer-level undo/redo
const HISTORY_LIMIT = 50;
let historyStack = [];
let redoStack = [];
function snapshot() {
  return {
    layers: layers.map(l => ({
      id: l.id,
      name: l.name,
      x: l.x, y: l.y,
      scale: l.scale,
      rotation: l.rotation,
      image: l.image,
      bg: {
        enabled:   l.bg.enabled,
        color:     l.bg.color ? { ...l.bg.color } : null,
        tolerance: l.bg.tolerance,
        feather:   l.bg.feather,
      },
      _processedCanvas: null,
      _processedKey: '',
    })),
    selectedId,
  };
}
function pushHistory() {
  historyStack.push(snapshot());
  if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
}
function applySnapshot(snap) {
  layers = snap.layers.map(l => ({ ...l, bg: { ...l.bg, color: l.bg.color ? { ...l.bg.color } : null } }));
  selectedId = snap.selectedId;
  rebuildLayerList();
  updateSelectedUI();
  scheduleRender();
}
function undo() {
  if (historyStack.length === 0) return;
  redoStack.push(snapshot());
  applySnapshot(historyStack.pop());
  syncHistoryButtons();
}
function redo() {
  if (redoStack.length === 0) return;
  historyStack.push(snapshot());
  applySnapshot(redoStack.pop());
  syncHistoryButtons();
}
function syncHistoryButtons() {
  const u = $('undoBtn'), r = $('redoBtn');
  if (u) u.disabled = historyStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

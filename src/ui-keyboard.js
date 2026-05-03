// Keyboard shortcuts:
//   Delete / Backspace — remove selected layer
//   R / Shift-R        — rotate selected layer ±90°
//   Ctrl/Cmd-Z         — undo
//   Ctrl-Shift-Z / Y   — redo
//   Space (held)       — peek un-dithered composite
window.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const isTextInput = inField && (tag === 'TEXTAREA' ||
      (tag === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')));
  if ((e.ctrlKey || e.metaKey) && !isTextInput) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { undo(); e.preventDefault(); return; }
    if ((k === 'z' && e.shiftKey) || k === 'y') { redo(); e.preventDefault(); return; }
  }
  if (inField) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId !== null) {
    deleteLayer(selectedId); e.preventDefault();
  } else if ((e.key === 'r' || e.key === 'R') && selectedId !== null) {
    const layer = selectedLayer();
    if (layer) { pushHistory(); commitRotation(layer.rotation + (e.shiftKey ? -90 : 90)); }
    e.preventDefault();
  } else if (e.code === 'Space' && !peekMode) {
    peekMode = true; scheduleRender(); e.preventDefault();
  } else if (e.key === 'Escape' && !presetMenu.classList.contains('hidden')) {
    closePresetMenu();
    presetBtn.focus();
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' && peekMode) {
    peekMode = false; scheduleRender(); e.preventDefault();
  }
});

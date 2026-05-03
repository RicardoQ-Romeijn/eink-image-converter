
// ----- File input + drop zone
$('file').addEventListener('change', e => {
  const inputEl = e.target;
  // Defer the value reset until *after* loadFiles finishes — some browsers
  // release File handles when the input clears, which would break loads
  // that are still in-flight inside the async loop.
  loadFiles(inputEl.files).finally(() => { inputEl.value = ''; });
});
const dropZone = $('drop');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('over');
  loadFiles(e.dataTransfer.files);
});

// ----- Clipboard paste
window.addEventListener('paste', e => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const files = [];
  for (const it of items) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length) {
    e.preventDefault();
    loadFiles(files);
  }
});

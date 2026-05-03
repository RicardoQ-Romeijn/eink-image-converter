// Same-origin upload of the current dither output to a Terminus admin form.
//
// Terminus exposes a screen-create form at GET /screens/new (HTML page with
// a hidden _csrf_token input + a <select name="screen[model_id]">). Submitting
// the form is a multipart/form-data POST /screens with screen[label],
// screen[name], screen[model_id], and screen[image] (the BMP).
//
// Both requests rely on the terminus.session cookie, which the browser only
// attaches automatically when the converter is served from the same origin
// as Terminus (e.g. trmnl.bamlab.nl/converter/). Anywhere else — file://, the
// GitHub Pages preview, any unrelated host — /screens/new doesn't exist and
// clicking the button would be a confusing dead end. We only show it when:
//
//   1. the page is being served over http/https (cookies can ride), AND
//   2. the path is mounted under /converter/ (matches the deployment doc;
//      excludes /eink-image-converter/ on github.io and any other prefix).
//
// If you ever mount the converter at a different path, change the regex
// below — or easier, host it under /converter/ on whichever Terminus origin
// you're using.

const TRMNL_UPLOAD_ENABLED =
  location.protocol !== 'file:' &&
  /^\/converter(\/|$)/.test(location.pathname);

if (TRMNL_UPLOAD_ENABLED) {
  const STORAGE_KEY = 'trmnl_upload_v1';
  // Form data scraped from /screens/new — { csrfToken, models: [{id,label}] }.
  // Re-fetched after each successful upload because some Hanami CSRF tokens
  // rotate per form submission.
  let formCache = null;

  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return {}; }
  };
  const savePrefs = (prefs) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
    catch (_) { /* quota / disabled */ }
  };

  // Fetch the screen-create page and lift out the values we need.
  async function fetchFormData() {
    const r = await fetch('/screens/new', { credentials: 'include' });
    if (!r.ok) {
      throw new Error(`/screens/new returned ${r.status} — are you logged in to Terminus?`);
    }
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const csrf = doc.querySelector('input[name="_csrf_token"]');
    if (!csrf || !csrf.value) {
      throw new Error('CSRF token not found on /screens/new');
    }
    const select = doc.querySelector('select[name="screen[model_id]"]');
    if (!select) {
      throw new Error('Model dropdown not found on /screens/new');
    }
    const models = Array.from(select.options)
      .filter(o => o.value)
      .map(o => ({ id: o.value, label: o.textContent.trim() }));
    if (!models.length) {
      throw new Error('No models configured in Terminus — create a model first.');
    }
    return { csrfToken: csrf.value, models };
  }

  // Take the selected layer's filename (or most recently added if none
  // selected) minus extension as the default label/name. Falls back to a
  // timestamp if no layers (button is also disabled then, but be defensive
  // in case state changes between modal open and send).
  function defaultName() {
    const sel = (typeof selectedLayer === 'function') ? selectedLayer() : null;
    const layer = sel || (Array.isArray(layers) && layers.length > 0 ? layers[layers.length - 1] : null);
    if (layer && layer.name) {
      return layer.name.replace(/\.[^.]+$/, '');
    }
    return 'image-' + new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
  }

  // Sanitize for use as an actual filename in the multipart payload. Terminus
  // doesn't care what we name it — the BMP bytes are what matters — but a
  // clean filename is nicer in server logs.
  function safeFilename(name) {
    const stem = (name || 'image').replace(/[^a-z0-9_.-]+/gi, '_').replace(/_+/g, '_');
    return (stem || 'image') + '.bmp';
  }

  let els = null;

  function setStatus(msg, kind /* 'info' | 'ok' | 'err' */) {
    els.status.textContent = msg;
    els.status.className = 'trmnl-modal-status' + (kind ? ' trmnl-modal-status--' + kind : '');
  }

  async function openModal() {
    if (!bmpBlob) {
      setStatus('Generate an image first.', 'err');
      return;
    }
    els.modal.classList.remove('hidden');
    setStatus('Loading form…', 'info');
    els.uploadBtn.disabled = true;
    try {
      formCache = await fetchFormData();
      const prefs = loadPrefs();
      els.modelSelect.innerHTML = '';
      for (const m of formCache.models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.label;
        if (prefs.modelId === m.id) opt.selected = true;
        els.modelSelect.appendChild(opt);
      }
      const fn = defaultName();
      els.label.value = fn;
      els.name.value = fn;
      setStatus('Ready.', 'info');
      els.uploadBtn.disabled = false;
      els.label.focus();
      els.label.select();
    } catch (err) {
      formCache = null;
      setStatus(err.message || String(err), 'err');
    }
  }

  function closeModal() {
    els.modal.classList.add('hidden');
  }

  async function doUpload() {
    if (!formCache) {
      setStatus('Form not loaded — close and reopen.', 'err');
      return;
    }
    if (!bmpBlob) {
      setStatus('No image generated yet.', 'err');
      return;
    }
    const label = els.label.value.trim();
    const name = els.name.value.trim();
    const modelId = els.modelSelect.value;
    if (!label || !name || !modelId) {
      setStatus('Label, name, and model are all required.', 'err');
      return;
    }
    els.uploadBtn.disabled = true;
    setStatus('Uploading…', 'info');

    const fd = new FormData();
    fd.append('_csrf_token', formCache.csrfToken);
    fd.append('screen[label]', label);
    fd.append('screen[name]', name);
    fd.append('screen[model_id]', modelId);
    fd.append('screen[image]', bmpBlob, safeFilename(name));

    try {
      const r = await fetch('/screens', {
        method: 'POST',
        body: fd,
        credentials: 'include',
        // Hanami responds with a 302 to /screens/:id on success; let the
        // browser follow it so r.ok reflects the final page.
        redirect: 'follow',
      });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}: ${body.slice(0, 200) || r.statusText}`);
      }
      // On validation failure Hanami re-renders /screens with errors inline
      // (still 200 OK), so r.ok alone isn't proof. The success path redirects
      // to /screens/<id>; if we're still on /screens, treat it as a failure.
      if (!/\/screens\/\d+(?:[/?#].*)?$/.test(new URL(r.url).pathname)) {
        throw new Error('Server returned the form page back — likely a validation error. Try a different name?');
      }
      savePrefs({ modelId });
      setStatus(`Uploaded "${label}" ✓`, 'ok');
      // Refresh CSRF for the next submit; some Hanami setups rotate it after
      // each form post.
      try { formCache = await fetchFormData(); } catch (_) { /* will surface on next click */ }
      // Pre-clear the label/name so the user can either rename and re-upload
      // (unusual) or close and design the next image.
      els.label.value = '';
      els.name.value = '';
      els.label.focus();
    } catch (err) {
      setStatus('Error: ' + (err.message || String(err)), 'err');
    } finally {
      els.uploadBtn.disabled = false;
    }
  }

  function init() {
    const sendBtn = document.getElementById('sendToTrmnlBtn');
    const modal = document.getElementById('trmnlModal');
    if (!sendBtn || !modal) return;

    els = {
      modal,
      label: document.getElementById('trmnlLabel'),
      name: document.getElementById('trmnlName'),
      modelSelect: document.getElementById('trmnlModelId'),
      status: document.getElementById('trmnlStatus'),
      uploadBtn: document.getElementById('trmnlUploadBtn'),
      cancelBtn: document.getElementById('trmnlCancelBtn'),
    };

    sendBtn.classList.remove('hidden');
    // Mirror the Export button's disabled state — both depend on bmpBlob.
    // We can't observe `bmpBlob` directly across files, so re-evaluate on
    // every render via the same hook the download button uses.
    const downloadBtn = document.getElementById('download');
    const sync = () => { sendBtn.disabled = downloadBtn.disabled; };
    sync();
    new MutationObserver(sync).observe(downloadBtn, { attributes: true, attributeFilter: ['disabled'] });

    sendBtn.addEventListener('click', openModal);
    els.cancelBtn.addEventListener('click', closeModal);
    els.uploadBtn.addEventListener('click', doUpload);
    // Click on backdrop closes; click on card does not.
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.classList.contains('hidden')) {
        closeModal();
        e.preventDefault();
      }
    });
  }

  init();
}

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

  // Best-effort extraction of validation messages from the form page Hanami
  // re-renders on POST failure. We don't know Terminus's exact error markup,
  // so try a handful of common patterns and fall back to a body-text snippet.
  function extractFormError(html) {
    if (!html) return 'Form rejected (empty response body).';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const selectors = [
      '.flash--error', '.flash-error', '.flash.error',
      '.error-message', '.errors li', '.field-error',
      'span.error', 'div.error', 'p.error',
      '[role="alert"]',
    ];
    const messages = new Set();
    for (const sel of selectors) {
      for (const el of doc.querySelectorAll(sel)) {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (t) messages.add(t);
      }
    }
    if (messages.size > 0) {
      return 'Server rejected: ' + Array.from(messages).slice(0, 3).join('; ');
    }
    // Nothing matched — surface the page title + a body snippet so the user
    // has something concrete to grep server logs for.
    const title = doc.querySelector('title');
    const body = doc.body;
    const titleText = title ? title.textContent.trim() : '';
    const bodyText = body ? body.textContent.replace(/\s+/g, ' ').trim().slice(0, 250) : '';
    return `Server rejected (no recognised error markup). Title: "${titleText}". Body: "${bodyText}…"`;
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

  // Submit the multipart form once. Returns one of:
  //   { kind: 'ok' }                 — screen created.
  //   { kind: 'duplicate' }          — likely (model_id, name) collision (HTTP 500).
  //   { kind: 'rejected', message }  — form re-rendered with validation errors.
  //   throws                         — network/transport failure.
  async function postScreen({ label, name, modelId }) {
    const fd = new FormData();
    fd.append('_csrf_token', formCache.csrfToken);
    fd.append('screen[label]', label);
    fd.append('screen[name]', name);
    fd.append('screen[model_id]', modelId);
    fd.append('screen[image]', bmpBlob, safeFilename(name));

    const r = await fetch('/screens', {
      method: 'POST',
      body: fd,
      credentials: 'include',
      redirect: 'follow',
    });

    // Terminus has a UNIQUE INDEX on (model_id, name). Re-uploading with the
    // same name 500s with a PG::UniqueViolation rather than re-rendering the
    // form. Treat 500 as "probably a duplicate name" — the caller retries with
    // a numeric suffix.
    if (r.status === 500) return { kind: 'duplicate' };

    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status}: ${body.slice(0, 200) || r.statusText}`);
    }

    // Terminus's POST /screens returns 200 in BOTH outcomes — no redirect:
    //   - success → renders the screens index template (the listing)
    //   - validation failure → renders the new-screen form template inline
    // r.redirected is therefore useless here. The form re-render is the only
    // page in this flow that contains <input name="screen[image]">; the index
    // page doesn't have any upload form. That's our success/failure signal.
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (doc.querySelector('input[name="screen[image]"]')) {
      return { kind: 'rejected', message: extractFormError(html) };
    }
    return { kind: 'ok' };
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
    const baseName = els.name.value.trim();
    const modelId = els.modelSelect.value;
    if (!label || !baseName || !modelId) {
      setStatus('Label, name, and model are all required.', 'err');
      return;
    }
    els.uploadBtn.disabled = true;
    setStatus('Uploading…', 'info');

    // The (model_id, name) UNIQUE index in Terminus collides whenever we
    // upload an image with a filename that's been used before. Auto-suffix
    // on collision so the batch flow ("design → upload, design → upload")
    // doesn't get stuck the moment a name repeats. A handful of retries is
    // more than enough for any realistic naming pattern.
    let name = baseName;
    let attempt = 0;
    const MAX_ATTEMPTS = 6;
    try {
      while (true) {
        attempt += 1;
        if (attempt > 1) {
          name = `${baseName}-${attempt}`;
          setStatus(`Name "${baseName}" exists — retrying as "${name}"…`, 'info');
        }
        const result = await postScreen({ label, name, modelId });
        if (result.kind === 'ok') break;
        if (result.kind === 'rejected') {
          throw new Error(result.message);
        }
        if (result.kind === 'duplicate' && attempt < MAX_ATTEMPTS) {
          // Hanami may rotate CSRF on each submit — refresh before retrying.
          try { formCache = await fetchFormData(); } catch (_) { /* surface on next */ }
          continue;
        }
        if (result.kind === 'duplicate') {
          throw new Error(`Tried "${baseName}" through "${name}" — all duplicates. Pick a different base name.`);
        }
      }
      savePrefs({ modelId });
      setStatus(
        attempt === 1
          ? `Uploaded "${label}" ✓`
          : `Uploaded "${label}" as "${name}" ✓`,
        'ok',
      );
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

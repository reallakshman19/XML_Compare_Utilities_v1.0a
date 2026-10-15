/** Visible import and structural-impact panel for a Validator MERGE_NODES request. */
export const SEQUENTIAL_MERGE_NODES_REQUEST_PANEL_SCHEMA =
  'SequentialMergeNodesRequestPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Merge request panel element missing: ${selector}`);
  return value;
}

function markup() {
  return `<section data-ssk-merge-request-panel hidden aria-hidden="true" inert>
<header><strong>Merge request preview</strong><span>Structural impact only</span></header>
<label>Validator request JSON<input type="file" accept=".json,application/json" data-ssk-merge-request-file></label>
<div data-ssk-merge-request-summary>No request loaded.</div>
<label>Sequential source node ID<input data-ssk-merge-request-source></label>
<label>Sequential retained target node ID<input data-ssk-merge-request-target></label>
<div><button type="button" data-ssk-merge-request-preview disabled>Create impact preview</button>
<button type="button" data-ssk-merge-request-clear disabled>Clear</button></div>
<output data-ssk-merge-request-status role="status" aria-live="polite">Load a merge request.</output>
<pre data-ssk-merge-request-evidence></pre>
</section>`;
}

function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-merge-request-panel]')) {
    host.insertAdjacentHTML('beforeend', markup());
  }
  const panel = required(root, '[data-ssk-merge-request-panel]');
  panel.style.cssText = [
    'position:absolute', 'left:12px', 'bottom:12px', 'z-index:11',
    'width:min(430px,calc(100% - 24px))', 'max-height:55%', 'overflow:auto', 'padding:12px',
    'border:1px solid rgba(168,85,247,.55)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  return panel;
}

function elements(root, panel) {
  const names = ['file', 'summary', 'source', 'target', 'preview', 'clear', 'status', 'evidence'];
  return Object.fromEntries([['panel', panel], ...names.map((name) => [name,
    required(root, `[data-ssk-merge-request-${name}]`)])]);
}

function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}

function evidenceSummary(preview) {
  if (!preview) return '';
  return JSON.stringify({
    impactStatus: preview.impactStatus,
    sequentialSourceNodeId: preview.mapping.sequentialSourceNodeId,
    sequentialTargetNodeId: preview.mapping.sequentialTargetNodeId,
    separationMm: preview.separationMm,
    affected: preview.affected,
    blockerCodes: preview.blockers.map((row) => row.code),
    reviewFlags: preview.reviewFlags,
    applicationDisposition: preview.applicationDisposition,
    publicationState: preview.publicationState,
  }, null, 2);
}

function render(state) {
  setHidden(state.elements.panel, !state.active);
  const loaded = Boolean(state.request) && !state.destroyed;
  state.elements.preview.disabled = !loaded;
  state.elements.clear.disabled = !loaded && !state.preview;
  state.elements.summary.textContent = state.request
    ? `Validator ${state.request.sourceCommand.payload.sourceNodeId} → ${state.request.sourceCommand.payload.targetNodeId}; explicit Sequential IDs required.`
    : 'No request loaded.';
  state.elements.status.textContent = state.notice || 'Load a merge request.';
  state.elements.evidence.textContent = evidenceSummary(state.preview);
}

async function loadFile(state) {
  try {
    const file = state.elements.file.files?.[0];
    if (!file) return;
    state.request = await state.onReadRequest(file); state.preview = null;
    state.notice = `Loaded ${file.name}. No identity was mapped automatically.`;
  } catch (error) {
    state.request = null; state.preview = null;
    state.notice = `${error.code || error.name}: ${error.message || String(error)}`;
  }
  render(state);
}

function createPreview(state) {
  try {
    state.preview = state.onPreview({
      request: state.request,
      sequentialSourceNodeId: state.elements.source.value,
      sequentialTargetNodeId: state.elements.target.value,
    });
    state.notice = `${state.preview.impactStatus}: impact preview created. Nothing was published.`;
  } catch (error) {
    state.preview = null; state.notice = `${error.code || error.name}: ${error.message || String(error)}`;
  }
  render(state);
}

function clear(state, reason = 'operator-clear') {
  state.request = null; state.preview = null; state.elements.file.value = '';
  state.notice = `Merge request cleared: ${reason}.`; render(state);
}

function bind(state) {
  state.handlers = {
    file: () => loadFile(state),
    preview: () => createPreview(state),
    clear: () => clear(state),
  };
  state.elements.file.addEventListener('change', state.handlers.file);
  state.elements.preview.addEventListener('click', state.handlers.preview);
  state.elements.clear.addEventListener('click', state.handlers.clear);
}

function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true;
  state.elements.file.removeEventListener('change', state.handlers.file);
  state.elements.preview.removeEventListener('click', state.handlers.preview);
  state.elements.clear.removeEventListener('click', state.handlers.clear);
  state.elements.panel.remove(); return true;
}

export function createSequentialMergeNodesRequestPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Merge request panel requires a root.');
  const state = {
    elements: elements(root, install(root)), request: null, preview: null,
    notice: null, active: false, destroyed: false,
    onReadRequest: requiredFunction(options.onReadRequest, 'onReadRequest'),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
  };
  bind(state); render(state);
  return Object.freeze({
    schema: SEQUENTIAL_MERGE_NODES_REQUEST_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setRequest(value, notice = null) {
      state.request = value; state.preview = null; state.notice = notice; render(state);
    },
    clear: (reason) => clear(state, reason),
    getState: () => Object.freeze({
      active: state.active, requestFingerprint: state.request?.requestFingerprint || null,
      previewFingerprint: state.preview?.previewFingerprint || null, destroyed: state.destroyed,
    }),
    destroy: () => destroy(state),
  });
}

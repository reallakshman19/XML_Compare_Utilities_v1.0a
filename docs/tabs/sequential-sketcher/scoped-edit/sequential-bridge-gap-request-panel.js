/** Visible import and connection-impact panel for a Validator BRIDGE_GAP request. */
export const SEQUENTIAL_BRIDGE_GAP_REQUEST_PANEL_SCHEMA =
  'SequentialBridgeGapRequestPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Bridge request panel element missing: ${selector}`);
  return value;
}

function markup() {
  return `<section data-ssk-bridge-request-panel hidden aria-hidden="true" inert>
<header><strong>Bridge request preview</strong><span>Connection impact only</span></header>
<label>Validator request JSON<input type="file" accept=".json,application/json" data-ssk-bridge-request-file></label>
<div data-ssk-bridge-request-summary>No request loaded.</div>
<label>Sequential from node ID<input data-ssk-bridge-request-from-node></label>
<label>Sequential from port ID<input data-ssk-bridge-request-from-port></label>
<label>Sequential to node ID<input data-ssk-bridge-request-to-node></label>
<label>Sequential to port ID<input data-ssk-bridge-request-to-port></label>
<div><button type="button" data-ssk-bridge-request-preview disabled>Create impact preview</button>
<button type="button" data-ssk-bridge-request-clear disabled>Clear</button></div>
<output data-ssk-bridge-request-status role="status" aria-live="polite">Load a bridge request.</output>
<pre data-ssk-bridge-request-evidence></pre>
</section>`;
}

function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-bridge-request-panel]')) {
    host.insertAdjacentHTML('beforeend', markup());
  }
  const panel = required(root, '[data-ssk-bridge-request-panel]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'bottom:12px', 'z-index:11',
    'width:min(450px,calc(100% - 24px))', 'max-height:58%', 'overflow:auto', 'padding:12px',
    'border:1px solid rgba(34,197,94,.55)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  return panel;
}

function elements(root, panel) {
  const names = ['file', 'summary', 'from-node', 'from-port', 'to-node', 'to-port',
    'preview', 'clear', 'status', 'evidence'];
  return Object.fromEntries([['panel', panel], ...names.map((name) => [name,
    required(root, `[data-ssk-bridge-request-${name}]`)])]);
}

function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}

function evidenceSummary(preview) {
  if (!preview) return '';
  return JSON.stringify({
    impactStatus: preview.impactStatus,
    mapping: preview.mapping,
    separationMm: preview.separationMm,
    affected: preview.affected,
    blockerCodes: preview.blockers.map((row) => row.code),
    reviewFlags: preview.reviewFlags,
    applicationDisposition: preview.applicationDisposition,
    candidateNativeOperation: preview.candidateNativeOperation,
    publicationState: preview.publicationState,
  }, null, 2);
}

function render(state) {
  setHidden(state.elements.panel, !state.active);
  const loaded = Boolean(state.request) && !state.destroyed;
  state.elements.preview.disabled = !loaded;
  state.elements.clear.disabled = !loaded && !state.preview;
  state.elements.summary.textContent = state.request
    ? `Validator ${state.request.sourceCommand.payload.fromNodeId} → ${state.request.sourceCommand.payload.toNodeId}; explicit Sequential node and port IDs required.`
    : 'No request loaded.';
  state.elements.status.textContent = state.notice || 'Load a bridge request.';
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
      sequentialFromNodeId: state.elements['from-node'].value,
      sequentialFromPortId: state.elements['from-port'].value,
      sequentialToNodeId: state.elements['to-node'].value,
      sequentialToPortId: state.elements['to-port'].value,
    });
    state.notice = `${state.preview.impactStatus}: impact preview created. Nothing was published.`;
  } catch (error) {
    state.preview = null; state.notice = `${error.code || error.name}: ${error.message || String(error)}`;
  }
  render(state);
}

function clearInputs(elementsValue) {
  for (const name of ['from-node', 'from-port', 'to-node', 'to-port']) {
    elementsValue[name].value = '';
  }
}

function clear(state, reason = 'operator-clear') {
  state.request = null; state.preview = null; state.elements.file.value = '';
  clearInputs(state.elements); state.notice = `Bridge request cleared: ${reason}.`; render(state);
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

export function createSequentialBridgeGapRequestPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Bridge request panel requires a root.');
  const state = {
    elements: elements(root, install(root)), request: null, preview: null,
    notice: null, active: false, destroyed: false,
    onReadRequest: requiredFunction(options.onReadRequest, 'onReadRequest'),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
  };
  bind(state); render(state);
  return Object.freeze({
    schema: SEQUENTIAL_BRIDGE_GAP_REQUEST_PANEL_SCHEMA,
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

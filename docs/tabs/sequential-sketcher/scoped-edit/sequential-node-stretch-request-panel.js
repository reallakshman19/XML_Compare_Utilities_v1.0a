/** Visible import panel for a Validator MOVE_NODE request and explicit Sequential identities. */
export const SEQUENTIAL_NODE_STRETCH_REQUEST_PANEL_SCHEMA =
  'SequentialNodeStretchRequestPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Stretch request panel element missing: ${selector}`);
  return value;
}

function markup() {
  return `<section data-ssk-node-stretch-request-panel hidden aria-hidden="true" inert>
<header><strong>Import Validator move request</strong><span>Preview only</span></header>
<label>Request JSON<input type="file" accept=".json,application/json" data-ssk-node-stretch-request-file></label>
<div data-ssk-node-stretch-request-summary>No request loaded.</div>
<label>Sequential component object ID<input data-ssk-node-stretch-request-object></label>
<label>Sequential node ID<input data-ssk-node-stretch-request-node></label>
<div><label>Minimum length (mm)<input value="1" data-ssk-node-stretch-request-min></label>
<label>Zero tolerance (mm)<input value="0.000000001" data-ssk-node-stretch-request-zero></label>
<label>Collinearity tolerance<input value="0.000000001" data-ssk-node-stretch-request-collinear></label></div>
<div><button type="button" data-ssk-node-stretch-request-current>Use current stretch selection</button>
<button type="button" data-ssk-node-stretch-request-preview disabled>Create request preview</button>
<button type="button" data-ssk-node-stretch-request-clear disabled>Clear request</button></div>
<output data-ssk-node-stretch-request-status role="status" aria-live="polite">Load a Validator move request.</output>
</section>`;
}

function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-node-stretch-request-panel]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-node-stretch-request-panel]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'bottom:12px', 'z-index:11',
    'width:min(410px,calc(100% - 24px))', 'padding:12px',
    'border:1px solid rgba(56,189,248,.55)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  return panel;
}

function elements(root, panel) {
  const names = ['file', 'summary', 'object', 'node', 'min', 'zero', 'collinear',
    'current', 'preview', 'clear', 'status'];
  return Object.fromEntries([['panel', panel], ...names.map((name) => [name,
    required(root, `[data-ssk-node-stretch-request-${name}]`)])]);
}

function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}

function finite(element, label) {
  const text = String(element.value || '').trim(), value = Number(text);
  if (!text || !Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function previewInput(state) {
  return {
    request: state.request,
    selectedObjectId: state.elements.object.value,
    sequentialNodeId: state.elements.node.value,
    profile: {
      minimumLengthMm: finite(state.elements.min, 'Minimum length'),
      zeroLengthToleranceMm: finite(state.elements.zero, 'Zero tolerance'),
      collinearityTolerance: finite(state.elements.collinear, 'Collinearity tolerance'),
    },
  };
}

function render(state) {
  setHidden(state.elements.panel, !state.active);
  const ready = Boolean(state.request) && !state.destroyed;
  state.elements.preview.disabled = !ready;
  state.elements.clear.disabled = !ready;
  state.elements.summary.textContent = state.request
    ? `Validator node ${state.request.sourceNode.nodeId} → ${JSON.stringify(state.request.sourceCommand.payload.position)}`
    : 'No request loaded.';
  state.elements.status.textContent = state.notice || 'Load a Validator move request.';
}

async function loadFile(state) {
  try {
    const file = state.elements.file.files?.[0];
    if (!file) return;
    state.request = await state.onReadRequest(file);
    state.notice = `Loaded ${file.name}. Explicit Sequential identities are still required.`;
  } catch (error) {
    state.request = null; state.notice = `${error.code || error.name}: ${error.message || String(error)}`;
  }
  render(state);
}

function useCurrent(state) {
  try {
    const current = state.onCurrentSelection();
    if (!current?.selectedObjectId || !current?.sequentialNodeId) throw new RangeError('No explicit stretch selection is active.');
    state.elements.object.value = current.selectedObjectId;
    state.elements.node.value = current.sequentialNodeId;
    state.notice = 'Current stretch component and node copied explicitly.';
  } catch (error) { state.notice = `${error.code || error.name}: ${error.message || String(error)}`; }
  render(state);
}

function createPreview(state) {
  try {
    const result = state.onPreviewRequest(previewInput(state));
    state.notice = `Request preview created: ${result.preview.operationId}. Nothing was published.`;
  } catch (error) { state.notice = `${error.code || error.name}: ${error.message || String(error)}`; }
  render(state);
}

function clear(state, reason = 'operator-clear') {
  state.request = null; state.elements.file.value = '';
  state.notice = `Request cleared: ${reason}.`; render(state);
}

function bind(state) {
  state.handlers = {
    file: () => loadFile(state), current: () => useCurrent(state),
    preview: () => createPreview(state), clear: () => clear(state),
  };
  state.elements.file.addEventListener('change', state.handlers.file);
  state.elements.current.addEventListener('click', state.handlers.current);
  state.elements.preview.addEventListener('click', state.handlers.preview);
  state.elements.clear.addEventListener('click', state.handlers.clear);
}

function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true;
  state.elements.file.removeEventListener('change', state.handlers.file);
  state.elements.current.removeEventListener('click', state.handlers.current);
  state.elements.preview.removeEventListener('click', state.handlers.preview);
  state.elements.clear.removeEventListener('click', state.handlers.clear);
  state.elements.panel.remove(); return true;
}

export function createSequentialNodeStretchRequestPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Stretch request panel requires a root.');
  const panel = install(root);
  const state = {
    elements: elements(root, panel), request: null, notice: null,
    active: false, destroyed: false,
    onReadRequest: requiredFunction(options.onReadRequest, 'onReadRequest'),
    onCurrentSelection: requiredFunction(options.onCurrentSelection, 'onCurrentSelection'),
    onPreviewRequest: requiredFunction(options.onPreviewRequest, 'onPreviewRequest'),
  };
  bind(state); render(state);
  return Object.freeze({
    schema: SEQUENTIAL_NODE_STRETCH_REQUEST_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setRequest(value, notice = null) { state.request = value; state.notice = notice; render(state); },
    clear: (reason) => clear(state, reason),
    getState: () => Object.freeze({ active: state.active,
      requestFingerprint: state.request?.requestFingerprint || null, destroyed: state.destroyed }),
    destroy: () => destroy(state),
  });
}

/** Visible import and relationship-impact panel for a Validator DISCONNECT_ENDPOINT request. */
export const SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_PANEL_SCHEMA =
  'SequentialDisconnectEndpointRequestPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Disconnect request panel element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-disconnect-request-panel hidden aria-hidden="true" inert>
<header><strong>Disconnect request preview</strong><span>Relationship impact only</span></header>
<label>Validator request JSON<input type="file" accept=".json,application/json" data-ssk-disconnect-request-file></label>
<div data-ssk-disconnect-request-summary>No request loaded.</div>
<label>Sequential relationship kind<select data-ssk-disconnect-request-kind><option value="COMMITTED_CONNECTION">COMMITTED_CONNECTION</option><option value="INTERNAL_EDGE">INTERNAL_EDGE</option></select></label>
<label>Sequential relationship ID<input data-ssk-disconnect-request-relationship></label>
<label>Sequential endpoint node ID<input data-ssk-disconnect-request-node></label>
<label>Sequential endpoint port ID<input data-ssk-disconnect-request-port></label>
<div><button type="button" data-ssk-disconnect-request-preview disabled>Create impact preview</button>
<button type="button" data-ssk-disconnect-request-clear disabled>Clear</button></div>
<output data-ssk-disconnect-request-status role="status" aria-live="polite">Load a disconnect request.</output>
<pre data-ssk-disconnect-request-evidence></pre>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-disconnect-request-panel]')) {
    host.insertAdjacentHTML('beforeend', markup());
  }
  const panel = required(root, '[data-ssk-disconnect-request-panel]');
  panel.style.cssText = [
    'position:absolute', 'left:12px', 'top:72px', 'z-index:11',
    'width:min(460px,calc(100% - 24px))', 'max-height:48%', 'overflow:auto', 'padding:12px',
    'border:1px solid rgba(239,68,68,.6)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  return panel;
}
function elements(root, panel) {
  const names = ['file', 'summary', 'kind', 'relationship', 'node', 'port',
    'preview', 'clear', 'status', 'evidence'];
  return Object.fromEntries([['panel', panel], ...names.map((name) => [name,
    required(root, `[data-ssk-disconnect-request-${name}]`)])]);
}
function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function evidenceSummary(preview) {
  if (!preview) return '';
  return JSON.stringify({ impactStatus: preview.impactStatus, mapping: preview.mapping,
    relationship: { kind: preview.relationship.kind,
      relationshipId: preview.relationship.relationshipId,
      nodeRelation: preview.relationship.nodeRelation },
    affected: preview.affected, blockerCodes: preview.blockers.map((row) => row.code),
    reviewFlags: preview.reviewFlags, applicationDisposition: preview.applicationDisposition,
    currentNativeDisconnectAuthority: preview.currentNativeDisconnectAuthority,
    publicationState: preview.publicationState }, null, 2);
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  const loaded = Boolean(state.request) && !state.destroyed;
  state.elements.preview.disabled = !loaded;
  state.elements.clear.disabled = !loaded && !state.preview;
  state.elements.summary.textContent = state.request
    ? `Validator ${state.request.sourceEdge.edgeId} ${state.request.selectedEndpoint.endpoint}; explicit Sequential relationship, node, and port IDs required.`
    : 'No request loaded.';
  state.elements.status.textContent = state.notice || 'Load a disconnect request.';
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
    state.preview = state.onPreview({ request: state.request,
      sequentialRelationshipKind: state.elements.kind.value,
      sequentialRelationshipId: state.elements.relationship.value,
      sequentialEndpointNodeId: state.elements.node.value,
      sequentialEndpointPortId: state.elements.port.value });
    state.notice = `${state.preview.impactStatus}: relationship-impact preview created. Nothing was published.`;
  } catch (error) {
    state.preview = null; state.notice = `${error.code || error.name}: ${error.message || String(error)}`;
  }
  render(state);
}
function clearInputs(elementsValue) {
  for (const name of ['relationship', 'node', 'port']) elementsValue[name].value = '';
  elementsValue.kind.value = 'COMMITTED_CONNECTION';
}
function clear(state, reason = 'operator-clear') {
  state.request = null; state.preview = null; state.elements.file.value = '';
  clearInputs(state.elements); state.notice = `Disconnect request cleared: ${reason}.`; render(state);
}
function bind(state) {
  state.handlers = { file: () => loadFile(state), preview: () => createPreview(state),
    clear: () => clear(state) };
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
export function createSequentialDisconnectEndpointRequestPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Disconnect request panel requires a root.');
  const state = { elements: elements(root, install(root)), request: null, preview: null,
    notice: null, active: false, destroyed: false,
    onReadRequest: requiredFunction(options.onReadRequest, 'onReadRequest'),
    onPreview: requiredFunction(options.onPreview, 'onPreview') };
  bind(state); render(state);
  return Object.freeze({ schema: SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setRequest(value, notice = null) {
      state.request = value; state.preview = null; state.notice = notice; render(state);
    },
    clear: (reason) => clear(state, reason),
    getState: () => Object.freeze({ active: state.active,
      requestFingerprint: state.request?.requestFingerprint || null,
      previewFingerprint: state.preview?.previewFingerprint || null, destroyed: state.destroyed }),
    destroy: () => destroy(state) });
}

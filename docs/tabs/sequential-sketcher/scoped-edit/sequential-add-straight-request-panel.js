/** Visible import and construction-impact panel for a Validator ADD_STRAIGHT_ELEMENT request. */
export const SEQUENTIAL_ADD_STRAIGHT_REQUEST_PANEL_SCHEMA =
  'SequentialAddStraightRequestPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Add-straight request panel element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-add-straight-request-panel hidden aria-hidden="true" inert>
<header><strong>Add straight request preview</strong><span>Construction impact only</span></header>
<label>Validator request JSON<input type="file" accept=".json,application/json" data-ssk-add-straight-request-file></label>
<div data-ssk-add-straight-request-summary>No request loaded.</div>
<label>Sequential start node ID<input data-ssk-add-straight-request-from-node></label>
<label>Sequential start port ID<input data-ssk-add-straight-request-from-port></label>
<label>New component canonical type<select data-ssk-add-straight-request-type><option value="PIPE">PIPE</option></select></label>
<label>Target branch ID<input data-ssk-add-straight-request-branch></label>
<div><button type="button" data-ssk-add-straight-request-preview disabled>Create impact preview</button>
<button type="button" data-ssk-add-straight-request-clear disabled>Clear</button></div>
<output data-ssk-add-straight-request-status role="status" aria-live="polite">Load an add-straight request.</output>
<pre data-ssk-add-straight-request-evidence></pre>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-add-straight-request-panel]')) {
    host.insertAdjacentHTML('beforeend', markup());
  }
  const panel = required(root, '[data-ssk-add-straight-request-panel]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'top:72px', 'z-index:11',
    'width:min(460px,calc(100% - 24px))', 'max-height:48%', 'overflow:auto', 'padding:12px',
    'border:1px solid rgba(245,158,11,.6)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  return panel;
}
function elements(root, panel) {
  const names = ['file', 'summary', 'from-node', 'from-port', 'type', 'branch',
    'preview', 'clear', 'status', 'evidence'];
  return Object.fromEntries([['panel', panel], ...names.map((name) => [name,
    required(root, `[data-ssk-add-straight-request-${name}]`)])]);
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
    proposedSegment: preview.proposedSegment,
    sourcePositionOffsetMm: preview.sourcePositionOffsetMm,
    affected: preview.affected,
    blockerCodes: preview.blockers.map((row) => row.code),
    reviewFlags: preview.reviewFlags,
    applicationDisposition: preview.applicationDisposition,
    currentNativeConstructionAuthority: preview.currentNativeConstructionAuthority,
    publicationState: preview.publicationState,
  }, null, 2);
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  const loaded = Boolean(state.request) && !state.destroyed;
  state.elements.preview.disabled = !loaded;
  state.elements.clear.disabled = !loaded && !state.preview;
  state.elements.summary.textContent = state.request
    ? `Validator start ${state.request.sourceCommand.payload.fromNodeId}; explicit Sequential node, port, PIPE type, and branch are required.`
    : 'No request loaded.';
  state.elements.status.textContent = state.notice || 'Load an add-straight request.';
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
      newComponentCanonicalType: state.elements.type.value,
      targetBranchId: state.elements.branch.value,
    });
    state.notice = `${state.preview.impactStatus}: construction-impact preview created. Nothing was published.`;
  } catch (error) {
    state.preview = null; state.notice = `${error.code || error.name}: ${error.message || String(error)}`;
  }
  render(state);
}
function clearInputs(elementsValue) {
  for (const name of ['from-node', 'from-port', 'branch']) elementsValue[name].value = '';
  elementsValue.type.value = 'PIPE';
}
function clear(state, reason = 'operator-clear') {
  state.request = null; state.preview = null; state.elements.file.value = '';
  clearInputs(state.elements); state.notice = `Add-straight request cleared: ${reason}.`; render(state);
}
function bind(state) {
  state.handlers = {
    file: () => loadFile(state), preview: () => createPreview(state), clear: () => clear(state),
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
export function createSequentialAddStraightRequestPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Add-straight request panel requires a root.');
  const state = {
    elements: elements(root, install(root)), request: null, preview: null,
    notice: null, active: false, destroyed: false,
    onReadRequest: requiredFunction(options.onReadRequest, 'onReadRequest'),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
  };
  bind(state); render(state);
  return Object.freeze({
    schema: SEQUENTIAL_ADD_STRAIGHT_REQUEST_PANEL_SCHEMA,
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

/** Visible import and whole-component impact panel for a Validator DELETE_EDGE request. */
export const SEQUENTIAL_COMPONENT_RETIREMENT_REQUEST_PANEL_SCHEMA =
  'SequentialComponentRetirementRequestPanel.v1';
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Retirement request panel element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-component-retirement-request-panel hidden aria-hidden="true" inert>
<header><strong>Retirement request preview</strong><span>Whole-component impact only</span></header>
<label>Validator request JSON<input type="file" accept=".json,application/json" data-ssk-component-retirement-request-file></label>
<div data-ssk-component-retirement-request-summary>No request loaded.</div>
<label>Sequential component ID<input data-ssk-component-retirement-request-component></label>
<label>Sequential geometry-part ID<input data-ssk-component-retirement-request-part></label>
<label>Sequential internal-edge ID<input data-ssk-component-retirement-request-edge></label>
<label>Sequential branch ID<input data-ssk-component-retirement-request-branch></label>
<div><button type="button" data-ssk-component-retirement-request-preview disabled>Create impact preview</button>
<button type="button" data-ssk-component-retirement-request-clear disabled>Clear</button></div>
<output data-ssk-component-retirement-request-status role="status" aria-live="polite">Load a retirement request.</output>
<pre data-ssk-component-retirement-request-evidence></pre>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-component-retirement-request-panel]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-component-retirement-request-panel]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'top:50%', 'transform:translateY(-50%)', 'z-index:11',
    'width:min(440px,calc(100% - 24px))', 'max-height:48%', 'overflow:auto', 'padding:12px',
    'border:1px solid rgba(244,63,94,.6)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  return panel;
}
function elements(root, panel) {
  const names = ['file', 'summary', 'component', 'part', 'edge', 'branch',
    'preview', 'clear', 'status', 'evidence'];
  return Object.fromEntries([['panel', panel], ...names.map((name) => [name,
    required(root, `[data-ssk-component-retirement-request-${name}]`)])]);
}
function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function evidenceSummary(preview) {
  if (!preview) return '';
  return JSON.stringify({ impactStatus: preview.impactStatus, mapping: preview.mapping,
    component: { componentId: preview.component.componentId,
      canonicalType: preview.component.canonicalType, branchId: preview.component.branchId },
    anchorInternalEdge: preview.anchorInternalEdge, anchorGeometry: preview.anchorGeometry,
    affected: preview.affected, blockerCodes: preview.blockers.map((row) => row.code),
    reviewFlags: preview.reviewFlags,
    currentNativeRetirementAuthority: preview.currentNativeRetirementAuthority,
    retirementQualificationScope: preview.retirementQualificationScope,
    applicationDisposition: preview.applicationDisposition,
    publicationState: preview.publicationState }, null, 2);
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  const loaded = Boolean(state.request) && !state.destroyed;
  state.elements.preview.disabled = !loaded;
  state.elements.clear.disabled = !loaded && !state.preview;
  state.elements.summary.textContent = state.request
    ? `Validator edge ${state.request.sourceEdge.edgeId}; explicit Sequential component, part, edge and branch IDs required.`
    : 'No request loaded.';
  state.elements.status.textContent = state.notice || 'Load a retirement request.';
  state.elements.evidence.textContent = evidenceSummary(state.preview);
}
async function loadFile(state) {
  try {
    const file = state.elements.file.files?.[0]; if (!file) return;
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
      sequentialComponentId: state.elements.component.value,
      sequentialGeometryPartId: state.elements.part.value,
      sequentialInternalEdgeId: state.elements.edge.value,
      sequentialBranchId: state.elements.branch.value });
    state.notice = `${state.preview.impactStatus}: whole-component impact preview created. Nothing was published.`;
  } catch (error) {
    state.preview = null; state.notice = `${error.code || error.name}: ${error.message || String(error)}`;
  }
  render(state);
}
function clearInputs(value) {
  for (const name of ['component', 'part', 'edge', 'branch']) value[name].value = '';
}
function clear(state, reason = 'operator-clear') {
  state.request = null; state.preview = null; state.elements.file.value = '';
  clearInputs(state.elements); state.notice = `Retirement request cleared: ${reason}.`; render(state);
}
function bind(state) {
  state.handlers = { file: () => loadFile(state), preview: () => createPreview(state), clear: () => clear(state) };
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
export function createSequentialComponentRetirementRequestPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Retirement request panel requires a root.');
  const state = { elements: elements(root, install(root)), request: null, preview: null,
    notice: null, active: false, destroyed: false,
    onReadRequest: requiredFunction(options.onReadRequest, 'onReadRequest'),
    onPreview: requiredFunction(options.onPreview, 'onPreview') };
  bind(state); render(state);
  return Object.freeze({ schema: SEQUENTIAL_COMPONENT_RETIREMENT_REQUEST_PANEL_SCHEMA,
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

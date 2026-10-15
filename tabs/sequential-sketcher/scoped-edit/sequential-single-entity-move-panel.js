/** Contained preview/cancel and explicit snap-review UI for one component translation. */
import { SEQUENTIAL_MOVE_SNAP_MODE } from './sequential-move-snap-contracts.js';
export const SEQUENTIAL_SINGLE_ENTITY_MOVE_PANEL_SCHEMA = 'SequentialSingleEntityMovePanel.v1';
const MOVE_CONSTRAINTS = Object.freeze(['X', 'Y', 'Z', 'XY', 'XZ', 'YZ']);
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`); return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Single-entity move panel element missing: ${selector}`); return value;
}
function constraintValue(value) {
  const result = String(value || '').trim().toUpperCase();
  if (!MOVE_CONSTRAINTS.includes(result)) throw new TypeError(`Unsupported move constraint: ${value}`);
  return result;
}
function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function markup() {
  return `<section data-ssk-single-move-panel hidden aria-hidden="true" inert>
<header><strong>Component move preview</strong><span>Preview / explicit snap / cancel</span></header>
<output data-ssk-single-move-target>No confirmed pipe or fitting selected.</output>
<label>Constraint<select data-ssk-single-move-constraint>
<option value="X">Axis X</option><option value="Y">Axis Y</option><option value="Z">Axis Z</option>
<option value="XY" selected>Plane XY</option><option value="XZ">Plane XZ</option><option value="YZ">Plane YZ</option>
</select></label>
<div data-ssk-single-move-delta>
<label>ΔX<input type="number" step="any" value="0" data-ssk-single-move-axis="x"></label>
<label>ΔY<input type="number" step="any" value="0" data-ssk-single-move-axis="y"></label>
<label>ΔZ<input type="number" step="any" value="0" data-ssk-single-move-axis="z"></label>
</div>
<div><button type="button" data-ssk-single-move-preview disabled>Preview numeric</button>
<button type="button" data-ssk-single-move-cancel disabled>Cancel preview</button></div>
<fieldset data-ssk-move-snap-controls><legend>Explicit snap evidence</legend>
<label><input type="checkbox" data-ssk-move-snap-mode="endpoint" checked>Endpoint</label>
<label><input type="checkbox" data-ssk-move-snap-mode="midpoint" checked>Midpoint</label>
<label><input type="checkbox" data-ssk-move-snap-mode="centerline" checked>Centerline</label>
<label><input type="checkbox" data-ssk-move-snap-mode="axis" checked>Axis</label>
<label><input type="checkbox" data-ssk-move-snap-mode="intersection" checked>Intersection</label>
<label><input type="checkbox" data-ssk-move-snap-mode="grid">Grid</label>
<label>Aperture px<input type="number" min="1" step="1" value="18" data-ssk-move-snap-aperture></label>
<label>Grid spacing<input type="number" min="0.000001" step="any" value="100" data-ssk-move-snap-grid-spacing></label>
<select data-ssk-move-snap-candidates size="5" aria-label="Snap candidates"></select>
<div><button type="button" data-ssk-move-snap-previous disabled>Previous</button>
<button type="button" data-ssk-move-snap-next disabled>Next</button>
<button type="button" data-ssk-move-snap-use disabled>Use candidate</button>
<button type="button" data-ssk-move-snap-clear disabled>Clear snap</button></div>
<output data-ssk-move-snap-status>No snap acquisition is active.</output></fieldset>
<pre data-ssk-single-move-diagnosis>No move preview is active.</pre>
<output data-ssk-single-move-status role="status" aria-live="polite">Select a confirmed component, then drag it or enter an exact delta.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-single-move-panel]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-single-move-panel]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'top:12px', 'z-index:9',
    'width:min(430px,calc(100% - 24px))', 'padding:12px', 'max-height:calc(100% - 24px)',
    'overflow:auto', 'border:1px solid rgba(56,189,248,.5)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0', 'box-shadow:0 18px 50px rgba(0,0,0,.38)',
  ].join(';');
  panel.querySelector('[data-ssk-single-move-delta]').style.cssText =
    'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0';
  panel.querySelectorAll('input[type="number"],select').forEach((element) => {
    element.style.cssText = 'box-sizing:border-box;width:100%;padding:6px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#07101f;color:#e2e8f0';
  });
  panel.querySelectorAll('button').forEach((button) => {
    button.style.cssText = 'margin:6px 6px 6px 0;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function numericDelta(elements) {
  return Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((axis) =>
    [axis, elements.axes[axis].value])));
}
function diagnosisText(preview) {
  if (!preview) return 'No move preview is active.';
  const rows = preview.boundaryDiagnosis.rows.map((row) => (
    `${row.selectedPortId} → ${row.stationaryPortId}: ${row.disposition} · gap ${row.separation.magnitude}`
  ));
  return [
    `Operation: ${preview.operationId}`,
    `Constraint: ${preview.constraint.kind === 'axis' ? preview.constraint.axis : preview.constraint.plane}`,
    `Raw delta: ${preview.rawDelta.x}, ${preview.rawDelta.y}, ${preview.rawDelta.z}`,
    `Effective delta: ${preview.delta.x}, ${preview.delta.y}, ${preview.delta.z}`,
    `Snap: ${preview.snapApplied ? preview.snapSelection.candidate.label : 'not applied'}`,
    `Disposition: ${preview.previewDisposition}`,
    ...(rows.length ? rows : ['No stationary topology boundary cuts.']),
  ].join('\n');
}
function targetText(target) {
  if (!target) return 'No confirmed pipe or fitting selected.';
  return [
    `Component: ${target.componentId}`, `Type: ${target.canonicalType}`,
    `Parts: ${target.geometryPartIds.length}`, `Boundary cuts: ${target.boundaryCuts.length}`,
    `Application evidence: ${target.rigidMoveEligible ? 'RIGID_MOVE_ELIGIBLE' : 'PREVIEW_DIAGNOSIS_ONLY'}`,
  ].join('\n');
}
function snapStatus(state) {
  const acquisition = state.acquisition;
  if (!acquisition) return 'No snap acquisition is active.';
  const selected = state.review?.selectedCandidateId;
  return [
    `Candidates: ${acquisition.candidates.length}`,
    `Suggestion: ${acquisition.suggestedCandidateId || 'none'} (not automatically selected)`,
    `Selected: ${selected || 'none'}`,
    `Acquisition: ${acquisition.acquisitionFingerprint}`,
  ].join('\n');
}
function renderCandidates(state) { const list = state.elements.candidates;
  list.replaceChildren(...(state.acquisition?.candidates || []).map((candidate) => {
    const option = list.ownerDocument.createElement('option');
    option.value = candidate.id;
    option.textContent = `${candidate.label} · ${candidate.screenDistance.toFixed(2)} px`;
    option.selected = candidate.id === state.review?.selectedCandidateId;
    return option;
  }));
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  state.elements.preview.disabled = !state.active || !state.target || state.destroyed;
  state.elements.cancel.disabled = !state.preview || state.destroyed;
  const hasCandidates = Boolean(state.acquisition?.candidates.length);
  const hasSelection = Boolean(state.review?.selectedCandidateId);
  state.elements.previous.disabled = !hasCandidates || state.destroyed;
  state.elements.next.disabled = !hasCandidates || state.destroyed;
  state.elements.use.disabled = !hasSelection || state.destroyed;
  state.elements.clearSnap.disabled = (!hasSelection && !state.preview?.snapApplied) || state.destroyed;
  state.elements.target.textContent = targetText(state.target);
  state.elements.diagnosis.textContent = diagnosisText(state.preview);
  state.elements.snapStatus.textContent = snapStatus(state);
  renderCandidates(state);
  state.elements.status.textContent = state.notice || (state.preview
    ? 'Draft overlay is active. Snap suggestion is evidence only until Use candidate.'
    : 'Select a confirmed component, then drag it or enter an exact delta.');
}
function elements(root, panel) {
  const snap = (name) => required(root, `[data-ssk-move-snap-${name}]`);
  return {
    panel, target: required(root, '[data-ssk-single-move-target]'),
    constraint: required(root, '[data-ssk-single-move-constraint]'),
    preview: required(root, '[data-ssk-single-move-preview]'),
    cancel: required(root, '[data-ssk-single-move-cancel]'),
    diagnosis: required(root, '[data-ssk-single-move-diagnosis]'),
    status: required(root, '[data-ssk-single-move-status]'),
    aperture: snap('aperture'), gridSpacing: snap('grid-spacing'), candidates: snap('candidates'),
    previous: snap('previous'), next: snap('next'), use: snap('use'), clearSnap: snap('clear'),
    snapStatus: snap('status'),
    modes: [...root.querySelectorAll('[data-ssk-move-snap-mode]')],
    axes: Object.fromEntries(['x', 'y', 'z'].map((axis) => [
      axis, required(root, `[data-ssk-single-move-axis="${axis}"]`),
    ])),
  };
}
function enabledModes(elementsValue) {
  const selected = new Set(elementsValue.modes.filter((row) => row.checked)
    .map((row) => row.dataset.sskMoveSnapMode));
  return [
    ...(selected.has('endpoint') ? [SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT] : []),
    ...(selected.has('midpoint') ? [SEQUENTIAL_MOVE_SNAP_MODE.MIDPOINT] : []),
    ...(selected.has('centerline') ? [SEQUENTIAL_MOVE_SNAP_MODE.CENTERLINE] : []),
    ...(selected.has('axis') ? [SEQUENTIAL_MOVE_SNAP_MODE.AXIS_X,
      SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Y, SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Z] : []),
    ...(selected.has('intersection') ? [SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION] : []),
    ...(selected.has('grid') ? [SEQUENTIAL_MOVE_SNAP_MODE.GRID] : []),
  ];
}
function snapProfile(state) {
  const modes = enabledModes(state.elements);
  return {
    enabledModes: modes,
    aperturePx: state.elements.aperture.value,
    grid: {
      enabled: modes.includes(SEQUENTIAL_MOVE_SNAP_MODE.GRID),
      spacing: state.elements.gridSpacing.value,
      origin: { x: 0, y: 0, z: 0 },
    },
  };
}
function notifyConstraint(state, source) {
  const value = constraintValue(state.elements.constraint.value);
  for (const listener of state.constraintListeners) listener(value, source);
  return value;
}
function setConstraint(state, value, source = 'programmatic') {
  const next = constraintValue(value);
  const changed = state.elements.constraint.value !== next;
  state.elements.constraint.value = next;
  if (changed) notifyConstraint(state, source);
  return next;
}
function setDelta(state, value = {}) {
  for (const axis of ['x', 'y', 'z']) if (value[axis] != null)
    state.elements.axes[axis].value = String(value[axis]);
  return numericDelta(state.elements);
}
function invoke(state, callback, success) {
  try { callback(); state.notice = success; }
  catch (error) { state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`; }
  render(state);
}
function bind(state) {
  state.handlers = {
    constraint: () => { try { notifyConstraint(state, 'operator'); }
      catch (error) { state.notice = `${error.name}: ${error.message}`; render(state); } },
    preview: () => invoke(state, () => { state.preview = state.onPreview({
      constraint: state.elements.constraint.value, delta: numericDelta(state.elements),
    }); }, 'Exact numeric draft and snap evidence created. Nothing was published.'),
    cancel: () => invoke(state, () => { state.onCancel('operator-cancel'); state.preview = null; },
      'Move preview cancelled without authority mutation.'),
    select: () => invoke(state, () => state.onSnapSelect(state.elements.candidates.value),
      'Snap candidate selected for review. Geometry is unchanged.'),
    previous: () => invoke(state, state.onSnapPrevious,
      'Previous snap candidate selected. Geometry is unchanged.'),
    next: () => invoke(state, state.onSnapNext,
      'Next snap candidate selected. Geometry is unchanged.'),
    use: () => invoke(state, () => { state.preview = state.onSnapUse(); },
      'Selected candidate explicitly applied to the preview only.'),
    clearSnap: () => invoke(state, () => { state.preview = state.onSnapClear(); },
      'Snap cleared; raw preview restored.'),
  };
  state.elements.constraint.addEventListener('change', state.handlers.constraint);
  state.elements.preview.addEventListener('click', state.handlers.preview);
  state.elements.cancel.addEventListener('click', state.handlers.cancel);
  state.elements.candidates.addEventListener('change', state.handlers.select);
  for (const name of ['previous', 'next', 'use', 'clearSnap']) {
    state.elements[name].addEventListener('click', state.handlers[name]);
  }
}
function destroyPanel(state) {
  if (state.destroyed) return false;
  state.destroyed = true;
  state.elements.constraint.removeEventListener('change', state.handlers.constraint);
  state.elements.preview.removeEventListener('click', state.handlers.preview);
  state.elements.cancel.removeEventListener('click', state.handlers.cancel);
  state.elements.candidates.removeEventListener('change', state.handlers.select);
  for (const name of ['previous', 'next', 'use', 'clearSnap']) {
    state.elements[name].removeEventListener('click', state.handlers[name]);
  }
  state.constraintListeners.clear(); state.elements.panel.remove(); return true;
}
function createPanelState(options, root) {
  return {
    elements: elements(root, install(root)),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
    onCancel: requiredFunction(options.onCancel, 'onCancel'),
    onSnapSelect: requiredFunction(options.onSnapSelect, 'onSnapSelect'),
    onSnapPrevious: requiredFunction(options.onSnapPrevious, 'onSnapPrevious'),
    onSnapNext: requiredFunction(options.onSnapNext, 'onSnapNext'),
    onSnapUse: requiredFunction(options.onSnapUse, 'onSnapUse'),
    onSnapClear: requiredFunction(options.onSnapClear, 'onSnapClear'),
    active: false, destroyed: false, target: null, preview: null,
    acquisition: null, review: null, notice: null, constraintListeners: new Set(),
  };
}
function panelApi(state) {
  return Object.freeze({
    schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setTarget(target) {
      state.target = target; state.preview = null; state.acquisition = null; state.review = null;
      state.notice = 'Target selected. Drag or preview an exact delta.';
      setDelta(state, { x: 0, y: 0, z: 0 }); render(state);
    },
    clearTarget(reason = null) {
      state.target = null; state.preview = null; state.acquisition = null;
      state.review = null; state.notice = reason; render(state);
    },
    setPreview(preview, notice = null) { state.preview = preview; state.notice = notice; render(state); },
    setSnapState(acquisition, review) { state.acquisition = acquisition; state.review = review; render(state); },
    setNotice(notice) { state.notice = notice; render(state); return notice; },
    setConstraint: (value, source) => setConstraint(state, value, source),
    subscribeConstraintChanged(callback) {
      const listener = requiredFunction(callback, 'constraint listener');
      state.constraintListeners.add(listener); return () => state.constraintListeners.delete(listener);
    },
    setDelta: (value) => setDelta(state, value),
    getConstraint: () => constraintValue(state.elements.constraint.value),
    getSnapProfile: () => snapProfile(state),
    getState: () => Object.freeze({
      active: state.active, targetId: state.target?.moveTargetId || null,
      operationId: state.preview?.operationId || null,
      constraint: constraintValue(state.elements.constraint.value),
      acquisitionFingerprint: state.acquisition?.acquisitionFingerprint || null,
      selectedCandidateId: state.review?.selectedCandidateId || null,
      destroyed: state.destroyed,
    }),
    destroy: () => destroyPanel(state),
  });
}
export function createSequentialSingleEntityMovePanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Single-entity move panel requires a root.');
  const state = createPanelState(options, root); bind(state); render(state); return panelApi(state);
}
export const _test = Object.freeze({ constraintValue, setConstraint, setDelta });

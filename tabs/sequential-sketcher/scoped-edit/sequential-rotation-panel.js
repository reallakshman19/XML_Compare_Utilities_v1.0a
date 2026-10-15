/** Explicit numeric rotation preview panel with pivot, scope and boundary evidence. */
import { SEQUENTIAL_ROTATION_SCOPE } from './sequential-rotation-target.js';

export const SEQUENTIAL_ROTATION_PANEL_SCHEMA = 'SequentialRotationPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Rotation panel element missing: ${selector}`);
  return value;
}
function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function field(name, label, value) {
  return `<label>${label}<input type="number" step="any" value="${value}" data-ssk-rotation-${name}></label>`;
}
function markup() {
  return `<section data-ssk-rotation-panel hidden aria-hidden="true" inert>
<header><strong>Rotate</strong><span>Rigid preview only</span></header>
<label>Scope<select data-ssk-rotation-scope><option value="COMPONENT_ONLY">Component</option><option value="CONNECTED_SUBGRAPH">Connected subgraph</option></select></label>
<div data-ssk-rotation-target>No rotation target.</div>
<fieldset><legend>Pivot</legend>${field('pivot-x', 'X', 0)}${field('pivot-y', 'Y', 0)}${field('pivot-z', 'Z', 0)}</fieldset>
<fieldset><legend>Axis</legend>${field('axis-x', 'X', 0)}${field('axis-y', 'Y', 0)}${field('axis-z', 'Z', 1)}</fieldset>
${field('angle', 'Angle °', 90)}
<label>Boundary tolerance<input type="number" step="any" value="1e-9" data-ssk-rotation-tolerance></label>
<div><button type="button" data-ssk-rotation-preview disabled>Preview rotation</button><button type="button" data-ssk-rotation-cancel disabled>Cancel preview</button></div>
<pre data-ssk-rotation-diagnosis>No boundary diagnosis.</pre>
<output data-ssk-rotation-status role="status" aria-live="polite">Select confirmed geometry.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-rotation-panel]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-rotation-panel]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'top:72px', 'z-index:11',
    'width:min(390px,calc(100% - 24px))', 'max-height:calc(100% - 84px)',
    'overflow:auto', 'padding:12px', 'border:1px solid rgba(168,85,247,.5)',
    'border-radius:12px', 'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  panel.querySelectorAll('input,select').forEach((element) => {
    element.style.cssText = 'box-sizing:border-box;width:100%;padding:6px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#07101f;color:#e2e8f0';
  });
  panel.querySelectorAll('button').forEach((button) => {
    button.style.cssText = 'margin:6px 6px 6px 0;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function elements(root, panel) {
  const names = ['pivot-x', 'pivot-y', 'pivot-z', 'axis-x', 'axis-y', 'axis-z'];
  return {
    panel, scope: required(root, '[data-ssk-rotation-scope]'),
    target: required(root, '[data-ssk-rotation-target]'),
    values: Object.fromEntries(names.map((name) => [name, required(root, `[data-ssk-rotation-${name}]`)])),
    angle: required(root, '[data-ssk-rotation-angle]'),
    tolerance: required(root, '[data-ssk-rotation-tolerance]'),
    preview: required(root, '[data-ssk-rotation-preview]'),
    cancel: required(root, '[data-ssk-rotation-cancel]'),
    diagnosis: required(root, '[data-ssk-rotation-diagnosis]'),
    status: required(root, '[data-ssk-rotation-status]'),
  };
}
function exactNumber(element, label) {
  if (element.value.trim() === '') throw new TypeError(`${label} is required.`);
  const value = Number(element.value);
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}
function pointValue(values, prefix, label) {
  return { x: exactNumber(values[`${prefix}-x`], `${label} X`),
    y: exactNumber(values[`${prefix}-y`], `${label} Y`),
    z: exactNumber(values[`${prefix}-z`], `${label} Z`) };
}
function inputValue(state) {
  return {
    pivot: pointValue(state.elements.values, 'pivot', 'Pivot'),
    axis: pointValue(state.elements.values, 'axis', 'Axis'),
    angleDegrees: exactNumber(state.elements.angle, 'Angle'),
    profile: { boundaryTolerance: exactNumber(state.elements.tolerance, 'Boundary tolerance') },
  };
}
function diagnosisText(preview) {
  if (!preview) return 'No boundary diagnosis.';
  const rows = preview.boundaryDiagnosis.boundaries.map((row) => (
    `${row.boundaryId}\n  gap=${row.separationMagnitude}\n  ${row.disposition}`
  ));
  return [`Disposition: ${preview.previewDisposition}`,
    `Aggregate: ${preview.boundaryDiagnosis.aggregateDisposition}`, ...rows].join('\n');
}
function targetText(target) {
  if (!target) return 'No rotation target.';
  return `${target.scope} · seed ${target.seedComponentId} · ${target.affectedComponentIds.length} component(s) · ${target.boundaryCuts.length} boundary cut(s)${target.locks.length ? ` · locks: ${target.locks.join(', ')}` : ''}`;
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  state.elements.target.textContent = targetText(state.target);
  state.elements.preview.disabled = !state.active || !state.target || state.destroyed;
  state.elements.cancel.disabled = !state.preview || state.destroyed;
  state.elements.diagnosis.textContent = diagnosisText(state.preview);
  state.elements.status.textContent = state.notice || (state.target
    ? 'Review pivot, axis and angle. Preview does not publish.' : 'Select confirmed geometry.');
}
function preview(state) {
  try {
    state.preview = state.onPreview(inputValue(state));
    state.notice = 'Rotation preview created. Boundary evidence must remain preserved before prepare.';
  } catch (error) {
    state.preview = null;
    state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
  }
  render(state);
}
function cancel(state, reason = 'operator-cancel') {
  state.onCancel(reason); state.preview = null;
  state.notice = `Rotation preview cleared: ${reason}.`; render(state);
}
function setPointFields(state, prefix, value) {
  for (const axis of ['x', 'y', 'z']) {
    state.elements.values[`${prefix}-${axis}`].value = String(value[axis]);
  }
}
function axisId(state) {
  try {
    const axis = pointValue(state.elements.values, 'axis', 'Axis');
    const length = Math.hypot(axis.x, axis.y, axis.z);
    if (!(length > 0)) return null;
    const value = { x: axis.x / length, y: axis.y / length, z: axis.z / length };
    const tolerance = 1e-12;
    if (Math.abs(value.x - 1) < tolerance && Math.abs(value.y) < tolerance && Math.abs(value.z) < tolerance) return 'X';
    if (Math.abs(value.y - 1) < tolerance && Math.abs(value.x) < tolerance && Math.abs(value.z) < tolerance) return 'Y';
    if (Math.abs(value.z - 1) < tolerance && Math.abs(value.x) < tolerance && Math.abs(value.y) < tolerance) return 'Z';
    return null;
  } catch { return null; }
}
function setAxis(state, value) {
  const axis = String(value || '').trim().toUpperCase();
  const vectors = { X: { x: 1, y: 0, z: 0 }, Y: { x: 0, y: 1, z: 0 }, Z: { x: 0, y: 0, z: 1 } };
  if (!vectors[axis]) throw new TypeError(`Rotation axis must be X, Y or Z: ${value}`);
  setPointFields(state, 'axis', vectors[axis]); state.onAxisChange(axis); render(state); return axis;
}
function bind(state) {
  state.handlers = {
    preview: () => preview(state), cancel: () => cancel(state),
    scope: () => { state.preview = null; state.notice = null; state.onScopeChange(state.elements.scope.value); },
    pivot: () => { try { state.onPivotChange(pointValue(state.elements.values, 'pivot', 'Pivot')); } catch {} },
    axis: () => { try { state.onAxisChange(axisId(state)); } catch {} },
  };
  state.elements.preview.addEventListener('click', state.handlers.preview);
  state.elements.cancel.addEventListener('click', state.handlers.cancel);
  state.elements.scope.addEventListener('change', state.handlers.scope);
  for (const axis of ['x', 'y', 'z']) {
    state.elements.values[`pivot-${axis}`].addEventListener('input', state.handlers.pivot);
    state.elements.values[`axis-${axis}`].addEventListener('input', state.handlers.axis);
  }
}
function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true;
  state.elements.preview.removeEventListener('click', state.handlers.preview);
  state.elements.cancel.removeEventListener('click', state.handlers.cancel);
  state.elements.scope.removeEventListener('change', state.handlers.scope);
  for (const axis of ['x', 'y', 'z']) {
    state.elements.values[`pivot-${axis}`].removeEventListener('input', state.handlers.pivot);
    state.elements.values[`axis-${axis}`].removeEventListener('input', state.handlers.axis);
  }
  state.elements.panel.remove(); return true;
}
export function createSequentialRotationPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Rotation panel requires a root.');
  const state = {
    elements: elements(root, install(root)),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
    onCancel: requiredFunction(options.onCancel, 'onCancel'),
    onScopeChange: requiredFunction(options.onScopeChange, 'onScopeChange'),
    onPivotChange: requiredFunction(options.onPivotChange || (() => {}), 'onPivotChange'),
    onAxisChange: requiredFunction(options.onAxisChange || (() => {}), 'onAxisChange'),
    active: false, destroyed: false, target: null, preview: null, notice: null,
  };
  bind(state); render(state);
  return Object.freeze({
    schema: SEQUENTIAL_ROTATION_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setTarget(target, pivot = null) {
      state.target = target; state.preview = null; state.notice = null;
      if (pivot) setPointFields(state, 'pivot', pivot); render(state);
    },
    clearTarget(reason = null) { state.target = null; state.preview = null; state.notice = reason; render(state); },
    setPreview(value, notice = null) { state.preview = value; state.notice = notice; render(state); },
    setPivot(value) { setPointFields(state, 'pivot', value); state.onPivotChange(value); render(state); },
    setAxis: (value) => setAxis(state, value),
    setAngle(value) { state.elements.angle.value = String(value); render(state); },
    getScope: () => state.elements.scope.value || SEQUENTIAL_ROTATION_SCOPE.COMPONENT_ONLY,
    getPivot: () => pointValue(state.elements.values, 'pivot', 'Pivot'),
    getAxis: () => pointValue(state.elements.values, 'axis', 'Axis'),
    getAxisId: () => axisId(state),
    getProfile: () => ({ boundaryTolerance: exactNumber(state.elements.tolerance, 'Boundary tolerance') }),
    getInput: () => inputValue(state),
    getState: () => Object.freeze({ active: state.active, scope: state.elements.scope.value,
      targetId: state.target?.rotationTargetId || null, operationId: state.preview?.operationId || null,
      pivot: state.target ? pointValue(state.elements.values, 'pivot', 'Pivot') : null,
      axisId: axisId(state), destroyed: state.destroyed }),
    destroy: () => destroy(state),
  });
}

export const _test = Object.freeze({ axisId, inputValue, pointValue, setPointFields });

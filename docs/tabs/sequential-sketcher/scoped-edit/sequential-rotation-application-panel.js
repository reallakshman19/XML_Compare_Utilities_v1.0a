/** Explicit prepare/review/apply panel for one boundary-compatible rotation. */
export const SEQUENTIAL_ROTATION_APPLICATION_PANEL_SCHEMA =
  'SequentialRotationApplicationPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Rotation application element missing: ${selector}`);
  return value;
}
function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function markup() {
  return `<section data-ssk-rotation-application hidden aria-hidden="true" inert>
<header><strong>Apply rotation</strong><span>Prepare / review / accept</span></header>
<label>Actor<input data-ssk-rotation-actor autocomplete="off"></label>
<label>Reason<input data-ssk-rotation-reason autocomplete="off"></label>
<label>Evidence<textarea data-ssk-rotation-evidence rows="2"></textarea></label>
<div><button type="button" data-ssk-rotation-prepare disabled>Prepare rotation</button><button type="button" data-ssk-rotation-accept disabled>Apply prepared</button><button type="button" data-ssk-rotation-discard disabled>Discard prepared</button></div>
<pre data-ssk-rotation-review>No prepared rotation.</pre>
<output data-ssk-rotation-application-status role="status" aria-live="polite">A compatible rotation preview can be prepared.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-rotation-application]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-rotation-application]');
  panel.style.cssText = [
    'position:absolute', 'left:12px', 'bottom:12px', 'z-index:10',
    'width:min(420px,calc(100% - 24px))', 'padding:12px',
    'border:1px solid rgba(168,85,247,.5)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  panel.querySelectorAll('input,textarea').forEach((element) => {
    element.style.cssText = 'box-sizing:border-box;width:100%;padding:6px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#07101f;color:#e2e8f0';
  });
  panel.querySelectorAll('button').forEach((button) => {
    button.style.cssText = 'margin:6px 6px 6px 0;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function elements(root, panel) {
  return {
    panel,
    actor: required(root, '[data-ssk-rotation-actor]'),
    reason: required(root, '[data-ssk-rotation-reason]'),
    evidence: required(root, '[data-ssk-rotation-evidence]'),
    prepare: required(root, '[data-ssk-rotation-prepare]'),
    accept: required(root, '[data-ssk-rotation-accept]'),
    discard: required(root, '[data-ssk-rotation-discard]'),
    review: required(root, '[data-ssk-rotation-review]'),
    status: required(root, '[data-ssk-rotation-application-status]'),
  };
}
function reviewText(prepared) {
  if (!prepared) return 'No prepared rotation.';
  const entry = prepared.candidate.entry;
  return [
    `Prepared: ${prepared.preparedId}`,
    `Scope: ${entry.scope}`,
    `Seed: ${entry.seedComponentId}`,
    `Components: ${entry.affectedComponentIds.join(', ')}`,
    `Pivot: ${entry.pivot.x}, ${entry.pivot.y}, ${entry.pivot.z}`,
    `Axis: ${entry.axis.x}, ${entry.axis.y}, ${entry.axis.z}`,
    `Angle: ${entry.angleDegrees}°`,
    `Boundaries: ${entry.boundaryDiagnosis.aggregateDisposition}`,
    `Previous journal: ${entry.previousHeadFingerprint}`,
    `Next journal: ${prepared.candidate.journal.headFingerprint}`,
    `Actor: ${entry.operator.actorId}`,
    `Reason: ${entry.operator.reason}`,
    `Publication: ${prepared.publicationState}`,
  ].join('\n');
}
function eligiblePreview(preview) {
  return Boolean(preview && !preview.noChange
    && preview.previewDisposition === 'PREVIEW_ONLY_ROTATION_CLEAR'
    && preview.target?.rotationEligible
    && preview.boundaryDiagnosis?.aggregateDisposition === 'PRESERVED');
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  const eligible = eligiblePreview(state.preview);
  state.elements.prepare.disabled = !state.active || !eligible || state.destroyed;
  state.elements.accept.disabled = !state.prepared || state.destroyed;
  state.elements.discard.disabled = !state.prepared || state.destroyed;
  state.elements.review.textContent = reviewText(state.prepared);
  state.elements.status.textContent = state.notice || (eligible
    ? 'Rotation is eligible for supervised preparation.'
    : 'Only a non-zero eligible rotation with preserved boundaries can be applied.');
}
function operatorInput(state) {
  return { actorId: state.elements.actor.value, reason: state.elements.reason.value,
    evidenceNote: state.elements.evidence.value };
}
function prepare(state) {
  try {
    state.prepared = state.onPrepare(state.preview, operatorInput(state));
    state.notice = 'Prepared rotation created. Review before explicit apply.';
  } catch (error) {
    state.prepared = null;
    state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
  }
  render(state);
}
function accept(state) {
  try {
    const result = state.onAccept(state.prepared);
    state.notice = result.accepted
      ? 'Rotation accepted and effective authority refreshed.'
      : `${result.reasonCode}: prepared rotation was not published.`;
    if (result.accepted) { state.prepared = null; state.preview = null; state.onCommitted(result); }
  } catch (error) {
    state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
  }
  render(state);
}
function discard(state, reason = 'operator-discard') {
  state.prepared = null; state.notice = `Prepared rotation discarded: ${reason}.`; render(state);
}
function bind(state) {
  state.handlers = { prepare: () => prepare(state), accept: () => accept(state),
    discard: () => discard(state) };
  state.elements.prepare.addEventListener('click', state.handlers.prepare);
  state.elements.accept.addEventListener('click', state.handlers.accept);
  state.elements.discard.addEventListener('click', state.handlers.discard);
}
function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true;
  state.elements.prepare.removeEventListener('click', state.handlers.prepare);
  state.elements.accept.removeEventListener('click', state.handlers.accept);
  state.elements.discard.removeEventListener('click', state.handlers.discard);
  state.elements.panel.remove(); return true;
}
export function createSequentialRotationApplicationPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Rotation application panel requires a root.');
  const panel = install(root);
  const state = {
    elements: elements(root, panel),
    onPrepare: requiredFunction(options.onPrepare, 'onPrepare'),
    onAccept: requiredFunction(options.onAccept, 'onAccept'),
    onCommitted: requiredFunction(options.onCommitted, 'onCommitted'),
    active: false, destroyed: false, preview: null, prepared: null, notice: null,
  };
  bind(state); render(state);
  return Object.freeze({
    schema: SEQUENTIAL_ROTATION_APPLICATION_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setPreview(preview, reason = null) { state.preview = preview; state.prepared = null; state.notice = reason; render(state); },
    invalidate(reason = 'authority-change') { state.preview = null; state.prepared = null; state.notice = reason; render(state); },
    discard: (reason) => discard(state, reason),
    getState: () => Object.freeze({ active: state.active,
      operationId: state.preview?.operationId || null,
      preparedId: state.prepared?.preparedId || null, destroyed: state.destroyed }),
    destroy: () => destroy(state),
  });
}

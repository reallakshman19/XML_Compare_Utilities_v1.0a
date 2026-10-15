/** Explicit prepare/review/apply panel for one qualified node stretch. */
export const SEQUENTIAL_NODE_STRETCH_APPLICATION_PANEL_SCHEMA =
  'SequentialNodeStretchApplicationPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Node stretch application element missing: ${selector}`);
  return value;
}
function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function markup() {
  return `<section data-ssk-node-stretch-application hidden aria-hidden="true" inert>
<header><strong>Apply node stretch</strong><span>Prepare / review / accept</span></header>
<label>Actor<input data-ssk-node-stretch-actor autocomplete="off"></label>
<label>Reason<input data-ssk-node-stretch-reason autocomplete="off"></label>
<label>Evidence<textarea data-ssk-node-stretch-evidence rows="2"></textarea></label>
<div><button type="button" data-ssk-node-stretch-prepare disabled>Prepare stretch</button>
<button type="button" data-ssk-node-stretch-accept disabled>Apply prepared</button>
<button type="button" data-ssk-node-stretch-discard disabled>Discard prepared</button></div>
<pre data-ssk-node-stretch-review>No prepared stretch.</pre>
<output data-ssk-node-stretch-application-status role="status" aria-live="polite">A qualified non-zero stretch preview can be prepared.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-node-stretch-application]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-node-stretch-application]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'bottom:12px', 'z-index:10',
    'width:min(410px,calc(100% - 24px))', 'padding:12px',
    'border:1px solid rgba(249,115,22,.55)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
    'box-shadow:0 18px 50px rgba(0,0,0,.38)',
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
    actor: required(root, '[data-ssk-node-stretch-actor]'),
    reason: required(root, '[data-ssk-node-stretch-reason]'),
    evidence: required(root, '[data-ssk-node-stretch-evidence]'),
    prepare: required(root, '[data-ssk-node-stretch-prepare]'),
    accept: required(root, '[data-ssk-node-stretch-accept]'),
    discard: required(root, '[data-ssk-node-stretch-discard]'),
    review: required(root, '[data-ssk-node-stretch-review]'),
    status: required(root, '[data-ssk-node-stretch-application-status]'),
  };
}
function reviewText(prepared) {
  if (!prepared) return 'No prepared stretch.';
  const entry = prepared.candidate.entry;
  return [
    `Prepared: ${prepared.preparedId}`,
    `Node: ${entry.nodeId}`,
    `Selected component: ${entry.componentId}`,
    `Affected components: ${entry.affectedComponentIds.join(', ')}`,
    `Operation: ${entry.operationId}`,
    `Target: ${entry.targetPosition.x}, ${entry.targetPosition.y}, ${entry.targetPosition.z}`,
    `Delta: ${entry.delta.x}, ${entry.delta.y}, ${entry.delta.z}`,
    `Minimum length: ${entry.profile.minimumLengthMm} mm`,
    `Previous journal: ${entry.previousHeadFingerprint}`,
    `Next journal: ${prepared.candidate.journal.headFingerprint}`,
    `Actor: ${entry.operator.actorId}`,
    `Reason: ${entry.operator.reason}`,
    `Publication: ${prepared.publicationState}`,
  ].join('\n');
}
function eligiblePreview(preview) {
  return Boolean(preview && !preview.noChange
    && preview.previewDisposition === 'PREVIEW_ONLY_NODE_STRETCH_QUALIFIED');
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  const eligible = eligiblePreview(state.preview);
  state.elements.prepare.disabled = !state.active || !eligible || state.destroyed;
  state.elements.accept.disabled = !state.prepared || state.destroyed;
  state.elements.discard.disabled = !state.prepared || state.destroyed;
  state.elements.review.textContent = reviewText(state.prepared);
  state.elements.status.textContent = state.notice || (eligible
    ? 'Stretch preview is eligible for supervised preparation.'
    : 'Only a qualified non-zero node stretch can be applied.');
}
function operatorInput(state) {
  return {
    actorId: state.elements.actor.value,
    reason: state.elements.reason.value,
    evidenceNote: state.elements.evidence.value,
  };
}
function prepare(state) {
  try {
    state.prepared = state.onPrepare(state.preview, operatorInput(state));
    state.notice = 'Prepared stretch evidence created. Review before explicit apply.';
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
      ? 'Node stretch accepted and effective authority refreshed.'
      : `${result.reasonCode}: prepared stretch was not published.`;
    if (result.accepted) {
      state.prepared = null; state.preview = null; state.onCommitted(result);
    }
  } catch (error) {
    state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
  }
  render(state);
}
function discard(state, reason = 'operator-discard') {
  state.prepared = null; state.notice = `Prepared stretch discarded: ${reason}.`; render(state);
}
function bind(state) {
  state.handlers = { prepare: () => prepare(state), accept: () => accept(state), discard: () => discard(state) };
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
export function createSequentialNodeStretchApplicationPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Node stretch application panel requires a root.');
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
    schema: SEQUENTIAL_NODE_STRETCH_APPLICATION_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setPreview(preview, reason = null) {
      state.preview = preview; state.prepared = null; state.notice = reason; render(state);
    },
    invalidate(reason = 'authority-change') {
      state.preview = null; state.prepared = null; state.notice = reason; render(state);
    },
    discard: (reason) => discard(state, reason),
    getState: () => Object.freeze({
      active: state.active, operationId: state.preview?.operationId || null,
      preparedId: state.prepared?.preparedId || null, destroyed: state.destroyed,
    }),
    destroy: () => destroy(state),
  });
}

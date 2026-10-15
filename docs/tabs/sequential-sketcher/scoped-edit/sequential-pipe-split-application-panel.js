/** Explicit prepare/review/apply panel for one pipe split. */
export const SEQUENTIAL_PIPE_SPLIT_APPLICATION_PANEL_SCHEMA =
  'SequentialPipeSplitApplicationPanel.v1';
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Pipe split application element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-pipe-split-application hidden>
<h3>Apply split</h3><label>Actor <input data-ssk-split-actor></label>
<label>Reason <input data-ssk-split-reason></label>
<label>Evidence <input data-ssk-split-note></label>
<button type="button" data-ssk-split-prepare>Prepare split</button>
<button type="button" data-ssk-split-apply disabled>Apply prepared</button>
<button type="button" data-ssk-split-discard>Discard prepared</button>
<pre data-ssk-split-review>No prepared split.</pre></section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-pipe-split-application]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-pipe-split-application]');
  panel.style.cssText = 'position:absolute;right:12px;bottom:12px;z-index:13;width:300px;padding:10px;border:1px solid rgba(148,163,184,.4);border-radius:10px;background:rgba(7,16,31,.95);color:#e2e8f0';
  return panel;
}
function operator(state) {
  return { actorId: required(state.panel, '[data-ssk-split-actor]').value,
    reason: required(state.panel, '[data-ssk-split-reason]').value,
    evidenceNote: required(state.panel, '[data-ssk-split-note]').value };
}
function render(state) {
  state.panel.hidden = !state.active;
  required(state.panel, '[data-ssk-split-prepare]').disabled = !state.preview;
  required(state.panel, '[data-ssk-split-apply]').disabled = !state.prepared;
  required(state.panel, '[data-ssk-split-review]').textContent = state.prepared
    ? `prepared=${state.prepared.preparedId}\nparent=${state.prepared.preview.target.parentComponentId}\nt=${state.prepared.preview.location.parameter}\nchildren=${state.prepared.preview.identities.upstreamComponentId}, ${state.prepared.preview.identities.downstreamComponentId}\nstate=${state.prepared.publicationState}`
    : 'No prepared split.';
}
function bind(state) {
  state.onClick = (event) => {
    if (event.target.closest?.('[data-ssk-split-prepare]')) {
      event.preventDefault(); state.prepared = state.onPrepare(operator(state)); render(state);
    } else if (event.target.closest?.('[data-ssk-split-apply]')) {
      event.preventDefault(); state.onApply(state.prepared);
    } else if (event.target.closest?.('[data-ssk-split-discard]')) {
      event.preventDefault(); state.prepared = null; state.onDiscard(); render(state);
    }
  };
  state.panel.addEventListener('click', state.onClick);
}
export function createSequentialPipeSplitApplicationPanel(options = {}) {
  const state = { panel: install(options.root), active: false, preview: null,
    prepared: null, onPrepare: options.onPrepare, onApply: options.onApply,
    onDiscard: options.onDiscard || (() => {}), onClick: null };
  if (![state.onPrepare, state.onApply].every((row) => typeof row === 'function')) {
    throw new TypeError('Pipe split application panel requires prepare and apply callbacks.');
  }
  bind(state); render(state);
  return Object.freeze({ schema: SEQUENTIAL_PIPE_SPLIT_APPLICATION_PANEL_SCHEMA,
    setActive(value) { state.active = value === true; render(state); },
    setPreview(value) { state.preview = value; state.prepared = null; render(state); },
    clear() { state.preview = null; state.prepared = null; render(state); },
    getState: () => Object.freeze({ active: state.active,
      previewOperationId: state.preview?.operationId || null,
      preparedId: state.prepared?.preparedId || null }),
    destroy() { state.panel.removeEventListener('click', state.onClick);
      state.panel.remove(); return true; } });
}

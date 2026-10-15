/** Contained exact-input panel for one straight-pipe split preview. */
export const SEQUENTIAL_PIPE_SPLIT_PANEL_SCHEMA = 'SequentialPipeSplitPanel.v1';
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Pipe split panel element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-pipe-split-panel hidden>
<h3>Split pipe</h3><div data-ssk-pipe-split-target>No pipe selected</div>
<label>Location <select data-ssk-split-mode><option value="PARAMETER">Exact parameter</option><option value="ACQUIRED_POINT">Acquired point</option></select></label>
<label>Parameter t <input data-ssk-split-t type="number" min="0" max="1" step="0.001" value="0.5"></label>
<div><label>X <input data-ssk-split-x type="number" value="0"></label><label>Y <input data-ssk-split-y type="number" value="0"></label><label>Z <input data-ssk-split-z type="number" value="0"></label></div>
<label>Minimum end distance <input data-ssk-split-min type="number" min="0" value="1"></label>
<label>Projection tolerance <input data-ssk-split-tol type="number" min="0" value="0.001"></label>
<button type="button" data-ssk-split-preview>Preview split</button>
<button type="button" data-ssk-split-cancel>Cancel preview</button>
<pre data-ssk-split-diagnosis>No preview.</pre></section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-pipe-split-panel]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-pipe-split-panel]');
  panel.style.cssText = 'position:absolute;right:12px;top:72px;z-index:13;width:300px;padding:10px;border:1px solid rgba(148,163,184,.4);border-radius:10px;background:rgba(7,16,31,.95);color:#e2e8f0';
  panel.querySelectorAll('input,select,button').forEach((row) => { row.style.margin = '3px'; });
  return panel;
}
function raw(panel, selector) { return required(panel, selector).value; }
function inputValue(state) {
  const mode = required(state.panel, '[data-ssk-split-mode]').value;
  return { mode, parameter: raw(state.panel, '[data-ssk-split-t]'),
    acquiredPoint: { x: raw(state.panel, '[data-ssk-split-x]'),
      y: raw(state.panel, '[data-ssk-split-y]'), z: raw(state.panel, '[data-ssk-split-z]') },
    minimumEndDistance: raw(state.panel, '[data-ssk-split-min]'),
    projectionTolerance: raw(state.panel, '[data-ssk-split-tol]') };
}
function render(state) {
  state.panel.hidden = !state.active;
  state.panel.querySelector('[data-ssk-pipe-split-target]').textContent = state.target
    ? `PIPE ${state.target.parentComponentId}` : 'No pipe selected';
  const preview = state.preview;
  state.panel.querySelector('[data-ssk-split-diagnosis]').textContent = preview
    ? `t=${preview.location.parameter}\nposition=${JSON.stringify(preview.splitPosition)}\nchildren=${preview.identities.upstreamComponentId}, ${preview.identities.downstreamComponentId}\nnew node=${preview.identities.splitNodeId}`
    : 'No preview.';
}
function bind(state) {
  state.onClick = (event) => {
    if (event.target.closest?.('[data-ssk-split-preview]')) {
      event.preventDefault(); state.onPreview(inputValue(state));
    } else if (event.target.closest?.('[data-ssk-split-cancel]')) {
      event.preventDefault(); state.onCancel('operator-cancel');
    }
  };
  state.panel.addEventListener('click', state.onClick);
}
export function createSequentialPipeSplitPanel(options = {}) {
  const state = { panel: install(options.root), active: false, target: null, preview: null,
    onPreview: options.onPreview, onCancel: options.onCancel, onClick: null };
  if (typeof state.onPreview !== 'function' || typeof state.onCancel !== 'function') {
    throw new TypeError('Pipe split panel requires preview and cancel callbacks.');
  }
  bind(state); render(state);
  return Object.freeze({ schema: SEQUENTIAL_PIPE_SPLIT_PANEL_SCHEMA,
    setActive(value) { state.active = value === true; render(state); },
    setTarget(value) { state.target = value; state.preview = null; render(state); },
    setPreview(value) { state.preview = value; render(state); },
    clear() { state.target = null; state.preview = null; render(state); },
    getState: () => Object.freeze({ active: state.active,
      targetId: state.target?.splitTargetId || null,
      operationId: state.preview?.operationId || null }),
    destroy() { state.panel.removeEventListener('click', state.onClick);
      state.panel.remove(); return true; } });
}

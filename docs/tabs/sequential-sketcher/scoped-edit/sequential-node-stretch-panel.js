/** Exact numeric preview panel for one selected certified topology node. */
export const SEQUENTIAL_NODE_STRETCH_PANEL_SCHEMA = 'SequentialNodeStretchPanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Node stretch panel element missing: ${selector}`);
  return value;
}
function setHidden(element, hidden) {
  element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function markup() {
  return `<section data-ssk-node-stretch-panel hidden aria-hidden="true" inert>
<header><strong>Stretch certified node</strong><span>Exact target coordinates</span></header>
<label>Node<select data-ssk-node-stretch-node></select></label>
<div data-ssk-node-stretch-position>Pick a confirmed component in Stretch node mode.</div>
<div><label>X<input data-ssk-node-stretch-x inputmode="decimal"></label>
<label>Y<input data-ssk-node-stretch-y inputmode="decimal"></label>
<label>Z<input data-ssk-node-stretch-z inputmode="decimal"></label></div>
<div><label>Minimum length (mm)<input data-ssk-node-stretch-min value="1" inputmode="decimal"></label>
<label>Zero tolerance (mm)<input data-ssk-node-stretch-zero value="0.000000001" inputmode="decimal"></label>
<label>Collinearity tolerance<input data-ssk-node-stretch-collinear value="0.000000001" inputmode="decimal"></label></div>
<div><button type="button" data-ssk-node-stretch-preview disabled>Preview stretch</button>
<button type="button" data-ssk-node-stretch-cancel disabled>Cancel stretch</button></div>
<output data-ssk-node-stretch-status role="status" aria-live="polite">Select a qualified port-bearing node.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-node-stretch-panel]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-node-stretch-panel]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'top:12px', 'z-index:11',
    'width:min(410px,calc(100% - 24px))', 'padding:12px',
    'border:1px solid rgba(249,115,22,.55)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
    'box-shadow:0 18px 50px rgba(0,0,0,.38)',
  ].join(';');
  panel.querySelectorAll('input,select').forEach((element) => {
    element.style.cssText = 'box-sizing:border-box;width:100%;padding:6px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#07101f;color:#e2e8f0';
  });
  panel.querySelectorAll('button').forEach((button) => {
    button.style.cssText = 'margin:6px 6px 0 0;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function elements(root, panel) {
  return {
    panel,
    node: required(root, '[data-ssk-node-stretch-node]'),
    position: required(root, '[data-ssk-node-stretch-position]'),
    x: required(root, '[data-ssk-node-stretch-x]'),
    y: required(root, '[data-ssk-node-stretch-y]'),
    z: required(root, '[data-ssk-node-stretch-z]'),
    minimum: required(root, '[data-ssk-node-stretch-min]'),
    zero: required(root, '[data-ssk-node-stretch-zero]'),
    collinear: required(root, '[data-ssk-node-stretch-collinear]'),
    preview: required(root, '[data-ssk-node-stretch-preview]'),
    cancel: required(root, '[data-ssk-node-stretch-cancel]'),
    status: required(root, '[data-ssk-node-stretch-status]'),
  };
}
function finiteInput(element, label) {
  const text = String(element.value || '').trim();
  const value = Number(text);
  if (!text || !Number.isFinite(value)) throw new TypeError(`${label} must be explicitly finite.`);
  return value;
}
function selectedNode(state) {
  const nodeId = String(state.elements.node.value || '').trim();
  return state.selection?.nodes.find((row) => row.nodeId === nodeId) || null;
}
function previewInput(state) {
  return {
    targetPosition: {
      x: finiteInput(state.elements.x, 'Target X'),
      y: finiteInput(state.elements.y, 'Target Y'),
      z: finiteInput(state.elements.z, 'Target Z'),
    },
    profile: {
      minimumLengthMm: finiteInput(state.elements.minimum, 'Minimum length'),
      zeroLengthToleranceMm: finiteInput(state.elements.zero, 'Zero tolerance'),
      collinearityTolerance: finiteInput(state.elements.collinear, 'Collinearity tolerance'),
    },
  };
}
function renderNode(state) {
  const node = selectedNode(state);
  state.elements.preview.disabled = !state.active || !node || state.destroyed;
  state.elements.cancel.disabled = !state.preview || state.destroyed;
  if (!node) return;
  state.elements.position.textContent = `Current: ${node.position.x}, ${node.position.y}, ${node.position.z} · Ports: ${node.portIds.join(', ')}`;
  if (!state.preview) {
    state.elements.x.value = String(node.position.x);
    state.elements.y.value = String(node.position.y);
    state.elements.z.value = String(node.position.z);
  }
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  renderNode(state);
  state.elements.status.textContent = state.notice || (state.selection
    ? 'Choose a qualified node and enter the exact target point.'
    : 'Pick a confirmed component in Stretch node mode.');
}
function populateNodes(state) {
  state.elements.node.innerHTML = '';
  for (const node of state.selection?.nodes || []) {
    const option = state.elements.node.ownerDocument.createElement('option');
    option.value = node.nodeId;
    option.textContent = `${node.nodeId} · ${node.boundaryClass} · ${node.portIds.join(', ')}`;
    state.elements.node.appendChild(option);
  }
}
function preview(state) {
  try {
    const node = selectedNode(state);
    if (!node) throw new RangeError('Select a qualified stretch node.');
    state.preview = state.onPreview(node.nodeId, previewInput(state));
    state.notice = 'Node stretch preview created. Nothing was published.';
  } catch (error) {
    state.preview = null;
    state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
  }
  render(state);
}
function cancel(state, reason = 'operator-cancel') {
  state.preview = null; state.onCancel(reason);
  state.notice = `Node stretch preview cleared: ${reason}.`; render(state);
}
function bind(state) {
  state.handlers = {
    node: () => { state.preview = null; state.onNodeChange(selectedNode(state)?.nodeId || null); render(state); },
    preview: () => preview(state),
    cancel: () => cancel(state),
  };
  state.elements.node.addEventListener('change', state.handlers.node);
  state.elements.preview.addEventListener('click', state.handlers.preview);
  state.elements.cancel.addEventListener('click', state.handlers.cancel);
}
function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true;
  state.elements.node.removeEventListener('change', state.handlers.node);
  state.elements.preview.removeEventListener('click', state.handlers.preview);
  state.elements.cancel.removeEventListener('click', state.handlers.cancel);
  state.elements.panel.remove(); return true;
}
export function createSequentialNodeStretchPanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Node stretch panel requires a root.');
  const panel = install(root);
  const state = {
    elements: elements(root, panel),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
    onCancel: requiredFunction(options.onCancel, 'onCancel'),
    onNodeChange: requiredFunction(options.onNodeChange, 'onNodeChange'),
    active: false, destroyed: false, selection: null, preview: null, notice: null,
  };
  bind(state); render(state);
  return Object.freeze({
    schema: SEQUENTIAL_NODE_STRETCH_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setSelection(value, reason = null) {
      state.selection = value; state.preview = null; state.notice = reason;
      populateNodes(state); render(state);
    },
    setPreview(value, reason = null) { state.preview = value; state.notice = reason; render(state); },
    clear(reason = null) {
      state.selection = null; state.preview = null; state.notice = reason;
      populateNodes(state); render(state);
    },
    getSelectedNodeId: () => selectedNode(state)?.nodeId || null,
    getState: () => Object.freeze({
      active: state.active, componentId: state.selection?.componentId || null,
      nodeId: selectedNode(state)?.nodeId || null,
      operationId: state.preview?.operationId || null, destroyed: state.destroyed,
    }),
    destroy: () => destroy(state),
  });
}

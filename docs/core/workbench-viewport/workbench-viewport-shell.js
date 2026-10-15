import { WorkbenchViewportCapability } from './workbench-viewport-host.js';

export const WORKBENCH_VIEWPORT_SHELL_SCHEMA = 'WorkbenchViewportShellModel.v1';

const BUILTIN_ACTIONS = Object.freeze([
  { id: 'fit', capability: WorkbenchViewportCapability.FIT, label: 'Auto Fit' },
  { id: 'range', capability: WorkbenchViewportCapability.RANGE, label: 'Range' },
  { id: 'scale-ratio', capability: WorkbenchViewportCapability.SCALE_RATIO, label: 'Scale' },
  { id: 'grid', capability: WorkbenchViewportCapability.GRID, label: 'Grid' },
  { id: 'minor-grid', capability: WorkbenchViewportCapability.MINOR_GRID, label: 'Minor' },
  { id: 'crosshair', capability: WorkbenchViewportCapability.CROSSHAIR, label: 'Crosshair' },
  { id: 'link-x', capability: WorkbenchViewportCapability.LINK_X, label: 'Link X' },
  { id: 'link-y', capability: WorkbenchViewportCapability.LINK_Y, label: 'Link Y' },
]);

function actionModel(action, labels) {
  return Object.freeze({
    id: action.id,
    capability: action.capability,
    label: labels?.[action.id] || action.label,
    kind: action.kind || 'button',
  });
}

function shellSource(value = {}) {
  const namespace = String(value.namespace || '').trim();
  const surfaceId = String(value.surfaceId || '').trim();
  const modeId = String(value.modeId || '').trim();
  if (!namespace || !surfaceId || !modeId) throw new TypeError('Shell source requires namespace, surfaceId, and modeId.');
  return { namespace, surfaceId, modeId, capabilities: Array.isArray(value.capabilities) ? value.capabilities : [] };
}

function enabledExtensions(actions, capabilities) {
  return (actions || []).filter((action) => !action.capability || capabilities.includes(action.capability));
}

export function buildWorkbenchViewportShellModel(host, options = {}) {
  const source = shellSource(host);
  const actions = BUILTIN_ACTIONS
    .filter((action) => source.capabilities.includes(action.capability))
    .map((action) => actionModel(action, options.labels));
  const extensions = enabledExtensions(options.extensionActions, source.capabilities)
    .map((action) => actionModel(action, options.labels));
  return Object.freeze({
    schema: WORKBENCH_VIEWPORT_SHELL_SCHEMA,
    namespace: source.namespace,
    activeSurfaceId: source.surfaceId,
    modeId: source.modeId,
    surfaces: Object.freeze([...(options.surfaces || [])]),
    actions: Object.freeze([...actions, ...extensions]),
    statusSegments: Object.freeze([...(typeof host.statusSegments === 'function' ? host.statusSegments() : options.statusSegments || [])]),
  });
}

export function positionWorkbenchPalette(palette, trigger, doc = globalThis.document) {
  if (!palette || !trigger) return false;
  palette.hidden = false;
  const viewport = doc?.documentElement;
  const width = viewport?.clientWidth || globalThis.innerWidth || 1024;
  const height = viewport?.clientHeight || globalThis.innerHeight || 768;
  const triggerRect = trigger.getBoundingClientRect();
  const paletteRect = palette.getBoundingClientRect();
  const left = Math.max(12, Math.min(triggerRect.left, width - paletteRect.width - 12));
  let top = triggerRect.bottom + 6;
  if (top + paletteRect.height > height - 12) top = Math.max(12, triggerRect.top - paletteRect.height - 6);
  palette.style.left = `${left}px`;
  palette.style.top = `${top}px`;
  return true;
}

export function observeWorkbenchAttribute(target, attribute, callback) {
  const Observer = target?.ownerDocument?.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (typeof Observer !== 'function') return null;
  const observer = new Observer(() => callback());
  observer.observe(target, { attributes: true, attributeFilter: [attribute] });
  return observer;
}

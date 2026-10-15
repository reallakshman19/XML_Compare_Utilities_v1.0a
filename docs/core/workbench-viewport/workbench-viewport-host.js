export const WORKBENCH_VIEWPORT_HOST_SCHEMA = 'WorkbenchViewportHost.v1';

export const WorkbenchViewportCapability = Object.freeze({
  FIT: 'fit',
  RANGE: 'range',
  SCALE_RATIO: 'scale-ratio',
  GRID: 'grid',
  MINOR_GRID: 'minor-grid',
  CROSSHAIR: 'crosshair',
  LINK_X: 'link-x',
  LINK_Y: 'link-y',
  SELECT_SURFACE: 'select-surface',
});

const REQUIRED_METHODS = Object.freeze([
  'getPlotBounds',
  'getWorldBounds',
  'worldToScreen',
  'screenToWorld',
  'readViewTransform',
  'applyViewTransform',
  'invalidate',
  'formatPointer',
  'statusSegments',
  'subscribe',
  'dispose',
]);

function identifier(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} must be a non-empty string.`);
  return text;
}

function capabilitiesOf(value) {
  const source = value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
  return Object.freeze([...new Set(source.map(String))]);
}

export function validateWorkbenchViewportHost(host) {
  if (!host || typeof host !== 'object') throw new TypeError('Workbench viewport host is required.');
  if (host.schema !== WORKBENCH_VIEWPORT_HOST_SCHEMA) throw new TypeError('Unsupported workbench viewport host schema.');
  identifier(host.namespace, 'namespace');
  identifier(host.surfaceId, 'surfaceId');
  identifier(host.modeId, 'modeId');
  REQUIRED_METHODS.forEach((method) => {
    if (typeof host[method] !== 'function') throw new TypeError(`Workbench viewport host requires ${method}().`);
  });
  if (!Array.isArray(host.capabilities)) throw new TypeError('Workbench viewport host capabilities must be an array.');
  return true;
}

export function createWorkbenchViewportHost(spec = {}) {
  const host = Object.freeze({
    ...spec,
    schema: WORKBENCH_VIEWPORT_HOST_SCHEMA,
    namespace: identifier(spec.namespace, 'namespace'),
    surfaceId: identifier(spec.surfaceId, 'surfaceId'),
    modeId: identifier(spec.modeId, 'modeId'),
    capabilities: capabilitiesOf(spec.capabilities),
  });
  validateWorkbenchViewportHost(host);
  return host;
}

export function hostSupports(host, capability) {
  validateWorkbenchViewportHost(host);
  return host.capabilities.includes(capability);
}

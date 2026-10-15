/** Renderer-neutral lifecycle contract for interchangeable engineering viewers. */

export const ENGINEERING_VIEWER_LIFECYCLE_METHODS = Object.freeze([
  'setSelection',
  'fitAll',
  'fitSelection',
  'reattach',
  'getStateSnapshot',
  'dispose',
]);

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function requiredMethods(specification) {
  if (!Array.isArray(specification?.requiredMethods)) {
    throw new TypeError('Engineering viewer specification requires requiredMethods.');
  }
  const methods = specification.requiredMethods.map((method, index) => (
    requiredText(method, `requiredMethods[${index}]`)
  ));
  if (new Set(methods).size !== methods.length) {
    throw new TypeError('Engineering viewer requiredMethods must be unique.');
  }
  return methods;
}

export function assertEngineeringViewerBackend(viewer, specification) {
  if (!viewer || typeof viewer !== 'object') {
    throw new TypeError(`${requiredText(specification?.label, 'Viewer label')} must be an object.`);
  }
  const label = requiredText(specification?.label, 'Viewer label');
  const missing = requiredMethods(specification).filter((method) => typeof viewer[method] !== 'function');
  if (missing.length) throw new TypeError(`${label} is missing: ${missing.join(', ')}.`);
  return viewer;
}

export function createEngineeringViewerFactory(factory, specification) {
  if (typeof factory !== 'function') {
    throw new TypeError(`${requiredText(specification?.label, 'Viewer label')} factory must be a function.`);
  }
  requiredMethods(specification);
  return async (host, callbacks) => assertEngineeringViewerBackend(
    await factory(host, callbacks),
    specification,
  );
}

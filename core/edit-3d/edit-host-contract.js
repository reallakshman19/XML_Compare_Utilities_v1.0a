/** Minimum domain surface required by the shared scoped 3D editor. */

export const EDIT_HOST_REQUIRED_METHODS = Object.freeze([
  'scene',
  'appendEditCommand',
  'entityGeometry',
  'resolveScope',
]);

export function assertEditHostContract(host) {
  if (!host || typeof host !== 'object') {
    throw new TypeError('Edit host must be an object.');
  }
  for (const name of EDIT_HOST_REQUIRED_METHODS) {
    if (typeof host[name] !== 'function') {
      throw new TypeError(`Edit host is missing ${name}().`);
    }
  }
  return host;
}

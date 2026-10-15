/** Headless shape conformance for prospective universal Edit 3D hosts. */

import { EDIT_HOST_REQUIRED_METHODS } from './edit-host-contract.js';

export const EDIT_3D_HOST_CONFORMANCE_V1 = 'Edit3DHostConformance.v1';

export function assertEdit3DHostConformance(host) {
  if (!host || typeof host !== 'object' || Array.isArray(host)) {
    throw new TypeError('Edit 3D host must be an object.');
  }
  for (const name of EDIT_HOST_REQUIRED_METHODS) {
    if (typeof host[name] !== 'function') {
      throw new TypeError(`Edit 3D host is missing ${name}().`);
    }
  }
  return Object.freeze({
    schema: EDIT_3D_HOST_CONFORMANCE_V1,
    valid: true,
    requiredMethods: Object.freeze([...EDIT_HOST_REQUIRED_METHODS]),
  });
}

/** Immutable presentation-only viewer policy for Revision Compare workspaces. */
import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';
import { REVISION_COMPARE_VIEWER_BACKEND } from './revision-compare-viewer-backend.js';

export const REVISION_COMPARE_VIEWER_POLICY_SCHEMA = 'RevisionCompareViewerPolicy.v1';
export const REVISION_COMPARE_FAILOVER_MODE = 'EXPLICIT_USER_ACTION';
export const REVISION_COMPARE_VIEWER_PERSISTENCE = 'WORKSPACE_ONLY';

function backend(value, label) {
  if (!Object.values(REVISION_COMPARE_VIEWER_BACKEND).includes(value)) {
    throw new TypeError(`${label} must be SVG or WEBGL.`);
  }
  return value;
}

function presentation(value) {
  if (!['overlay', 'side-by-side'].includes(value)) {
    throw new TypeError('defaultSvgPresentation must be overlay or side-by-side.');
  }
  return value;
}

function retainedBackends(values) {
  if (!Array.isArray(values)) throw new TypeError('retainedBackends must be an array.');
  const canonical = [REVISION_COMPARE_VIEWER_BACKEND.SVG, REVISION_COMPARE_VIEWER_BACKEND.WEBGL];
  if (values.length !== canonical.length || values.some((value, index) => value !== canonical[index])) {
    throw new TypeError('retainedBackends must be [SVG, WEBGL] in canonical order.');
  }
  return canonical;
}

export function createRevisionCompareViewerPolicy(input = {}) {
  const policy = {
    schema: REVISION_COMPARE_VIEWER_POLICY_SCHEMA,
    defaultBackend: backend(input.defaultBackend ?? REVISION_COMPARE_VIEWER_BACKEND.SVG, 'defaultBackend'),
    defaultSvgPresentation: presentation(input.defaultSvgPresentation ?? 'overlay'),
    retainedBackends: retainedBackends(input.retainedBackends ?? [
      REVISION_COMPARE_VIEWER_BACKEND.SVG,
      REVISION_COMPARE_VIEWER_BACKEND.WEBGL,
    ]),
    recoveryBackendForSvgFailure: backend(
      input.recoveryBackendForSvgFailure ?? REVISION_COMPARE_VIEWER_BACKEND.WEBGL,
      'recoveryBackendForSvgFailure',
    ),
    recoveryBackendForWebglFailure: backend(
      input.recoveryBackendForWebglFailure ?? REVISION_COMPARE_VIEWER_BACKEND.SVG,
      'recoveryBackendForWebglFailure',
    ),
    failoverMode: input.failoverMode ?? REVISION_COMPARE_FAILOVER_MODE,
    persistence: input.persistence ?? REVISION_COMPARE_VIEWER_PERSISTENCE,
  };
  if (policy.recoveryBackendForSvgFailure !== REVISION_COMPARE_VIEWER_BACKEND.WEBGL
    || policy.recoveryBackendForWebglFailure !== REVISION_COMPARE_VIEWER_BACKEND.SVG) {
    throw new TypeError('Recovery backends must explicitly cross between SVG and WEBGL.');
  }
  if (policy.failoverMode !== REVISION_COMPARE_FAILOVER_MODE) {
    throw new TypeError(`failoverMode must be ${REVISION_COMPARE_FAILOVER_MODE}.`);
  }
  if (policy.persistence !== REVISION_COMPARE_VIEWER_PERSISTENCE) {
    throw new TypeError(`persistence must be ${REVISION_COMPARE_VIEWER_PERSISTENCE}.`);
  }
  assertJsonSafe(policy, REVISION_COMPARE_VIEWER_POLICY_SCHEMA);
  return deepFreeze(policy);
}

export const REVISION_COMPARE_DEFAULT_VIEWER_POLICY = createRevisionCompareViewerPolicy();
/** Integration-level validation for the existing four-method Edit 3D host seam. */
import { assertEdit3DHostConformance } from '../edit-3d/index.js';
import { validateEngineeringScene } from '../engineering-scene/engineering-contract-validation.js';
import {
  createEngineeringScopeRequest,
  scopeScene,
  assertEngineeringScope,
} from '../engineering-scope/index.js';
import {
  validateScopedEditEntityGeometry,
  validateScopedEditJournalProjection,
} from './scoped-edit-contracts.js';

export const SCOPED_EDIT_HOST_CONTRACT_V1 = 'ScopedEditHost.v1';

export function isScopedEditDeeplyFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isScopedEditDeeplyFrozen(child, seen));
}

function requireFrozen(value, label) {
  if (!isScopedEditDeeplyFrozen(value)) throw new TypeError(`${label} must be deeply immutable.`);
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assertScopedEditHostContract(host) {
  const base = assertEdit3DHostConformance(host);
  return Object.freeze({
    schema: SCOPED_EDIT_HOST_CONTRACT_V1,
    valid: true,
    requiredMethods: base.requiredMethods,
  });
}

export function readScopedEditHostContext(host, inputRequest) {
  assertScopedEditHostContract(host);
  const request = createEngineeringScopeRequest(inputRequest);
  const scene = requireFrozen(host.scene(), 'host.scene() result');
  validateEngineeringScene(scene);
  const rawScope = requireFrozen(host.resolveScope(request), 'host.resolveScope() result');
  const scope = assertEngineeringScope(rawScope);
  if (!sameJson(scope.request, request)) throw new TypeError('Resolved scope request does not match the runtime request.');
  const scopedScene = scopeScene(scene, scope);
  return Object.freeze({ request, scene, scope, scopedScene });
}

export function readScopedEditEntityGeometry(host, entityId) {
  const raw = requireFrozen(host.entityGeometry(entityId), 'host.entityGeometry() result');
  const geometry = validateScopedEditEntityGeometry(raw);
  if (geometry.entityId !== entityId) throw new TypeError('Entity geometry ID does not match the requested entity.');
  return geometry;
}

function assertProjectionPrefix(current, next) {
  if (next.envelopes.length !== current.envelopes.length + 1) {
    throw new TypeError('Appended projection must add exactly one envelope.');
  }
  current.envelopes.forEach((entry, index) => {
    if (!sameJson(entry, next.envelopes[index])) throw new TypeError(`Appended projection changed envelope ${entry.commandId}.`);
  });
}

function assertAppendedEnvelope(current, next, envelope) {
  const appended = next.envelopes.at(-1);
  if (!sameJson(appended, envelope)) throw new TypeError('Appended projection does not contain the requested envelope.');
  const expectedActive = [...current.activeCommandIds, envelope.commandId];
  if (!sameJson(next.activeCommandIds, expectedActive)) {
    throw new TypeError('Appended projection must preserve active IDs and activate the appended command.');
  }
  if (!sameJson(next.initialState, current.initialState)) throw new TypeError('Appended projection changed initialState.');
}

/** Treat append as a pure current-projection + envelope -> next-projection operation. */
export function appendScopedEditProjection(host, currentInput, envelope) {
  const current = validateScopedEditJournalProjection(currentInput);
  const rawNext = requireFrozen(host.appendEditCommand(current, envelope), 'host.appendEditCommand() result');
  const next = validateScopedEditJournalProjection(rawNext);
  assertProjectionPrefix(current, next);
  assertAppendedEnvelope(current, next, envelope);
  return next;
}

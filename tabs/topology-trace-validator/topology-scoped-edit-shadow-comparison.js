/** Immutable exact and semantic-safety comparison evidence for Topology shadow execution. */
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { semanticHash, semanticStringify } from './topology-validator-values.js';

export const TOPOLOGY_SCOPED_EDIT_SHADOW_COMPATIBILITY_V1 =
  'TopologyScopedEditShadowCompatibility.v1';
export const TOPOLOGY_SHADOW_REJECTION_CLASSIFICATION_V1 =
  'TopologyShadowRejectionClassification.v1';
export const TOPOLOGY_SHADOW_POSITIVE_PARITY_MISMATCH =
  'TOPOLOGY_SHADOW_POSITIVE_PARITY_MISMATCH';
export const TOPOLOGY_SHADOW_PARITY_MODE = Object.freeze({
  EXACT: 'EXACT',
  SEMANTIC_SAFETY: 'SEMANTIC_SAFETY',
});
export const TOPOLOGY_SHADOW_SEMANTIC_CLASS = Object.freeze({
  NON_EDITABLE_BOUNDARY_TARGET: 'NON_EDITABLE_BOUNDARY_TARGET',
  NON_EDITABLE_EXCLUDED_TARGET: 'NON_EDITABLE_EXCLUDED_TARGET',
  UNSUPPORTED_COMMAND: 'UNSUPPORTED_COMMAND',
  COMMAND_PAYLOAD_MISMATCH: 'COMMAND_PAYLOAD_MISMATCH',
  STALE_AUTHORITY: 'STALE_AUTHORITY',
  CORRUPTED_PROJECTION: 'CORRUPTED_PROJECTION',
  INVALID_DRAG: 'INVALID_DRAG',
  DESTROYED_RUNTIME: 'DESTROYED_RUNTIME',
  UNKNOWN_ENTITY: 'UNKNOWN_ENTITY',
});

const RUNTIME_BOUNDARY_CODES = Object.freeze(['BOUNDARY_FROZEN', 'BOUNDARY_GHOSTED']);
const RULES = Object.freeze([
  Object.freeze({ direct: ['BOUNDARY_TARGET_NOT_EDITABLE'], runtime: RUNTIME_BOUNDARY_CODES,
    target: ['BOUNDARY'], semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.NON_EDITABLE_BOUNDARY_TARGET }),
  Object.freeze({ direct: ['EXCLUDED_TARGET_NOT_EDITABLE'], runtime: RUNTIME_BOUNDARY_CODES,
    target: ['EXCLUDED'], semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.NON_EDITABLE_EXCLUDED_TARGET }),
  Object.freeze({ direct: ['UNSUPPORTED_COMMAND_TARGET_RESOLVER', 'TOPOLOGY_SECTIONAL_SCOPE_UNSUPPORTED',
    'TOPOLOGY_SCOPE_PROPAGATE_UNSUPPORTED'], runtime: ['APPEND_PROJECTION_INVALID',
    'TOPOLOGY_SECTIONAL_SCOPE_UNSUPPORTED', 'TOPOLOGY_SCOPE_PROPAGATE_UNSUPPORTED'],
  target: ['COMMAND', 'SCOPE'], semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.UNSUPPORTED_COMMAND }),
  Object.freeze({ direct: ['TOPOLOGY_DRY_RUN_COMMAND_UNSUPPORTED', 'TOPOLOGY_DRY_RUN_ENVELOPE_MISMATCH',
    'COMMAND_AUTHORITY_MISMATCH'], runtime: ['APPEND_PROJECTION_INVALID'], target: ['COMMAND'],
  semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.COMMAND_PAYLOAD_MISMATCH }),
  Object.freeze({ direct: ['STALE_TOPOLOGY_HOST_AUTHORITY', 'STALE_TOPOLOGY_SCOPE_AUTHORITY'],
    runtime: ['STALE_TOPOLOGY_HOST_AUTHORITY', 'STALE_TOPOLOGY_SCOPE_AUTHORITY',
      'SCOPE_REVALIDATION_FAILED'], target: ['AUTHORITY'],
  semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.STALE_AUTHORITY }),
  Object.freeze({ direct: ['TOPOLOGY_DRY_RUN_PROJECTION_MISMATCH'],
    runtime: ['APPEND_PROJECTION_INVALID', 'SCOPED_EDIT_RUNTIME_PROJECTION_INVALID'],
    target: ['PROJECTION'], semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.CORRUPTED_PROJECTION }),
  Object.freeze({ direct: ['TOPOLOGY_SHADOW_DIRECT_INVALID_DRAG'],
    runtime: ['DRAG_INVALID', 'DRAG_CANCELLED', 'DRAG_START_MISMATCH'], target: ['DRAG'],
  semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.INVALID_DRAG }),
  Object.freeze({ direct: ['TOPOLOGY_READ_ONLY_HOST_DESTROYED'], runtime: ['RUNTIME_DESTROYED'],
    target: ['LIFECYCLE'], semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.DESTROYED_RUNTIME }),
  Object.freeze({ direct: ['TOPOLOGY_HOST_UNKNOWN_ENTITY', 'TOPOLOGY_SCOPE_UNKNOWN_ENTITY'],
    runtime: ['ENTITY_OUT_OF_SCOPE', 'ENTITY_BOUNDARY_ONLY', 'TOPOLOGY_SCOPE_UNKNOWN_ENTITY'],
    target: ['ENTITY'], semanticClass: TOPOLOGY_SHADOW_SEMANTIC_CLASS.UNKNOWN_ENTITY }),
]);

function same(left, right) {
  return semanticStringify(left) === semanticStringify(right);
}

function error(code, message) {
  const value = new Error(message);
  value.code = code;
  return value;
}

function nonNegative(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be non-negative.`);
  return value;
}

export function createTopologyShadowSideEffectEvidence(input = {}) {
  return immutableJson({
    sourceMutations: nonNegative(input.sourceMutations ?? 0, 'sourceMutations'),
    recoveryPersistence: nonNegative(input.recoveryPersistence ?? 0, 'recoveryPersistence'),
    writerAcquisitions: nonNegative(input.writerAcquisitions ?? 0, 'writerAcquisitions'),
    productionAcceptance: nonNegative(input.productionAcceptance ?? 0, 'productionAcceptance'),
    controllerMutations: nonNegative(input.controllerMutations ?? 0, 'controllerMutations'),
    rendererRefreshes: nonNegative(input.rendererRefreshes ?? 0, 'rendererRefreshes'),
    selectionPublications: nonNegative(input.selectionPublications ?? 0, 'selectionPublications'),
    domMounts: nonNegative(input.domMounts ?? 0, 'domMounts'),
    gestureRegistrations: nonNegative(input.gestureRegistrations ?? 0, 'gestureRegistrations'),
  }, 'Topology shadow side-effect evidence');
}

export function topologyShadowSideEffectsAreZero(input) {
  return Object.values(createTopologyShadowSideEffectEvidence(input)).every((value) => value === 0);
}

function matchingRule(directHostCode, runtimeCode, targetClassification) {
  return RULES.find((rule) => rule.direct.includes(directHostCode)
    && rule.runtime.includes(runtimeCode) && rule.target.includes(targetClassification));
}

export function classifyTopologyShadowRejection(input = {}) {
  const directHostCode = requiredContractText(input.directHostCode, 'directHostCode');
  const runtimeCode = requiredContractText(input.runtimeCode, 'runtimeCode');
  const targetClassification = requiredContractText(input.targetClassification,
    'targetClassification').toUpperCase();
  const sideEffects = createTopologyShadowSideEffectEvidence(input.sideEffects);
  const bothRejected = input.bothRejected === true;
  const rule = matchingRule(directHostCode, runtimeCode, targetClassification);
  const valid = Boolean(rule && bothRejected && topologyShadowSideEffectsAreZero(sideEffects));
  return immutableJson({ schema: TOPOLOGY_SHADOW_REJECTION_CLASSIFICATION_V1,
    directHostCode, runtimeCode, targetClassification, bothRejected,
    semanticClass: rule?.semanticClass ?? null, valid }, 'Topology shadow rejection classification');
}

function pathResult(input = {}) {
  return {
    accepted: input.accepted === true,
    rejectionCode: input.rejectionCode == null ? null
      : requiredContractText(input.rejectionCode, 'shadow rejectionCode'),
    projectionHash: input.projectionHash == null ? null
      : requiredContractText(input.projectionHash, 'shadow projectionHash'),
    evidence: input.evidence ?? null,
  };
}

export function assertTopologyShadowPositiveParity(direct, runtime) {
  if (!same(direct, runtime)) throw error(TOPOLOGY_SHADOW_POSITIVE_PARITY_MISMATCH,
    'Direct Topology dry-run and shared runtime candidate evidence differ.');
  return immutableJson(direct, 'Topology shadow exact positive evidence');
}

export function topologyShadowEvidenceHash(value) {
  return semanticHash(value);
}

export function createTopologyShadowCompatibilityEvidence(input = {}) {
  const mode = requiredContractText(input.mode, 'shadow parity mode');
  if (!Object.values(TOPOLOGY_SHADOW_PARITY_MODE).includes(mode)) {
    throw new TypeError(`Unsupported shadow parity mode ${mode}.`);
  }
  const direct = pathResult(input.direct), runtime = pathResult(input.runtime);
  const sideEffects = createTopologyShadowSideEffectEvidence(input.sideEffects);
  const exactMatch = mode === TOPOLOGY_SHADOW_PARITY_MODE.EXACT && same(direct, runtime);
  const classification = mode === TOPOLOGY_SHADOW_PARITY_MODE.SEMANTIC_SAFETY
    ? classifyTopologyShadowRejection({ directHostCode: direct.rejectionCode,
      runtimeCode: runtime.rejectionCode, targetClassification: input.targetClassification,
      bothRejected: !direct.accepted && !runtime.accepted, sideEffects }) : null;
  const safeEarlyRejection = Boolean(classification?.valid
    && RUNTIME_BOUNDARY_CODES.includes(runtime.rejectionCode));
  const valid = mode === TOPOLOGY_SHADOW_PARITY_MODE.EXACT
    ? exactMatch && topologyShadowSideEffectsAreZero(sideEffects) : classification.valid;
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_SHADOW_COMPATIBILITY_V1,
    authorityId: requiredContractText(input.authorityId, 'shadow authorityId'),
    direct, runtime, parity: { mode, semanticClass: classification?.semanticClass ?? null,
      exactMatch, safeEarlyRejection, valid }, sideEffects },
  'Topology scoped-edit shadow compatibility evidence');
}

/** Descriptive edit eligibility for canonical Sequential topology targets. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_EDIT_ELIGIBILITY_SCHEMA = 'SequentialEditEligibility.v1';
export const SEQUENTIAL_EDIT_CAPABILITIES = Object.freeze([
  'RIGID_MOVE_ELIGIBLE',
  'STRETCH_ELIGIBLE',
  'ROTATE_ELIGIBLE',
  'SPLIT_ELIGIBLE',
  'SUPPORT_REASSIGNMENT_ELIGIBLE',
]);
export const SEQUENTIAL_EDIT_LOCKS = Object.freeze([
  'LOCKED_SOURCE_EVIDENCE',
  'LOCKED_ACTIVE_CONSTRUCTION_HEAD',
  'LOCKED_CANDIDATE_OR_REPAIR',
  'LOCKED_INSUFFICIENT_GEOMETRY',
  'LOCKED_UNRESOLVED_ANCESTRY',
]);

const RIGID_TYPES = new Set([
  'PIPE', 'ELBOW', 'TEE', 'OLET', 'REDUCER', 'VALVE', 'FLANGE',
  'GASKET', 'INSTRUMENT', 'COUPLING', 'UNION', 'CAP', 'BLIND',
]);

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function baseCapabilities(input) {
  const type = String(input.canonicalType || '').toUpperCase();
  const result = [];
  const boundaryFree = Number(input.rigidBoundaryCount || 0) === 0;
  if (RIGID_TYPES.has(type) && boundaryFree) {
    result.push('RIGID_MOVE_ELIGIBLE', 'ROTATE_ELIGIBLE');
  }
  if (type === 'PIPE') result.push('STRETCH_ELIGIBLE', 'SPLIT_ELIGIBLE');
  if (Number(input.supportAttachmentCount) > 0) {
    result.push('SUPPORT_REASSIGNMENT_ELIGIBLE');
  }
  return result;
}

function lockReasons(input) {
  const locks = [];
  if (input.sourceEvidenceOnly === true) locks.push('LOCKED_SOURCE_EVIDENCE');
  if (input.sessionState !== 'ROUTE_COMPLETE') locks.push('LOCKED_ACTIVE_CONSTRUCTION_HEAD');
  if ((input.repairConnectionIds || []).length) locks.push('LOCKED_CANDIDATE_OR_REPAIR');
  if (!input.geometryPartCount || !input.positionedPortCount) locks.push('LOCKED_INSUFFICIENT_GEOMETRY');
  if (input.completeAncestry !== true || Number(input.unresolvedPortCount) > 0) {
    locks.push('LOCKED_UNRESOLVED_ANCESTRY');
  }
  return locks;
}

function inheritedValues(input, key, fallback) {
  return Array.isArray(input[key]) ? input[key] : fallback;
}

export function createSequentialEditEligibility(input = {}) {
  const targetKind = requiredContractText(input.targetKind, 'eligibility targetKind').toUpperCase();
  const targetId = requiredContractText(input.targetId, 'eligibility targetId');
  const capabilities = uniqueSorted(inheritedValues(input, 'capabilities', baseCapabilities(input)));
  const locks = uniqueSorted(inheritedValues(input, 'locks', lockReasons(input)));
  const material = {
    schema: SEQUENTIAL_EDIT_ELIGIBILITY_SCHEMA,
    targetKind,
    targetId,
    componentId: String(input.componentId || '').trim() || null,
    canonicalType: String(input.canonicalType || '').trim().toUpperCase() || null,
    capabilities: locks.length ? [] : capabilities,
    locks,
    evidence: immutableJson(input.evidence || {}, 'Sequential edit eligibility evidence'),
  };
  return immutableJson({
    ...material,
    eligibilityId: sequentialSemanticFingerprint('SSKEDITELIGIBILITY', material),
    editable: material.capabilities.length > 0 && material.locks.length === 0,
  }, 'Sequential edit eligibility');
}

export function inheritSequentialEditEligibility(parent, input = {}) {
  if (parent?.schema !== SEQUENTIAL_EDIT_ELIGIBILITY_SCHEMA) {
    throw new TypeError(`Parent eligibility must use ${SEQUENTIAL_EDIT_ELIGIBILITY_SCHEMA}.`);
  }
  return createSequentialEditEligibility({
    ...input,
    componentId: input.componentId || parent.componentId,
    canonicalType: input.canonicalType || parent.canonicalType,
    capabilities: parent.capabilities,
    locks: parent.locks,
    sessionState: 'ROUTE_COMPLETE',
    geometryPartCount: 1,
    positionedPortCount: 1,
    completeAncestry: true,
  });
}

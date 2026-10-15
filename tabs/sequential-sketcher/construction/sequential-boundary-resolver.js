import { stableToken } from '../sequential-sketcher-contract.js';
import { resolveSequentialConstructionTolerances } from '../policy/sequential-construction-tolerance-policy.js';
import {
  REFERENCE_TARGET_KINDS,
  resolveSequentialReference,
} from '../source/sequential-reference-resolver.js';

function clonePoint(point) { return point ? { x: point.x, y: point.y, z: point.z } : null; }
function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function targetPortRows(referenceTarget, indexes) {
  if (referenceTarget.kind === REFERENCE_TARGET_KINDS.JUNCTION_COMPONENT || referenceTarget.kind === REFERENCE_TARGET_KINDS.INLINE_COMPONENT) {
    const component = indexes.components.get(referenceTarget.targetComponentId);
    if (!component) return [];
    const roles = new Set(referenceTarget.targetPortRoles || []);
    return component.ports
      .filter((port) => !roles.size || roles.has(port.role))
      .map((port) => ({ component, port }));
  }
  if (referenceTarget.kind === REFERENCE_TARGET_KINDS.BRANCH) {
    const branch = indexes.branches.get(referenceTarget.targetBranchId);
    if (!branch) return [];
    const first = branch.components[0];
    const last = branch.components[branch.components.length - 1];
    return [first, last]
      .filter(Boolean)
      .filter((component, index, rows) => rows.indexOf(component) === index)
      .flatMap((component) => component.ports.map((port) => ({ component, port })));
  }
  return [];
}
function candidate(boundaryRole, boundaryPosition, connectedPort, referenceTarget, row) {
  const targetSourcePosition = clonePoint(row.port.sourcePosition);
  const targetPosition = targetSourcePosition || clonePoint(boundaryPosition);
  const connectedSourcePosition = clonePoint(connectedPort?.sourcePosition);
  const connectedPosition = connectedSourcePosition || clonePoint(boundaryPosition);
  if (!targetPosition || !connectedPosition || !boundaryPosition) return null;
  const componentCentre = clonePoint(row.component.geometry?.centre);
  return Object.freeze({
    candidateId: `BOUNDARY-CAND-${stableToken(`${boundaryRole}|${connectedPort?.portId || ''}|${row.port.portId}`)}`,
    boundaryRole,
    referenceTarget: referenceTarget.reference,
    referenceKind: referenceTarget.kind,
    boundaryPosition: clonePoint(boundaryPosition),
    connectedPortId: connectedPort?.portId || null,
    connectedComponentId: connectedPort?.componentId || null,
    connectedSourcePosition,
    connectedPosition,
    connectedPositionBasis: connectedSourcePosition ? 'SOURCE_EXPLICIT' : 'DERIVED_FROM_BRANCH_BOUNDARY',
    targetBranchId: row.component.branchId,
    targetComponentId: row.component.componentId,
    targetSourceComponentId: row.component.sourceComponentId,
    targetPortId: row.port.portId,
    targetPortRole: row.port.role,
    targetSourcePosition,
    targetPosition,
    targetPositionBasis: targetSourcePosition ? 'SOURCE_EXPLICIT' : 'DERIVED_FROM_BRANCH_BOUNDARY',
    boundaryToConnectedGapMm: distance(boundaryPosition, connectedPosition),
    targetToBoundaryGapMm: distance(targetPosition, boundaryPosition),
    totalGapMm: distance(targetPosition, connectedPosition),
    derivedBranchLegLengthMm: !targetSourcePosition && componentCentre ? distance(componentCentre, boundaryPosition) : null,
  });
}

function outcome(payload, tolerances) {
  return Object.freeze({
    ...payload,
    toleranceEvidenceType: 'REFERENCE_BOUNDARY_EQUIVALENCE',
    toleranceEvidenceTypes: Object.freeze([
      'REFERENCE_BOUNDARY_EQUIVALENCE',
      'BRANCH_ENDPOINT_EQUIVALENCE',
    ]),
    exactToleranceMm: tolerances.referenceBoundaryMm,
    referenceBoundaryToleranceMm: tolerances.referenceBoundaryMm,
    branchEndpointToleranceMm: tolerances.branchEndpointMm,
    autoRepairToleranceMm: tolerances.automaticRepairMm,
    tolerancePolicySchema: tolerances.policySchema,
    tolerancePolicyId: tolerances.policyId,
    tolerancePolicyRevision: tolerances.policyRevision,
    tolerancePolicyFingerprint: tolerances.policyFingerprint,
  });
}

export function resolveBoundaryReference({
  boundaryRole,
  boundaryPosition,
  referenceValue,
  connectedPort,
  indexes,
  exactToleranceMm,
  externalBoundaryExactToleranceMm,
  referenceBoundaryEquivalenceMm,
  branchEndpointEquivalenceMm,
  autoRepairToleranceMm,
}) {
  const tolerances = resolveSequentialConstructionTolerances({
    exactToleranceMm,
    externalBoundaryExactToleranceMm,
    referenceBoundaryEquivalenceMm,
    branchEndpointEquivalenceMm,
    autoRepairToleranceMm,
  });
  const referenceExactMm = tolerances.referenceBoundaryMm;
  const branchExactMm = tolerances.branchEndpointMm;
  const repairMm = tolerances.automaticRepairMm;
  if (!boundaryPosition) return outcome({ status: 'USER_DECISION_REQUIRED', reason: 'BOUNDARY_POSITION_MISSING', candidates: Object.freeze([]) }, tolerances);
  if (!connectedPort) return outcome({ status: 'USER_DECISION_REQUIRED', reason: 'BOUNDARY_CONNECTED_PORT_MISSING', candidates: Object.freeze([]) }, tolerances);
  const referenceTarget = resolveSequentialReference(referenceValue, indexes);
  if (referenceTarget.status === 'MISSING') return outcome({ status: 'USER_DECISION_REQUIRED', reason: 'REFERENCE_TARGET_MISSING', referenceTarget, candidates: Object.freeze([]) }, tolerances);
  if (referenceTarget.status === 'AMBIGUOUS') return outcome({ status: 'USER_DECISION_REQUIRED', reason: 'REFERENCE_TARGET_AMBIGUOUS', referenceTarget, candidates: Object.freeze(referenceTarget.matches || []) }, tolerances);
  const candidates = targetPortRows(referenceTarget, indexes)
    .map((row) => candidate(boundaryRole, boundaryPosition, connectedPort, referenceTarget, row))
    .filter(Boolean)
    .sort((left, right) => left.totalGapMm - right.totalGapMm || left.candidateId.localeCompare(right.candidateId));
  if (!candidates.length) return outcome({ status: 'USER_DECISION_REQUIRED', reason: 'REFERENCE_TARGET_PORT_UNRESOLVED', referenceTarget, candidates: Object.freeze([]) }, tolerances);

  const withinRepair = candidates.filter((row) => (
    row.targetToBoundaryGapMm <= repairMm
    && row.boundaryToConnectedGapMm <= repairMm
  ));
  if (!withinRepair.length) {
    const connectedTooFar = candidates.every((row) => row.boundaryToConnectedGapMm > repairMm);
    return outcome({
      status: 'USER_DECISION_REQUIRED',
      reason: connectedTooFar ? 'BOUNDARY_TO_FIRST_COMPONENT_GAP' : 'BOUNDARY_REFERENCE_GAP_EXCEEDS_LIMIT',
      referenceTarget,
      candidates: Object.freeze(candidates),
    }, tolerances);
  }

  const exact = withinRepair.filter((row) => (
    row.targetToBoundaryGapMm <= referenceExactMm
    && row.boundaryToConnectedGapMm <= branchExactMm
  ));
  if (exact.length === 1) return outcome({ status: 'CONFIRMED_REFERENCE', selected: exact[0], referenceTarget, candidates: Object.freeze(candidates) }, tolerances);
  if (exact.length > 1) return outcome({ status: 'USER_DECISION_REQUIRED', reason: 'MULTIPLE_BOUNDARY_REFERENCE_PORTS', referenceTarget, candidates: Object.freeze(candidates) }, tolerances);
  if (withinRepair.length === 1) return outcome({ status: 'AUTO_REPAIRED_SMALL_GAP', selected: withinRepair[0], referenceTarget, candidates: Object.freeze(candidates) }, tolerances);
  return outcome({ status: 'USER_DECISION_REQUIRED', reason: 'MULTIPLE_BOUNDARY_REPAIR_PORTS', referenceTarget, candidates: Object.freeze(candidates) }, tolerances);
}

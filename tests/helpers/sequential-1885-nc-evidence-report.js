import { createConfirmedSequentialConstruction } from '../../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { resolveSequentialReference } from '../../tabs/sequential-sketcher/source/sequential-reference-resolver.js';
import { buildConfirmedConstructionSupportProjection } from '../../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';

const TWO_PORT_TYPES = new Set([
  'PIPE', 'ELBOW', 'REDUCER', 'VALVE', 'FLANGE',
  'GASKET', 'INSTRUMENT', 'COUPLING', 'UNION',
]);

function text(value) { return String(value ?? '').trim(); }
function point(value) { return value ? { x: value.x, y: value.y, z: value.z } : null; }
function samePoint(left, right) {
  return Boolean(left && right && left.x === right.x && left.y === right.y && left.z === right.z);
}
function lineKey(value) {
  const candidates = text(value)
    .replace(/\/B[^/]+$/u, '')
    .split(/[-/]/u)
    .filter((token) => /^S[0-9A-Z]+$/u.test(token));
  return candidates.length === 1 ? candidates[0] : null;
}

export function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const key = selector(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function componentReferences(component) {
  return [...new Set([
    component.cref,
    ...component.ports.map((port) => port.referenceTarget),
  ].map(text).filter(Boolean))];
}

function referenceInventory(branch, indexes) {
  const rawReferences = [
    branch.href,
    branch.tref,
    ...branch.components.flatMap(componentReferences),
  ].map(text).filter(Boolean);
  return [...new Set(rawReferences)].map((reference) => {
    const result = resolveSequentialReference(reference, indexes);
    return {
      reference,
      rawReference: result.rawReference || reference,
      normalizedReference: result.normalizedReference || reference,
      normalizationOperations: [...(result.normalizationOperations || [])],
      resolutionBasis: result.resolutionBasis || null,
      status: result.status,
      kind: result.kind,
      targetBranchId: result.targetBranchId || null,
      targetSourceComponentId: result.targetSourceComponentId || null,
      matchCount: result.matches?.length || (result.status === 'RESOLVED' ? 1 : 0),
      rawEvidence: Object.freeze({
        href: branch.href === reference,
        tref: branch.tref === reference,
        componentIds: branch.components
          .filter((component) => componentReferences(component).includes(reference))
          .map((component) => component.sourceComponentId),
      }),
    };
  });
}

function candidateInventory(request) {
  return (request?.candidates || []).map((candidate) => ({
    candidateId: candidate.candidateId,
    fromPortId: candidate.fromPortId || candidate.targetPortId || null,
    toPortId: candidate.toPortId || candidate.connectedPortId || null,
    targetBranchId: candidate.targetBranchId || null,
    targetComponentId: candidate.targetComponentId || null,
    targetSourceComponentId: candidate.targetSourceComponentId || null,
    targetComponentType: candidate.targetComponentType || null,
    targetPortRole: candidate.targetPortRole || null,
    referenceKind: candidate.referenceKind || candidate.targetKind || null,
    sourceAdjacent: Boolean(candidate.sourceAdjacent),
    referenceMatch: Boolean(candidate.referenceMatch || candidate.referenceKind),
    roleCompatible: candidate.roleCompatible ?? null,
    directionCompatible: candidate.directionCompatible ?? null,
    boreCompatible: candidate.boreCompatible ?? null,
    boreCompatibility: candidate.boreCompatibility || null,
    directionAngleDeg: Number.isFinite(Number(candidate.directionAngleDeg))
      ? Number(candidate.directionAngleDeg) : null,
    gapMm: Number.isFinite(Number(candidate.gapMm ?? candidate.totalGapMm))
      ? Number(candidate.gapMm ?? candidate.totalGapMm) : null,
    fromPosition: point(candidate.fromPosition || candidate.targetPosition),
    toPosition: point(candidate.toPosition || candidate.connectedPosition),
    fromSourcePosition: point(candidate.fromSourcePosition || candidate.targetSourcePosition),
    toSourcePosition: point(candidate.toSourcePosition || candidate.connectedSourcePosition),
    fromPositionBasis: candidate.fromPositionBasis || candidate.targetPositionBasis || null,
    toPositionBasis: candidate.toPositionBasis || candidate.connectedPositionBasis || null,
  }));
}

function expectedContinuationCategory(reason) {
  if (['AMBIGUOUS_BRANCH_START', 'MULTIPLE_BOUNDARY_REFERENCE_PORTS'].includes(reason)) return 'HEAD_BOUNDARY';
  if (reason === 'REFERENCE_TARGET_MISSING') return 'REFERENCE_TARGET';
  if (reason === 'REFERENCE_TARGET_PORT_UNRESOLVED') return 'REFERENCE_TARGET_PORT';
  if (reason === 'UNEXPLAINED_TERMINAL') return 'TERMINAL_EVIDENCE';
  if (reason === 'MULTIPLE_EXACT_CANDIDATES') return 'EXACT_PORT_SELECTION';
  if (reason === 'MULTIPLE_REPAIR_CANDIDATES') return 'SMALL_GAP_PORT_SELECTION';
  if (reason === 'CONTINUITY_NOT_PROVEN') return 'SOURCE_SEQUENCE_OR_GAP';
  if (reason?.startsWith('EXTERNAL_BOUNDARY_') || reason === 'EXTERNAL_REFERENCE_CLASSIFIED') return 'EXTERNAL_BOUNDARY_EVIDENCE';
  return 'NONE';
}

function missingEvidenceClass(reason) {
  if (reason === 'REFERENCE_TARGET_MISSING') return 'REFERENCE_NORMALIZATION_OR_EXTERNAL_SCOPE';
  if (reason === 'REFERENCE_TARGET_PORT_UNRESOLVED') return 'FITTING_PORT_DERIVATION';
  if (['AMBIGUOUS_BRANCH_START', 'MULTIPLE_BOUNDARY_REFERENCE_PORTS'].includes(reason)) return 'SOURCE_BOUNDARY_AMBIGUITY';
  if (reason === 'MULTIPLE_EXACT_CANDIDATES') return 'COMPOSITE_OR_PORT_AMBIGUITY';
  if (reason === 'UNEXPLAINED_TERMINAL') return 'TERMINAL_DIALECT_OR_MISSING_ENGINEERING_DATA';
  if (reason === 'CONTINUITY_NOT_PROVEN') return 'SOURCE_GAP_OR_SEQUENCE';
  if (reason?.startsWith('EXTERNAL_BOUNDARY_')) return 'EXTERNAL_BOUNDARY_POSITION_EVIDENCE';
  if (reason === 'EXTERNAL_REFERENCE_CLASSIFIED') return 'EXTERNAL_PHYSICAL_ROLE_EVIDENCE';
  return 'NONE';
}

function zeroLength(component) {
  return TWO_PORT_TYPES.has(component.canonicalType)
    && component.ports.length >= 2
    && samePoint(component.ports[0].sourcePosition, component.ports[1].sourcePosition);
}

function typeCounts(components) { return countBy(components, (component) => component.canonicalType); }

function acceptedSupportProjection(session, indexes) {
  if (session?.state !== 'ROUTE_COMPLETE') return null;
  const confirmed = createConfirmedSequentialConstruction(session, indexes);
  const projection = buildConfirmedConstructionSupportProjection(confirmed, indexes, {
    projectionToleranceMm: 50,
    onCenterlineToleranceMm: 0.001,
    ambiguityToleranceMm: 1,
  });
  return {
    constructionFingerprint: confirmed.constructionFingerprint,
    boundaryClassificationCount: confirmed.audit.boundaryClassificationCount,
    resolvedSupportFamilyCount: projection.supportGlyphs.length,
    unresolvedSupportFamilyCount: projection.unresolvedSupportFamilies.length,
    diagnosticCount: projection.diagnostics.length,
  };
}

export function probeSequentialBranch(branch, evidence, indexes, engineOptions, maxSteps) {
  let result;
  let runtimeError = null;
  try {
    result = runConstructionUntilBlocked(
      createSequentialConstructionSession(branch.branchId),
      evidence,
      indexes,
      engineOptions,
      maxSteps,
    );
  } catch (error) {
    runtimeError = { name: error.name, message: error.message, stack: error.stack };
  }
  const session = result?.session || null;
  const request = session?.currentDecisionRequest || null;
  const activePort = indexes.ports.get(session?.activeExitPortId);
  const activeComponent = indexes.components.get(session?.activeComponentId);
  const references = referenceInventory(branch, indexes);
  let supportProjection = null;
  let supportProjectionError = null;
  try {
    supportProjection = acceptedSupportProjection(session, indexes);
  } catch (error) {
    supportProjectionError = { name: error.name, message: error.message, stack: error.stack };
  }
  return {
    branchId: branch.branchId,
    lineKey: lineKey(branch.branchId),
    sourceBranchIndex: branch.sourceBranchIndex,
    href: branch.href || null,
    tref: branch.tref || null,
    sourceRouteComponentCount: branch.sourceRouteComponentCount,
    activeComponentCount: branch.components.length,
    shadowCarrierCount: branch.shadowCarrierCount,
    typeCounts: typeCounts(branch.components),
    zeroLengthCount: branch.components.filter(zeroLength).length,
    terminalComponentType: branch.components.at(-1)?.canonicalType || null,
    state: runtimeError ? 'RUNTIME_ERROR' : session?.state || 'UNKNOWN',
    blockedReason: request?.reason || null,
    decisionScope: request?.decisionScope || null,
    expectedContinuationCategory: expectedContinuationCategory(request?.reason),
    missingEvidenceClass: missingEvidenceClass(request?.reason),
    activeEndpoint: session ? {
      branchId: session.activeBranchId,
      componentId: session.activeComponentId,
      sourceComponentId: activeComponent?.sourceComponentId || null,
      componentType: activeComponent?.canonicalType || null,
      portId: activePort?.portId || session.activeExitPortId || null,
      portRole: activePort?.role || null,
      sourcePosition: point(activePort?.sourcePosition),
      boreMm: activePort?.boreMm ?? null,
      tangent: point(activePort?.tangent),
    } : null,
    references,
    unresolvedReferences: references.filter((reference) => reference.status !== 'RESOLVED'),
    candidates: candidateInventory(request),
    externalReferenceClassification: request?.externalReferenceClassification || null,
    confirmedComponentCount: session?.confirmedComponentIds.length || 0,
    committedConnectionCount: session?.committedConnections.length || 0,
    repairCount: session?.repairLedger.length || 0,
    decisionCount: session?.decisionLedger.length || 0,
    boundaryClassificationCount: session?.boundaryClassifications?.length || 0,
    boundaryClassifications: (session?.boundaryClassifications || []).map((row) => ({
      ...row,
      normalizationOperations: [...(row.normalizationOperations || [])],
      basis: [...(row.basis || [])],
      sourcePosition: point(row.sourcePosition),
      boundaryPosition: point(row.boundaryPosition),
      resolvedPosition: point(row.resolvedPosition),
    })),
    constructionFingerprint: supportProjection?.constructionFingerprint || null,
    supportProjection,
    supportProjectionError,
    runtimeError,
  };
}

export function featureCounts(rows) {
  return {
    teeBranches: rows.filter((row) => row.typeCounts.TEE > 0).length,
    reducerBranches: rows.filter((row) => row.typeCounts.REDUCER > 0).length,
    oletBranches: rows.filter((row) => row.typeCounts.OLET > 0).length,
    zeroLengthBranches: rows.filter((row) => row.zeroLengthCount > 0).length,
    explicitClosureBranches: rows.filter((row) => !row.tref && ['CAP', 'BLIND'].includes(row.terminalComponentType)).length,
    unexplainedTerminalBranches: rows.filter((row) => row.blockedReason === 'UNEXPLAINED_TERMINAL').length,
    unresolvedReferenceBranches: rows.filter((row) => row.unresolvedReferences.length > 0).length,
    shadowCarrierBranches: rows.filter((row) => row.shadowCarrierCount > 0).length,
    routeCompleteBranches: rows.filter((row) => row.state === 'ROUTE_COMPLETE').length,
    blockedBranches: rows.filter((row) => row.state === 'USER_DECISION_REQUIRED').length,
    failedBranches: rows.filter((row) => row.state === 'FAILED').length,
  };
}

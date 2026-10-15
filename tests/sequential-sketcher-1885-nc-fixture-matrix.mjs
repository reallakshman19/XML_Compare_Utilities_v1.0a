import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { resolveSequentialReference } from '../tabs/sequential-sketcher/source/sequential-reference-resolver.js';

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const REPORT_PATH = 'artifacts/sequential-sketcher/1885-nc-fixture-matrix.json';
const EXPECTED_S_LINE_KEYS = Object.freeze(['S8810101', 'S8810103', 'S8810111', 'S8810112', 'S8811951']);
const EXPECTED_S_BRANCH_COUNT = 21;
const ENGINE_OPTIONS = Object.freeze({
  exactToleranceMm: 1,
  autoRepairToleranceMm: 25,
  candidateSearchRadiusMm: 250,
});
const MAX_STEPS_PER_ROOT = 1200;
const TWO_PORT_TYPES = new Set(['PIPE', 'ELBOW', 'REDUCER', 'VALVE', 'FLANGE', 'GASKET', 'INSTRUMENT', 'COUPLING', 'UNION']);

function text(value) { return String(value ?? '').trim(); }
function samePoint(left, right) {
  return Boolean(left && right && left.x === right.x && left.y === right.y && left.z === right.z);
}
function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const key = selector(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}
function lineKey(value) {
  const candidates = text(value).replace(/\/B[^/]+$/u, '').split(/[-/]/u).filter((token) => /^S[0-9A-Z]+$/u.test(token));
  return candidates.length === 1 ? candidates[0] : null;
}
function componentReferences(component) {
  return [...new Set([
    component.cref,
    ...component.ports.map((port) => port.referenceTarget),
  ].map(text).filter(Boolean))];
}
function zeroLength(component) {
  if (!TWO_PORT_TYPES.has(component.canonicalType) || component.ports.length < 2) return false;
  return samePoint(component.ports[0].sourcePosition, component.ports[1].sourcePosition);
}
function summarizeReference(reference, indexes) {
  const result = resolveSequentialReference(reference, indexes);
  return {
    reference,
    status: result.status,
    kind: result.kind,
    targetBranchId: result.targetBranchId || null,
    targetSourceComponentId: result.targetSourceComponentId || null,
    matchCount: result.matches?.length || (result.status === 'RESOLVED' ? 1 : 0),
  };
}
function compactDecision(request) {
  if (!request) return null;
  const minimumGapMm = (request.candidates || []).reduce((minimum, candidate) => {
    const gap = Number(candidate.gapMm ?? candidate.totalGapMm);
    return Number.isFinite(gap) ? Math.min(minimum, gap) : minimum;
  }, Number.POSITIVE_INFINITY);
  return {
    reason: request.reason,
    decisionScope: request.decisionScope || null,
    candidateCount: request.candidates?.length || 0,
    candidateTypes: countBy(request.candidates || [], (candidate) => candidate.targetComponentType || candidate.referenceKind || 'UNKNOWN'),
    minimumGapMm: Number.isFinite(minimumGapMm) ? minimumGapMm : null,
  };
}
function representative(rows, featureSelector, limit = 12) {
  return rows
    .filter(featureSelector)
    .sort((left, right) => (
      left.componentCount - right.componentCount
      || left.branchId.localeCompare(right.branchId)
    ))
    .slice(0, limit)
    .map((row) => ({
      branchId: row.branchId,
      lineKey: row.lineKey,
      componentCount: row.componentCount,
      state: row.state,
      blockedReason: row.blockedDecision?.reason || null,
      typeCounts: row.typeCounts,
      zeroLengthCount: row.zeroLengthComponents.length,
      shadowCarrierCount: row.shadowCarrierCount,
      referenceIssueCount: row.referenceIssues.length,
    }));
}
function featureCounts(rows) {
  return {
    teeBranches: rows.filter((row) => row.teeCount > 0).length,
    reducerBranches: rows.filter((row) => row.reducerCount > 0).length,
    oletBranches: rows.filter((row) => row.oletCount > 0).length,
    zeroLengthBranches: rows.filter((row) => row.zeroLengthComponents.length > 0).length,
    explicitClosureBranches: rows.filter((row) => !row.hasTref && ['CAP', 'BLIND'].includes(row.terminalComponentType)).length,
    unexplainedTerminalBranches: rows.filter((row) => row.blockedDecision?.reason === 'UNEXPLAINED_TERMINAL').length,
    unresolvedReferenceBranches: rows.filter((row) => row.referenceIssues.length > 0).length,
    shadowCarrierBranches: rows.filter((row) => row.shadowCarrierCount > 0).length,
    routeCompleteBranches: rows.filter((row) => row.state === 'ROUTE_COMPLETE').length,
    blockedBranches: rows.filter((row) => row.state === 'USER_DECISION_REQUIRED').length,
    failedBranches: rows.filter((row) => row.state === 'FAILED').length,
  };
}
function representatives(rows) {
  return {
    tee: representative(rows, (row) => row.teeCount > 0),
    reducer: representative(rows, (row) => row.reducerCount > 0),
    zeroLength: representative(rows, (row) => row.zeroLengthComponents.length > 0),
    explicitClosure: representative(rows, (row) => !row.hasTref && ['CAP', 'BLIND'].includes(row.terminalComponentType)),
    unexplainedTerminal: representative(rows, (row) => row.blockedDecision?.reason === 'UNEXPLAINED_TERMINAL'),
    referenceIssue: representative(rows, (row) => row.referenceIssues.length > 0),
    blocked: representative(rows, (row) => row.state === 'USER_DECISION_REQUIRED'),
    routeComplete: representative(rows, (row) => row.state === 'ROUTE_COMPLETE'),
  };
}

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'sequential-sketcher-fixture-matrix' } });
assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
const records = await response.json();
assert.ok(Array.isArray(records), 'Pinned fixture must be a JSON array');
const immutableSnapshot = JSON.stringify(records);
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const branchRows = [];
const runtimeErrors = [];

for (const branch of evidence.branches) {
  const references = [branch.href, branch.tref, ...branch.components.flatMap(componentReferences)]
    .map(text)
    .filter(Boolean);
  const referenceAudit = [...new Set(references)].map((reference) => summarizeReference(reference, indexes));
  const referenceIssues = referenceAudit.filter((row) => row.status !== 'RESOLVED');
  let result = null;
  let runtimeError = null;
  try {
    result = runConstructionUntilBlocked(
      createSequentialConstructionSession(branch.branchId),
      evidence,
      indexes,
      ENGINE_OPTIONS,
      MAX_STEPS_PER_ROOT,
    );
  } catch (error) {
    runtimeError = { name: error.name, message: error.message, stack: error.stack };
    runtimeErrors.push({ branchId: branch.branchId, ...runtimeError });
  }
  const components = branch.components;
  const zeroLengthComponents = components.filter(zeroLength).map((component) => ({
    sourceComponentId: component.sourceComponentId,
    canonicalType: component.canonicalType,
    sourceIndex: component.sourceIndex,
    position: component.ports[0]?.sourcePosition || null,
  }));
  const terminal = components.at(-1) || null;
  const pendingJunctionCount = result?.session?.pendingBranchJunctions?.length || 0;
  const pendingUnfinishedCount = (result?.session?.pendingBranchJunctions || []).filter((junction) => ![
    'COMPLETED', 'ENTERED', 'USER_TERMINAL', 'USER_EXTERNAL_BOUNDARY', 'REJECTED',
  ].includes(junction.status)).length;
  branchRows.push({
    branchId: branch.branchId,
    lineKey: lineKey(branch.branchId),
    sourceBranchIndex: branch.sourceBranchIndex,
    componentCount: components.length,
    sourceRouteComponentCount: branch.sourceRouteComponentCount,
    shadowCarrierCount: branch.shadowCarrierCount,
    typeCounts: countBy(components, (component) => component.canonicalType),
    teeCount: components.filter((component) => component.canonicalType === 'TEE').length,
    reducerCount: components.filter((component) => component.canonicalType === 'REDUCER').length,
    oletCount: components.filter((component) => component.canonicalType === 'OLET').length,
    zeroLengthComponents,
    terminalComponentType: terminal?.canonicalType || null,
    terminalSourceComponentId: terminal?.sourceComponentId || null,
    hasHref: Boolean(branch.href),
    hasTref: Boolean(branch.tref),
    referenceAudit,
    referenceIssues,
    state: runtimeError ? 'RUNTIME_ERROR' : result.session.state,
    outcomes: result?.outcomes || [],
    blockedDecision: compactDecision(result?.session?.currentDecisionRequest),
    confirmedComponentCount: result?.session?.confirmedComponentIds?.length || 0,
    connectionCount: result?.session?.committedConnections?.length || 0,
    repairCount: result?.session?.repairLedger?.length || 0,
    pendingJunctionCount,
    pendingUnfinishedCount,
    completedBranchCount: result?.session?.completedBranchIds?.length || 0,
    runtimeError,
  });
}

const sourceUnchanged = JSON.stringify(records) === immutableSnapshot;
const sScopeRows = branchRows.filter((row) => row.lineKey);
const sLineKeys = [...new Set(sScopeRows.map((row) => row.lineKey))].sort();
const fixtureFeaturePresence = {
  tee: branchRows.some((row) => row.teeCount > 0),
  reducer: branchRows.some((row) => row.reducerCount > 0),
  zeroLength: branchRows.some((row) => row.zeroLengthComponents.length > 0),
  explicitClosure: branchRows.some((row) => !row.hasTref && ['CAP', 'BLIND'].includes(row.terminalComponentType)),
  unexplainedTerminal: branchRows.some((row) => row.blockedDecision?.reason === 'UNEXPLAINED_TERMINAL'),
};
const report = {
  schema: 'Sequential1885NcFixtureMatrix.v1',
  sourceCommit: SOURCE_COMMIT,
  fixtureRecordCount: records.length,
  indexedBranchCount: evidence.branches.length,
  indexedComponentCount: evidence.components.length,
  evidenceAudit: evidence.audit,
  lineKeyCounts: countBy(branchRows, (row) => row.lineKey || 'UNRESOLVED'),
  branchStateCounts: countBy(branchRows, (row) => row.state),
  blockedReasonCounts: countBy(branchRows.filter((row) => row.blockedDecision), (row) => row.blockedDecision.reason),
  componentTypeCounts: countBy(evidence.components, (component) => component.canonicalType),
  referenceStatusCounts: countBy(branchRows.flatMap((row) => row.referenceAudit), (row) => `${row.status}:${row.kind}`),
  featureCounts: featureCounts(branchRows),
  validation: {
    sourceUnchanged,
    runtimeErrorCount: runtimeErrors.length,
    fixtureFeaturePresence,
  },
  representatives: representatives(branchRows),
  sScope: {
    lineKeys: sLineKeys,
    branchCount: sScopeRows.length,
    branchStateCounts: countBy(sScopeRows, (row) => row.state),
    blockedReasonCounts: countBy(sScopeRows.filter((row) => row.blockedDecision), (row) => row.blockedDecision.reason),
    featureCounts: featureCounts(sScopeRows),
    representatives: representatives(sScopeRows),
    branches: sScopeRows,
  },
  runtimeErrors,
  branches: branchRows,
};

mkdirSync('artifacts/sequential-sketcher', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  schema: report.schema,
  indexedBranchCount: report.indexedBranchCount,
  indexedComponentCount: report.indexedComponentCount,
  validation: report.validation,
  featureCounts: report.featureCounts,
  branchStateCounts: report.branchStateCounts,
  blockedReasonCounts: report.blockedReasonCounts,
  sScope: {
    lineKeys: report.sScope.lineKeys,
    branchCount: report.sScope.branchCount,
    branchStateCounts: report.sScope.branchStateCounts,
    blockedReasonCounts: report.sScope.blockedReasonCounts,
    featureCounts: report.sScope.featureCounts,
    representatives: report.sScope.representatives,
  },
}, null, 2));

assert.equal(sourceUnchanged, true, 'Fixture-wide matrix must not mutate source evidence');
assert.equal(runtimeErrors.length, 0, 'Fixture-wide construction probes must not throw');
assert.equal(fixtureFeaturePresence.tee, true, 'Fixture must contain at least one tee branch');
assert.equal(fixtureFeaturePresence.reducer, true, 'Fixture must contain at least one reducer branch');
assert.equal(fixtureFeaturePresence.zeroLength, true, 'Fixture must contain at least one zero-length inline fitting');
assert.equal(fixtureFeaturePresence.explicitClosure, false, 'Pinned fixture unexpectedly gained CAP/BLIND closure components');
assert.equal(fixtureFeaturePresence.unexplainedTerminal, true, 'Fixture must retain fail-closed unexplained-terminal examples');
assert.deepEqual(sLineKeys, EXPECTED_S_LINE_KEYS, 'Pinned S-line ownership set changed');
assert.equal(sScopeRows.length, EXPECTED_S_BRANCH_COUNT, 'Pinned S-line branch count changed');
assert.ok(sScopeRows.some((row) => row.state === 'ROUTE_COMPLETE'), 'S-line scope must retain at least one complete reference-connected route');
assert.ok(sScopeRows.some((row) => row.blockedDecision?.reason === 'UNEXPLAINED_TERMINAL'), 'S-line scope must retain terminal-review cases');
assert.ok(sScopeRows.some((row) => row.referenceIssues.length > 0), 'S-line scope must retain missing external-reference evidence');

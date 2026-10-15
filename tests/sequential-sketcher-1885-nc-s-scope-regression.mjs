import assert from 'node:assert/strict';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const EXPECTED_LINE_KEYS = Object.freeze(['S8810101', 'S8810103', 'S8810111', 'S8810112', 'S8811951']);
const EXPECTED_BRANCH_COUNTS = Object.freeze({
  S8810101: 7,
  S8810103: 1,
  S8810111: 2,
  S8810112: 1,
  S8811951: 10,
});
const EXPECTED_ACTIVE_COMPONENT_COUNTS = Object.freeze({
  S8810101: 43,
  S8810103: 6,
  S8810111: 16,
  S8810112: 5,
  S8811951: 123,
});
const EXPECTED_TYPE_COUNTS = Object.freeze({
  ELBOW: 18,
  FLANGE: 40,
  GASKET: 40,
  INSTRUMENT: 8,
  OLET: 10,
  PIPE: 56,
  REDUCER: 4,
  TEE: 5,
  VALVE: 12,
});
const EXPECTED_BLOCKED_REASONS = Object.freeze({
  AMBIGUOUS_BRANCH_START: 3,
  MULTIPLE_BOUNDARY_REFERENCE_PORTS: 2,
  REFERENCE_TARGET_MISSING: 6,
  REFERENCE_TARGET_PORT_UNRESOLVED: 3,
  UNEXPLAINED_TERMINAL: 6,
});
const ENGINE_OPTIONS = Object.freeze({
  exactToleranceMm: 1,
  autoRepairToleranceMm: 25,
  candidateSearchRadiusMm: 250,
});

function text(value) { return String(value ?? '').trim(); }
function lineKey(branchId) {
  const candidates = text(branchId).replace(/\/B[^/]+$/u, '').split(/[-/]/u).filter((token) => /^S[0-9A-Z]+$/u.test(token));
  return candidates.length === 1 ? candidates[0] : null;
}
function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const key = selector(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}
function branchSuffix(branchId) { return branchId.slice(branchId.lastIndexOf('/') + 1); }
function exactBranch(rows, key, suffix) {
  const matches = rows.filter((row) => row.lineKey === key && branchSuffix(row.branchId) === suffix);
  assert.equal(matches.length, 1, `Expected exactly one ${key}/${suffix} branch`);
  return matches[0];
}

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'sequential-sketcher-s-scope-regression' } });
assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
const records = await response.json();
assert.ok(Array.isArray(records), 'Pinned fixture must be a JSON array');
const immutableSnapshot = JSON.stringify(records);
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const selectedBranches = evidence.branches.filter((branch) => lineKey(branch.branchId));
const selectedLineKeys = [...new Set(selectedBranches.map((branch) => lineKey(branch.branchId)))].sort();
assert.deepEqual(selectedLineKeys, EXPECTED_LINE_KEYS);
assert.equal(selectedBranches.length, 21);

const rows = [];
for (const branch of selectedBranches) {
  const result = runConstructionUntilBlocked(
    createSequentialConstructionSession(branch.branchId),
    evidence,
    indexes,
    ENGINE_OPTIONS,
    1200,
  );
  rows.push({
    branchId: branch.branchId,
    lineKey: lineKey(branch.branchId),
    state: result.session.state,
    blockedReason: result.session.currentDecisionRequest?.reason || null,
    componentCount: branch.components.length,
    sourceRouteComponentCount: branch.sourceRouteComponentCount,
    shadowCarrierCount: branch.shadowCarrierCount,
    confirmedComponentCount: result.session.confirmedComponentIds.length,
    connectionCount: result.session.committedConnections.length,
    repairCount: result.session.repairLedger.length,
    typeCounts: countBy(branch.components, (component) => component.canonicalType),
    operations: result.session.strokeLedger.map((command) => command.op),
  });
}

assert.equal(JSON.stringify(records), immutableSnapshot, 'S-scope regression must not mutate source evidence');
assert.deepEqual(countBy(rows, (row) => row.lineKey), EXPECTED_BRANCH_COUNTS);
assert.deepEqual(
  Object.fromEntries(EXPECTED_LINE_KEYS.map((key) => [key, rows.filter((row) => row.lineKey === key).reduce((sum, row) => sum + row.componentCount, 0)])),
  EXPECTED_ACTIVE_COMPONENT_COUNTS,
);
assert.equal(rows.reduce((sum, row) => sum + row.sourceRouteComponentCount, 0), 196);
assert.equal(rows.reduce((sum, row) => sum + row.componentCount, 0), 193);
assert.equal(rows.reduce((sum, row) => sum + row.shadowCarrierCount, 0), 3);
assert.deepEqual(
  countBy(selectedBranches.flatMap((branch) => branch.components), (component) => component.canonicalType),
  EXPECTED_TYPE_COUNTS,
);
assert.deepEqual(countBy(rows, (row) => row.state), {
  ROUTE_COMPLETE: 1,
  USER_DECISION_REQUIRED: 20,
});
assert.deepEqual(countBy(rows.filter((row) => row.blockedReason), (row) => row.blockedReason), EXPECTED_BLOCKED_REASONS);
assert.equal(rows.reduce((sum, row) => sum + row.repairCount, 0), 0);
assert.equal(rows.some((row) => row.state === 'FAILED'), false);
assert.equal(rows.some((row) => row.operations.includes('DISCONNECTED_FRAGMENT')), false);

const completeB3 = exactBranch(rows, 'S8811951', 'B3');
assert.equal(completeB3.state, 'ROUTE_COMPLETE');
assert.equal(completeB3.componentCount, 21);
assert.equal(completeB3.blockedReason, null);

const zeroLengthInstrument = exactBranch(rows, 'S8810101', 'B5');
assert.equal(zeroLengthInstrument.componentCount, 1);
assert.equal(zeroLengthInstrument.typeCounts.INSTRUMENT, 1);
assert.equal(zeroLengthInstrument.blockedReason, 'AMBIGUOUS_BRANCH_START');
assert.equal(zeroLengthInstrument.confirmedComponentCount, 0);

const reducerBoundary = exactBranch(rows, 'S8810101', 'B6');
assert.equal(reducerBoundary.typeCounts.REDUCER, 1);
assert.equal(reducerBoundary.blockedReason, 'REFERENCE_TARGET_MISSING');

const teeBoundary = exactBranch(rows, 'S8810111', 'B2');
assert.equal(teeBoundary.typeCounts.TEE, 1);
assert.equal(teeBoundary.blockedReason, 'MULTIPLE_BOUNDARY_REFERENCE_PORTS');

const unresolvedPort = exactBranch(rows, 'S8810101', 'B4');
assert.equal(unresolvedPort.blockedReason, 'REFERENCE_TARGET_PORT_UNRESOLVED');

const terminalReview = exactBranch(rows, 'S8810112', 'B6');
assert.equal(terminalReview.blockedReason, 'UNEXPLAINED_TERMINAL');
assert.ok(terminalReview.confirmedComponentCount > 0);

const shadowHost = exactBranch(rows, 'S8811951', 'B2');
assert.equal(shadowHost.shadowCarrierCount, 3);
assert.equal(shadowHost.sourceRouteComponentCount, 42);
assert.equal(shadowHost.componentCount, 39);
assert.equal(shadowHost.blockedReason, 'REFERENCE_TARGET_MISSING');

console.log(JSON.stringify({
  schema: 'Sequential1885NcSScopeRegression.v1',
  sourceCommit: SOURCE_COMMIT,
  lineKeys: selectedLineKeys,
  branchCounts: EXPECTED_BRANCH_COUNTS,
  activeComponentCounts: EXPECTED_ACTIVE_COMPONENT_COUNTS,
  stateCounts: countBy(rows, (row) => row.state),
  blockedReasonCounts: countBy(rows.filter((row) => row.blockedReason), (row) => row.blockedReason),
  shadowCarrierCount: rows.reduce((sum, row) => sum + row.shadowCarrierCount, 0),
  repairCount: rows.reduce((sum, row) => sum + row.repairCount, 0),
}, null, 2));

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

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const ROOT_BRANCH = '/ASIM-1885-6"-S8811951-91261M7-HC-01/B2';
const REPORT_PATH = 'artifacts/sequential-sketcher/1885-nc-b2-probe.json';

function text(value) { return String(value ?? '').trim(); }
function branchId(record) { return text(record?.attributes?.NAME || record?.name); }
function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const key = selector(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))));
}

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'sequential-sketcher-b2-probe' } });
assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
const records = await response.json();
assert.ok(Array.isArray(records));
const rawRoot = records.find((record) => branchId(record) === ROOT_BRANCH);
assert.ok(rawRoot, `Pinned fixture must contain ${ROOT_BRANCH}`);

const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const root = indexes.branches.get(ROOT_BRANCH);
assert.ok(root);
const sourceSnapshot = JSON.stringify(rawRoot);
const result = runConstructionUntilBlocked(
  createSequentialConstructionSession(ROOT_BRANCH),
  evidence,
  indexes,
  { exactToleranceMm: 1, autoRepairToleranceMm: 25, candidateSearchRadiusMm: 250 },
  2000,
);

assert.equal(JSON.stringify(rawRoot), sourceSnapshot, 'B2 construction must not mutate source evidence');
assert.notEqual(result.session.state, 'FAILED', 'B2 must stop safely rather than fail');
assert.ok(result.session.confirmedComponentIds.length > 0);
assert.equal(result.session.strokeLedger.some((command) => command.op === 'DISCONNECTED_FRAGMENT'), false);
if (result.session.state === 'USER_DECISION_REQUIRED') assert.ok(result.session.currentDecisionRequest);

const confirmedComponents = result.session.confirmedComponentIds
  .map((id) => indexes.components.get(id))
  .filter(Boolean);
const confirmedBranchIds = [...new Set(confirmedComponents.map((component) => component.branchId))];
const registeredJunctions = result.session.strokeLedger.filter((command) => (
  command.op === 'REGISTER_OLET_BRANCH' || command.op === 'REGISTER_TEE_BRANCH'
));
const returnedJunctions = result.session.strokeLedger.filter((command) => command.op === 'RETURN_TO_JUNCTION');
const enteredBranches = result.session.strokeLedger.filter((command) => command.op === 'ENTER_BRANCH');

const report = {
  schema: 'Sequential1885NcB2Probe.v1',
  sourceCommit: SOURCE_COMMIT,
  rootBranchId: ROOT_BRANCH,
  indexedBranchCount: evidence.branches.length,
  indexedComponentCount: evidence.components.length,
  rootSource: {
    href: root.href,
    tref: root.tref,
    componentCount: root.components.length,
    componentTypes: countBy(root.components, (component) => component.canonicalType),
    componentReferences: root.components
      .filter((component) => component.cref || component.ports.some((port) => port.referenceTarget))
      .map((component) => ({
        sourceComponentId: component.sourceComponentId,
        canonicalType: component.canonicalType,
        cref: component.cref,
        portReferences: component.ports.filter((port) => port.referenceTarget).map((port) => ({ role: port.role, referenceTarget: port.referenceTarget })),
      })),
  },
  finalState: result.session.state,
  outcomes: result.outcomes,
  blockedDecision: result.session.currentDecisionRequest ? {
    reason: result.session.currentDecisionRequest.reason,
    decisionScope: result.session.currentDecisionRequest.decisionScope || null,
    activePortId: result.session.currentDecisionRequest.activePortId || null,
    candidateCount: result.session.currentDecisionRequest.candidates.length,
    candidates: result.session.currentDecisionRequest.candidates.slice(0, 12).map((candidate) => ({
      candidateId: candidate.candidateId,
      targetBranchId: candidate.targetBranchId || null,
      targetSourceComponentId: candidate.targetSourceComponentId || null,
      targetPortRole: candidate.targetPortRole || null,
      gapMm: Number.isFinite(Number(candidate.gapMm ?? candidate.totalGapMm)) ? Number(Number(candidate.gapMm ?? candidate.totalGapMm).toFixed(3)) : null,
      referenceMatch: Boolean(candidate.referenceMatch || candidate.referenceKind),
      sourceAdjacent: Boolean(candidate.sourceAdjacent),
      boreCompatibility: candidate.boreCompatibility || null,
    })),
  } : null,
  confirmedComponentCount: confirmedComponents.length,
  confirmedComponentsByBranch: countBy(confirmedComponents, (component) => component.branchId),
  confirmedBranchIds,
  connectionCount: result.session.committedConnections.length,
  connectionTypes: countBy(result.session.committedConnections, (connection) => connection.connectionType),
  repairCount: result.session.repairLedger.length,
  pendingJunctions: result.session.pendingBranchJunctions,
  registeredJunctionCount: registeredJunctions.length,
  registeredJunctions,
  returnedJunctionCount: returnedJunctions.length,
  returnedJunctions,
  enteredBranchCount: enteredBranches.length,
  enteredBranches,
  operationCounts: countBy(result.session.strokeLedger, (command) => command.op),
};

mkdirSync('artifacts/sequential-sketcher', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));

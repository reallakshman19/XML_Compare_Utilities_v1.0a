import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import {
  buildSequentialBlockedReviewQueue,
  refreshSequentialBlockedReviewQueue,
} from '../tabs/sequential-sketcher/review/sequential-blocked-review-queue.js';
import {
  buildSequentialDecisionRegister,
  createSequentialDecisionRegisterExports,
} from '../tabs/sequential-sketcher/review/sequential-review-queue-export.js';
import { applyConstructionDecision } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { DECISION_ACTIONS } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { buildSequentialReversalCandidates } from '../tabs/sequential-sketcher/construction/sequential-supervised-decision-actions.js';

function pipe(name, start, end) {
  return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } };
}
function branch(name, attributes, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children };
}

const reverseId = '/REGISTER/S410/B1';
const deferId = '/REGISTER/S420/B1';
const records = [
  branch(reverseId, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('REVERSE-P1', { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
  ]),
  branch(deferId, {
    HPOS: { x: 0, y: 0, z: 0 },
    TREF: '/REGISTER/MISSING/TARGET',
  }, [
    pipe('DEFER-P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
  ]),
];
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const queue = buildSequentialBlockedReviewQueue(evidence, indexes, {});
const registry = createSequentialBranchWorkspaceRegistry();
registry.reset(evidence.branches.map((row) => row.branchId));
for (const snapshot of queue.snapshots) registry.save(snapshot.branchId, { session: snapshot.session });

const reverseSession = registry.get(reverseId).session;
const reversalCandidates = buildSequentialReversalCandidates(reverseSession, indexes);
assert.equal(reversalCandidates.length, 2);
const reversed = applyConstructionDecision(
  reverseSession,
  evidence,
  indexes,
  DECISION_ACTIONS.REVERSE_COMPONENT,
  {
    candidateId: reversalCandidates[1].candidateId,
    componentId: reversalCandidates[1].componentId,
    entryPortId: reversalCandidates[1].entryPortId,
    reason: 'Approved reverse traversal, upstream flow confirmed',
    evidenceNote: 'Approved line list, row 410, confirms the entry orientation.',
  },
  {},
);
assert.equal(reversed.outcome, 'COMPONENT_TRAVERSAL_REVERSED');
registry.save(reverseId, { session: reversed.session });

const deferSession = registry.get(deferId).session;
const deferred = applyConstructionDecision(
  deferSession,
  evidence,
  indexes,
  DECISION_ACTIONS.DEFER_DECISION,
  {
    reason: 'Await external scope confirmation',
    evidenceNote: 'No approved target reference is available.',
  },
  {},
);
assert.equal(deferred.outcome, 'DECISION_DEFERRED');
registry.save(deferId, { session: deferred.session });

const refreshed = refreshSequentialBlockedReviewQueue(queue, registry, evidence, indexes);
assert.equal(refreshed.summary.manuallyResolvedCount, 1);
assert.equal(refreshed.summary.deferredCount, 1);
const register = buildSequentialDecisionRegister(refreshed);
assert.equal(register.schema, 'SequentialDecisionRegister.v1');
assert.equal(register.summary.unresolvedCount, 1);
assert.equal(register.summary.manualResolutionCount, 1);
assert.equal(register.unresolvedRows[0].branchId, deferId);
assert.equal(register.unresolvedRows[0].decisionState, 'DEFERRED');
assert.equal(register.unresolvedRows[0].reason, 'REFERENCE_TARGET_MISSING');
assert.equal(register.unresolvedRows[0].deferredReason, 'Await external scope confirmation');
assert.equal(register.manualRows[0].branchId, reverseId);
assert.equal(register.manualRows[0].action, DECISION_ACTIONS.REVERSE_COMPONENT);
assert.equal(register.manualRows[0].reason, 'Approved reverse traversal, upstream flow confirmed');
assert.equal(register.manualRows[0].evidenceNote, 'Approved line list, row 410, confirms the entry orientation.');
assert.ok(register.manualRows[0].previousConstructionFingerprint);
assert.ok(register.manualRows[0].resultingConstructionFingerprint);

const exports = createSequentialDecisionRegisterExports(refreshed);
assert.match(exports.unresolvedCsv, /branchId,lineKey,reviewStatus/);
assert.match(exports.unresolvedCsv, /REFERENCE_TARGET_MISSING/);
assert.match(exports.unresolvedCsv, /Await external scope confirmation/);
assert.match(exports.manualCsv, /selectedFromPortId,selectedToPortId/);
assert.match(exports.manualCsv, /REVERSE_COMPONENT/);
assert.match(exports.manualCsv, /"Approved reverse traversal, upstream flow confirmed"/);
assert.match(exports.manualCsv, /"Approved line list, row 410, confirms the entry orientation\."/);
const parsedJson = JSON.parse(exports.registerJson);
assert.equal(parsedJson.schema, 'SequentialDecisionRegister.v1');
assert.equal(parsedJson.summary.unresolvedCount, 1);
assert.equal(parsedJson.summary.manualResolutionCount, 1);
assert.equal(parsedJson.manualRows[0].resultingConstructionFingerprint, register.manualRows[0].resultingConstructionFingerprint);

console.log('sequential decision register export tests passed');

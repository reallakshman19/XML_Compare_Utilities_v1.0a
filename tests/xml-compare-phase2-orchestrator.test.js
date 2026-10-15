import assert from 'node:assert/strict';

import {
  createApprovedMatchSet,
  createApprovedTransferCases,
  createMatchCandidateSet,
  createMatchDecision,
  createTransferPlan,
  createTransferStage,
  createValidationModelV2,
  orchestrateValidationTransferPhase,
  stableHash,
  validateTransferStage,
} from '../xml-compare/contracts/phase2-validation-transfer-orchestrator.js';

const ambiguousCandidates = createMatchCandidateSet({
  sourceId: 'A',
  targetId: 'B',
  candidates: [
    { sourceUid: 'S-10', targetUid: 'T-10A', deltaMm: 0.002, identityConfidence: 0.95, basis: ['coordinate-transform'] },
    { sourceUid: 'S-10', targetUid: 'T-10B', deltaMm: 0.003, identityConfidence: 0.95, basis: ['coordinate-transform'] },
  ],
});

assert.equal(ambiguousCandidates.schema, 'match-candidate-set/v1');
assert.ok(ambiguousCandidates.summary.ambiguousCount > 0, 'ambiguous candidates must be counted');
assert.equal(ambiguousCandidates.candidates.every((item) => item.secondBestDeltaMm != null), true);

const sourceRecords = [
  { uid: 'S-1', position: { x: 0, y: 0, z: 0 }, pressure: 10, coordinateFrameStatus: { comparableForDelta: true } },
  { uid: 'S-2', position: { x: 100, y: 0, z: 0 }, pressure: 10, coordinateFrameStatus: { comparableForDelta: true } },
];
const targetRecords = [
  { uid: 'T-1', position: { x: 0, y: 0, z: 0 }, pressure: 10.005, coordinateFrameStatus: { comparableForDelta: true } },
  { uid: 'T-2', position: { x: 100, y: 0, z: 0 }, pressure: 11, coordinateFrameStatus: { comparableForDelta: true } },
];

const candidateSet = createMatchCandidateSet({
  sourceId: 'A',
  targetId: 'B',
  candidates: [
    { sourceUid: 'S-1', targetUid: 'T-1', deltaMm: 0, identityConfidence: 0.98, basis: ['manual'], transformBasis: 'identity-offset' },
    { sourceUid: 'S-2', targetUid: 'T-2', deltaMm: 0, identityConfidence: 0.98, basis: ['manual'], transformBasis: 'identity-offset' },
  ],
});
const decisions = [
  createMatchDecision({ sourceUid: 'S-1', targetUid: 'T-1', decision: 'approved', decisionBasis: 'manual-review', confidence: 1 }),
  createMatchDecision({ sourceUid: 'S-2', targetUid: 'T-2', decision: 'approved', decisionBasis: 'manual-review', confidence: 1 }),
];
const approvedMatchSet = createApprovedMatchSet({
  sourceGraph: { sourceId: 'A' },
  targetGraph: { sourceId: 'B' },
  candidateSet,
  decisions,
  transformPolicy: { approved: true, approvalBasis: 'identity-offset' },
});

assert.equal(approvedMatchSet.schema, 'approved-match-set/v1');
assert.equal(approvedMatchSet.summary.approvedCount, 2);
assert.equal(approvedMatchSet.summary.blockerCount, 0);

const validationModel = createValidationModelV2({
  sourceRecords,
  targetRecords,
  approvedMatchSet,
  compareFields: ['pressure'],
});

assert.equal(validationModel.schema, 'validation-model/v2');
assert.equal(validationModel.rows[0].status, 'OK', 'pressure tolerance should allow small numeric delta');
assert.equal(validationModel.rows[1].status, 'MISMATCH', 'pressure tolerance should reject large numeric delta');
assert.equal(validationModel.summary.blockerCount, 1);

const duplicateCandidateSet = createMatchCandidateSet({
  candidates: [
    { sourceUid: 'S-1', targetUid: 'T-1', deltaMm: 0, identityConfidence: 0.98, status: 'candidate' },
    { sourceUid: 'S-2', targetUid: 'T-1', deltaMm: 0, identityConfidence: 0.98, status: 'candidate' },
  ],
});
const duplicateApproved = createApprovedMatchSet({
  candidateSet: duplicateCandidateSet,
  decisions: [
    createMatchDecision({ sourceUid: 'S-1', targetUid: 'T-1', decision: 'approved' }),
    createMatchDecision({ sourceUid: 'S-2', targetUid: 'T-1', decision: 'approved' }),
  ],
  transformPolicy: { approved: true },
});
assert.ok(duplicateApproved.summary.blockerCount > 0, 'conflicted matches must not silently approve');

const transferCases = createApprovedTransferCases({
  approvedMatchSet,
  validationModel: createValidationModelV2({ sourceRecords, targetRecords: [targetRecords[0], { ...targetRecords[1], pressure: 10 }], approvedMatchSet, compareFields: ['pressure'] }),
  requestedBlocks: ['RestraintsBlock'],
});
assert.equal(transferCases.filter((item) => item.approvalStatus === 'approved').length, 2);

const sourceText = '<CategorizedInputXML><Line id="A" /></CategorizedInputXML>';
const targetText = '<CategorizedInputXML><Line id="B" /></CategorizedInputXML>';
const transferPlan = createTransferPlan({
  approvedMatchSet,
  transferCases,
  sourceText,
  targetText,
  workspaceRevision: 7,
});
assert.equal(transferPlan.ok, true);
assert.equal(transferPlan.sourceHash, stableHash(sourceText));

const stage = createTransferStage({ plan: transferPlan, workspaceRevision: 7 });
assert.equal(validateTransferStage({ stage, sourceText, targetText, workspaceRevision: 7 }).ok, true);
assert.equal(validateTransferStage({ stage, sourceText: `${sourceText}\n<!-- changed -->`, targetText, workspaceRevision: 7 }).ok, false);

const orchestrated = orchestrateValidationTransferPhase({
  sourceReadiness: { sourceId: 'A', readyForConnector: true },
  targetReadiness: { sourceId: 'B', readyForConnector: true },
  sourceGraph: { sourceId: 'A' },
  targetGraph: { sourceId: 'B' },
  sourceRecords,
  targetRecords: [targetRecords[0], { ...targetRecords[1], pressure: 10 }],
  candidates: candidateSet.candidates,
  decisions,
  transformPolicy: { approved: true, approvalBasis: 'identity-offset' },
  compareFields: ['pressure'],
  requestedBlocks: ['RestraintsBlock'],
  sourceText,
  targetText,
  workspaceRevision: 7,
});

assert.equal(orchestrated.schema, 'xml-compare-phase2-orchestrator/v1');
assert.equal(orchestrated.readinessGateOk, true);
assert.equal(orchestrated.summary.transferReady, true);

console.log('XML Compare phase 2 orchestrator tests passed');

import assert from 'node:assert/strict';

import {
  applyXmlCompareCanvasAction,
  createXmlCompareCanvasState,
} from '../xml-compare/XmlCompareCanvasStateController.js';
import { createApprovedConnectorValidationModel } from '../xml-compare/XmlCompareApprovedConnectorModel.js';
import { _test as candidateRuntimeTest } from '../tabs/xml-compare-candidate-review-runtime.js';

const sourceRecords = [
  { uid: 'S-1', displayName: 'Source Node 1', position: { x: 0, y: 0, z: 0 }, pressure: 10, coordinateFrameStatus: { comparableForDelta: true } },
  { uid: 'S-2', displayName: 'Source Node 2', position: { x: 100, y: 0, z: 0 }, pressure: 10, coordinateFrameStatus: { comparableForDelta: true } },
];
const targetRecords = [
  { uid: 'T-1', displayName: 'Target Node 1', position: { x: 0, y: 0, z: 0 }, pressure: 10.005, coordinateFrameStatus: { comparableForDelta: true } },
  { uid: 'T-2', displayName: 'Target Node 2', position: { x: 100, y: 0, z: 0 }, pressure: 10, coordinateFrameStatus: { comparableForDelta: true } },
];

let state = createXmlCompareCanvasState();
state = applyXmlCompareCanvasAction(state, { type: 'select-record', side: 'source', uid: 'S-1', records: sourceRecords });
state = applyXmlCompareCanvasAction(state, { type: 'select-record', side: 'target', uid: 'T-1', records: targetRecords });

assert.equal(state.pendingConnectorPreview.sourceUid, 'S-1', 'selection must create pending preview');
assert.equal(state.pendingConnectorPreview.targetUid, 'T-1');
assert.equal(state.manualConnectors.length, 0, 'selection must not create approved/display connector');
assert.equal(state.matchDecisions.length, 0, 'selection must not create MatchDecision.v1');
assert.equal(state.approvedMatchSet, null, 'selection must not create ApprovedMatchSet.v1');

state = applyXmlCompareCanvasAction(state, { type: 'approve-pending-connector' });
assert.equal(state.matchDecisions.length, 1, 'Approve Link creates MatchDecision.v1');
assert.equal(state.matchDecisions[0].schema, 'match-decision/v1');
assert.equal(state.matchDecisions[0].decision, 'approved');
assert.equal(state.approvedMatchSet.schema, 'approved-match-set/v1');
assert.equal(state.approvedMatchSet.summary.approvedCount, 1, 'Approve Link creates ApprovedMatchSet.v1');
assert.equal(state.manualConnectors.length, 1, 'display connector is projection from ApprovedMatchSet');
assert.equal(state.manualConnectors[0].status, 'approved');

const validationModel = createApprovedConnectorValidationModel({ state, sourceRecords, targetRecords, compareFields: ['pressure'] });
assert.equal(validationModel.schema, 'validation-model/v2');
assert.equal(validationModel.summary.okCount, 1, 'ValidationModel.v2 consumes ApprovedMatchSet.v1');

const candidate = {
  id: 'candidate:S-2=>T-2:nodeNumber:nodeNumber',
  sourceUid: 'S-2',
  targetUid: 'T-2',
  sourceLabel: 'Source Node 2',
  targetLabel: 'Target Node 2',
  basis: ['KEY'],
  score: 0.96,
};
let candidateState = createXmlCompareCanvasState();
candidateState = applyXmlCompareCanvasAction(candidateState, { type: 'accept-candidate', candidate });
assert.equal(candidateState.matchDecisions[0].decision, 'approved');
assert.equal(candidateState.matchDecisions[0].decisionBasis, 'candidate-accepted');
assert.equal(candidateState.approvedMatchSet.summary.approvedCount, 1);

candidateState = applyXmlCompareCanvasAction(candidateState, { type: 'reject-candidate', candidateId: candidate.id, candidate });
assert.ok(candidateState.candidateDecisions.rejectedCandidateIds.includes(candidate.id), 'candidate reject persists rejected state');
assert.equal(candidateState.matchDecisions.at(-1).decision, 'rejected');

let ambiguousState = createXmlCompareCanvasState();
ambiguousState = applyXmlCompareCanvasAction(ambiguousState, { type: 'accept-candidate', candidate: { ...candidate, targetUid: 'T-X', status: 'ambiguous' } });
assert.equal(ambiguousState.matchDecisions[0].decision, 'needs-review', 'ambiguous candidate must not silently approve');
assert.equal(ambiguousState.approvedMatchSet.summary.approvedCount, 0);

let duplicateNumericState = createXmlCompareCanvasState();
duplicateNumericState = applyXmlCompareCanvasAction(duplicateNumericState, { type: 'accept-candidate', candidate: { ...candidate, sourceUid: 'S-1', targetUid: 'T-1', method: 'numeric-fields', allowDuplicateTarget: true, status: 'valid' } });
duplicateNumericState = applyXmlCompareCanvasAction(duplicateNumericState, { type: 'accept-candidate', candidate: { ...candidate, sourceUid: 'S-2', targetUid: 'T-1', method: 'numeric-fields', allowDuplicateTarget: true, status: 'valid' } });
assert.equal(duplicateNumericState.approvedMatchSet.summary.approvedCount, 2, 'numeric-field-valid duplicate target claims remain approved');
assert.equal(duplicateNumericState.approvedMatchSet.summary.blockerCount, 0);

const events = [];
globalThis.CustomEvent = class TestCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};
const dispatchTarget = { dispatchEvent(event) { events.push(event); return true; } };
const row = {
  dataset: {
    xmlCompareCandidateRow: candidate.id,
    sourceUid: candidate.sourceUid,
    targetUid: candidate.targetUid,
    sourceLabel: candidate.sourceLabel,
    targetLabel: candidate.targetLabel,
    basis: 'KEY',
    score: '0.96',
  },
};
assert.equal(candidateRuntimeTest.acceptRow(row, dispatchTarget), true);
assert.equal(events[0].type, 'xml-compare:state-action');
assert.equal(events[0].detail.type, 'accept-candidate', 'candidate accept dispatches semantic action');
assert.equal(events[0].detail.candidate.sourceUid, 'S-2');

console.log('XML Compare approved connector workflow tests passed');

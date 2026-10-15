import assert from 'assert';
import { createCiiTransferPreview } from '../tabs/cii-workspace/cii-workspace-transfer-plan.js';
import { createCiiWorkspaceReviewLedger } from '../tabs/cii-workspace/cii-workspace-review.js';

const sourceDocument = { fileName: 'source.cii', contentSha256: 'source-sha' };
const targetDocument = { fileName: 'target.cii', contentSha256: 'target-sha' };
const sourceGraph = {
  nodes: [{ id: '100', nodeName: 'PUMP-N1' }, { id: '200', nodeName: '' }],
  edges: [{ elementId: 'S100-200', diameter: 273, P1: 4500, T1: 145, lengthMm: 1000, componentKind: 'PIPE', rigidEvidence: { status: 'NONE' }, fromContext: { sizeTransition: false }, toContext: { sizeTransition: false } }],
};
const targetGraph = {
  nodes: [{ id: '5000', nodeName: 'EXISTING-NAME' }, { id: '5010', nodeName: '' }, { id: '5020', nodeName: '' }],
  edges: [
    { elementId: 'T5000-5010', diameter: 273, P1: 0, T1: 0, lengthMm: 500, componentKind: 'PIPE', rigidEvidence: { status: 'NONE' }, fromContext: { sizeTransition: false }, toContext: { sizeTransition: true } },
    { elementId: 'T5010-5020', diameter: 219, P1: 0, T1: 0, lengthMm: 500, componentKind: 'PIPE', rigidEvidence: { status: 'NONE' }, fromContext: { sizeTransition: true }, toContext: { sizeTransition: false } },
  ],
};
const correspondence = {
  status: 'READY', correspondenceIdentity: 'corr-transfer',
  nodeRows: [
    { correspondenceId: 'node:100:5000', kind: 'NODE', sourceNodeId: '100', targetNodeId: '5000', status: 'LOCKED', authority: 'USER_LOCKED_ANCHOR' },
    { correspondenceId: 'insert:5010', kind: 'NODE', sourceNodeId: null, targetNodeId: '5010', status: 'INSERTED' },
  ],
  elementRows: [{ correspondenceId: 'path:S100-200:T5000-5010:T5010-5020', kind: 'ELEMENT_PATH', sourceElementIds: ['S100-200'], targetElementIds: ['T5000-5010', 'T5010-5020'], status: 'HIGH', authority: 'LOCKED_ANCHOR_SPAN_SUBDIVISION' }],
};
const review = createCiiWorkspaceReviewLedger(sourceDocument, targetDocument, [], correspondence, {
  reviewedCorrespondenceIds: ['path:S100-200:T5000-5010:T5010-5020'],
});
const plan = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, review);
const nodeName = plan.operations.find((item) => item.property === 'NodeName');
assert(nodeName.blockers.includes('TARGET_NODENAME_NONBLANK'));
assert(!plan.operations.some((item) => item.targetEvidence?.nodeId === '5010'));
for (const property of ['P1', 'T1']) {
  const operation = plan.operations.find((item) => item.property === property);
  assert(operation.blockers.includes('TARGET_PATH_SIZE_TRANSITION_UNREPRESENTED_IN_SOURCE'));
  assert(operation.blockers.includes('TARGET_PATH_REDUCER_CONTEXT_REQUIRES_SPLIT'));
  assert.strictEqual(operation.status, 'BLOCKED');
}
assert.strictEqual(plan.status, 'BLOCKED');
assert(plan.blockers.includes('NO_TRANSFERABLE_PREVIEW_OPERATIONS'));
console.log('CII Workspace bound transfer preview checks passed.');

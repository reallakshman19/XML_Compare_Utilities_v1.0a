import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { attachCiiComponentCorrespondence } from '../tabs/cii-workspace/cii-workspace-components.js';
import { createCiiTransferPreview } from '../tabs/cii-workspace/cii-workspace-transfer-plan.js';
import { createCiiWorkspaceReviewLedger } from '../tabs/cii-workspace/cii-workspace-review.js';

function document(side, from, to, weight, options = {}) {
  const pointerBound = options.pointerBound !== false;
  const element = { index: 0, from, to, dx: 1000, dy: 0, dz: 0, length: 1000, od: 273, wall: 8, P1: 10, T1: 100, hasBend: false };
  const rigidRecord = pointerBound ? { pointer: 1, weight, rawFields: [weight], rawRow: String(weight) } : null;
  return {
    schema: 'CIIWorkspaceDocument.v1', side, fileName: `${side}.cii`, contentSha256: `${side}-sha`, nodeNames: {},
    parsed: {
      elements: [element],
      nodes: { [from]: { x: 0, y: 0, z: 0 }, [to]: { x: 1000, y: 0, z: 0 } },
      // Deliberately misleading legacy parser evidence. Pointer custody below is
      // the only authority allowed to classify the element as RIGID.
      rigids: [{ node: from, mass: Number(weight) + 999 }],
    },
    auxiliaryEvidence: {
      elements: { 0: { pointers: { rigid: pointerBound ? 1 : 0, sifTee: 0 }, rigidRecord, sifTeeRecord: null } },
      rigids: { byPointer: pointerBound ? { 1: rigidRecord } : {} },
    },
    capabilities: { families: {
      rigidMass: {
        state: pointerBound ? 'PARSED' : 'EMPTY', count: pointerBound ? 1 : 0, qualification: 'QUALIFIED',
        authority: 'tabs/cii-workspace/cii-workspace-auxiliary.js#RIGID_POINTER', limitations: [],
      },
      sifTee: {
        state: 'EMPTY', count: 0, qualification: 'PARTIAL',
        authority: 'tabs/cii-workspace/cii-workspace-auxiliary.js#SIF_TEE_POINTER', limitations: [],
      },
    } },
  };
}

const sourceDocument = document('SOURCE', 100, 110, 25);
const targetDocument = document('TARGET', 5000, 5010, 10);
const sourceGraph = adaptCiiDocumentToTopologyGraph(sourceDocument);
const targetGraph = adaptCiiDocumentToTopologyGraph(targetDocument);
assert.strictEqual(sourceGraph.edges[0].componentKind, 'RIGID');
assert.strictEqual(sourceGraph.edges[0].rigidEvidence.status, 'POINTER_BOUND_RECORD');
assert.strictEqual(sourceGraph.edges[0].rigidEvidence.pointer, 1);
assert.strictEqual(sourceGraph.edges[0].rigidEvidence.weight, 25);
assert.strictEqual(targetGraph.edges[0].componentKind, 'RIGID');
assert.strictEqual(targetGraph.edges[0].rigidEvidence.weight, 10);

const row = {
  correspondenceId: 'element:E1:100->110:E1:5000->5010', kind: 'ELEMENT',
  sourceElementId: sourceGraph.edges[0].elementId, targetElementIds: [targetGraph.edges[0].elementId],
  status: 'HIGH', authority: 'LOCKED_ANCHOR_SPAN_ALIGNMENT',
};
const correspondence = attachCiiComponentCorrespondence({ status: 'READY', correspondenceIdentity: 'corr-rigid', nodeRows: [], elementRows: [row] }, sourceGraph, targetGraph);
assert.strictEqual(correspondence.componentRows.length, 1);
assert.strictEqual(correspondence.componentRows[0].kind, 'COMPONENT');
assert.strictEqual(correspondence.componentRows[0].authority, 'POINTER_BOUND_RIGID_COMPONENT_CONTEXT');
const componentRow = correspondence.componentRows[0];
const review = createCiiWorkspaceReviewLedger(sourceDocument, targetDocument, [], correspondence, {
  reviewedCorrespondenceIds: [componentRow.correspondenceId], rejectedCorrespondenceIds: [],
});
const plan = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, review);
const rigid = plan.operations.find((operation) => operation.property === 'rigidWeight');
assert(rigid, 'reviewed pointer-bound RIGID correspondence should create a rigidWeight preview');
assert.strictEqual(rigid.status, 'PREVIEW_READY');
assert.strictEqual(rigid.before, 10);
assert.strictEqual(rigid.proposed, 25);
assert.strictEqual(rigid.custody, 'RIGID_COMPONENT');
assert.strictEqual(rigid.matchAuthority.kind, 'COMPONENT');

const noPointerDocument = document('TARGET', 6000, 6010, 10, { pointerBound: false });
const noPointerGraph = adaptCiiDocumentToTopologyGraph(noPointerDocument);
assert.strictEqual(noPointerGraph.edges[0].componentKind, 'PIPE', 'legacy parsed.rigids must not create RIGID identity without an ELEMENT pointer');
assert.strictEqual(noPointerGraph.edges[0].rigidEvidence.status, 'NONE');
const noPointerCorrespondence = attachCiiComponentCorrespondence({ status: 'READY', nodeRows: [], elementRows: [{ ...row, targetElementIds: [noPointerGraph.edges[0].elementId] }] }, sourceGraph, noPointerGraph);
assert.strictEqual(noPointerCorrespondence.componentRows.length, 0, 'RIGID component custody requires pointer-bound evidence on both sides');

console.log('CII Workspace pointer-bound rigid component correspondence/custody checks passed.');

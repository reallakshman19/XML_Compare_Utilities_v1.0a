// T0.1 contract validation + T0.2 audit cross-reference integrity.
import assert from 'assert';
import {
  CONTRACT_VERSIONS, DIFF_STATUS, APPROVAL_STATUS, TRANSFER_RULES,
  validateCanonicalObjectGraph, validateCompareAudit, validateTransferPlan, validateVisualGeometryModel,
} from '../workbench3d/contracts/contracts.js';

// ── T0.1 CanonicalObjectGraph.v1 ─────────────────────────────────────────
const tinyGraph = {
  contract: CONTRACT_VERSIONS.CanonicalObjectGraph,
  modelId: 'source',
  objects: [{ objectId: 'source:E1', kind: 'PIPE' }],
  nodes: [{ nodeId: '10', coordMm: [0, 0, 0] }],
  paths: [{ pathId: 'source:P1', elementIds: ['source:E1'] }],
};
assert.deepStrictEqual(validateCanonicalObjectGraph(tinyGraph), [], 'valid graph accepted');
assert.ok(validateCanonicalObjectGraph({ ...tinyGraph, objects: [{ kind: 'PIPE' }] }).length > 0, 'missing objectId rejected');
assert.ok(validateCanonicalObjectGraph({ ...tinyGraph, paths: [{ pathId: 'p', elementIds: ['ghost'] }] }).length > 0, 'orphan path element rejected');

// ── T0.2 CompareAudit.v1 cross references ────────────────────────────────
const audit = {
  contract: CONTRACT_VERSIONS.CompareAudit,
  sourceObjectIds: ['source:E1'],
  targetObjectIds: ['target:E1'],
  objectDiff: { rows: [{ diffId: 'D1', sourceObjectId: 'source:E1', targetObjectId: 'target:E1', status: DIFF_STATUS.MATCHED_UNCHANGED }] },
  conflictLedger: { rows: [{ conflictId: 'C1', diffId: 'D1', kind: 'EVIDENCE_CONFLICT' }] },
  transferPlan: { rows: [{ rowId: 'T1', diffId: 'D1', targetObjectId: 'target:E1' }] },
};
assert.deepStrictEqual(validateCompareAudit(audit), [], 'valid audit accepted');
const orphanAudit = JSON.parse(JSON.stringify(audit));
orphanAudit.conflictLedger.rows[0].diffId = 'D999';
assert.ok(validateCompareAudit(orphanAudit).length > 0, 'orphan conflict diffId rejected');
const orphanTransfer = JSON.parse(JSON.stringify(audit));
orphanTransfer.transferPlan.rows[0].targetObjectId = 'target:GHOST';
assert.ok(validateCompareAudit(orphanTransfer).length > 0, 'orphan transfer target rejected');

// TransferPlan geometry protection at contract level.
const plan = {
  contract: CONTRACT_VERSIONS.TransferPlan,
  config: { allowGeometryTransfer: false },
  rows: [{ rowId: 'T1', property: 'FROM_NODE', approval: APPROVAL_STATUS.APPROVED, rule: TRANSFER_RULES.OVERWRITE }],
};
assert.ok(validateTransferPlan(plan).length > 0, 'approved geometry transfer rejected by contract');

// VisualGeometryModel sanity.
assert.deepStrictEqual(validateVisualGeometryModel({
  contract: CONTRACT_VERSIONS.VisualGeometryModel,
  modelId: 'source',
  segments: [{ objectId: 'source:E1', start: [0, 0, 0], end: [1, 0, 0] }],
  markers: [],
}), [], 'valid visual model accepted');

console.log('workbench3d-contracts.test.js passed');

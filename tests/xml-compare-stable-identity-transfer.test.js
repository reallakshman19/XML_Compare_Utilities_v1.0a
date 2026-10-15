import assert from 'node:assert/strict';

import { buildTransferPlanPreview } from '../xml-compare/XmlCompareTransferStateModel.js';

// Approved match captured a uid at approval time, plus a level-independent stableKey.
const approvedMatchSet = {
  approvedMatches: [{ sourceUid: 'old-s', targetUid: 'old-t', sourceStableKey: 'LINENO1::10', targetStableKey: 'UNSPECIFIED_LINE::1010', identityConfidence: 0.9, coordinateDeltaMm: 0 }],
  summary: { approvedCount: 1 },
};
const validationModel = { rows: [{ sourceUid: 'old-s', targetUid: 'old-t', status: 'OK', coordinateDeltaMm: 0 }] };
const baseInput = {
  approvedMatchSet,
  approvedValidationModel: validationModel,
  selectedBlocks: ['NameBlock'],
  scope: 'node',
  sourceText: '<CategorizedInputXML></CategorizedInputXML>',
  targetText: '<CategorizedInputXML></CategorizedInputXML>',
  workspaceRevision: 0,
};

// --- G2 fix: the current records have DIFFERENT uids (level view changed) but matching stableKeys. ---
const relabelled = buildTransferPlanPreview({
  ...baseInput,
  sourceRecords: [{ uid: 'new-s-uid', stableKey: 'LINENO1::10', lineNo: 'LINENO1', nodeNumber: '10', elementKey: '10->20', role: 'FROM' }],
  targetRecords: [{ uid: 'new-t-uid', stableKey: 'UNSPECIFIED_LINE::1010', lineNo: 'UNSPECIFIED_LINE', nodeNumber: '1010', elementKey: '1000->1010', role: 'TO' }],
});
assert.equal(relabelled.ok, true, 'plan resolves via stableKey despite uid change');
assert.ok(!relabelled.diagnostics.some((d) => d.code === 'UNRESOLVED_APPROVED_PAIR'), 'no unresolved diagnostic when stableKey matches');
assert.equal(relabelled.pairs[0].sourceNode, '10', 'source node resolved from current record');
assert.equal(relabelled.pairs[0].targetNode, '1010', 'target node resolved from current record');

// --- Guard: neither stableKey nor uid resolves -> BLOCKER diagnostic, plan not ok (no silent skip). ---
const unresolved = buildTransferPlanPreview({
  ...baseInput,
  sourceRecords: [{ uid: 'zzz', stableKey: 'OTHER_LINE::99', lineNo: 'OTHER_LINE', nodeNumber: '99' }],
  targetRecords: [{ uid: 'yyy', stableKey: 'OTHER_LINE::88', lineNo: 'OTHER_LINE', nodeNumber: '88' }],
});
assert.equal(unresolved.ok, false, 'plan blocked when approved pair cannot be resolved');
assert.ok(unresolved.diagnostics.some((d) => d.code === 'UNRESOLVED_APPROVED_PAIR'), 'unresolved pair raises a diagnostic instead of silently skipping');

// --- Back-compat: records keyed by uid only (no stableKey) still resolve via uid fallback. ---
const uidOnly = buildTransferPlanPreview({
  ...baseInput,
  sourceRecords: [{ uid: 'old-s', lineNo: 'LINENO1', nodeNumber: '10' }],
  targetRecords: [{ uid: 'old-t', lineNo: 'UNSPECIFIED_LINE', nodeNumber: '1010' }],
});
assert.equal(uidOnly.ok, true, 'uid fallback still resolves when no stableKey present');
assert.ok(!uidOnly.diagnostics.some((d) => d.code === 'UNRESOLVED_APPROVED_PAIR'));

console.log('XML Compare stable identity transfer tests passed');

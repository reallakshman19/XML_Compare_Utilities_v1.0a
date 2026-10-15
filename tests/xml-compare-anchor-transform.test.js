import assert from 'node:assert/strict';

import { _test, coordinateAxisForField, createAnchorOffset, applyAnchorOffset, alignedFieldValue } from '../xml-compare/XmlCompareAnchorTransform.js';
import { createValidationModelV2 } from '../xml-compare/contracts/phase2/validation-models.js';
import { createApprovedMatchSet, createMatchCandidateSet } from '../xml-compare/contracts/phase2/match-models.js';

// --- module unit tests ---
assert.equal(coordinateAxisForField('globalX'), 'x');
assert.equal(coordinateAxisForField('FROM_GLOBAL_Z'), 'z');
assert.equal(coordinateAxisForField('z'), 'z');
assert.equal(coordinateAxisForField('index'), null, "'index' must not be treated as a coordinate axis");
assert.equal(coordinateAxisForField('temperature1'), null);

const offset = createAnchorOffset({ sourceAnchor: { position: { x: 10, y: 0, z: -19800 } }, targetAnchor: { position: { x: 0, y: 0, z: -108 } } });
assert.deepEqual({ x: offset.x, y: offset.y, z: offset.z }, { x: 10, y: 0, z: -19692 });
assert.deepEqual(applyAnchorOffset({ x: 0, y: 0, z: -1100 }, offset), { x: 10, y: 0, z: -20792 });
assert.equal(alignedFieldValue('globalZ', -1100, offset), -20792);
assert.equal(alignedFieldValue('materialName', 'A106 B', offset), 'A106 B', 'text fields are untouched');

// --- G3: anchor offset makes coordinate validation pass across different origins ---
// Source frame (absolute) vs target frame (basis 0). Anchor: s10 <-> t1010.
const sourceRecords = [
  { uid: 's10', position: { x: 10, y: 0, z: -19800 }, globalZ: -19800 },
  { uid: 's20', position: { x: 10, y: 0, z: -20792 }, globalZ: -20792 },
];
const targetRecords = [
  { uid: 't1010', position: { x: 0, y: 0, z: -108 }, globalZ: -108 },
  { uid: 't1020', position: { x: 0, y: 0, z: -1100 }, globalZ: -1100 },
];
const decisions = [
  { sourceUid: 's10', targetUid: 't1010', decision: 'approved', decisionBasis: 'anchor', confidence: 0.9 },
  { sourceUid: 's20', targetUid: 't1020', decision: 'approved', decisionBasis: 'manual', confidence: 0.9 },
];
const candidateSet = createMatchCandidateSet({ candidates: decisions.map((d) => ({ sourceUid: d.sourceUid, targetUid: d.targetUid, basis: ['manual'], score: 0.9, identityConfidence: 0.9 })) });
const approvedMatchSet = createApprovedMatchSet({ candidateSet, decisions, transformPolicy: { approved: true } });
assert.equal(approvedMatchSet.summary.approvedCount, 2);

const anchor = { sourceUid: 's10', targetUid: 't1010' };

// Without anchor: raw origins differ -> coordinate field mismatches, huge coord delta.
const noAnchor = createValidationModelV2({ sourceRecords, targetRecords, approvedMatchSet, compareFields: ['globalZ'] });
const s20NoAnchor = noAnchor.rows.find((r) => r.sourceUid === 's20');
assert.equal(s20NoAnchor.fieldRows[0].status, 'MISMATCH', 'without anchor, globalZ mismatches');
assert.ok(s20NoAnchor.coordinateDeltaMm > 1000, `without anchor coord delta should be huge, got ${s20NoAnchor.coordinateDeltaMm}`);

// With anchor: target re-based onto source frame -> aligned, OK.
const withAnchor = createValidationModelV2({ sourceRecords, targetRecords, approvedMatchSet, compareFields: ['globalZ'], anchor });
const s20 = withAnchor.rows.find((r) => r.sourceUid === 's20');
assert.equal(s20.fieldRows[0].status, 'OK', 'with anchor, globalZ aligns and passes');
assert.ok(s20.coordinateDeltaMm < 0.01, `with anchor coord delta ~0, got ${s20.coordinateDeltaMm}`);
assert.equal(withAnchor.summary.okCount, 2, 'both rows OK after anchor alignment');

console.log('XML Compare anchor transform tests passed');

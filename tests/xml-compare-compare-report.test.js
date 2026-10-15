import assert from 'node:assert/strict';

import { createXmlCompareFieldCompareModel, createXmlCompareCompareReport } from '../xml-compare/XmlCompareFieldCompareModel.js';
import { createAnchorOffset } from '../xml-compare/XmlCompareAnchorTransform.js';

const src = (n, z) => ({ uid: `s${n}`, stableKey: `LINENO1::${n}`, nodeNumber: String(n), displayName: `SRC-node-${n}`, globalX: 23227.580, globalY: 3257.150, globalZ: z, position: { x: 23227.580, y: 3257.150, z } });
const tgt = (n, z) => ({ uid: `t${n}`, stableKey: `UNSPECIFIED_LINE::${n}`, nodeNumber: String(n), displayName: `TGT-different-${n}`, globalX: 0, globalY: 0, globalZ: z, position: { x: 0, y: 0, z } });

const sourceRecords = [src(10, -19800), src(70, -22942.292)];
const targetRecords = [tgt(1010, -108), tgt(1050, -3250.292)];
const offset = createAnchorOffset({ sourceAnchor: sourceRecords[0], targetAnchor: targetRecords[0] }); // z: -19692

// --- single-pair differ: aligned coordinate unchanged, label changed ---
const anchorModel = createXmlCompareFieldCompareModel({ sourceRecord: src(10, -19800), targetRecord: tgt(1010, -108), compareFields: ['globalZ', 'globalX', 'displayName'], anchorOffset: offset });
const zRow = anchorModel.rows.find((r) => r.field === 'globalZ');
assert.equal(zRow.valueType, 'number');
assert.ok(Math.abs(zRow.delta) < 1e-6, `aligned globalZ delta ~0, got ${zRow.delta}`);
assert.equal(zRow.status, 'unchanged');
assert.equal(anchorModel.rows.find((r) => r.field === 'globalX').status, 'unchanged');
const nameRow = anchorModel.rows.find((r) => r.field === 'displayName');
assert.equal(nameRow.valueType, 'string');
assert.equal(nameRow.status, 'changed', 'different node labels -> changed');

// --- within-tolerance banding ---
const nearModel = createXmlCompareFieldCompareModel({ sourceRecord: { globalZ: -22942.292 }, targetRecord: { globalZ: -3247.1 }, compareFields: ['globalZ'], anchorOffset: offset, toleranceMm: 6 });
// -3247.1 + -19692 = -22939.1 ; delta from -22942.292 = 3.192 -> within-tol
assert.equal(nearModel.rows[0].status, 'within-tol', `expected within-tol, got ${nearModel.rows[0].status} (delta ${nearModel.rows[0].delta})`);

// --- missing field ---
const missingModel = createXmlCompareFieldCompareModel({ sourceRecord: { globalZ: -1 }, targetRecord: {}, compareFields: ['globalZ'] });
assert.equal(missingModel.rows[0].status, 'missing');

// --- multi-pair report over approved pairs ---
const pairs = [
  { sourceUid: 's10', targetUid: 't1010', sourceStableKey: 'LINENO1::10', targetStableKey: 'UNSPECIFIED_LINE::1010' },
  { sourceUid: 's70', targetUid: 't1050', sourceStableKey: 'LINENO1::70', targetStableKey: 'UNSPECIFIED_LINE::1050' },
];
const report = createXmlCompareCompareReport({ pairs, sourceRecords, targetRecords, compareFields: ['globalZ', 'displayName'], anchorOffset: offset });
assert.equal(report.pairCount, 2);
assert.ok(report.pairs.every((p) => p.resolved), 'both pairs resolve by stableKey');
// 2 pairs x globalZ unchanged = 2 unchanged; 2 x displayName changed = 2 changed
assert.equal(report.totals.unchangedCount, 2);
assert.equal(report.totals.changedCount, 2);
assert.equal(report.totals.fieldCount, 4);

console.log('XML Compare compare report tests passed');

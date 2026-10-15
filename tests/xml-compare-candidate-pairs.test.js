import assert from 'node:assert/strict';

import { createXmlCompareCandidatePairs, detectAnchorConnectors, _test } from '../xml-compare/XmlCompareCandidatePairModel.js';

// Benchmark geometry: source is an absolute Z-riser (X/Y constant); target is delta-basis (origin 0,0,0).
// Anchor s10 <-> t1010 -> translation offset re-bases the target onto the source frame.
const src = (n, z) => ({ uid: `s${n}`, stableKey: `LINENO1::${n}`, nodeNumber: String(n), displayName: `${n}->x`, position: { x: 23227.580, y: 3257.150, z } });
const tgt = (n, z) => ({ uid: `t${n}`, stableKey: `UNSPECIFIED_LINE::${n}`, nodeNumber: String(n), displayName: `${n}->x`, position: { x: 0, y: 0, z } });

const sourceRecords = [src(10, -19800), src(20, -19908), src(70, -22942.292)];
// t1050 as-saved chosen so aligned (offset z = -19692) lands exactly on s70: -3250.292 + -19692 = -22942.292
const targetRecords = [tgt(1010, -108), tgt(1020, -1100), tgt(1050, -3250.292)];
const anchor = { sourceUid: 's10', targetUid: 't1010' };

const result = createXmlCompareCandidatePairs({ sourceRecords, targetRecords, anchor, toleranceMm: 6 });
const pair = (uid) => result.pairs.find((p) => p.sourceUid === uid);

// Anchor pair: exact, valid.
assert.equal(pair('s10').isAnchor, true);
assert.equal(pair('s10').targetUid, 't1010');
assert.equal(pair('s10').deltaMm, 0);
assert.equal(pair('s10').status, 'valid');

// Coincident node after alignment: valid at ~0 mm.
assert.equal(pair('s70').targetUid, 't1050');
assert.ok(pair('s70').deltaMm < 0.01, `s70 delta ~0, got ${pair('s70').deltaMm}`);
assert.equal(pair('s70').status, 'valid');

// Off-by-one node: nearest is the anchor target ~108 mm away -> review.
assert.equal(pair('s20').targetUid, 't1010');
assert.ok(Math.abs(pair('s20').deltaMm - 108) < 0.01, `s20 delta ~108, got ${pair('s20').deltaMm}`);
assert.equal(pair('s20').status, 'review');

assert.deepEqual(
  { valid: result.summary.validCount, review: result.summary.reviewCount, conflict: result.summary.conflictCount },
  { valid: 2, review: 1, conflict: 0 },
);

// --- Conflict: two source nodes claim the same target -> both flagged conflict. ---
const withConflict = createXmlCompareCandidatePairs({
  sourceRecords: [...sourceRecords, src(71, -22942.0)],
  targetRecords, anchor, toleranceMm: 6,
});
const c70 = withConflict.pairs.find((p) => p.sourceUid === 's70');
const c71 = withConflict.pairs.find((p) => p.sourceUid === 's71');
assert.equal(c70.targetUid, 't1050');
assert.equal(c71.targetUid, 't1050');
// nearest-wins: s70 (Δ≈0) keeps the contested target; s71 (Δ≈0.29) is the conflict loser.
assert.equal(c70.status, 'valid', 'nearest source keeps the contested target');
assert.equal(c71.status, 'conflict', 'farther source flagged as conflict loser');
assert.equal(withConflict.summary.conflictCount, 1);

// --- No anchor -> no offset -> different origins never align (all review). ---
const noAnchor = createXmlCompareCandidatePairs({ sourceRecords, targetRecords, toleranceMm: 6, mode: 'numeric' });
assert.equal(noAnchor.summary.validCount, 0, 'without an anchor, nothing is valid by coordinate');

// --- PS basis (AIM 2): match by node name (delimiter token), no coordinate anchor needed. ---
const nSrc = [
  { uid: 'ns1', stableKey: 'L::1', nodeNumber: '1', nodeName: 'PS.A100.10' },
  { uid: 'ns2', stableKey: 'L::2', nodeNumber: '2', nodeName: 'PS.A100.20' },
  { uid: 'ns3', stableKey: 'L::3', nodeNumber: '3', nodeName: 'PS.A100.99' },
];
const nTgt = [
  { uid: 'nt1', stableKey: 'T::1', nodeNumber: '5001', nodeName: 'PS.A100.10' },
  { uid: 'nt2', stableKey: 'T::2', nodeNumber: '5002', nodeName: 'PS.A100.20' },
];
// whole-name match
const byName = createXmlCompareCandidatePairs({ sourceRecords: nSrc, targetRecords: nTgt, basis: 'name', nameField: 'nodeName' });
const np = (uid) => byName.pairs.find((p) => p.sourceUid === uid);
assert.equal(np('ns1').targetUid, 'nt1', 'name match pairs by identical node name');
assert.equal(np('ns1').status, 'valid');
assert.equal(np('ns3').status, 'no-target', 'unmatched name -> no-target');
assert.equal(byName.basis, 'name');
// delimiter-token match: last token after "." (position 3)
const byToken = createXmlCompareCandidatePairs({ sourceRecords: nSrc, targetRecords: nTgt, basis: 'name', nameField: 'nodeName', nameDelimiter: '.', namePosition: 3 });
assert.equal(byToken.pairs.find((p) => p.sourceUid === 'ns2').targetUid, 'nt2', 'token position 3 ("20") matches');

// --- AIM 3: per-axis tolerance (X, Y, Z gated independently). ---
// offset = anchorS - anchorT = (1000,1000,1000). Two isolated clusters so each source has one clear nearest.
const anchorS = { uid: 's0', stableKey: 'S::0', nodeNumber: '0', position: { x: 1000, y: 1000, z: 1000 } };
const anchorT = { uid: 't0', stableKey: 'T::0', nodeNumber: '0', position: { x: 0, y: 0, z: 0 } };
const sPass = { uid: 's1', stableKey: 'S::1', nodeNumber: '1', position: { x: 1400, y: 1400, z: 1300 } };       // vs t1 aligned (1300,1300,1250) -> Δ (100,100,50)
const sFailZ = { uid: 's2', stableKey: 'S::2', nodeNumber: '2', position: { x: 50000, y: 50000, z: 50000 } };  // vs t2 aligned (50100,50100,49250) -> Δ (-100,-100,750)
const tNear = { uid: 't1', stableKey: 'T::1', nodeNumber: '1', position: { x: 300, y: 300, z: 250 } };
const tFar = { uid: 't2', stableKey: 'T::2', nodeNumber: '2', position: { x: 49100, y: 49100, z: 48250 } };
const axSrc = [anchorS, sPass, sFailZ], axTgt = [anchorT, tNear, tFar], axAnchor = { sourceUid: 's0', targetUid: 't0' };

const tight = createXmlCompareCandidatePairs({ sourceRecords: axSrc, targetRecords: axTgt, anchor: axAnchor, tolerance: { x: 1000, y: 1000, z: 500 }, mode: 'numeric' });
const ap = (uid) => tight.pairs.find((p) => p.sourceUid === uid);
assert.deepEqual(tight.tolerance, { x: 1000, y: 1000, z: 500 });
assert.equal(ap('s1').status, 'valid', 'all axes within limit -> valid');
assert.ok(Math.abs(Math.abs(ap('s1').deltaZ) - 50) < 1e-6, `axis deltas exposed, got Δz=${ap('s1').deltaZ}`);
assert.equal(ap('s2').status, 'review', 'Δz=750 exceeds Z=500 -> review even though X/Y pass');

// Loosen only Z -> the same pair becomes valid, proving axes are gated independently.
const looseZ = createXmlCompareCandidatePairs({ sourceRecords: axSrc, targetRecords: axTgt, anchor: axAnchor, tolerance: { x: 1000, y: 1000, z: 1000 }, mode: 'numeric' });
assert.equal(looseZ.pairs.find((p) => p.sourceUid === 's2').status, 'valid', 'Δz=750 within Z=1000 -> valid');

// --- Hierarchical connectors (accepted parent mapping, NOT equality). ---
// Source line "L-SRC" is connected to target line "L-TGT" (different ids). Only nodes in that connected
// line-pair may match; a source node on another line is excluded even if geometrically nearest.
const hSrc = [
  { uid: 'hs0', stableKey: 'L-SRC::0', nodeNumber: '0', lineNo: 'L-SRC', position: { x: 0, y: 0, z: 0 } },
  { uid: 'hs1', stableKey: 'L-SRC::1', nodeNumber: '1', lineNo: 'L-SRC', position: { x: 10, y: 0, z: 0 } },
  { uid: 'hx1', stableKey: 'L-OTHER::9', nodeNumber: '9', lineNo: 'L-OTHER', position: { x: 10, y: 0, z: 0 } }, // same coord as hs1 but wrong line
];
const hTgt = [
  { uid: 'ht0', stableKey: 'L-TGT::0', nodeNumber: '0', lineNo: 'L-TGT', position: { x: 0, y: 0, z: 0 } },
  { uid: 'ht1', stableKey: 'L-TGT::1', nodeNumber: '1', lineNo: 'L-TGT', position: { x: 10, y: 0, z: 0 } },
];
const hConn = createXmlCompareCandidatePairs({ sourceRecords: hSrc, targetRecords: hTgt, anchor: { sourceUid: 'hs0', targetUid: 'ht0' }, tolerance: { x: 5, y: 5, z: 5 }, mode: 'numeric' });
assert.equal(hConn.scope.sourceLine, 'L-SRC');
assert.equal(hConn.scope.targetLine, 'L-TGT', 'connector maps L-SRC -> L-TGT (not equal ids)');
assert.equal(hConn.scope.sourceNodeCount, 2, 'only the 2 nodes on the connected source line are in scope');
assert.ok(!hConn.pairs.some((p) => p.sourceUid === 'hx1'), 'a node on a non-connected line is excluded even if coincident');
assert.equal(hConn.pairs.find((p) => p.sourceUid === 'hs1').status, 'valid');

// Explicit multi-field connector list (e.g. pipe size) further constrains.
const withSize = hSrc.map((r) => ({ ...r, pipeSize: r.lineNo === 'L-SRC' ? '8' : '6' }));
const tgtSize = hTgt.map((r) => ({ ...r, pipeSize: '6' }));
const sizeConn = createXmlCompareCandidatePairs({ sourceRecords: withSize, targetRecords: tgtSize, anchor: { sourceUid: 'hs0', targetUid: 'ht0' }, tolerance: { x: 5, y: 5, z: 5 }, mode: 'numeric', parentConnectors: [{ field: 'pipeSize', sourceValue: '8', targetValue: '6' }] });
assert.equal(sizeConn.scope.sourceNodeCount, 2, 'pipeSize connector 8->6 scopes to the two 8" source nodes');
assert.equal(_test.passesConnectors({ pipeSize: '8' }, [{ field: 'pipeSize', sourceValue: '8', targetValue: '6' }], 'source'), true);
assert.equal(_test.passesConnectors({ pipeSize: '6' }, [{ field: 'pipeSize', sourceValue: '6', targetValue: '8' }], 'target'), false);

// Dynamic connector dropdown content: common non-coordinate XML fields discovered from both loaded sides.
const dynSrc = [
  { uid: 'ds0', stableKey: 'L-A::0', nodeNumber: '0', lineNo: 'L-A', materialName: 'CS', componentType: 'Valve', globalX: 0, position: { x: 0, y: 0, z: 0 } },
  { uid: 'ds1', stableKey: 'L-A::1', nodeNumber: '1', lineNo: 'L-A', materialName: 'CS', componentType: 'Pipe', globalX: 10, position: { x: 10, y: 0, z: 0 } },
];
const dynTgt = [
  { uid: 'dt0', stableKey: 'L-B::0', nodeNumber: '0', lineNo: 'L-B', materialName: 'SS', componentType: 'Valve', globalX: 0, position: { x: 0, y: 0, z: 0 } },
  { uid: 'dt1', stableKey: 'L-B::1', nodeNumber: '1', lineNo: 'L-B', materialName: 'SS', componentType: 'Pipe', globalX: 10, position: { x: 10, y: 0, z: 0 } },
];
const dynamicConnectors = detectAnchorConnectors(dynSrc[0], dynTgt[0], { sourceRecords: dynSrc, targetRecords: dynTgt });
assert.ok(dynamicConnectors.some((conn) => conn.field === 'materialName' && conn.sourceValue === 'CS' && conn.targetValue === 'SS'), 'common XML field materialName is offered as a connector');
assert.ok(dynamicConnectors.some((conn) => conn.field === 'componentType' && conn.sourceValue === 'Valve' && conn.targetValue === 'Valve'), 'common XML field componentType is offered as a connector');
assert.ok(!dynamicConnectors.some((conn) => conn.field === 'globalX'), 'numeric coordinate fields stay in Match on, not connector options');

// Numeric field mode: status is determined by the selected numeric deltas, not duplicate nearest-target claims.
const nfSrc = [
  { uid: 'nfs0', stableKey: 'NF-S::0', nodeNumber: '0', displayName: '0', globalX: 0, globalY: 0, globalZ: 0, position: { x: 0, y: 0, z: 0 } },
  { uid: 'nfs1', stableKey: 'NF-S::1', nodeNumber: '1', displayName: '1', globalX: 100, globalY: 100, globalZ: 100, position: { x: 100, y: 0, z: 0 } },
  { uid: 'nfs2', stableKey: 'NF-S::2', nodeNumber: '2', displayName: '2', globalX: 120, globalY: 100, globalZ: 100, position: { x: 120, y: 0, z: 0 } },
];
const nfTgt = [
  { uid: 'nft0', stableKey: 'NF-T::0', nodeNumber: '0', displayName: '0', globalX: 0, globalY: 0, globalZ: 0, position: { x: 0, y: 0, z: 0 } },
  { uid: 'nft1', stableKey: 'NF-T::1', nodeNumber: '1', displayName: '1', globalX: 110, globalY: 100, globalZ: 100, position: { x: 110, y: 0, z: 0 } },
];
const numericFieldPairs = createXmlCompareCandidatePairs({
  sourceRecords: nfSrc,
  targetRecords: nfTgt,
  anchor: { sourceUid: 'nfs0', targetUid: 'nft0' },
  compareFields: ['globalX', 'globalY', 'globalZ'],
  tolerance: { x: 1000, y: 1000, z: 500 },
  mode: 'numeric',
});
assert.equal(numericFieldPairs.pairs.find((p) => p.sourceUid === 'nfs1').status, 'valid');
assert.equal(numericFieldPairs.pairs.find((p) => p.sourceUid === 'nfs2').status, 'valid');
assert.equal(numericFieldPairs.summary.conflictCount, 0, 'numeric field matches inside tolerance are not downgraded to conflict');

console.log('XML Compare candidate pair tests passed');

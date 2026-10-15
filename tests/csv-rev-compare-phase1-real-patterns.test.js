import assert from 'node:assert/strict';
import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';

const H = [
  'PREV NAME', 'CIVILSECONDARYSUPPORT', 'PIPE', 'SIZE (BORE)',
  'PIPING PRIMARY SUPPORT', 'SUPPORT TYPE', 'PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST', 'NORTH/SOUTH', 'BOP ELEVATION', 'REMARKS (IF ANY)',
];

function row({ prev = '', civil, pipe, size = '8"', members, types, refs, x, y, z = 'U 100652mm', remarks = '' }) {
  return [prev, civil, pipe, size, members, types, refs, x, y, z, remarks];
}
function csv(rows) {
  return [H, ...rows].map((cells) => cells.map((value) => {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(',')).join('\n');
}
function remarkFor(result, target) {
  return result.remarks.targetRemarks[target.sourceRowId]?.remark || '';
}
function candidateFor(result, source, target) {
  return result.lineage.candidates.find((candidate) => candidate.sourceNodeId === source.nodeId && candidate.targetNodeId === target.nodeId);
}
function sameAreaContext() {
  return row({
    civil: 'SL-CONTEXT', pipe: 'BWGA-1000-8"-CONTEXT-01', size: '8"',
    members: '/SL-CONTEXT.1', types: 'REST-200', refs: '=CTX/1',
    x: 'E 150000mm', y: 'N 90000mm', z: 'U 100000mm',
  });
}

// Real R2/R3 false-positive pattern: the target has an exact Civil+PIPE
// predecessor and a different-Civil predecessor carrying its current component
// references. Location identity wins; component-reference reassignment must not
// manufacture a PS-number change.
{
  const pipe = 'BWGA-1000-2"-P8310007-253461P1-01';
  const rev2 = csv([
    row({
      prev: 'PS-111049.3', civil: 'SL-111050(REF)', pipe,
      members: '/SL-111050.1,/SL-111050.2', types: 'REST-50,GUIDE-50', refs: '=67133210/585,=67133210/586',
      x: 'E 182105.106 mm', y: 'N 98532.482 mm',
    }),
    row({
      prev: 'PS-111051.3', civil: 'SL-111052(REF)', pipe,
      members: '/SL-111052.1,/SL-111052.2', types: 'REST-50,GUIDE-50', refs: '=67133210/580,=67133210/581',
      x: 'E 176905.106 mm', y: 'N 98532.482 mm',
    }),
  ]);
  const rev3 = csv([
    row({
      prev: 'PS-111051.3', civil: 'SL-111050(REF)', pipe,
      members: '/SL-111050.1,/SL-111050.2', types: 'REST-50,GUIDE-50', refs: '=67133210/580,=67133210/581',
      x: 'E 181105 mm', y: 'N 98532 mm',
    }),
  ]);
  const result = runSupportRevisionCompare(rev2, rev3);
  const target = result.targetModel.locations[0];
  const edge = result.lineage.edges.find((candidate) => candidate.targetNodeIds.includes(target.nodeId));
  const source = result.sourceModel.locationByNodeId.get(edge.sourceNodeIds[0]);
  assert.equal(edge.matchingMethod, 'civil-pipe-location-identity');
  assert.equal(source.family, 'SL-111050(REF)');
  assert.equal(target.size, '8"');
  assert.ok(!result.ledger.events.some((event) => event.type === 'SECONDARY_SUPPORT_FAMILY_CHANGED' && event.targetXmlNode === target.nodeId));
  assert.ok(!/\b(?:PS\s*No\.|Line\s*No\.)\s*(?:\/\s*Line\s*No\.\s*)?Change\b/i.test(remarkFor(result, target)));
}

// Real false-negative pattern: same Civil support, changed line/PIPE, and two
// persistent components survive. This is deterministic fallback lineage and
// produces the Phase 1 line-number-change token without consulting R3 remarks.
// An unchanged same-area row supplies the pair-level context present in the
// real workbook; it is not candidate evidence for SL-111001.
{
  const oldPipe = '8"-P-1110XXX-METALLIC';
  const newPipe = 'BWGA-1000-FL-8"-M1610003-(FL-07)';
  const rev2 = csv([
    sameAreaContext(),
    row({
      civil: 'SL-111001(REF)', pipe: oldPipe,
      members: '/SL-111001.1,/SL-111001.2,/SL-111001.3', types: 'REST-200,GUIDE-200,STOP-200',
      refs: '=67133218/20,=67133218/21,=67141410/11', x: 'E 187110.232mm', y: 'N 103000.648mm', z: 'U 100656.05mm',
    }),
  ]);
  const rev3 = csv([
    sameAreaContext(),
    row({
      prev: 'SL-111001.1', civil: 'SL-111001(REF)', pipe: newPipe,
      members: '/SL-111001.1,/SL-111001.4,/SL-111001.3', types: 'REST-200,GUIDE-200,STOP-200',
      refs: '=67133218/20,=67133218/27,=67141410/11', x: 'E 187114mm', y: 'N 103001mm', z: 'U 100547mm',
    }),
  ]);
  const result = runSupportRevisionCompare(rev2, rev3);
  assert.equal(result.stage, 'READY_TO_EXPORT');
  const target = result.targetModel.locations.find((location) => location.family === 'SL-111001(REF)');
  const edge = result.lineage.edges.find((candidate) => candidate.targetNodeIds.includes(target.nodeId));
  assert.equal(edge.matchingMethod, 'persistent-reference-overlap');
  assert.equal(edge.outcome, 'DETERMINISTIC');
  const pipeEvent = result.ledger.events.find((event) => event.type === 'PIPE_IDENTITY_CHANGED' && event.targetXmlNode === target.nodeId);
  assert.equal(pipeEvent.remarkEligible, true);
  assert.equal(pipeEvent.normalizedState.projection, 'LINE_NUMBER_CHANGE');
  assert.match(remarkFor(result, target), /Line No\. Change\(Old Line No\. 8"-P-1110XXX-METALLIC\)/);
}

// Real workbook shape: R3 can retain the old Civil+PIPE as an identity-only
// shell while the active successor has the new PIPE and persistent references.
// The shell stays in the model/output but cannot consume active-support lineage.
{
  const oldPipe = '8"-P-1110XXX-METALLIC';
  const newPipe = 'BWGA-1000-FL-8"-M1610003-(FL-07)';
  const rev2 = csv([
    sameAreaContext(),
    row({
      civil: 'SL-111001(REF)', pipe: oldPipe,
      members: '/SL-111001.1,/SL-111001.2,/SL-111001.3', types: 'REST-200,GUIDE-200,LINE-STOP-200',
      refs: '=67133218/20,=67133218/21,=67141410/11', x: 'E 187110.232mm', y: 'N 103000.648mm', z: 'U 100656.05mm',
    }),
  ]);
  const rev3 = csv([
    sameAreaContext(),
    row({ civil: 'SL-111001(REF)', pipe: oldPipe, members: '', types: '', refs: '', x: '', y: '', z: '' }),
    row({
      prev: 'SL-111001.1', civil: 'SL-111001(REF)', pipe: newPipe,
      members: '/SL-111001.1,/SL-111001.2,/SL-111001.3', types: 'REST-200,GUIDE-200,LINE-STOP-200',
      refs: '=67133218/20,=67133218/27,=67141410/11', x: 'E 187114mm', y: 'N 103001mm', z: 'U 100547mm',
    }),
  ]);
  const result = runSupportRevisionCompare(rev2, rev3);
  assert.equal(result.stage, 'READY_TO_EXPORT');
  assert.equal(result.targetModel.locations.length, 3);
  assert.equal(result.lineage.comparisonEligibility.ignoredTargetLocations.length, 1);
  assert.equal(result.lineage.comparisonEligibility.ignoredTargetLocations[0].classification, 'IDENTITY_ONLY_SHELL');
  const activeTarget = result.targetModel.locations.find((location) => location.pipe.raw === newPipe);
  const edge = result.lineage.edges.find((candidate) => candidate.targetNodeIds.includes(activeTarget.nodeId));
  assert.equal(edge.matchingMethod, 'persistent-reference-overlap');
  assert.equal(edge.outcome, 'DETERMINISTIC');
  assert.match(remarkFor(result, activeTarget), /Line No\. Change\(Old Line No\. 8"-P-1110XXX-METALLIC\)/);
}

// SIZE (BORE) is canonicalized into the governed SIZE field and is a hard
// compatibility gate. Even exact Civil+PIPE plus persistent reference evidence
// cannot auto-link rows when both revisions explicitly disagree on bore.
{
  const pipe = 'AREA-1000-LINE-8"-P100-01';
  const rev2 = csv([row({ civil: 'SL-BORE', pipe, size: '8"', members: '/SL-BORE.1', types: 'REST', refs: '=1/1', x: 'E 1000mm', y: 'N 1000mm' })]);
  const rev3 = csv([row({ civil: 'SL-BORE', pipe, size: '10"', members: '/SL-BORE.1', types: 'REST', refs: '=1/1', x: 'E 1000mm', y: 'N 1000mm' })]);
  const result = runSupportRevisionCompare(rev2, rev3);
  const source = result.sourceModel.locations[0];
  const target = result.targetModel.locations[0];
  const candidate = candidateFor(result, source, target);
  assert.equal(source.size, '8"');
  assert.equal(target.size, '10"');
  assert.equal(candidate.evidence.bore.status, 'MISMATCH');
  assert.equal(candidate.eligible, false);
  assert.equal(candidate.outcome, 'NO_MATCH');
  assert.ok(candidate.reasonCodes.includes('BORE_MISMATCH_REJECTED'));
  assert.ok(!result.lineage.edges.some((edge) => edge.sourceNodeIds.includes(source.nodeId) && edge.targetNodeIds.includes(target.nodeId)));
}

// Approximate lineage requires several independent signals. PREV NAME carries
// explicit weight, matching bore is mandatory, and coordinate weight is based
// on frame-normalized deltas from at least three trusted exact anchors.
{
  const anchors2 = [1, 2, 3].map((n) => row({
    civil: `SL-A${n}`, pipe: `AREA-1000-LINE-8"-A${n}-01`, size: '8"', members: '', types: '', refs: '',
    x: `E ${n * 1000}mm`, y: `N ${n * 2000}mm`, z: `U ${n * 3000}mm`,
  }));
  const anchors3 = [1, 2, 3].map((n) => row({
    civil: `SL-A${n}`, pipe: `AREA-1000-LINE-8"-A${n}-01`, size: '8"', members: '', types: '', refs: '',
    x: `E ${n * 1000 + 100}mm`, y: `N ${n * 2000 + 100}mm`, z: `U ${n * 3000 + 100}mm`,
  }));
  const approximatePipe = 'AREA-1000-LINE-8"-P900-01';
  const rev2 = csv([...anchors2, row({ prev: 'PS-APPROX-01', civil: 'SL-OLD', pipe: approximatePipe, size: '8"', members: '', types: '', refs: '', x: 'E 4000mm', y: 'N 5000mm', z: 'U 6000mm' })]);
  const rev3 = csv([...anchors3, row({ prev: 'PS-APPROX-01', civil: 'SL-NEW', pipe: approximatePipe, size: '8"', members: '', types: '', refs: '', x: 'E 4103mm', y: 'N 5102mm', z: 'U 6101mm' })]);
  const result = runSupportRevisionCompare(rev2, rev3);
  const source = result.sourceModel.locations.find((location) => location.family === 'SL-OLD');
  const target = result.targetModel.locations.find((location) => location.family === 'SL-NEW');
  const candidate = candidateFor(result, source, target);
  const prevWeight = candidate.weightBreakdown.find((item) => item.signal === 'prev-name');
  const boreWeight = candidate.weightBreakdown.find((item) => item.signal === 'bore');
  const coordinateWeight = candidate.weightBreakdown.find((item) => item.signal === 'coordinate-delta');
  assert.equal(result.lineage.coordinateFrame.anchorCount, 3);
  assert.equal(result.lineage.coordinateFrame.scoreFrameUsable, true);
  assert.equal(candidate.scorePolicyId, 'SUPPORT_LINEAGE_SCORE_V2');
  assert.equal(candidate.scorePolicyVersion, '2.2.0');
  assert.equal(prevWeight.contribution, 18);
  assert.equal(boreWeight.contribution, 12);
  assert.equal(coordinateWeight.contribution, 12);
  assert.deepEqual(candidate.evidence.coordinate.usableAxes, ['x', 'y', 'z']);
  assert.ok(Math.abs(candidate.evidence.coordinate.deltas.x - 3) < 1e-9);
  assert.ok(Math.abs(candidate.evidence.coordinate.deltas.y - 2) < 1e-9);
  assert.ok(Math.abs(candidate.evidence.coordinate.deltas.z - 1) < 1e-9);
  assert.ok(candidate.evidence.coordinate.scoringResidualMm < 5);
  assert.equal(candidate.approximateSignalCount, 3);
  assert.equal(candidate.approximateEligible, true);
  assert.equal(candidate.outcome, 'LIKELY');
}

// A single exact anchor is insufficient to make coordinate proximity a scoring
// signal. PREV NAME + same pipe + bore alone therefore remains below the
// multi-signal approximation gate rather than being silently auto-linked.
{
  const anchorPipe = 'AREA-1000-LINE-8"-A1-01';
  const approximatePipe = 'AREA-1000-LINE-8"-P901-01';
  const rev2 = csv([
    row({ civil: 'SL-A1', pipe: anchorPipe, size: '8"', members: '', types: '', refs: '', x: 'E 1000mm', y: 'N 2000mm', z: 'U 3000mm' }),
    row({ prev: 'PS-ONLY-ONE-ANCHOR', civil: 'SL-X', pipe: approximatePipe, size: '8"', members: '', types: '', refs: '', x: 'E 4000mm', y: 'N 5000mm', z: 'U 6000mm' }),
  ]);
  const rev3 = csv([
    row({ civil: 'SL-A1', pipe: anchorPipe, size: '8"', members: '', types: '', refs: '', x: 'E 1100mm', y: 'N 2100mm', z: 'U 3100mm' }),
    row({ prev: 'PS-ONLY-ONE-ANCHOR', civil: 'SL-Y', pipe: approximatePipe, size: '8"', members: '', types: '', refs: '', x: 'E 4100mm', y: 'N 5100mm', z: 'U 6100mm' }),
  ]);
  const result = runSupportRevisionCompare(rev2, rev3);
  const source = result.sourceModel.locations.find((location) => location.family === 'SL-X');
  const target = result.targetModel.locations.find((location) => location.family === 'SL-Y');
  const candidate = candidateFor(result, source, target);
  const coordinateWeight = candidate.weightBreakdown.find((item) => item.signal === 'coordinate-delta');
  assert.equal(result.lineage.coordinateFrame.anchorCount, 1);
  assert.equal(result.lineage.coordinateFrame.scoreFrameUsable, false);
  assert.equal(coordinateWeight.contribution, 0);
  assert.equal(coordinateWeight.reasonCode, 'COORDINATE_FRAME_UNPROVEN');
  assert.equal(candidate.approximateSignalCount, 2);
  assert.equal(candidate.approximateEligible, false);
  assert.equal(candidate.outcome, 'NO_MATCH');
}

console.log('csv-rev-compare-phase1-real-patterns.test.js: all checks passed');
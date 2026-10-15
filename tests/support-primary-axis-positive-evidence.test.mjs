import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSupportReportAxisTypicalityAudit,
} from '../tabs/support-steel-relationship-builder/support-report-axis-typicality.js';

const LINE = 'ASIM-1885-2"-P8810320-31441C4-HT-01';

function evidence(familyId, traversals) {
  const groups = [];
  for (const traversal of traversals) {
    const rows = traversal.points.map((point, index) => Object.freeze({
      guid: `${familyId}-${traversal.branch}-${index + 1}`,
      secondarySupportFamilyId: familyId,
      fullLineTag: LINE,
      branchNode: traversal.branch,
      clashPointGlobalMm: Object.freeze({ ...point }),
    }));
    traversal.points.forEach((point, index) => groups.push(Object.freeze({
      groupId: `${familyId}::${traversal.branch}::L${index + 1}`,
      locationId: `${familyId}::${traversal.branch}::L${index + 1}`,
      secondarySupportFamilyId: familyId,
      fullLineTag: LINE,
      branchNodes: Object.freeze([traversal.branch]),
      representativeClashPointGlobalMm: Object.freeze({ ...point }),
      locationNominalBoreMm: 50,
      evidenceRows: Object.freeze([rows[index]]),
    })));
  }
  return Object.freeze({ groups: Object.freeze(groups), rawClashes: Object.freeze([]) });
}

function twoLocationEvidenceWithAxisRows(familyId, rawAxisPoints) {
  const branch = '/B1';
  const locationPoints = [rawAxisPoints[0], rawAxisPoints[rawAxisPoints.length - 1]];
  const rows = rawAxisPoints.map((point, index) => Object.freeze({
    guid: `${familyId}-${branch}-RAW-${index + 1}`,
    secondarySupportFamilyId: familyId,
    fullLineTag: LINE,
    branchNode: branch,
    clashPointGlobalMm: Object.freeze({ ...point }),
  }));
  const groups = locationPoints.map((point, index) => Object.freeze({
    groupId: `${familyId}::${branch}::L${index + 1}`,
    locationId: `${familyId}::${branch}::L${index + 1}`,
    secondarySupportFamilyId: familyId,
    fullLineTag: LINE,
    branchNodes: Object.freeze([branch]),
    representativeClashPointGlobalMm: Object.freeze({ ...point }),
    locationNominalBoreMm: 50,
    evidenceRows: Object.freeze(rows.length > 2
      ? index === 0 ? rows.slice(0, -1) : [rows[rows.length - 1]]
      : [rows[index]]),
  }));
  return Object.freeze({ groups: Object.freeze(groups), rawClashes: Object.freeze([]) });
}

function compare(leftTraversals, rightTraversals) {
  return buildSupportReportAxisTypicalityAudit(
    evidence('PS-1', leftTraversals),
    evidence('PS-2', rightTraversals),
  ).familyComparisons[0];
}

test('multi-traversal relative-angle evidence remains sufficient for positive axis MATCH', () => {
  const traversals = [
    { branch: '/B1', points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
    { branch: '/B2', points: [{ x: 0, y: 200, z: 0 }, { x: 0, y: 300, z: 0 }] },
  ];
  const result = compare(traversals, traversals);
  assert.equal(result.result, 'MATCH');
  assert.equal(result.reasonCode, 'AXIS_TYPICALITY_MATCH');
  const sufficiency = result.signals.find((item) => item.reasonCode === 'AXIS_POSITIVE_EVIDENCE_SUFFICIENT');
  assert.equal(sufficiency?.result, 'PASS');
  assert.equal(sufficiency?.basis, 'RELATIVE_AXIS_ANGLE_INFORMED');
});

test('single-traversal two-point positive geometry is unavailable rather than MATCH', () => {
  const traversals = [
    { branch: '/B1', points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
  ];
  const result = compare(traversals, traversals);
  assert.equal(result.result, 'UNAVAILABLE');
  assert.equal(result.reasonCode, 'AXIS_TYPICALITY_UNAVAILABLE_INSUFFICIENT_POSITIVE_EVIDENCE');
  assert.ok(result.unavailableReasonCodes.includes('AXIS_POSITIVE_EVIDENCE_SUFFICIENT'));
});

test('mixed PCA and two-point single-traversal axes are unavailable for positive identity', () => {
  const left = twoLocationEvidenceWithAxisRows('PS-1', [
    { x: 0, y: 0, z: 0 },
    { x: 50, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
  ]);
  const right = twoLocationEvidenceWithAxisRows('PS-2', [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
  ]);
  const result = buildSupportReportAxisTypicalityAudit(left, right).familyComparisons[0];
  assert.equal(result.result, 'UNAVAILABLE');
  assert.equal(result.reasonCode, 'AXIS_TYPICALITY_UNAVAILABLE_INSUFFICIENT_POSITIVE_EVIDENCE');
  const sufficiency = result.signals.find((item) => item.reasonCode === 'AXIS_POSITIVE_EVIDENCE_SUFFICIENT');
  assert.equal(sufficiency?.result, 'UNAVAILABLE');
  assert.deepEqual(sufficiency?.left.map((item) => item.axisBasis), ['PCA_BRANCH_AXIS']);
  assert.deepEqual(sufficiency?.right.map((item) => item.axisBasis), ['TWO_POINT_AXIS']);
});

test('independently supported PCA axes remain sufficient for single-traversal positive MATCH', () => {
  const traversals = [
    { branch: '/B1', points: [{ x: 0, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
  ];
  const result = compare(traversals, traversals);
  assert.equal(result.result, 'MATCH');
  const sufficiency = result.signals.find((item) => item.reasonCode === 'AXIS_POSITIVE_EVIDENCE_SUFFICIENT');
  assert.equal(sufficiency?.result, 'PASS');
  assert.equal(sufficiency?.basis, 'INDEPENDENT_PCA_AXES');
});

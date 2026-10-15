import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSupportReportAxisTypicalityAudit,
  compareAxisTypicalityFamilies,
  extractAxisTypicalityFamilyFeatures,
  selectAxisTypicalityMatch,
} from '../tabs/support-steel-relationship-builder/support-report-axis-typicality.js';

function evidence(familyId, traversals) {
  const groups = [];
  for (const traversal of traversals) {
    const rows = traversal.locations.map((point, index) => Object.freeze({
      guid: `${familyId}-${traversal.branch}-${index + 1}`,
      secondarySupportFamilyId: familyId,
      fullLineTag: traversal.line,
      branchNode: traversal.branch,
      clashPointGlobalMm: Object.freeze({ ...point }),
    }));
    traversal.locations.forEach((point, index) => groups.push(Object.freeze({
      groupId: `${familyId}::${traversal.branch}::L${index + 1}`,
      locationId: `${familyId}::${traversal.branch}::L${index + 1}`,
      secondarySupportFamilyId: familyId,
      fullLineTag: traversal.line,
      branchNodes: Object.freeze([traversal.branch]),
      representativeClashPointGlobalMm: Object.freeze({ ...point }),
      locationNominalBoreMm: traversal.bore,
      evidenceRows: Object.freeze([rows[index]]),
    })));
  }
  return Object.freeze({ groups: Object.freeze(groups), rawClashes: Object.freeze([]) });
}

function baseline(familyId = 'PS-1', transform = (point) => point) {
  const line = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  return evidence(familyId, [
    { line, branch: '/B1', bore: 50, locations: [transform({ x: 0, y: 0, z: 0 }), transform({ x: 100, y: 0, z: 0 })] },
    { line, branch: '/B2', bore: 50, locations: [transform({ x: 0, y: 200, z: 0 }), transform({ x: 0, y: 300, z: 0 })] },
  ]);
}

function rigidTransform(point) {
  const yaw = 0.73;
  const pitch = -0.41;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = cy * point.x - sy * point.y;
  const y1 = sy * point.x + cy * point.y;
  const z1 = point.z;
  return {
    x: cp * x1 + sp * z1 + 417.25,
    y: y1 - 812.5,
    z: -sp * x1 + cp * z1 + 93.75,
  };
}

function reflect(point) {
  return { x: -point.x + 50, y: point.y + 25, z: point.z + 10 };
}

test('same intrinsic geometry matches after arbitrary rigid rotation and translation', () => {
  const audit = buildSupportReportAxisTypicalityAudit(
    baseline('PS-11168'),
    baseline('PS-14168', rigidTransform),
  );
  assert.equal(audit.matches[0].result, 'MATCH');
  assert.equal(audit.familyComparisons[0].result, 'MATCH');
  assert.deepEqual(audit.leftFamilies[0].locationsPerTraversalSpectrum, [2, 2]);
  assert.deepEqual(audit.rightFamilies[0].locationsPerTraversalSpectrum, [2, 2]);
  assert.deepEqual(audit.leftFamilies[0].dnNormalizedPairSpectrum,
    audit.rightFamilies[0].dnNormalizedPairSpectrum);
  assert.deepEqual(audit.leftFamilies[0].relativeAxisAngleSpectrumDeg,
    audit.rightFamilies[0].relativeAxisAngleSpectrumDeg);
});

test('axis sign reversal and true reflected coordinates preserve intrinsic match', () => {
  const audit = buildSupportReportAxisTypicalityAudit(
    baseline('PS-1'),
    baseline('PS-2', reflect),
  );
  assert.equal(audit.matches[0].result, 'MATCH');
  assert.deepEqual(audit.leftFamilies[0].relativeAxisAngleSpectrumDeg, [90]);
  assert.deepEqual(audit.rightFamilies[0].relativeAxisAngleSpectrumDeg, [90]);
});

test('material DN-normalized axial spacing difference is informed no-match', () => {
  const line = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  const right = evidence('PS-2', [
    { line, branch: '/B1', bore: 50, locations: [{ x: 0, y: 0, z: 0 }, { x: 160, y: 0, z: 0 }] },
    { line, branch: '/B2', bore: 50, locations: [{ x: 0, y: 200, z: 0 }, { x: 0, y: 300, z: 0 }] },
  ]);
  const comparison = buildSupportReportAxisTypicalityAudit(baseline('PS-1'), right).familyComparisons[0];
  assert.equal(comparison.result, 'NO_MATCH');
  assert.equal(comparison.reasonCode, 'AXIS_TYPICALITY_GEOMETRY_MISMATCH');
  assert.ok(comparison.failedReasonCodes.includes('AXIS_DN_NORMALIZED_SPACING_WITHIN_TOLERANCE'));
});

test('material relative traversal-angle difference is informed no-match', () => {
  const line = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  const diagonal = 100 / Math.sqrt(2);
  const right = evidence('PS-2', [
    { line, branch: '/B1', bore: 50, locations: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
    { line, branch: '/B2', bore: 50, locations: [{ x: 0, y: 200, z: 0 }, { x: diagonal, y: 200 + diagonal, z: 0 }] },
  ]);
  const comparison = buildSupportReportAxisTypicalityAudit(baseline('PS-1'), right).familyComparisons[0];
  assert.equal(comparison.result, 'NO_MATCH');
  assert.ok(comparison.failedReasonCodes.includes('AXIS_RELATIVE_ANGLE_WITHIN_TOLERANCE'));
});

test('insufficient trusted axis evidence is unavailable rather than mismatch', () => {
  const line = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  const sparse = evidence('PS-2', [
    { line, branch: '/B1', bore: 50, locations: [{ x: 0, y: 0, z: 0 }] },
    { line, branch: '/B2', bore: 50, locations: [{ x: 0, y: 200, z: 0 }] },
  ]);
  const audit = buildSupportReportAxisTypicalityAudit(baseline('PS-1'), sparse);
  assert.equal(audit.rightFamilies[0].authorityStatus, 'UNAVAILABLE');
  assert.equal(audit.familyComparisons[0].result, 'UNAVAILABLE');
  assert.equal(audit.matches[0].result, 'UNAVAILABLE');
});

test('return/traversal multiplicity mismatch is informed no-match', () => {
  const sameClass = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  const otherClass = 'ASIM-1885-2"-D8810320-31441C4-HT-01';
  const right = evidence('PS-2', [
    { line: sameClass, branch: '/B1', bore: 50, locations: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
    { line: otherClass, branch: '/B2', bore: 50, locations: [{ x: 0, y: 200, z: 0 }, { x: 0, y: 300, z: 0 }] },
  ]);
  const comparison = buildSupportReportAxisTypicalityAudit(baseline('PS-1'), right).familyComparisons[0];
  assert.equal(comparison.result, 'NO_MATCH');
  assert.ok(comparison.failedReasonCodes.includes('AXIS_RETURN_MULTIPLICITY_EQUAL'));
});

test('partial axis coverage is review, not mismatch', () => {
  const line = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  const partial = evidence('PS-2', [
    { line, branch: '/B1', bore: 50, locations: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
    { line, branch: '/B2', bore: 50, locations: [{ x: 0, y: 200, z: 0 }] },
  ]);
  const left = extractAxisTypicalityFamilyFeatures(baseline('PS-1'))[0];
  const right = extractAxisTypicalityFamilyFeatures(partial)[0];
  assert.equal(right.authorityStatus, 'PARTIAL');
  const comparison = compareAxisTypicalityFamilies(left, right);
  assert.equal(comparison.result, 'REVIEW');
  assert.equal(comparison.reasonCode, 'AXIS_TYPICALITY_REVIEW_PARTIAL_EVIDENCE');
});

test('an unavailable competing candidate blocks authoritative unique axis selection', () => {
  const selected = selectAxisTypicalityMatch('PS-1', [
    Object.freeze({
      auditId: 'AXISTYP-PS-1--PS-2', leftFamilyId: 'PS-1', rightFamilyId: 'PS-2',
      result: 'MATCH', reasonCode: 'AXIS_TYPICALITY_MATCH', mismatchCount: 0, unavailableReasonCodes: Object.freeze([]),
    }),
    Object.freeze({
      auditId: 'AXISTYP-PS-1--PS-3', leftFamilyId: 'PS-1', rightFamilyId: 'PS-3',
      result: 'UNAVAILABLE', reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE', mismatchCount: 0, unavailableReasonCodes: Object.freeze([]),
    }),
  ]);
  assert.equal(selected.result, 'REVIEW');
  assert.equal(selected.rightFamilyId, '');
  assert.equal(selected.reasonCode, 'AXIS_TYPICALITY_REVIEW_UNASSESSED_CANDIDATES');
  assert.deepEqual(selected.candidateFamilyIds, ['PS-2', 'PS-3']);
});
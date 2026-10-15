import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupSupportReportEvidenceByLocation,
} from '../tabs/support-steel-relationship-builder/support-report-location-grouping.js';

const line = 'ASIM-1885-3"-D8810275-11261M7-PP-01';
const branch = `/${line}/B1`;

function row(primarySupportMemberId, x, primaryItemName = primarySupportMemberId) {
  return {
    secondarySupportFamilyId: 'PS-12076',
    fullLineTag: line,
    scope: 'ASIM',
    branchNode: branch,
    primarySupportMemberId,
    primaryItemName,
    clashPointGlobalMm: { x, y: 0, z: 0 },
    primaryPath: ['/ASIM-1885-CU-PI', `/${line}`, branch, primaryItemName].filter(Boolean),
    secondaryPath: ['/ASIM-1885-CU-SU', '/PS-12076'],
  };
}

test('family-only fallback evidence cannot bore-axis merge into a concrete occurrence beyond 50 mm', () => {
  const groups = groupSupportReportEvidenceByLocation([
    row('/PS-12076.1', 0),
    row('/PS-12076', 62.03),
  ]);

  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.locationCountOnPipe === 2));
});

test('symbolic DATUM evidence may remain attached to its concrete support occurrence', () => {
  const groups = groupSupportReportEvidenceByLocation([
    row('/PS-11168.7', 0, '/PS-11168.7'),
    row('/PS-11168', 62.03, '/PS-11168/DATUM'),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].locationCountOnPipe, 1);
  assert.ok(groups[0].locationGroupingBasis.includes('WITHIN_BORE_AXIS_WINDOW'));
});

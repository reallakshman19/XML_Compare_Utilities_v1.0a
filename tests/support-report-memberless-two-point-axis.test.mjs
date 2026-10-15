import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupSupportReportEvidenceByLocation,
} from '../tabs/support-steel-relationship-builder/support-report-location-grouping.js';

const line = 'ASIM-1885-3"-D8810275-11261M7-PP-01';
const branch = `/${line}/B1`;

function row(primarySupportMemberId, x) {
  return {
    secondarySupportFamilyId: 'PS-12076',
    fullLineTag: line,
    scope: 'ASIM',
    branchNode: branch,
    primarySupportMemberId,
    clashPointGlobalMm: { x, y: 0, z: 0 },
    primaryPath: ['/ASIM-1885-CU-PI', `/${line}`, branch, primarySupportMemberId].filter(Boolean),
    secondaryPath: ['/ASIM-1885-CU-SU', '/PS-12076'],
  };
}

test('memberless evidence cannot define a two-point bore axis that merges itself beyond 50 mm', () => {
  const groups = groupSupportReportEvidenceByLocation([
    row('/PS-12076.1', 0),
    row('', 62.03),
  ]);

  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.locationCountOnPipe === 2));
  assert.deepEqual(groups.map((group) => group.primarySupportMemberIds), [['/PS-12076.1'], []]);
});

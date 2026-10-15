import assert from 'node:assert/strict';
import test from 'node:test';
import { createPsFamilyAuditFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-relationship-engine.js';
import {
  SUPPORT_STEEL_SAMPLE_STEEL,
  SUPPORT_STEEL_SAMPLE_SUPPORT,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';

function sourceBundle() {
  return buildSupportSteelRelationshipBundle({
    supportInput: SUPPORT_STEEL_SAMPLE_SUPPORT,
    steelInput: SUPPORT_STEEL_SAMPLE_STEEL,
  });
}

function auditBundle(bundle) {
  return createPsFamilyAuditFromTextInputs({
    evidenceMode: 'RELATIONSHIP_BUNDLE',
    relationshipBundleText: JSON.stringify(bundle),
    structureXmlText: '',
    supportXmlText: '',
    config: { evidenceMode: 'RELATIONSHIP_BUNDLE' },
  });
}

test('projects one shared support family into member-level line memberships', () => {
  const audit = auditBundle(sourceBundle());
  const summary = audit.supportSummaryRows.find((row) => row.psRoot === '/PS-14259');
  assert.ok(summary);
  assert.equal(summary.lineMembershipCount, 2);
  assert.deepEqual(summary.lineFamilies.sort(), [
    'ASIM-1836-4"-P9001002',
    'ASIM-1836-6"-P9001001',
  ]);

  const memberships = audit.lineMembershipRows.filter((row) => row.supportFamilyId === '/PS-14259');
  assert.equal(memberships.length, 2);
  assert.equal(memberships.filter((row) => row.isPrimary).length, 1);
  assert.deepEqual(memberships.map((row) => row.memberCount).sort((a, b) => a - b), [1, 3]);

  const trees = audit.lineSupportTreeRows.filter((row) => row.supportGroup.includes('PS-14259'));
  assert.equal(trees.length, 2);
  assert.ok(trees.some((row) => row.treeText.includes('/PS-14259/SREF')));
  assert.ok(trees.some((row) => row.treeText.includes('/PS-14259.1')));

  const sref = audit.supportMemberRows.find((row) => row.support === '/PS-14259/SREF');
  const shoe = audit.supportMemberRows.find((row) => row.support === '/PS-14259.1');
  assert.equal(sref.lineFamily, 'ASIM-1836-4"-P9001002');
  assert.equal(shoe.lineFamily, 'ASIM-1836-6"-P9001001');
  assert.notEqual(sref.lineMembershipId, shoe.lineMembershipId);

  const terminals = audit.structureContactRows.filter((row) => row.supportGroup.includes('PS-14259'));
  assert.ok(terminals.length > 0);
  assert.ok(terminals.every((row) => row.lineFamily === 'ASIM-1836-6"-P9001001'));
  assert.ok(audit.supportExceptionRows.some((row) => (
    row.supportGroup.includes('PS-14259') && row.exceptionCode === 'MULTI_LINE_SUPPORT_FAMILY'
  )));
  assert.ok(audit.supportExceptionRows.some((row) => (
    row.supportGroup.includes('PS-14259') && row.exceptionCode === 'MULTI_BRANCH_SUPPORT_FAMILY'
  )));

  const exports = createPsFamilyAuditExports(audit);
  assert.match(exports.lineMembershipsCsv, /MembershipId,SupportFamilyId,SupportGroup/);
  assert.match(exports.lineMembershipsCsv, /ASIM-1836-4""-P9001002/);
  assert.match(exports.lineMembershipsCsv, /ASIM-1836-6""-P9001001/);
  assert.match(exports.supportChainCsv, /CrossLine,FromMembershipId,ToMembershipId/);
});

test('marks physical edges spanning two line memberships explicitly', () => {
  const bundle = structuredClone(sourceBundle());
  const family = bundle.supportFamilies.find((row) => row.familyId === '/PS-14259');
  const sref = family.members.find((row) => row.memberId === '/PS-14259/SREF');
  family.members.push({
    memberId: '/PS-14259.3',
    semanticRole: 'BRACKET_MEMBER',
    lineContext: structuredClone(sref.lineContext),
    analyticalGeometry: { physicalGeometryAvailable: true },
    attributes: {},
  });
  bundle.supportMemberChain.supportChainEdges.push({
    edgeId: 'SSMC:CROSS-LINE',
    evidenceId: 'SSMC:CROSS-LINE',
    sourceSchema: 'SupportMemberChainBundle.v1',
    evidenceClass: 'ANALYTICAL',
    supportFamilyId: '/PS-14259',
    supportA: '/PS-14259.2',
    supportB: '/PS-14259.3',
    edgeType: 'SUPPORT_MEMBER_CONTACT',
    contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE',
    relationshipStatus: 'RESOLVED_ANALYTICAL_CONTACT',
    distanceMm: 0,
  });

  const audit = auditBundle(bundle);
  const edge = audit.supportChainRows.find((row) => row.chainEvidence === 'SSMC:CROSS-LINE');
  assert.ok(edge);
  assert.equal(edge.crossLine, true);
  assert.equal(edge.line, 'MULTI_LINE');
  assert.equal(edge.lineFamily, 'MULTI_LINE');
  assert.equal(edge.fromLineFamily, 'ASIM-1836-6"-P9001001');
  assert.equal(edge.toLineFamily, 'ASIM-1836-4"-P9001002');
  assert.equal(edge.lineMembershipIds.length, 2);
  assert.match(edge.remarks, /spans multiple line memberships/);
  assert.ok(audit.supportExceptionRows.some((row) => (
    row.exceptionCode === 'CROSS_LINE_SUPPORT_MEMBER_EDGE'
    && row.evidenceId === 'SSMC:CROSS-LINE'
  )));

  const exports = createPsFamilyAuditExports(audit);
  assert.match(exports.supportChainCsv, /SSMC:CROSS-LINE/);
  assert.match(exports.supportChainCsv, /MULTI_LINE/);
});

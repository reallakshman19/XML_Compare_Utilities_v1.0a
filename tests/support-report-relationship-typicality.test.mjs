import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSupportReportRelationshipTopologyAudit,
  compareRelationshipTopologyFamilies,
  extractRelationshipTopologyFamilyFeatures,
} from '../tabs/support-steel-relationship-builder/support-report-relationship-typicality.js';
import { buildSupportReportTypicalityAudit } from '../tabs/support-steel-relationship-builder/support-report-typicality.js';
import {
  buildSupportReportTypicalityComparison,
  _test as projectionTest,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';

function reportFamily(familyId, assemblyIds, options = {}) {
  const area = options.area || '1885';
  const serial = options.serial || '8810320';
  const line = `ASIM-${area}-2"-P${serial}-31441C4-HT-01`;
  const explicit = options.explicit !== false;
  const summary = {
    familyId,
    totalSupportPointsOnSecondary: options.effectiveCount ?? assemblyIds.length,
    explicitAssemblyIds: explicit ? assemblyIds : [],
    geometryOnlyGroupIds: options.geometryOnlyGroupIds || [],
    ambiguityCount: options.ambiguityCount || 0,
    explicitRelationshipFamilyAvailable: explicit,
    orphanRecoveredGroupIds: [],
    orphanAmbiguousGroupIds: [],
    orphanUnresolvedGroupIds: [],
  };
  return Object.freeze({
    primarySupportFamilySummaries: Object.freeze([Object.freeze(summary)]),
    rows: Object.freeze([Object.freeze({
      rowId: `${familyId}::L1`,
      civilSecondarySupport: `${familyId}(REF)`,
      pipe: line,
      size: 50,
      supportType: 'REST-50',
      totalSupportPointsOnSecondary: summary.totalSupportPointsOnSecondary,
    })]),
  });
}

function familyEvidence(familyId, options = {}) {
  const area = options.area || '1885';
  const serial = options.serial || '8810320';
  const line = `ASIM-${area}-2"-P${serial}-31441C4-HT-01`;
  return Object.freeze({
    groups: Object.freeze([Object.freeze({
      groupId: `${familyId}::L1`,
      locationId: `${familyId}::L1`,
      secondarySupportFamilyId: familyId,
      fullLineTag: line,
      primarySupportMemberIds: Object.freeze([`/${familyId}.1`]),
      representativeClashPointGlobalMm: Object.freeze({ x: 0, y: 0, z: 0 }),
      clashPointsGlobalMm: Object.freeze([Object.freeze({ x: 0, y: 0, z: 0 })]),
      evidenceRows: Object.freeze([]),
    })]),
    rawClashes: Object.freeze([]),
  });
}

test('different family IDs with identical complete explicit topology match', () => {
  const left = reportFamily('PS-11167', ['PSA::PS-11167::M-1+2', 'PSA::PS-11167::M-3'], { area: '1885', serial: '8810320' });
  const right = reportFamily('PS-14167', ['PSA::PS-14167::M-7+8', 'PSA::PS-14167::M-9'], { area: '1884', serial: '9999999' });
  const audit = buildSupportReportRelationshipTopologyAudit(left, right);
  assert.equal(audit.matches[0].result, 'MATCH');
  assert.equal(audit.matches[0].rightFamilyId, 'PS-14167');
  assert.equal(audit.familyComparisons[0].result, 'MATCH');
  assert.deepEqual(audit.leftFamilies[0].assemblyMemberCountSpectrum, [1, 2]);
  assert.deepEqual(audit.rightFamilies[0].assemblyMemberCountSpectrum, [1, 2]);
});

test('explicit assembly-count mismatch is an informed no-match', () => {
  const left = extractRelationshipTopologyFamilyFeatures(reportFamily('PS-1', ['PSA::PS-1::M-1']))[0];
  const right = extractRelationshipTopologyFamilyFeatures(reportFamily('PS-2', ['PSA::PS-2::M-1', 'PSA::PS-2::M-2']))[0];
  const comparison = compareRelationshipTopologyFamilies(left, right);
  assert.equal(comparison.result, 'NO_MATCH');
  assert.ok(comparison.failedReasonCodes.includes('REL_EFFECTIVE_ASSEMBLY_COUNT_EQUAL'));
  assert.ok(comparison.failedReasonCodes.includes('REL_EXPLICIT_ASSEMBLY_COUNT_EQUAL'));
});

test('equal assembly count with different connected-component member spectrum is no-match', () => {
  const left = extractRelationshipTopologyFamilyFeatures(reportFamily('PS-10', [
    'PSA::PS-10::M-1+2+3',
    'PSA::PS-10::M-4',
  ]))[0];
  const right = extractRelationshipTopologyFamilyFeatures(reportFamily('PS-20', [
    'PSA::PS-20::M-7+8',
    'PSA::PS-20::M-9+10',
  ]))[0];
  const comparison = compareRelationshipTopologyFamilies(left, right);
  assert.equal(comparison.result, 'NO_MATCH');
  assert.deepEqual(left.assemblyMemberCountSpectrum, [1, 3]);
  assert.deepEqual(right.assemblyMemberCountSpectrum, [2, 2]);
  assert.ok(comparison.failedReasonCodes.includes('REL_ASSEMBLY_MEMBER_COUNT_SPECTRUM_EQUAL'));
});

test('missing explicit relationship authority is unavailable rather than mismatch', () => {
  const left = reportFamily('PS-1', ['PSA::PS-1::M-1']);
  const right = reportFamily('PS-2', [], { explicit: false, effectiveCount: 1 });
  const audit = buildSupportReportRelationshipTopologyAudit(left, right);
  assert.equal(audit.familyComparisons[0].result, 'UNAVAILABLE');
  assert.equal(audit.matches[0].result, 'UNAVAILABLE');
  assert.equal(audit.matches[0].reasonCode, 'REL_TOPOLOGY_UNAVAILABLE');
});

test('explicit family with unresolved geometry coverage requires review', () => {
  const left = reportFamily('PS-1', ['PSA::PS-1::M-1'], { geometryOnlyGroupIds: ['G2'] });
  const right = reportFamily('PS-2', ['PSA::PS-2::M-7']);
  const audit = buildSupportReportRelationshipTopologyAudit(left, right);
  assert.equal(audit.leftFamilies[0].authorityStatus, 'EXPLICIT_PARTIAL');
  assert.equal(audit.familyComparisons[0].result, 'REVIEW');
  assert.equal(audit.familyComparisons[0].reasonCode, 'REL_TOPOLOGY_REVIEW_PARTIAL_AUTHORITY');
});

test('attaching relationship topology leaves frozen structural matcher output reproducible', () => {
  const leftEvidence = familyEvidence('PS-11168', { area: '1885', serial: '8810320' });
  const rightEvidence = familyEvidence('PS-14168', { area: '1884', serial: '9910320' });
  const structural = buildSupportReportTypicalityAudit(leftEvidence, rightEvidence);
  const comparison = buildSupportReportTypicalityComparison(leftEvidence, rightEvidence, {
    leftReportBundle: reportFamily('PS-11168', ['PSA::PS-11168::M-1']),
    rightReportBundle: reportFamily('PS-14168', [], { explicit: false, effectiveCount: 1 }),
  });
  assert.deepEqual(comparison.structuralMatches, structural.matches);
  assert.equal(comparison.structuralMatches[0].result, 'TYPICAL');
  assert.equal(comparison.relationshipTopologyMatches[0].result, 'UNAVAILABLE');
  assert.equal(comparison.matches[0].result, 'TYPICAL');
  assert.equal(comparison.matches[0].rightFamilyId, 'PS-14168');
  assert.equal(comparison.matches[0].typicalityConsensus.result, 'RELATIONSHIP_UNAVAILABLE');
  assert.equal(comparison.matches[0].typicalityConsensus.confidence, 'MEDIUM');
});

test('informed relationship contradiction downgrades structural candidate to review conflict', () => {
  const leftEvidence = familyEvidence('PS-11168', { area: '1885', serial: '8810320' });
  const rightEvidence = familyEvidence('PS-14168', { area: '1884', serial: '9910320' });
  const comparison = buildSupportReportTypicalityComparison(leftEvidence, rightEvidence, {
    leftReportBundle: reportFamily('PS-11168', ['PSA::PS-11168::M-1']),
    rightReportBundle: reportFamily('PS-14168', ['PSA::PS-14168::M-7', 'PSA::PS-14168::M-8']),
  });
  assert.equal(comparison.structuralMatches[0].result, 'TYPICAL');
  assert.equal(comparison.relationshipTopologyAudit.familyComparisons[0].result, 'NO_MATCH');
  assert.equal(comparison.matches[0].result, 'REVIEW');
  assert.equal(comparison.matches[0].reasonCode, 'TYPICAL_CONSENSUS_RELATIONSHIP_CONFLICT');
  assert.equal(comparison.matches[0].typicalityConsensus.result, 'CONFLICT');
  assert.equal(projectionTest.reviewLabel(comparison.matches[0]),
    'REVIEW — Candidate PS-14168 withheld: structural and relationship-topology comparisons disagree.');
});

test('relationship-only candidate never promotes a structural rejection in conservative integration', () => {
  const structuralNoMatch = Object.freeze({
    leftFamilyId: 'PS-1', rightFamilyId: '', result: 'NO_MATCH', reasonCode: 'TYPICAL_REJECTED_TOPOLOGY',
  });
  const relationshipMatch = Object.freeze({
    leftFamilyId: 'PS-1', rightFamilyId: 'PS-2', result: 'MATCH', reasonCode: 'REL_TOPOLOGY_MATCH',
    candidateFamilyIds: Object.freeze(['PS-2']),
  });
  const resolved = projectionTest.applyRelationshipTopologyConsensus(structuralNoMatch, relationshipMatch, {
    familyComparisons: [],
  });
  assert.equal(resolved.result, 'NO_MATCH');
  assert.equal(resolved.typicalityConsensus.result, 'STRUCTURAL_RESULT_RETAINED_RELATIONSHIP_ONLY_MATCH_WITHHELD');
});

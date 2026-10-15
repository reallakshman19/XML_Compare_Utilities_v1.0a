import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSupportReportTypicalityAudit } from '../tabs/support-steel-relationship-builder/support-report-typicality.js';
import { buildSupportReportRelationshipTopologyAudit } from '../tabs/support-steel-relationship-builder/support-report-relationship-typicality.js';
import {
  buildSupportReportTypicalityComparison,
  _test as projectionTest,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';

function familyEvidence(familyId, offset = { x: 0, y: 0, z: 0 }) {
  const line = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  const source = [
    { branch: '/B1', points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
    { branch: '/B2', points: [{ x: 0, y: 200, z: 0 }, { x: 0, y: 300, z: 0 }] },
  ];
  const groups = [];
  for (const traversal of source) {
    traversal.points.forEach((raw, index) => {
      const point = Object.freeze({ x: raw.x + offset.x, y: raw.y + offset.y, z: raw.z + offset.z });
      const row = Object.freeze({
        guid: `${familyId}-${traversal.branch}-${index + 1}`,
        secondarySupportFamilyId: familyId,
        fullLineTag: line,
        branchNode: traversal.branch,
        clashPointGlobalMm: point,
      });
      groups.push(Object.freeze({
        groupId: `${familyId}::${traversal.branch}::L${index + 1}`,
        locationId: `${familyId}::${traversal.branch}::L${index + 1}`,
        secondarySupportFamilyId: familyId,
        fullLineTag: line,
        branchNodes: Object.freeze([traversal.branch]),
        primarySupportMemberIds: Object.freeze([`/${familyId}.${groups.length + 1}`]),
        representativeClashPointGlobalMm: point,
        clashPointsGlobalMm: Object.freeze([point]),
        locationNominalBoreMm: 50,
        evidenceRows: Object.freeze([row]),
      }));
    });
  }
  return Object.freeze({ groups: Object.freeze(groups), rawClashes: Object.freeze([]) });
}

function reportBundle(familyId, explicit = false) {
  const line = 'ASIM-1885-2"-P8810320-31441C4-HT-01';
  return Object.freeze({
    primarySupportFamilySummaries: Object.freeze([Object.freeze({
      familyId,
      totalSupportPointsOnSecondary: 4,
      explicitAssemblyIds: explicit
        ? Object.freeze([
          `PSA::${familyId}::M-1`,
          `PSA::${familyId}::M-2`,
          `PSA::${familyId}::M-3`,
          `PSA::${familyId}::M-4`,
        ])
        : Object.freeze([]),
      geometryOnlyGroupIds: Object.freeze([]),
      ambiguityCount: 0,
      explicitRelationshipFamilyAvailable: explicit,
      orphanRecoveredGroupIds: Object.freeze([]),
      orphanAmbiguousGroupIds: Object.freeze([]),
      orphanUnresolvedGroupIds: Object.freeze([]),
    })]),
    rows: Object.freeze([Object.freeze({
      rowId: `${familyId}::L1`,
      civilSecondarySupport: `${familyId}(REF)`,
      pipe: line,
      size: 50,
      totalSupportPointsOnSecondary: 4,
    })]),
  });
}

test('axis channel leaves structural and relationship matcher outputs independently reproducible', () => {
  const leftEvidence = familyEvidence('PS-11168');
  const rightEvidence = familyEvidence('PS-14168', { x: 500, y: -700, z: 200 });
  const leftReport = reportBundle('PS-11168', false);
  const rightReport = reportBundle('PS-14168', false);

  const structural = buildSupportReportTypicalityAudit(leftEvidence, rightEvidence);
  const relationship = buildSupportReportRelationshipTopologyAudit(leftReport, rightReport);
  const comparison = buildSupportReportTypicalityComparison(leftEvidence, rightEvidence, {
    leftReportBundle: leftReport,
    rightReportBundle: rightReport,
  });

  assert.deepEqual(comparison.structuralMatches, structural.matches);
  assert.deepEqual(comparison.relationshipTopologyMatches, relationship.matches);
  assert.equal(comparison.axisTypicalityMatches[0].result, 'MATCH');
  assert.equal(comparison.matches[0].result, 'TYPICAL');
  assert.equal(comparison.matches[0].rightFamilyId, 'PS-14168');
  assert.equal(comparison.matches[0].typicalityConsensus.result, 'STRUCTURAL_AXIS_AGREE');
  assert.equal(comparison.matches[0].typicalityConsensus.confidence, 'HIGH');
});

test('all three independently agreeing channels produce strongest consensus confidence', () => {
  const leftEvidence = familyEvidence('PS-11168');
  const rightEvidence = familyEvidence('PS-14168', { x: 500, y: -700, z: 200 });
  const comparison = buildSupportReportTypicalityComparison(leftEvidence, rightEvidence, {
    leftReportBundle: reportBundle('PS-11168', true),
    rightReportBundle: reportBundle('PS-14168', true),
  });
  assert.equal(comparison.structuralMatches[0].result, 'TYPICAL');
  assert.equal(comparison.relationshipTopologyMatches[0].result, 'MATCH');
  assert.equal(comparison.axisTypicalityMatches[0].result, 'MATCH');
  assert.equal(comparison.matches[0].result, 'TYPICAL');
  assert.equal(comparison.matches[0].typicalityConsensus.result, 'ALL_CHANNELS_AGREE');
  assert.equal(comparison.matches[0].typicalityConsensus.confidence, 'VERY_HIGH');
});

test('informed axis contradiction downgrades an eligible structural candidate to review conflict', () => {
  const structural = Object.freeze({
    leftFamilyId: 'PS-1',
    rightFamilyId: 'PS-2',
    result: 'TYPICAL',
    reasonCode: 'TYPICAL_ACCEPTED',
    typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'RELATIONSHIP_UNAVAILABLE', confidence: 'MEDIUM', basis: 'relationship unavailable' }),
  });
  const axisMatch = Object.freeze({
    leftFamilyId: 'PS-1',
    rightFamilyId: '',
    result: 'NO_MATCH',
    reasonCode: 'AXIS_TYPICALITY_NO_MATCH',
    bestCandidateFamilyId: 'PS-2',
  });
  const axisAudit = Object.freeze({ familyComparisons: Object.freeze([Object.freeze({
    auditId: 'AXISTYP-PS-1--PS-2',
    leftFamilyId: 'PS-1',
    rightFamilyId: 'PS-2',
    result: 'NO_MATCH',
    reasonCode: 'AXIS_TYPICALITY_GEOMETRY_MISMATCH',
    failedReasonCodes: Object.freeze(['AXIS_DN_NORMALIZED_SPACING_WITHIN_TOLERANCE']),
  })]) });
  const resolved = projectionTest.applyAxisTypicalityConsensus(structural, axisMatch, axisAudit);
  assert.equal(resolved.result, 'REVIEW');
  assert.equal(resolved.reasonCode, 'TYPICAL_CONSENSUS_AXIS_CONFLICT');
  assert.equal(resolved.typicalityConsensus.result, 'AXIS_CONFLICT');
  assert.equal(projectionTest.reviewLabel(resolved),
    'REVIEW — Candidate PS-2 withheld: structural and pipe-axis typicality comparisons disagree.');
});

test('axis-only candidate never promotes structural rejection', () => {
  const structuralNoMatch = Object.freeze({
    leftFamilyId: 'PS-1',
    rightFamilyId: '',
    result: 'NO_MATCH',
    reasonCode: 'TYPICAL_REJECTED_TOPOLOGY',
    typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'STRUCTURAL_RESULT_RETAINED', confidence: 'UNAVAILABLE', basis: 'no candidate' }),
  });
  const axisMatch = Object.freeze({
    leftFamilyId: 'PS-1',
    rightFamilyId: 'PS-2',
    result: 'MATCH',
    reasonCode: 'AXIS_TYPICALITY_MATCH',
    candidateFamilyIds: Object.freeze(['PS-2']),
  });
  const resolved = projectionTest.applyAxisTypicalityConsensus(structuralNoMatch, axisMatch, { familyComparisons: [] });
  assert.equal(resolved.result, 'NO_MATCH');
  assert.equal(resolved.typicalityConsensus.result, 'STRUCTURAL_RESULT_RETAINED_AXIS_ONLY_MATCH_WITHHELD');
});

test('axis unavailable preserves prior relationship consensus unchanged', () => {
  const priorConsensus = Object.freeze({
    schema: 'TypicalityConsensusV1',
    result: 'AGREE',
    confidence: 'HIGH',
    basis: 'structural and relationship agree',
  });
  const match = Object.freeze({
    leftFamilyId: 'PS-1',
    rightFamilyId: 'PS-2',
    result: 'TYPICAL',
    reasonCode: 'TYPICAL_ACCEPTED',
    typicalityConsensus: priorConsensus,
  });
  const resolved = projectionTest.applyAxisTypicalityConsensus(match, Object.freeze({
    leftFamilyId: 'PS-1', result: 'UNAVAILABLE', reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE', candidateFamilyIds: Object.freeze([]),
  }), Object.freeze({ familyComparisons: Object.freeze([]) }));
  assert.equal(resolved.result, 'TYPICAL');
  assert.equal(resolved.typicalityConsensus, priorConsensus);
  assert.equal(resolved.axisTypicality.result, 'UNAVAILABLE');
});
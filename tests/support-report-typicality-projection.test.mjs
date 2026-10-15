import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import { buildCanonicalTypicalityLocations } from '../tabs/support-steel-relationship-builder/support-report-typicality-location.js';
import {
  buildSupportReportTypicalityComparison,
  projectTypicalityOntoSupportReportBundle,
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  _test,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';

test('comparison profile preserves structural defaults when only location tolerance is overridden', () => {
  const profile = _test.comparisonProfile({
    pipingLocation: { geometryFingerprintToleranceMm: 125 },
  });
  assert.equal(profile.structural.geometryEnvelopeToleranceMm,
    SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.structural.geometryEnvelopeToleranceMm);
  assert.equal(profile.structural.pairDistanceP95ToleranceMm,
    SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.structural.pairDistanceP95ToleranceMm);
  assert.equal(profile.pipingLocation.geometryFingerprintToleranceMm, 125);
  assert.equal(profile.pipingLocation.assignmentWeights.supportTypeMember, 100000);
});

test('11168 -> 14168 preserves six structural location links while consensus withholds publication for axis review', () => {
  const leftEvidence = parseSupportReportClashXml(readFileSync('benchmarks/11168.xml', 'utf8'));
  const rightEvidence = parseSupportReportClashXml(readFileSync('benchmarks/14168.xml', 'utf8'));
  const leftReport = buildSupportReportBundle({ clashEvidence: leftEvidence });
  const typicalityAudit = buildSupportReportTypicalityComparison(leftEvidence, rightEvidence, {
    leftReportBundle: leftReport,
    profile: { pipingLocation: { geometryFingerprintToleranceMm: 1000 } },
  });
  const projected = projectTypicalityOntoSupportReportBundle(leftReport, typicalityAudit, leftEvidence);

  assert.equal(typicalityAudit.structuralMatches[0].result, 'TYPICAL');
  assert.equal(typicalityAudit.matches[0].result, 'REVIEW');
  assert.equal(typicalityAudit.matches[0].reasonCode, 'TYPICAL_CONSENSUS_AXIS_REVIEW');
  assert.equal(typicalityAudit.matches[0].typicalityConsensus.result, 'AXIS_REVIEW_REQUIRED');
  assert.equal(typicalityAudit.matches[0].rightFamilyId, 'PS-14168');
  assert.equal(typicalityAudit.locationAssignments.length, 1);
  assert.equal(typicalityAudit.locationAssignments[0].selectedAssignments.length, 6);
  assert.equal(projected.rows.length, 6);
  assert.equal(projected.typicalityAudit, typicalityAudit);

  for (const row of projected.rows) {
    assert.equal(row.typicalStructure, '');
    assert.equal(row.typicalityPublication.status, 'WITHHELD');
    assert.equal(row.typicalityPublication.reasonCode, 'TYPICAL_PUBLICATION_WITHHELD_REVIEW');
    assert.equal(row.pipingSupportArrangementMatch,
      'REVIEW — Candidate PS-14168 withheld: pipe-axis typicality evidence is incomplete or ambiguous.');
    assert.match(row.typicalityAuditId, /^TYP-PS-11168--PS-14168-L\d{2}$/);
  }
});

test('typicality display remarks are human-friendly while reason codes stay machine-readable', () => {
  assert.equal(_test.matchedLabel({ rightFamilyId: 'PS-14168' }),
    'MATCHED — Support arrangement matches PS-14168.');
  assert.equal(_test.limitedCheckLabel(),
    'LIMITED CHECK — Support type unavailable; topology-only comparison used.');
  assert.equal(_test.noMatchLabel({
    bestCandidateFamilyId: 'PS-10661',
    failedReasonCodes: [
      'STRUCT_MEMBER_MULTIPLICITY_EQUAL',
      'STRUCT_PIPE_CLASS_POPULATION_EQUAL',
      'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE',
      'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE',
    ],
  }), 'NOT MATCHED — Closest candidate PS-10661 was rejected: member count per support location, pipe class population, overall geometry envelope and relative spacing.');
  assert.equal(_test.ambiguousLabel({ candidateFamilyIds: ['PS-1943', 'PS-10048'] }),
    'AMBIGUOUS — 2 candidates remain: PS-1943, PS-10048.');
  assert.equal(_test.reviewLabel({ reasonCode: 'TYPICAL_REVIEW_MEMBER_MULTIPLICITY_CHANGED' }),
    'REVIEW — member count per support location differs.');
  assert.equal(_test.sentenceList(['a', 'b', 'c']), 'a, b and c');
});

test('location-aware group IDs bridge report support types and projection for repeated pipes', () => {
  const pipe = 'ASIM-1-2"-P8810001-31441C4-HT-01';
  const point = (x) => Object.freeze({ x, y: 0, z: 0 });
  const evidence = Object.freeze({
    groups: Object.freeze([
      Object.freeze({
        groupId: 'PS-1::PIPE::G1', locationId: 'PS-1::PIPE::L1', secondarySupportFamilyId: 'PS-1',
        fullLineTag: pipe, primarySupportMemberIds: Object.freeze(['/PS-1.1']),
        representativeClashPointGlobalMm: point(0), clashPointsGlobalMm: Object.freeze([point(0)]), evidenceRows: Object.freeze([]),
      }),
      Object.freeze({
        groupId: 'PS-1::PIPE::G2', locationId: 'PS-1::PIPE::L2', secondarySupportFamilyId: 'PS-1',
        fullLineTag: pipe, primarySupportMemberIds: Object.freeze(['/PS-1.2']),
        representativeClashPointGlobalMm: point(1000), clashPointsGlobalMm: Object.freeze([point(1000)]), evidenceRows: Object.freeze([]),
      }),
    ]),
    rawClashes: Object.freeze([]),
  });
  const report = Object.freeze({ rows: Object.freeze([
    Object.freeze({ rowId: 'PS-1::PIPE::G1', civilSecondarySupport: 'PS-1(REF)', pipe, supportType: 'REST-50' }),
    Object.freeze({ rowId: 'PS-1::PIPE::G2', civilSecondarySupport: 'PS-1(REF)', pipe, supportType: 'GUIDE-50' }),
  ]) });

  const aliased = _test.withLocationRowAliases(report, evidence);
  assert.deepEqual(aliased.rows.map((row) => [row.rowId, row.sourceReportRowId]), [
    ['PS-1::PIPE::L1', 'PS-1::PIPE::G1'],
    ['PS-1::PIPE::L2', 'PS-1::PIPE::G2'],
  ]);

  const locations = buildCanonicalTypicalityLocations(evidence, aliased);
  assert.deepEqual(locations.map((item) => [item.locationId, item.supportTypesRaw]), [
    ['PS-1::PIPE::L1', ['REST-50']],
    ['PS-1::PIPE::L2', ['GUIDE-50']],
  ]);

  assert.equal(_test.resolveRowLocation(report.rows[0], locations).locationId, 'PS-1::PIPE::L1');
  assert.equal(_test.resolveRowLocation(report.rows[1], locations).locationId, 'PS-1::PIPE::L2');
});

test('family match becomes review rather than typical when piping arrangement is partial', () => {
  const match = Object.freeze({
    leftFamilyId: 'PS-1', rightFamilyId: 'PS-2', auditId: 'TYP-PS-1--PS-2',
    result: 'TYPICAL', reasonCode: 'TYPICAL_ACCEPTED',
  });
  const resolved = _test.resolveFamilyMatch(match, { result: 'PARTIAL' });
  assert.equal(resolved.result, 'REVIEW');
  assert.equal(resolved.reasonCode, 'TYPICAL_REVIEW_SUPPORT_CONFIGURATION');
});

test('structural review candidate keeps deterministic location-level audit', () => {
  const point = (x) => Object.freeze({ x, y: 0, z: 0 });
  const family = (familyId, area, members) => Object.freeze({
    groups: Object.freeze([
      Object.freeze({
        groupId: `${familyId}::PIPE::L1`, locationId: `${familyId}::PIPE::L1`, secondarySupportFamilyId: familyId,
        fullLineTag: `ASIM-${area}-3"-D8810524-11261M7-PP${area === '1885' ? '-01' : ''}`,
        primarySupportMemberIds: Object.freeze(members[0]), representativeClashPointGlobalMm: point(0), evidenceRows: Object.freeze([]),
      }),
      Object.freeze({
        groupId: `${familyId}::PIPE::L2`, locationId: `${familyId}::PIPE::L2`, secondarySupportFamilyId: familyId,
        fullLineTag: `ASIM-${area}-3"-D8810524-11261M7-PP${area === '1885' ? '-01' : ''}`,
        primarySupportMemberIds: Object.freeze(members[1]), representativeClashPointGlobalMm: point(1000), evidenceRows: Object.freeze([]),
      }),
    ]),
    rawClashes: Object.freeze([]),
  });
  const left = family('PS-10669', '1884', [['/PS-10669.1', '/PS-10669.11'], []]);
  const right = family('PS-12669', '1885', [['/PS-12669.4'], []]);

  const audit = buildSupportReportTypicalityComparison(left, right);
  assert.equal(audit.structuralMatches[0].result, 'REVIEW');
  assert.equal(audit.structuralMatches[0].reasonCode, 'TYPICAL_REVIEW_MEMBER_TOPOLOGY_CHANGED');
  assert.deepEqual(audit.structuralMatches[0].failedReasonCodes, [
    'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL',
    'STRUCT_MEMBER_MULTIPLICITY_EQUAL',
  ]);
  assert.equal(audit.matches[0].result, 'REVIEW');
  assert.equal(audit.matches[0].rightFamilyId, 'PS-12669');
  assert.equal(audit.matches[0].locationAssignmentResult, 'PARTIAL');
  assert.equal(audit.matches[0].locationCorrespondenceStatus, 'DETERMINISTIC');
  assert.equal(audit.locationAssignments.length, 1);
  assert.equal(audit.locationAssignments[0].selectedAssignments.length, 2);
  assert.equal(audit.locationAssignments[0].selectedAssignments.filter((pair) => pair.signals.memberMultiplicity.result === 'FAIL').length, 1);
  assert.equal(audit.locationAssignments[0].selectedAssignments.every((pair) => pair.signals.pipeClass.result === 'PASS'), true);
});
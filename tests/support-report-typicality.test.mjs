import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { _test as clashContextTest } from '../tabs/support-steel-relationship-builder/support-report-clash-test-context.js';
import {
  buildSupportReportTypicalityAudit,
  compareSupportTypeMultisets,
  extractStructuralFamilyFeatures,
  familyNameEvidence,
  normalizePipeClass,
  supportTypeMultiset,
} from '../tabs/support-steel-relationship-builder/support-report-typicality.js';

const leftXml = readFileSync('benchmarks/11168.xml', 'utf8');
const rightXml = readFileSync('benchmarks/14168.xml', 'utf8');
const leftEvidence = parseSupportReportClashXml(leftXml);
const rightEvidence = parseSupportReportClashXml(rightXml);

function familyEvidence(families) {
  const groups = [];
  const rawClashes = [];
  for (const family of families) {
    family.points.forEach((point, index) => {
      const groupId = `${family.familyId}::${family.pipeTag}::LOC-${index + 1}`;
      groups.push(Object.freeze({
        groupId,
        locationId: groupId,
        secondarySupportFamilyId: family.familyId,
        fullLineTag: family.pipeTag,
        representativeClashPointGlobalMm: Object.freeze({ ...point }),
        primarySupportMemberIds: Object.freeze(family.members?.[index] || []),
        evidenceRows: Object.freeze([]),
      }));
      rawClashes.push(Object.freeze({
        guid: `${family.familyId}-${index + 1}`,
        familyIds: Object.freeze([family.familyId]),
        clashPointGlobalMm: Object.freeze({ ...point }),
      }));
    });
  }
  return Object.freeze({ groups: Object.freeze(groups), rawClashes: Object.freeze(rawClashes) });
}

test('raw clash evidence is retained but structural geometry is canonical-location based', () => {
  assert.equal(leftEvidence.rawClashCount, 41);
  assert.equal(rightEvidence.rawClashCount, 41);
  assert.equal(leftEvidence.rawClashes.length, 41);
  assert.equal(rightEvidence.rawClashes.length, 41);
  assert.equal(leftEvidence.rawClashes.every((item) => item.guid), true);
  assert.equal(rightEvidence.rawClashes.every((item) => item.guid), true);

  const synthetic = familyEvidence([{
    familyId: 'PS-10001',
    pipeTag: 'ASIM-1884-2"-P8810584-31441C4-HT',
    points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }],
  }]);
  const contaminated = Object.freeze({
    ...synthetic,
    rawClashes: Object.freeze([
      ...synthetic.rawClashes,
      Object.freeze({ guid: 'noise', familyIds: Object.freeze(['PS-10001']), clashPointGlobalMm: Object.freeze({ x: 99999, y: 99999, z: 99999 }) }),
    ]),
  });
  const [feature] = extractStructuralFamilyFeatures(contaminated);
  assert.equal(feature.rawClashPointCount, 3);
  assert.equal(feature.structuralGeometryPointCount, 2);
  assert.equal(feature.structuralGeometrySource, 'CANONICAL_LOCATION_REPRESENTATIVES');
  assert.deepEqual(feature.geometryEnvelopeMm.span, { x: 100, y: 0, z: 0 });
});

test('11168 and 14168 preserve five pipe classes across six physical locations and ten primary-support members', () => {
  const [left] = extractStructuralFamilyFeatures(leftEvidence);
  const [right] = extractStructuralFamilyFeatures(rightEvidence);

  assert.equal(left.familyId, 'PS-11168');
  assert.equal(right.familyId, 'PS-14168');
  assert.equal(left.locationCount, 6);
  assert.equal(right.locationCount, 6);
  assert.equal(left.structuralGeometryPointCount, 6);
  assert.equal(right.structuralGeometryPointCount, 6);
  assert.equal(left.numericPrimarySupportMemberCount, 10);
  assert.equal(right.numericPrimarySupportMemberCount, 10);
  assert.equal(left.memberMultiplicitySpectrum.length, 6);
  assert.deepEqual(left.memberMultiplicitySpectrum, [1, 1, 1, 2, 2, 3]);
  assert.deepEqual(left.memberMultiplicitySpectrum, right.memberMultiplicitySpectrum);
  assert.deepEqual(left.normalizedPipeClassPopulation, right.normalizedPipeClassPopulation);
  assert.equal(left.normalizedPipeClassPopulation.length, 6);
  assert.deepEqual([...new Set(left.normalizedPipeClassPopulation)], [
    '2|A|13421',
    '2|P|31441C4|HT',
    '4|P|31441C4|PP',
    '4|W|31441C4',
    '8|P|31441C4|PP',
  ]);
});

test('11168 -> 14168 benchmark is accepted from auditable structural signals', () => {
  const audit = buildSupportReportTypicalityAudit(leftEvidence, rightEvidence);
  assert.equal(audit.schema, 'SupportReportTypicalityAudit.v1');
  assert.equal(audit.leftFamilyCount, 1);
  assert.equal(audit.rightFamilyCount, 1);
  assert.equal(audit.matches.length, 1);
  assert.equal(audit.matches[0].leftFamilyId, 'PS-11168');
  assert.equal(audit.matches[0].rightFamilyId, 'PS-14168');
  assert.equal(audit.matches[0].auditId, 'TYP-PS-11168--PS-14168');
  assert.equal(audit.matches[0].result, 'TYPICAL');

  const comparison = audit.familyComparisons[0];
  assert.equal(comparison.result, 'TYPICAL');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_LOCATION_COUNT_EQUAL').result, 'PASS');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL').result, 'PASS');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_MEMBER_MULTIPLICITY_EQUAL').result, 'PASS');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_PIPE_CLASS_POPULATION_EQUAL').result, 'PASS');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE').result, 'PASS');

  const distance = comparison.signals.find((item) => item.reasonCode === 'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE');
  assert.equal(distance.result, 'PASS');
  assert.ok(distance.residual.median <= 10);
  assert.ok(distance.residual.p95 > 25);
  assert.ok(distance.residual.max <= 50);
  assert.equal(distance.p95Result, 'ADVISORY_EXCEEDED');
  assert.deepEqual(distance.policy, { median: 'HARD', p95: 'ADVISORY', max: 'HARD' });
});

test('canonical pipe line uses the parent piping-line node instead of branch spelling', () => {
  const path = [
    'ASIM-1884-CU-PI',
    'ASIM-1884-CU-PI-D',
    'ASIM-1884-3"-D8810524-11261M7-PP',
    'ASIM-1884-3"-D-8810524-11261M7-PP/B1',
    'PS-10076.1',
  ];
  assert.equal(
    clashContextTest.canonicalPipeLineTag(path, 'ASIM-1884-3"-D-8810524-11261M7-PP/B1', ''),
    'ASIM-1884-3"-D8810524-11261M7-PP',
  );
});

test('pipe normalization understands 1884 and 1885 line-tag grammars', () => {
  assert.equal(normalizePipeClass('ASIM-1884-3"-D-8810524-11261M7-PP'), '3|D|11261M7|PP');
  assert.equal(normalizePipeClass('ASIM-1885-3"-D8810275-11261M7-PP-01'), '3|D|11261M7|PP');
  assert.equal(normalizePipeClass('ASIM-1884-2"-P-8810584-31441C4-HT'), '2|P|31441C4|HT');
  assert.equal(normalizePipeClass('ASIM-1885-2"-P8810384-31441C4-HT-01'), '2|P|31441C4|HT');
  assert.equal(normalizePipeClass('ASIM-1884-4"-B-8810102-11441T3-PP'), '4|B|11441T3|PP');
  assert.equal(normalizePipeClass('ASIM-1885-4"-B8810052-11441T3-PP-01'), '4|B|11441T3|PP');
  assert.equal(normalizePipeClass('ASIM-1884-2"-A-8010545-13421'), '2|A|13421');
  assert.equal(normalizePipeClass('ASIM-1885-2"-A8010745-13421-01'), '2|A|13421');
  assert.equal(normalizePipeClass('ASIM-1884-4"-W8810226-31441C4'), '4|W|31441C4');
  assert.equal(normalizePipeClass('ASIM-1885-4"-W8810126-31441C4-03'), '4|W|31441C4');
  assert.equal(normalizePipeClass('ASIM-1884-6"-S-8810215-91261M7-HC'), '6|S|91261M7|HC');
  assert.equal(normalizePipeClass('ASIM-1885-6"-S8811951-91261M7-HC-01'), '6|S|91261M7|HC');
});

test('single-location family pair-distance is unavailable and non-blocking', () => {
  const left = familyEvidence([{
    familyId: 'PS-10001', pipeTag: 'ASIM-1884-2"-A8010545-13421', points: [{ x: 0, y: 0, z: 0 }],
  }]);
  const right = familyEvidence([{
    familyId: 'PS-12001', pipeTag: 'ASIM-1885-2"-A8010745-13421-01', points: [{ x: 5000, y: -9000, z: 2000 }],
  }]);
  const audit = buildSupportReportTypicalityAudit(left, right);
  assert.equal(audit.matches[0].result, 'TYPICAL');
  const pair = audit.familyComparisons[0].signals.find((item) => item.reasonCode === 'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE');
  assert.equal(pair.result, 'UNAVAILABLE');
  assert.equal(pair.p95Result, 'UNAVAILABLE');
});

test('strong PS family-name evidence breaks ties only after structural eligibility', () => {
  const left = familyEvidence([{
    familyId: 'PS-10076',
    pipeTag: 'ASIM-1884-3"-D8810524-11261M7-PP',
    points: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }],
  }]);
  const right = familyEvidence([
    {
      familyId: 'PS-12076',
      pipeTag: 'ASIM-1885-3"-D8810275-11261M7-PP-01',
      points: [{ x: 10, y: 0, z: 0 }, { x: 1010, y: 0, z: 0 }],
    },
    {
      familyId: 'PS-19999',
      pipeTag: 'ASIM-1885-3"-D8810999-11261M7-PP-01',
      points: [{ x: 10, y: 0, z: 0 }, { x: 1010, y: 0, z: 0 }],
    },
  ]);
  const audit = buildSupportReportTypicalityAudit(left, right);
  assert.equal(audit.familyComparisons.filter((item) => item.result === 'TYPICAL').length, 2);
  assert.equal(audit.matches[0].result, 'TYPICAL');
  assert.equal(audit.matches[0].rightFamilyId, 'PS-12076');
  assert.equal(audit.matches[0].reasonCode, 'TYPICAL_ACCEPTED_FAMILY_ID_TIEBREAK');
  assert.equal(familyNameEvidence('PS-10076', 'PS-12076').class, 'ONE_POSITION_DIFFERENT');
});

test('strong counterpart with only member multiplicity changed is REVIEW, never TYPICAL', () => {
  const left = familyEvidence([{
    familyId: 'PS-10010',
    pipeTag: 'ASIM-1884-2"-A8010545-13421',
    points: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }],
    members: [['/PS-10010.1', '/PS-10010.2'], []],
  }]);
  const right = familyEvidence([{
    familyId: 'PS-12010',
    pipeTag: 'ASIM-1885-2"-A8010745-13421-01',
    points: [{ x: 2000, y: -3000, z: 500 }, { x: 3000, y: -3000, z: 500 }],
    members: [['/PS-12010.1'], ['/PS-12010.2']],
  }]);
  const audit = buildSupportReportTypicalityAudit(left, right);
  const comparison = audit.familyComparisons[0];
  assert.equal(comparison.result, 'NOT_TYPICAL');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL').result, 'PASS');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_MEMBER_MULTIPLICITY_EQUAL').result, 'FAIL');
  assert.equal(audit.matches[0].result, 'REVIEW');
  assert.equal(audit.matches[0].rightFamilyId, 'PS-12010');
  assert.equal(audit.matches[0].reasonCode, 'TYPICAL_REVIEW_MEMBER_MULTIPLICITY_CHANGED');
  assert.deepEqual(audit.matches[0].failedReasonCodes, ['STRUCT_MEMBER_MULTIPLICITY_EQUAL']);
});

test('same multiplicity with different unique member reuse is REVIEW, never TYPICAL', () => {
  const left = familyEvidence([{
    familyId: 'PS-10020',
    pipeTag: 'ASIM-1884-2"-A8010545-13421',
    points: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }],
    members: [['/PS-10020.1'], ['/PS-10020.1']],
  }]);
  const right = familyEvidence([{
    familyId: 'PS-12020',
    pipeTag: 'ASIM-1885-2"-A8010745-13421-01',
    points: [{ x: 2000, y: 1000, z: 500 }, { x: 3000, y: 1000, z: 500 }],
    members: [['/PS-12020.1'], ['/PS-12020.2']],
  }]);
  const audit = buildSupportReportTypicalityAudit(left, right);
  const comparison = audit.familyComparisons[0];
  assert.equal(comparison.result, 'NOT_TYPICAL');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL').result, 'FAIL');
  assert.equal(comparison.signals.find((item) => item.reasonCode === 'STRUCT_MEMBER_MULTIPLICITY_EQUAL').result, 'PASS');
  assert.equal(audit.matches[0].result, 'REVIEW');
  assert.equal(audit.matches[0].rightFamilyId, 'PS-12020');
  assert.equal(audit.matches[0].reasonCode, 'TYPICAL_REVIEW_UNIQUE_MEMBER_COUNT_CHANGED');
  assert.deepEqual(audit.matches[0].failedReasonCodes, ['STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL']);
});

test('NO_MATCH retains the best rejected candidate audit trail when family-name evidence is weak', () => {
  const left = familyEvidence([{
    familyId: 'PS-10010', pipeTag: 'ASIM-1884-2"-A8010545-13421', points: [{ x: 0, y: 0, z: 0 }], members: [['/PS-10010.1']],
  }]);
  const right = familyEvidence([{
    familyId: 'PS-13011', pipeTag: 'ASIM-1885-2"-A8010745-13421-01', points: [{ x: 0, y: 0, z: 0 }], members: [[]],
  }]);
  const audit = buildSupportReportTypicalityAudit(left, right);
  assert.equal(audit.matches[0].result, 'NO_MATCH');
  assert.equal(audit.matches[0].bestCandidateFamilyId, 'PS-13011');
  assert.equal(audit.matches[0].auditId, 'TYP-PS-10010--PS-13011');
  assert.deepEqual(audit.matches[0].failedReasonCodes, [
    'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL',
    'STRUCT_MEMBER_MULTIPLICITY_EQUAL',
  ]);
});

test('SUPPORT TYPE canonicalization is order-independent and duplicate-sensitive', () => {
  assert.deepEqual(supportTypeMultiset('REST-50, BP-50, GUIDE-50'), {
    'BP-50': 1,
    'GUIDE-50': 1,
    'REST-50': 1,
  });
  const exact = compareSupportTypeMultisets(
    'REST-50, BP-50, GUIDE-50',
    'GUIDE-50, REST-50, BP-50',
  );
  assert.equal(exact.result, 'EXACT');
  assert.deepEqual(exact.reasonCodes, ['SUPPORT_TYPE_MULTISET_EXACT']);

  const duplicateMismatch = compareSupportTypeMultisets(
    'REST-15, BP-15, GUIDE-15, REST-15, GUIDE-15, BP-15',
    'REST-15, BP-15, GUIDE-15',
  );
  assert.equal(duplicateMismatch.result, 'PARTIAL');
  assert.deepEqual(duplicateMismatch.missingFromRight, [
    { type: 'BP-15', count: 1 },
    { type: 'GUIDE-15', count: 1 },
    { type: 'REST-15', count: 1 },
  ]);
  assert.deepEqual(duplicateMismatch.extraInRight, []);
  assert.deepEqual(duplicateMismatch.reasonCodes, ['SUPPORT_TYPE_MEMBER_MISSING']);
});
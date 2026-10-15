import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStructuralAxisDisagreementMatrix,
  buildTopologyScreenedAxisSelection,
  classifyConservativeTopologyExclusion,
  classifyStructuralAxisDisagreement,
  summarizeAxisTypicalityAudit,
} from './support-report-typicality-disagreement-matrix.mjs';

const structural = (result, rightFamilyId = '', extra = {}) => Object.freeze({
  leftFamilyId: 'PS-1', result, rightFamilyId, reasonCode: `STRUCT_${result}`, ...extra,
});
const axis = (result, rightFamilyId = '', extra = {}) => Object.freeze({
  leftFamilyId: 'PS-1', result, rightFamilyId, reasonCode: `AXIS_${result}`, ...extra,
});
const axisFamily = (familyId, extra = {}) => Object.freeze({
  familyId,
  authorityStatus: 'UNAVAILABLE',
  sourceLocationCount: 2,
  sourceTraversalCount: 1,
  ambiguousGroupTraversalCount: 0,
  locationsPerTraversalSpectrum: Object.freeze([2]),
  returnMultiplicitySpectrum: Object.freeze([1]),
  ...extra,
});

test('A/B/C/D classes preserve independent structural and axis decisions', () => {
  assert.equal(classifyStructuralAxisDisagreement(structural('TYPICAL', 'PS-2'), axis('MATCH', 'PS-2')),
    'A_BOTH_MATCH_SAME_CANDIDATE');
  assert.equal(classifyStructuralAxisDisagreement(structural('TYPICAL', 'PS-2'), axis('NO_MATCH')),
    'B_STRUCTURAL_MATCH_AXIS_REJECT');
  assert.equal(classifyStructuralAxisDisagreement(structural('NO_MATCH'), axis('MATCH', 'PS-2')),
    'C_STRUCTURAL_REJECT_AXIS_MATCH');
  assert.equal(classifyStructuralAxisDisagreement(structural('NO_MATCH'), axis('NO_MATCH')),
    'D_BOTH_REJECT');
});

test('different accepted candidates are conflict rather than A agreement', () => {
  assert.equal(classifyStructuralAxisDisagreement(structural('TYPICAL', 'PS-2'), axis('MATCH', 'PS-3')),
    'MATCH_CONFLICT_DIFFERENT_CANDIDATE');
});

test('UNAVAILABLE and REVIEW stay outside A/B/C/D instead of being treated as rejection', () => {
  assert.equal(classifyStructuralAxisDisagreement(structural('TYPICAL', 'PS-2'), axis('UNAVAILABLE')),
    'STRUCTURAL_TYPICAL_AXIS_UNAVAILABLE');
  assert.equal(classifyStructuralAxisDisagreement(structural('REVIEW', 'PS-2'), axis('MATCH', 'PS-2')),
    'STRUCTURAL_REVIEW_AXIS_MATCH');
});

test('matrix exposes B/C cases as the priority calibration set', () => {
  const matrix = buildStructuralAxisDisagreementMatrix([
    { leftFamilyId: 'PS-1', rightFamilyId: 'PS-11', result: 'TYPICAL', reasonCode: 'TYPICAL_ACCEPTED' },
    { leftFamilyId: 'PS-2', rightFamilyId: '', result: 'NO_MATCH', reasonCode: 'TYPICAL_REJECTED' },
    { leftFamilyId: 'PS-3', rightFamilyId: 'PS-13', result: 'TYPICAL', reasonCode: 'TYPICAL_ACCEPTED' },
  ], [
    { leftFamilyId: 'PS-1', rightFamilyId: '', result: 'NO_MATCH', reasonCode: 'AXIS_TYPICALITY_NO_MATCH' },
    { leftFamilyId: 'PS-2', rightFamilyId: 'PS-12', result: 'MATCH', reasonCode: 'AXIS_TYPICALITY_MATCH' },
    { leftFamilyId: 'PS-3', rightFamilyId: 'PS-13', result: 'MATCH', reasonCode: 'AXIS_TYPICALITY_MATCH' },
  ]);

  assert.deepEqual(matrix.classificationHistogram, {
    A_BOTH_MATCH_SAME_CANDIDATE: 1,
    B_STRUCTURAL_MATCH_AXIS_REJECT: 1,
    C_STRUCTURAL_REJECT_AXIS_MATCH: 1,
  });
  assert.deepEqual(matrix.priorityCalibrationCases.map((item) => item.leftFamilyId), ['PS-1', 'PS-2']);
});

test('axis audit diagnostics distinguish missing feature authority from candidate-selection review', () => {
  const diagnostics = summarizeAxisTypicalityAudit({
    leftFamilies: [
      {
        familyId: 'PS-1', authorityStatus: 'UNAVAILABLE', trustedTraversalCount: 0, normalizedPairCount: 0,
        relativeAxisAngleCount: 0, unavailableTraversalCount: 1, ambiguousGroupTraversalCount: 0,
        missingBorePairOpportunityCount: 0, sourceLocationCount: 1, sourceTraversalCount: 1,
        locationsPerTraversalSpectrum: [1], returnMultiplicitySpectrum: [1],
      },
      {
        familyId: 'PS-2', authorityStatus: 'COMPLETE', trustedTraversalCount: 2, normalizedPairCount: 1,
        relativeAxisAngleCount: 1, unavailableTraversalCount: 0, ambiguousGroupTraversalCount: 0,
        missingBorePairOpportunityCount: 0, sourceLocationCount: 2, sourceTraversalCount: 1,
        locationsPerTraversalSpectrum: [2], returnMultiplicitySpectrum: [1],
      },
    ],
    rightFamilies: [{
      familyId: 'PS-3', authorityStatus: 'PARTIAL', trustedTraversalCount: 1, normalizedPairCount: 1,
      relativeAxisAngleCount: 0, unavailableTraversalCount: 1, ambiguousGroupTraversalCount: 0,
      missingBorePairOpportunityCount: 1, sourceLocationCount: 2, sourceTraversalCount: 1,
      locationsPerTraversalSpectrum: [2], returnMultiplicitySpectrum: [1],
    }],
    familyComparisons: [
      { leftFamilyId: 'PS-1', rightFamilyId: 'PS-3', result: 'UNAVAILABLE', reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE', availability: { result: 'UNAVAILABLE' }, mismatchCount: 0, unavailableReasonCodes: [], failedReasonCodes: [], auditId: 'A1' },
      { leftFamilyId: 'PS-2', rightFamilyId: 'PS-3', result: 'REVIEW', reasonCode: 'AXIS_TYPICALITY_REVIEW_PARTIAL_EVIDENCE', availability: { result: 'REVIEW' }, mismatchCount: 0, unavailableReasonCodes: [], failedReasonCodes: [], auditId: 'A2' },
      { leftFamilyId: 'PS-2', rightFamilyId: 'PS-4', result: 'MATCH', reasonCode: 'AXIS_TYPICALITY_MATCH', availability: { result: 'AVAILABLE' }, mismatchCount: 0, unavailableReasonCodes: [], failedReasonCodes: [], auditId: 'A3' },
    ],
    matches: [
      { leftFamilyId: 'PS-1', result: 'UNAVAILABLE', reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE', candidateFamilyIds: [] },
      { leftFamilyId: 'PS-2', result: 'REVIEW', reasonCode: 'AXIS_TYPICALITY_AMBIGUOUS_MATCHES', candidateFamilyIds: ['PS-3', 'PS-4'] },
    ],
  });

  assert.deepEqual(diagnostics.leftAuthorityStatusHistogram, { COMPLETE: 1, UNAVAILABLE: 1 });
  assert.deepEqual(diagnostics.leftEvidenceGapFlagHistogram, {
    COMPLETE_AUTHORITY: 1,
    NO_INTRINSIC_GEOMETRY: 1,
    NO_TRUSTED_TRAVERSAL_AXIS: 1,
    UNAVAILABLE_TRAVERSAL: 1,
  });
  assert.deepEqual(diagnostics.rightEvidenceGapFlagHistogram, {
    MISSING_BORE_PAIR_OPPORTUNITY: 1,
    UNAVAILABLE_TRAVERSAL: 1,
  });
  assert.deepEqual(diagnostics.pairResultHistogram, { MATCH: 1, REVIEW: 1, UNAVAILABLE: 1 });
  assert.deepEqual(diagnostics.pairAvailabilityHistogram, { AVAILABLE: 1, REVIEW: 1, UNAVAILABLE: 1 });
  assert.deepEqual(diagnostics.selectedReasonHistogram, {
    AXIS_TYPICALITY_AMBIGUOUS_MATCHES: 1,
    AXIS_TYPICALITY_UNAVAILABLE: 1,
  });
  assert.deepEqual(diagnostics.selectedCandidateCountHistogram, { '0': 1, '2': 1 });
});

test('safe topology exclusion uses exact location evidence even when axis geometry is unavailable', () => {
  const left = axisFamily('PS-1', { sourceLocationCount: 2 });
  const right = axisFamily('PS-2', { sourceLocationCount: 3 });
  assert.deepEqual(classifyConservativeTopologyExclusion(left, right), {
    excluded: true,
    reasonCode: 'AXIS_TOPOLOGY_SAFE_EXCLUDE_LOCATION_COUNT',
  });
});

test('safe traversal exclusions require complete traversal identity and preserve ambiguous candidates', () => {
  const left = axisFamily('PS-1', { sourceTraversalCount: 1, locationsPerTraversalSpectrum: [2] });
  const right = axisFamily('PS-2', { sourceTraversalCount: 2, locationsPerTraversalSpectrum: [1, 1] });
  assert.equal(classifyConservativeTopologyExclusion(left, right).reasonCode,
    'AXIS_TOPOLOGY_SAFE_EXCLUDE_TRAVERSAL_COUNT');

  const ambiguousRight = axisFamily('PS-2', {
    sourceTraversalCount: 2,
    locationsPerTraversalSpectrum: [1, 1],
    ambiguousGroupTraversalCount: 1,
  });
  assert.deepEqual(classifyConservativeTopologyExclusion(left, ambiguousRight), {
    excluded: false,
    reasonCode: 'AXIS_TOPOLOGY_RETAIN_TRAVERSAL_INCOMPLETE',
  });
});

test('return multiplicity only excludes when return topology is complete', () => {
  const left = axisFamily('PS-1', {
    sourceLocationCount: 3,
    sourceTraversalCount: 2,
    locationsPerTraversalSpectrum: [1, 2],
    returnMultiplicitySpectrum: [2],
  });
  const right = axisFamily('PS-2', {
    sourceLocationCount: 3,
    sourceTraversalCount: 2,
    locationsPerTraversalSpectrum: [1, 2],
    returnMultiplicitySpectrum: [1, 1],
  });
  assert.equal(classifyConservativeTopologyExclusion(left, right).reasonCode,
    'AXIS_TOPOLOGY_SAFE_EXCLUDE_RETURN_MULTIPLICITY');

  const incompleteRight = axisFamily('PS-2', {
    sourceLocationCount: 3,
    sourceTraversalCount: 2,
    locationsPerTraversalSpectrum: [1, 2],
    returnMultiplicitySpectrum: [1],
  });
  assert.deepEqual(classifyConservativeTopologyExclusion(left, incompleteRight), {
    excluded: false,
    reasonCode: 'AXIS_TOPOLOGY_RETAIN_RETURN_INCOMPLETE',
  });
});

test('diagnostic topology screening can unlock a proven match without fabricating NO_MATCH', () => {
  const left = axisFamily('PS-1', { authorityStatus: 'COMPLETE' });
  const compatible = axisFamily('PS-2', { authorityStatus: 'COMPLETE' });
  const impossibleUnassessed = axisFamily('PS-3', { sourceLocationCount: 3 });
  const audit = {
    leftFamilies: [left],
    rightFamilies: [compatible, impossibleUnassessed],
    familyComparisons: [
      {
        auditId: 'MATCH-1', leftFamilyId: 'PS-1', rightFamilyId: 'PS-2', result: 'MATCH',
        reasonCode: 'AXIS_TYPICALITY_MATCH', mismatchCount: 0, unavailableReasonCodes: [], failedReasonCodes: [],
      },
      {
        auditId: 'UNAVAILABLE-1', leftFamilyId: 'PS-1', rightFamilyId: 'PS-3', result: 'UNAVAILABLE',
        reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE', mismatchCount: 0, unavailableReasonCodes: [], failedReasonCodes: [],
      },
    ],
    matches: [{
      leftFamilyId: 'PS-1', result: 'REVIEW', reasonCode: 'AXIS_TYPICALITY_REVIEW_UNASSESSED_CANDIDATES',
      rightFamilyId: '', candidateFamilyIds: ['PS-2', 'PS-3'], candidateAuditIds: ['MATCH-1', 'UNAVAILABLE-1'],
    }],
  };

  const screened = buildTopologyScreenedAxisSelection(audit);
  assert.equal(screened.safelyExcludedCandidateCount, 1);
  assert.equal(screened.retainedUnassessedCandidateCount, 0);
  assert.equal(screened.decisivenessUnlockedCount, 1);
  assert.deepEqual(screened.screenedSelectedResultHistogram, { MATCH: 1 });
  assert.equal(screened.decisivenessUnlockedFamilies[0].screened.candidateFamilyId, 'PS-2');

  const allImpossible = buildTopologyScreenedAxisSelection({
    leftFamilies: [left],
    rightFamilies: [impossibleUnassessed],
    familyComparisons: [audit.familyComparisons[1]],
    matches: [{ leftFamilyId: 'PS-1', result: 'UNAVAILABLE', reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE' }],
  });
  assert.deepEqual(allImpossible.screenedSelectedResultHistogram, { UNAVAILABLE: 1 });
  assert.equal(allImpossible.decisivenessUnlockedCount, 0);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectTypicalityOntoSupportReportBundle,
  _test as projectionTest,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';

function structural(result = 'TYPICAL', reasonCode = 'TYPICAL_MATCH', rightFamilyId = 'PS-200') {
  return Object.freeze({
    leftFamilyId: 'PS-100',
    rightFamilyId,
    result,
    reasonCode,
    auditId: 'STRUCT-PS-100--PS-200',
    candidateFamilyIds: rightFamilyId ? Object.freeze([rightFamilyId]) : Object.freeze([]),
    candidateAuditIds: Object.freeze([]),
    failedReasonCodes: Object.freeze([]),
  });
}

function channel(result, family = 'PS-200', reasonCode = '') {
  return Object.freeze({
    result,
    reasonCode: reasonCode || `${result}_REASON`,
    auditId: `${result}-AUDIT`,
    selectedResult: result,
    selectedFamilyId: result === 'MATCH' ? family : '',
    selectedCandidateFamilyIds: result === 'MATCH' ? Object.freeze([family]) : Object.freeze([]),
    failedReasonCodes: Object.freeze([]),
  });
}

function finalMatch(overrides = {}) {
  return Object.freeze({
    ...structural(),
    relationshipTopology: channel('MATCH'),
    axisTypicality: channel('MATCH'),
    typicalityConsensus: Object.freeze({
      schema: 'TypicalityConsensusV1',
      result: 'ALL_CHANNELS_AGREE',
      confidence: 'VERY_HIGH',
      basis: 'All channels agree.',
    }),
    ...overrides,
  });
}

function project(match) {
  const structuralMatch = structural();
  return projectTypicalityOntoSupportReportBundle({
    schema: 'SupportReportBundle.v1',
    rows: [Object.freeze({ rowId: 'ROW-1', civilSecondarySupport: 'PS-100', pipe: 'LINE-1' })],
  }, {
    matches: Object.freeze([match]),
    structuralMatches: Object.freeze([structuralMatch]),
    arrangementResolvedStructuralMatches: Object.freeze([structuralMatch]),
    locationAssignments: Object.freeze([]),
  }, { groups: Object.freeze([]) });
}

test('A: all three channels agreeing publishes Column 22 and records VERY_HIGH consensus', () => {
  const report = project(finalMatch());
  const row = report.rows[0];
  assert.equal(row.typicalStructure, 'PS-200');
  assert.equal(row.typicalityPublication.status, 'PUBLISHED');
  assert.equal(row.typicalityPublication.reasonCode, 'TYPICAL_PUBLICATION_FINAL_TYPICAL');
  assert.equal(row.typicalityDecisionAudit.consensus.result, 'ALL_CHANNELS_AGREE');
  assert.equal(row.typicalityDecisionAudit.consensus.confidence, 'VERY_HIGH');
});

test('B/C/D: final TYPICAL remains publishable when secondary evidence is unavailable', () => {
  for (const match of [
    finalMatch({
      relationshipTopology: channel('UNAVAILABLE', '', 'REL_TOPOLOGY_UNAVAILABLE'),
      typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'STRUCTURAL_AXIS_AGREE', confidence: 'HIGH', basis: '' }),
    }),
    finalMatch({
      axisTypicality: channel('UNAVAILABLE', '', 'AXIS_TYPICALITY_UNAVAILABLE'),
      typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'AGREE', confidence: 'HIGH', basis: '' }),
    }),
    finalMatch({
      relationshipTopology: channel('UNAVAILABLE', '', 'REL_TOPOLOGY_UNAVAILABLE'),
      axisTypicality: channel('UNAVAILABLE', '', 'AXIS_TYPICALITY_UNAVAILABLE'),
      typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'RELATIONSHIP_UNAVAILABLE', confidence: 'MEDIUM', basis: '' }),
    }),
  ]) {
    assert.equal(projectionTest.typicalityPublicationDecision(match).status, 'PUBLISHED');
  }
});

test('E/F/G/H: every final REVIEW withholds Column 22 even when a retained candidate exists', () => {
  const reasons = [
    'TYPICAL_CONSENSUS_RELATIONSHIP_CONFLICT',
    'TYPICAL_CONSENSUS_AXIS_CONFLICT',
    'TYPICAL_CONSENSUS_MULTI_CHANNEL_CONFLICT',
    'TYPICAL_REVIEW_SUPPORT_CONFIGURATION',
  ];
  for (const reasonCode of reasons) {
    const match = finalMatch({ result: 'REVIEW', reasonCode });
    const report = project(match);
    assert.equal(report.rows[0].typicalStructure, '');
    assert.equal(report.rows[0].typicalityPublication.status, 'WITHHELD');
    assert.equal(report.rows[0].typicalityPublication.reasonCode, 'TYPICAL_PUBLICATION_WITHHELD_REVIEW');
    assert.equal(report.rows[0].typicalityDecisionAudit.final.candidateFamilyId, 'PS-200');
  }
});

test('I/J: ambiguous/no-match/secondary-only cases cannot populate Column 22', () => {
  const cases = [
    structural('AMBIGUOUS', 'TYPICAL_AMBIGUOUS', ''),
    structural('NO_MATCH', 'TYPICAL_NO_MATCH', ''),
    Object.freeze({
      ...structural('NO_MATCH', 'TYPICAL_NO_MATCH', ''),
      relationshipTopology: channel('MATCH'),
      axisTypicality: channel('MATCH'),
      typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'STRUCTURAL_RESULT_RETAINED_AXIS_ONLY_MATCH_WITHHELD', confidence: 'LOW', basis: '' }),
    }),
  ];
  for (const match of cases) assert.equal(projectionTest.typicalityPublicationDecision(match).status, 'WITHHELD');
});

test('Column 23 wording exposes agreement and evidence limitations', () => {
  assert.match(projectionTest.matchedLabel(finalMatch()), /Structural, relationship-topology and pipe-axis comparisons agree on PS-200/);
  assert.match(projectionTest.matchedLabel(finalMatch({
    relationshipTopology: channel('UNAVAILABLE', '', 'REL_TOPOLOGY_UNAVAILABLE'),
    typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'STRUCTURAL_AXIS_AGREE', confidence: 'HIGH', basis: '' }),
  })), /relationship topology unavailable/);
  assert.match(projectionTest.matchedLabel(finalMatch({
    axisTypicality: channel('UNAVAILABLE', '', 'AXIS_TYPICALITY_UNAVAILABLE'),
    typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'AGREE', confidence: 'HIGH', basis: '' }),
  })), /pipe-axis evidence unavailable/);
  assert.match(projectionTest.matchedLabel(finalMatch({
    relationshipTopology: channel('UNAVAILABLE', '', 'REL_TOPOLOGY_UNAVAILABLE'),
    axisTypicality: channel('UNAVAILABLE', '', 'AXIS_TYPICALITY_UNAVAILABLE'),
    typicalityConsensus: Object.freeze({ schema: 'TypicalityConsensusV1', result: 'RELATIONSHIP_UNAVAILABLE', confidence: 'MEDIUM', basis: '' }),
  })), /relationship topology and pipe-axis evidence unavailable/);
});

test('Column 23 review wording names the retained candidate while making withholding explicit', () => {
  const relationshipConflict = finalMatch({ result: 'REVIEW', reasonCode: 'TYPICAL_CONSENSUS_RELATIONSHIP_CONFLICT' });
  const axisConflict = finalMatch({ result: 'REVIEW', reasonCode: 'TYPICAL_CONSENSUS_AXIS_CONFLICT' });
  const multiConflict = finalMatch({ result: 'REVIEW', reasonCode: 'TYPICAL_CONSENSUS_MULTI_CHANNEL_CONFLICT' });
  assert.match(projectionTest.reviewLabel(relationshipConflict), /Candidate PS-200 withheld/);
  assert.match(projectionTest.reviewLabel(axisConflict), /Candidate PS-200 withheld/);
  assert.match(projectionTest.reviewLabel(multiConflict), /Candidate PS-200 withheld/);
});

test('row decision audit keeps structural, relationship, axis, consensus and publication independently visible', () => {
  const match = finalMatch();
  const publication = projectionTest.typicalityPublicationDecision(match);
  const audit = projectionTest.buildRowTypicalityDecisionAudit(match, structural(), structural(), publication);
  assert.equal(audit.schema, 'SupportReportTypicalityRowAudit.v1');
  assert.equal(audit.structural.result, 'TYPICAL');
  assert.equal(audit.relationshipTopology.result, 'MATCH');
  assert.equal(audit.axisTypicality.result, 'MATCH');
  assert.equal(audit.consensus.result, 'ALL_CHANNELS_AGREE');
  assert.equal(audit.publication.status, 'PUBLISHED');
});
